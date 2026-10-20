import { prisma } from '@lspot/database';
import { roundTo2Decimals, PaymentMethod } from '@lspot/shared';

export class CreditService {
  async getCustomers(tenantId: string) {
    const customers = await prisma.customer.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' }
    });

    return customers.map((c) => {
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

  async getCustomerLedger(customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        sales: {
          where: { paymentStatus: 'CREDIT' },
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
    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId }
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    const payAmount = Number(data.amount);
    const currentBal = Number(customer.currentBalance);
    const newBal = roundTo2Decimals(Math.max(0, currentBal - payAmount));

    return prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: customer.id },
        data: { currentBalance: newBal }
      });

      // Find unpaid or partially paid invoices to allocate
      const unpaidInvoices = await tx.invoice.findMany({
        where: {
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
      where: { tenantId, currentBalance: { gt: 0 } },
      include: {
        invoices: {
          where: { status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] } }
        }
      }
    });

    const now = new Date();
    const result = customers.map((c) => {
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
