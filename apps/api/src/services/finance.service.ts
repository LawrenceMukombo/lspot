import { prisma } from '@lspot/database';
import { roundTo2Decimals, calculateGrossProfit, calculateOperatingProfit } from '@lspot/shared';
import { getLusakaBusinessDateBounds } from './kitchen.service.js';

export class FinanceService {
  async getDashboardSummary(tenantId: string, startDate?: Date, endDate?: Date) {
    const isStartValid = startDate instanceof Date && !isNaN(startDate.getTime());
    const isEndValid = endDate instanceof Date && !isNaN(endDate.getTime());

    const start = isStartValid ? new Date(startDate.getTime()) : new Date();
    if (!isStartValid) start.setHours(0, 0, 0, 0);

    const end = isEndValid ? new Date(endDate.getTime()) : new Date();
    if (!isEndValid) end.setHours(23, 59, 59, 999);

    try {
      // 1. Sales in period (exclude refunded/reversed sales from revenue and COGS)
      const allSalesInPeriod = await prisma.sale.findMany({
        where: {
          tenantId,
          createdAt: { gte: start, lte: end }
        },
        include: { payments: true, items: { include: { menuItem: { include: { category: true } } } } }
      });

      const salesInPeriod = allSalesInPeriod.filter((s) => s.paymentStatus !== 'REFUNDED');
      const voidsAndReversalsCount = allSalesInPeriod.length - salesInPeriod.length;

      let todaySales = 0;
      let cashReceived = 0;
      let mobileMoneyReceived = 0;
      let creditSales = 0;
      let cogsToday = 0;
      let totalPortionsSold = 0;

      for (const s of salesInPeriod) {
        todaySales += Number(s.totalAmount);
        for (const p of s.payments) {
          const amt = Number(p.amount);
          if (p.paymentMethod === 'CASH') cashReceived += amt;
          else if (p.paymentMethod === 'AIRTEL_MONEY' || p.paymentMethod === 'MTN_MOMO') mobileMoneyReceived += amt;
          else if (p.paymentMethod === 'CUSTOMER_CREDIT') creditSales += amt;
        }
        for (const item of s.items) {
          totalPortionsSold += item.quantity;
          const unitCost = Number(item.unitCost) > 0 ? Number(item.unitCost) : Number(item.menuItem.estimatedCost);
          cogsToday += item.quantity * unitCost;
        }
      }

      // 2. Outstanding Debtors
      const customers = await prisma.customer.findMany({
        where: { tenantId, currentBalance: { gt: 0 } }
      });
      const outstandingDebtors = customers.reduce((sum, c) => sum + Number(c.currentBalance), 0);

      // 3. Operating Expenses in period
      const expensesInPeriod = await prisma.expense.findMany({
        where: {
          tenantId,
          expenseDate: { gte: start, lte: end }
        }
      });
      const operatingExpenses = expensesInPeriod.reduce((sum, e) => sum + Number(e.amount), 0);

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

      // 5. Kitchen Production in period
      const startDayUtc = getLusakaBusinessDateBounds(start).businessDateUtc;
      const endDayUtc = getLusakaBusinessDateBounds(end).businessDateUtc;

      const kitchenRegisters = await prisma.kitchenRegister.findMany({
        where: {
          tenantId,
          businessDate: { gte: startDayUtc, lte: endDayUtc }
        },
        include: { items: true }
      });
      let totalPortionsPrepared = 0;
      let totalPortionsWaste = 0;
      for (const reg of kitchenRegisters) {
        for (const item of reg.items) {
          totalPortionsPrepared += item.preparedPortions;
          totalPortionsWaste += item.wastePortions;
        }
      }

      // 6. Visualizations & Analytical Intelligence
      // 6a. Hourly Sales & Dining Traffic Distribution (08:00 to 22:00)
      const hourlySalesMap: { [hour: number]: { count: number; total: number } } = {};
      for (let h = 7; h <= 22; h++) {
        hourlySalesMap[h] = { count: 0, total: 0 };
      }

      // 6b. Category Revenue Breakdown
      const categoryRevenueMap: { [cat: string]: { name: string; revenue: number; portions: number } } = {};

      // 6c. Top Dishes Ranking
      const dishSalesMap: { [menuItemId: string]: { name: string; portions: number; revenue: number; cost: number } } = {};

      for (const s of salesInPeriod) {
        const saleHour = new Date(s.createdAt).getHours();
        if (hourlySalesMap[saleHour]) {
          hourlySalesMap[saleHour].count += 1;
          hourlySalesMap[saleHour].total += Number(s.totalAmount);
        }

        for (const item of s.items) {
          const itemRev = item.quantity * Number(item.unitPrice);
          const itemCost = item.quantity * Number(item.unitCost || item.menuItem?.estimatedCost || 0);
          const catName = item.menuItem?.category?.name || 'General Menu';

          // Category
          if (!categoryRevenueMap[catName]) {
            categoryRevenueMap[catName] = { name: catName, revenue: 0, portions: 0 };
          }
          categoryRevenueMap[catName].revenue += itemRev;
          categoryRevenueMap[catName].portions += item.quantity;

          // Dish
          const itemId = item.menuItemId;
          const dishName = item.menuItem?.name || 'Dish';
          if (!dishSalesMap[itemId]) {
            dishSalesMap[itemId] = {
              name: dishName,
              portions: 0,
              revenue: 0,
              cost: 0
            };
          }
          dishSalesMap[itemId].portions += item.quantity;
          dishSalesMap[itemId].revenue += itemRev;
          dishSalesMap[itemId].cost += itemCost;
        }
      }

      // Format Hourly Stats
      const hourlyDistribution = Object.keys(hourlySalesMap).map((h) => {
        const hour = Number(h);
        const label = `${hour.toString().padStart(2, '0')}:00`;
        return {
          hour,
          label,
          orders: hourlySalesMap[hour].count,
          revenue: roundTo2Decimals(hourlySalesMap[hour].total)
        };
      });

      // Format Top Dishes
      const topSellingDishes = Object.values(dishSalesMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 6)
        .map((d) => ({
          name: d.name,
          portions: d.portions,
          revenue: roundTo2Decimals(d.revenue),
          marginPercent: d.revenue > 0 ? Math.round(((d.revenue - d.cost) / d.revenue) * 100) : 0
        }));

      // Format Category Breakdown
      const categoryBreakdown = Object.values(categoryRevenueMap)
        .sort((a, b) => b.revenue - a.revenue)
        .map((c) => ({
          category: c.name,
          portions: c.portions,
          revenue: roundTo2Decimals(c.revenue),
          percentage: todaySales > 0 ? Math.round((c.revenue / todaySales) * 100) : 0
        }));

      // Average Ticket Size & Peak Velocity
      const totalTicketsCount = salesInPeriod.length;
      const averageTicketSize = totalTicketsCount > 0 ? roundTo2Decimals(todaySales / totalTicketsCount) : 0;
      
      // Find peak hour
      let peakHour = '12:00 - 14:00 (Lunch Rush)';
      let maxHourOrders = 0;
      for (const h of hourlyDistribution) {
        if (h.orders > maxHourOrders) {
          maxHourOrders = h.orders;
          peakHour = `${h.label} (${h.orders} orders)`;
        }
      }

      // Calculate authentic Gross Profit and Operating Profit based on actual data
      const { grossProfit, grossMarginPercentage } = calculateGrossProfit(todaySales, cogsToday);
      const { operatingProfit } = calculateOperatingProfit(grossProfit, operatingExpenses);

      return {
        currency: 'ZMW',
        period: {
          startDate: start.toISOString(),
          endDate: end.toISOString()
        },
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
        totalPortionsWaste,
        totalTicketsCount,
        averageTicketSize,
        peakHour,
        hourlyDistribution,
        topSellingDishes,
        categoryBreakdown
      };
    } catch (dbErr) {
      console.error('Database error in getDashboardSummary:', dbErr);
      return {
        currency: 'ZMW',
        period: {
          startDate: start.toISOString(),
          endDate: end.toISOString()
        },
        todaySales: 0,
        cashReceived: 0,
        mobileMoneyReceived: 0,
        creditSales: 0,
        outstandingDebtors: 0,
        cogs: 0,
        grossProfit: 0,
        grossMarginPercentage: 0,
        operatingExpenses: 0,
        operatingProfit: 0,
        inventoryValue: 0,
        lowStockCount: 0,
        totalPortionsPrepared: 0,
        totalPortionsSold: 0,
        totalPortionsWaste: 0,
        totalTicketsCount: 0,
        averageTicketSize: 0,
        peakHour: 'N/A',
        hourlyDistribution: [],
        topSellingDishes: [],
        categoryBreakdown: []
      };
    }
  }

