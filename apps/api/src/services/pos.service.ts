import { prisma } from '@lspot/database';
import {
  PaymentMethod,
  SaleStatus,
  calculateClosingPreparedPortions,
  roundTo2Decimals
} from '@lspot/shared';

export class PosService {
  async getCatalog(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const categories = await prisma.menuCategory.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: 'asc' }
    });

    const items = await prisma.menuItem.findMany({
      where: { tenantId, isAvailable: true },
      include: {
        category: true
      },
      orderBy: { name: 'asc' }
    });

    // Fetch today's register to show remaining prepared portions
    const todayRegister = await prisma.kitchenRegister.findFirst({
      where: { tenantId, businessDate: today, status: 'OPEN' },
      include: { items: true }
    });

    const portionMap = new Map<string, number>();
    if (todayRegister) {
      for (const item of todayRegister.items) {
        portionMap.set(item.menuItemId, item.remainingPortions);
      }
    }

    const catalogItems = items.map((i) => {
      const price = Number(i.sellingPrice);
      const remainingPortions = portionMap.has(i.id) ? portionMap.get(i.id)! : 999; // direct resale beverages don't require kitchen batch
      return {
        id: i.id,
        name: i.name,
        categoryId: i.categoryId,
        categoryName: i.category.name,
        sellingPrice: price,
        portionSize: i.portionSize,
        remainingPortions,
        isAvailable: i.isAvailable && remainingPortions > 0
      };
    });

    return {
      categories,
      items: catalogItems
    };
  }

  async checkout(tenantId: string, branchId: string, cashierId: string, data: any) {
    // 1. Idempotency check
    if (data.idempotencyKey) {
      const existing = await prisma.sale.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
        include: { items: { include: { menuItem: true } }, payments: true }
      });
      if (existing) {
        return existing;
      }
    }

    // 2. Find cashier's current open shift
    const activeShift = await prisma.cashierShift.findFirst({
      where: { cashierId, status: 'OPEN' },
      orderBy: { startedAt: 'desc' }
    });

    // 3. Customer credit verification if credit payment used
    const creditPayment = data.payments.find((p: any) => p.method === PaymentMethod.CUSTOMER_CREDIT);
    let customer: any = null;
    if (creditPayment) {
      if (!data.customerId) {
        throw new Error('Customer ID is required for Credit sales');
      }
      customer = await prisma.customer.findUnique({
        where: { id: data.customerId }
      });
      if (!customer) {
        throw new Error('Customer account not found');
      }
      const limit = Number(customer.creditLimit);
      const balance = Number(customer.currentBalance);
      const available = limit - balance;

      if (creditPayment.amount > available) {
        throw new Error(`Credit limit exceeded! Customer available credit is K ${available.toFixed(2)}`);
      }
    }

    const saleNumber = `SALE-${Date.now().toString().slice(-8)}`;

    // 4. Atomic Execution: Sale + Items + Payments + Stock/Kitchen Update + Customer Balance + Shift Cash
    return prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          tenantId,
          branchId,
          saleNumber,
          shiftId: activeShift ? activeShift.id : null,
          cashierId,
          customerId: data.customerId || null,
          orderType: data.orderType || 'DINE_IN',
          tableNumber: data.tableNumber || null,
          subtotal: data.subtotal,
          discountAmount: data.discountAmount || 0,
          taxAmount: 0,
          totalAmount: data.totalAmount,
          paymentStatus: creditPayment ? 'CREDIT' : 'PAID',
          idempotencyKey: data.idempotencyKey,
          items: {
            create: data.items.map((i: any) => ({
              menuItemId: i.menuItemId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              subtotal: i.subtotal,
              notes: i.notes
            }))
          },
          payments: {
            create: data.payments.map((p: any) => ({
              paymentMethod: p.method,
              amount: p.amount,
              reference: p.reference,
              receivedAt: new Date()
            }))
          }
        },
        include: { items: { include: { menuItem: true } }, payments: true }
      });

      // Update Kitchen Register items (deduct sold portions)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayRegister = await tx.kitchenRegister.findFirst({
        where: { tenantId, branchId, businessDate: today, status: 'OPEN' }
      });

      if (todayRegister) {
        for (const lineItem of data.items) {
          const regItem = await tx.kitchenRegisterItem.findFirst({
            where: { registerId: todayRegister.id, menuItemId: lineItem.menuItemId }
          });

          if (regItem) {
            const newSold = regItem.soldPortions + lineItem.quantity;
            const newRemaining = calculateClosingPreparedPortions({
              openingPortions: regItem.openingPortions,
              preparedPortions: regItem.preparedPortions,
              soldPortions: newSold,
              wastePortions: regItem.wastePortions,
              staffMealPortions: regItem.staffMealPortions,
              complimentaryPortions: regItem.complimentaryPortions
            });

            await tx.kitchenRegisterItem.update({
              where: { id: regItem.id },
              data: {
                soldPortions: newSold,
                remainingPortions: newRemaining
              }
            });
          }
        }
      }

      // Update customer balance if credit sale
      if (creditPayment && customer) {
        const newBalance = roundTo2Decimals(Number(customer.currentBalance) + creditPayment.amount);
        await tx.customer.update({
          where: { id: customer.id },
          data: { currentBalance: newBalance }
        });
      }

      // Update Cashier Shift cash collections if cash payment present
      const cashPay = data.payments.find((p: any) => p.method === PaymentMethod.CASH);
      if (cashPay && activeShift) {
        const newCashSales = roundTo2Decimals(Number(activeShift.cashSales) + cashPay.amount);
        const newExpected = roundTo2Decimals(
          Number(activeShift.openingFloat) +
          newCashSales +
          Number(activeShift.cashCreditCollections) -
          Number(activeShift.cashExpenses)
        );

        await tx.cashierShift.update({
          where: { id: activeShift.id },
          data: {
            cashSales: newCashSales,
            expectedCash: newExpected
          }
        });
      }

      return sale;
    });
  }

  async getRecentSales(tenantId: string, limit = 50) {
    return prisma.sale.findMany({
      where: { tenantId },
      include: {
        items: { include: { menuItem: true } },
        payments: true,
        cashier: { select: { fullName: true } },
        customer: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }
}

export const posService = new PosService();
