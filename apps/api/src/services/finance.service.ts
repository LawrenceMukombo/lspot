import { prisma } from '@lspot/database';
import { roundTo2Decimals, calculateGrossProfit, calculateOperatingProfit } from '@lspot/shared';

export class FinanceService {
  async getDashboardSummary(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Sales today
    const salesToday = await prisma.sale.findMany({
      where: { tenantId, createdAt: { gte: today } },
      include: { payments: true, items: { include: { menuItem: true } } }
    });

    let todaySales = 0;
    let cashReceived = 0;
    let mobileMoneyReceived = 0;
    let creditSales = 0;
    let cogsToday = 0;
    let totalPortionsSold = 0;

    for (const s of salesToday) {
      todaySales += Number(s.totalAmount);
      for (const p of s.payments) {
        const amt = Number(p.amount);
        if (p.paymentMethod === 'CASH') cashReceived += amt;
        else if (p.paymentMethod === 'AIRTEL_MONEY' || p.paymentMethod === 'MTN_MOMO') mobileMoneyReceived += amt;
        else if (p.paymentMethod === 'CUSTOMER_CREDIT') creditSales += amt;
      }
      for (const item of s.items) {
        totalPortionsSold += item.quantity;
        cogsToday += item.quantity * Number(item.unitCost || item.menuItem.estimatedCost);
      }
    }

    // 2. Outstanding Debtors
    const customers = await prisma.customer.findMany({
      where: { tenantId, currentBalance: { gt: 0 } }
    });
    const outstandingDebtors = customers.reduce((sum, c) => sum + Number(c.currentBalance), 0);

    // 3. Operating Expenses today
    const expensesToday = await prisma.expense.findMany({
      where: { tenantId, expenseDate: { gte: today } }
    });
    const operatingExpenses = expensesToday.reduce((sum, e) => sum + Number(e.amount), 0);

    // 4. Inventory Value & Low stock items
    const stockItems = await prisma.stockItem.findMany({
      where: { tenantId, isActive: true }
    });
    let inventoryValue = 0;
    let lowStockCount = 0;
    for (const item of stockItems) {
      const stock = Number(item.currentStock);
      const cost = Number(item.averageUnitCost);
      inventoryValue += stock * cost;
      if (stock <= Number(item.reorderLevel)) {
        lowStockCount++;
      }
    }

    // 5. Kitchen Production today
    const kitchenRegister = await prisma.kitchenRegister.findFirst({
      where: { tenantId, businessDate: today },
      include: { items: true }
    });
    let totalPortionsPrepared = 0;
    let totalPortionsWaste = 0;
    if (kitchenRegister) {
      for (const item of kitchenRegister.items) {
        totalPortionsPrepared += item.preparedPortions;
        totalPortionsWaste += item.wastePortions;
      }
    }

    const { grossProfit, grossMarginPercentage } = calculateGrossProfit(todaySales, cogsToday);
    const { operatingProfit } = calculateOperatingProfit(grossProfit, operatingExpenses);

    return {
      currency: 'ZMW',
      todaySales: roundTo2Decimals(todaySales),
      cashReceived: roundTo2Decimals(cashReceived),
      mobileMoneyReceived: roundTo2Decimals(mobileMoneyReceived),
      creditSales: roundTo2Decimals(creditSales),
      outstandingDebtors: roundTo2Decimals(outstandingDebtors),
      cogs: roundTo2Decimals(cogsToday),
      grossProfit,
      grossMarginPercentage,
      operatingExpenses: roundTo2Decimals(operatingExpenses),
      operatingProfit,
      inventoryValue: roundTo2Decimals(inventoryValue),
      lowStockCount,
      totalPortionsPrepared,
      totalPortionsSold,
      totalPortionsWaste
    };
  }

  async getExpenses(tenantId: string) {
    return prisma.expense.findMany({
      where: { tenantId },
      include: { category: true },
      orderBy: { expenseDate: 'desc' }
    });
  }

  async recordExpense(tenantId: string, approvedById: string | undefined, data: any) {
    return prisma.expense.create({
      data: {
        tenantId,
        categoryId: data.categoryId,
        amount: data.amount,
        payee: data.payee,
        description: data.description,
        paymentMethod: data.paymentMethod || 'CASH',
        receiptNumber: data.receiptNumber || null,
        approvedById: approvedById || null
      },
      include: { category: true }
    });
  }
}

export const financeService = new FinanceService();
