import { prisma } from '@lspot/database';
import { roundTo2Decimals, PaymentMethod } from '@lspot/shared';
import { LEGACY_DEMO_CUSTOMER_IDS, LEGACY_DEMO_SALE_IDS } from './finance.service.js';

export class CreditService {
  async getCustomers(tenantId: string) {
    const customers = await prisma.customer.findMany({
      where: {
        tenantId,
        isActive: true,
        id: { notIn: LEGACY_DEMO_CUSTOMER_IDS }
      },
      orderBy: { name: 'asc' }
    });

    return customers.map((c: any) => {
      const limit = Number(c.creditLimit);
      const balance = Number(c.currentBalance);
      const available = Math.max(0, limit - balance);
      return {
        ...c,
        creditLimit: limit,
        currentBalance: balance,
        availableCredit: available
      };
    });
  }

  async createCustomer(tenantId: string, data: any) {
    return prisma.customer.create({
      data: {
        tenantId,
        name: data.name,
        customerType: data.customerType,
        phone: data.phone,
        email: data.email || null,
        tpin: data.tpin || null,
        creditLimit: data.creditLimit || 0,
        currentBalance: 0,
        paymentTermsDays: data.paymentTermsDays || 30,
        address: data.address || null
      }
    });
  }

  async updateCustomer(tenantId: string, id: string, data: any) {
    const existing = await prisma.customer.findFirst({ where: { id, tenantId } });
    if (!existing) throw new Error('Customer not found');

    const updateData: any = {};
    for (const key of ['name', 'customerType', 'phone', 'tpin', 'address'] as const) {
      if (data[key] !== undefined) updateData[key] = data[key] || null;
    }
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.creditLimit !== undefined) updateData.creditLimit = Number(data.creditLimit);
    if (data.paymentTermsDays !== undefined) updateData.paymentTermsDays = Number(data.paymentTermsDays);
    if (updateData.name === null) delete updateData.name;
    if (updateData.phone === null) delete updateData.phone;
    if (updateData.customerType === null) delete updateData.customerType;

    return prisma.customer.update({ where: { id: existing.id }, data: updateData });
  }

  async deactivateCustomer(tenantId: string, id: string) {
    const customer = await prisma.customer.findFirst({ where: { id, tenantId } });
    if (!customer) throw new Error('Customer not found');
    if (Number(customer.currentBalance) > 0) {
      throw new Error('Cannot deactivate a customer with an outstanding balance. Settle the account first.');
    }
    // Soft delete only — preserves credit history and audit trail
    return prisma.customer.update({ where: { id: customer.id }, data: { isActive: false } });
  }

  async getCustomerLedger(tenantId: string, customerId: string) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      include: {
        sales: {
          where: { paymentStatus: 'CREDIT', id: { notIn: LEGACY_DEMO_SALE_IDS } },
          include: { items: { include: { menuItem: true } } },
          orderBy: { createdAt: 'desc' }
        },
        invoices: {
          include: { payments: true },
          orderBy: { issueDate: 'desc' }
        }
      }
    });

    return customer;
  }

  async recordCustomerPayment(tenantId: string, data: any) {
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, tenantId }
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    const payAmount = Number(data.amount);
    const currentBal = Number(customer.currentBalance);
    const newBal = roundTo2Decimals(Math.max(0, currentBal - payAmount));

    return prisma.$transaction(async (tx: any) => {
      await tx.customer.update({
        where: { id: customer.id },
        data: { currentBalance: newBal }
      });

      // Find unpaid or partially paid invoices to allocate
      const unpaidInvoices = await tx.invoice.findMany({
        where: {
          tenantId,
          customerId: customer.id,
          status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] }
        },
        orderBy: { dueDate: 'asc' }
      });

      let remainingPayment = payAmount;
      for (const inv of unpaidInvoices) {
        if (remainingPayment <= 0) break;
        const total = Number(inv.totalAmount);
        const paid = Number(inv.amountPaid);
        const due = total - paid;

        const alloc = Math.min(remainingPayment, due);
        const newPaid = roundTo2Decimals(paid + alloc);
        const newStatus = newPaid >= total ? 'PAID' : 'PARTIALLY_PAID';

        await tx.invoice.update({
          where: { id: inv.id },
          data: {
            amountPaid: newPaid,
            status: newStatus
          }
        });

        await tx.payment.create({
          data: {
            invoiceId: inv.id,
            paymentMethod: data.paymentMethod,
            amount: alloc,
            reference: data.reference,
            receivedAt: new Date()
          }
        });

        remainingPayment -= alloc;
      }

      // If any excess remaining or no invoice exists, record standalone payment
      if (remainingPayment > 0) {
        await tx.payment.create({
          data: {
            paymentMethod: data.paymentMethod,
            amount: remainingPayment,
            reference: data.reference,
            receivedAt: new Date()
          }
        });
      }

      // Update active CashierShift if credit repayment was received in CASH
      if (data.paymentMethod === PaymentMethod.CASH) {
        const activeShift = await tx.cashierShift.findFirst({
          where: { tenantId, status: 'OPEN' },
          orderBy: { startedAt: 'desc' }
        });
        if (activeShift) {
          const newCreditCollections = roundTo2Decimals(Number(activeShift.cashCreditCollections) + payAmount);
          const newExpected = roundTo2Decimals(
            Number(activeShift.openingFloat) +
            Number(activeShift.cashSales) +
            newCreditCollections -
            Number(activeShift.cashExpenses) -
            Number(activeShift.cashWithdrawals)
          );
          await tx.cashierShift.update({
            where: { id: activeShift.id },
            data: {
              cashCreditCollections: newCreditCollections,
              expectedCash: newExpected
            }
          });
        }
      }

      return {
        customerId: customer.id,
        amountPaid: payAmount,
        previousBalance: currentBal,
        newBalance: newBal
      };
    });
  }

  async getAgeingReport(tenantId: string) {
    const customers = await prisma.customer.findMany({
      where: {
        tenantId,
        isActive: true,
        id: { notIn: LEGACY_DEMO_CUSTOMER_IDS },
        currentBalance: { gt: 0 }
      },
      include: {
        invoices: {
          where: { status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] } }
        }
      }
    });

    const now = new Date();
    const result = customers.map((c: any) => {
      let current = 0;
      let days30 = 0;
      let days60 = 0;
      let days90Plus = 0;

      for (const inv of c.invoices) {
        const balance = Number(inv.totalAmount) - Number(inv.amountPaid);
        const ageDays = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 3600 * 24));

        if (ageDays <= 0) {
          current += balance;
        } else if (ageDays <= 30) {
          days30 += balance;
        } else if (ageDays <= 60) {
          days60 += balance;
        } else {
          days90Plus += balance;
        }
      }

      return {
        customerId: c.id,
        customerName: c.name,
        customerType: c.customerType,
        phone: c.phone,
        totalBalance: Number(c.currentBalance),
        current: roundTo2Decimals(current),
        days30: roundTo2Decimals(days30),
        days60: roundTo2Decimals(days60),
        days90Plus: roundTo2Decimals(days90Plus)
      };
    });

    return result;
  }
}

export const creditService = new CreditService();