  async getExpenseCategories(tenantId: string) {
    return prisma.expenseCategory.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' }
    });
  }

  async getExpenses(tenantId: string) {
    return prisma.expense.findMany({
      where: { tenantId },
      include: { category: true },
      orderBy: { expenseDate: 'desc' }
    });
  }

  async recordExpense(tenantId: string, approvedById: string | undefined, data: any) {
    const paymentMethod = data.paymentMethod || 'CASH';
    const amount = Number(data.amount);

    return prisma.$transaction(async (tx) => {
      let categoryId = data.categoryId;
      const validCat = categoryId
        ? await tx.expenseCategory.findFirst({ where: { id: categoryId, tenantId } })
        : null;
      if (!validCat) {
        const fallbackCat = await tx.expenseCategory.findFirst({ where: { tenantId } });
        if (!fallbackCat) {
          throw new Error('No expense category configured for this tenant');
        }
        categoryId = fallbackCat.id;
      }

      const expense = await tx.expense.create({
        data: {
          tenantId,
          categoryId,
          amount,
          payee: data.payee,
          description: data.description,
          paymentMethod,
          receiptNumber: data.receiptNumber || null,
          approvedById: approvedById || null
        },
        include: { category: true }
      });

      if (paymentMethod === 'CASH') {
        const activeShift = await tx.cashierShift.findFirst({
          where: { tenantId, status: 'OPEN' },
          orderBy: { startedAt: 'desc' }
        });
        if (activeShift) {
          const newCashExpenses = roundTo2Decimals(Number(activeShift.cashExpenses) + amount);
          const newExpected = roundTo2Decimals(
            Number(activeShift.openingFloat) +
            Number(activeShift.cashSales) +
            Number(activeShift.cashCreditCollections) -
            newCashExpenses -
            Number(activeShift.cashWithdrawals)
          );
          await tx.cashierShift.update({
            where: { id: activeShift.id },
            data: {
              cashExpenses: newCashExpenses,
              expectedCash: newExpected
            }
          });
        }
      }

      return expense;
    });
  }
}

export const financeService = new FinanceService();
