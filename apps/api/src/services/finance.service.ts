import { prisma } from '@lspot/database';
import { roundTo2Decimals, calculateGrossProfit, calculateOperatingProfit } from '@lspot/shared';
import { getLusakaBusinessDateBounds } from './kitchen.service.js';

export const LEGACY_DEMO_SALE_IDS = ['sale-001', 'sale-002', 'sale-003', 'sale-004', 'sale-005'];
export const LEGACY_DEMO_EXPENSE_IDS = ['exp-rec-001', 'exp-rec-002', 'exp-rec-003'];
export const LEGACY_DEMO_REGISTER_IDS = ['reg-today-001'];
export const LEGACY_DEMO_KITCHEN_ITEM_IDS = ['kitem-001', 'kitem-002', 'kitem-003', 'kitem-004', 'kitem-005'];
export const LEGACY_DEMO_CUSTOMER_IDS = ['cust-001', 'cust-002', 'cust-003'];

function isBeverageMenuItem(menuItem: any): boolean {
  const catName = String(menuItem?.category?.name || '').toLowerCase();
  const itemName = String(menuItem?.name || '').toLowerCase();
  return (
    catName.includes('drink') ||
    catName.includes('beverage') ||
    catName.includes('water') ||
    itemName.includes('water') ||
    itemName.includes('coca') ||
    itemName.includes('fanta') ||
    itemName.includes('sprite') ||
    itemName.includes('soft drink')
  );
}

function getLusakaHour(dateInput: Date | string): number {
  const d = new Date(dateInput);
  // Africa/Lusaka is permanently UTC+02:00
  const lusakaTime = new Date(d.getTime() + 2 * 60 * 60 * 1000);
  return lusakaTime.getUTCHours();
}

export class FinanceService {
  async getDashboardSummary(tenantId: string, startDate?: Date, endDate?: Date) {
    const defaultBounds = getLusakaBusinessDateBounds();
    const isStartValid = startDate instanceof Date && !isNaN(startDate.getTime());
    const isEndValid = endDate instanceof Date && !isNaN(endDate.getTime());

    const start = isStartValid ? new Date(startDate.getTime()) : defaultBounds.startOfDayLusaka;
    const end = isEndValid ? new Date(endDate.getTime()) : defaultBounds.endOfDayLusaka;

    try {
      // 1. Real Sales in period (exclude refunded/reversed sales and legacy demo seed records)
      const allSalesInPeriod = await prisma.sale.findMany({
        where: {
          tenantId,
          id: { notIn: LEGACY_DEMO_SALE_IDS },
          createdAt: { gte: start, lte: end }
        },
        include: { payments: true, items: { include: { menuItem: { include: { category: true } } } } },
        orderBy: { createdAt: 'desc' }
      });

      const salesInPeriod = allSalesInPeriod.filter((s: any) => s.paymentStatus !== 'REFUNDED');
      const voidsAndReversalsCount = allSalesInPeriod.length - salesInPeriod.length;

      let todaySales = 0;
      let cashReceived = 0;
      let mobileMoneyReceived = 0;
      let creditSales = 0;
      let cogsToday = 0;
      let totalPortionsSold = 0;
      let totalBeveragesSold = 0;

      for (const s of salesInPeriod) {
        todaySales += Number(s.totalAmount);
        for (const p of s.payments) {
          const amt = Number(p.amount);
          if (p.paymentMethod === 'CASH') cashReceived += amt;
          else if (p.paymentMethod === 'AIRTEL_MONEY' || p.paymentMethod === 'MTN_MOMO') mobileMoneyReceived += amt;
          else if (p.paymentMethod === 'CUSTOMER_CREDIT') creditSales += amt;
        }
        for (const item of s.items) {
          if (isBeverageMenuItem(item.menuItem)) {
            totalBeveragesSold += item.quantity;
          } else {
            totalPortionsSold += item.quantity;
          }
          const unitCost = Number(item.unitCost) > 0 ? Number(item.unitCost) : Number(item.menuItem?.estimatedCost || 0);
          cogsToday += item.quantity * unitCost;
        }
      }

      // 2. Outstanding Debtors (real active customer accounts only)
      const customers = await prisma.customer.findMany({
        where: {
          tenantId,
          isActive: true,
          id: { notIn: LEGACY_DEMO_CUSTOMER_IDS },
          currentBalance: { gt: 0 }
        }
      });
      const outstandingDebtors = customers.reduce((sum: number, c: any) => sum + Number(c.currentBalance), 0);
      const activeDebtorCount = customers.length;

      // 3. Operating Expenses in period (real expenses only)
      const expensesInPeriod = await prisma.expense.findMany({
        where: {
          tenantId,
          id: { notIn: LEGACY_DEMO_EXPENSE_IDS },
          expenseDate: { gte: start, lte: end }
        }
      });
      const operatingExpenses = expensesInPeriod.reduce((sum: number, e: any) => sum + Number(e.amount), 0);

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

      // 5. Kitchen Production strictly within the selected filter period [start, end]
      const startDayUtc = getLusakaBusinessDateBounds(start).businessDateUtc;
      const endDayUtc = getLusakaBusinessDateBounds(end).businessDateUtc;

      const productionBatches = await prisma.productionBatch.findMany({
        where: {
          register: { tenantId },
          createdAt: { gte: start, lte: end }
        }
      });

      const totalPortionsPrepared = productionBatches.reduce(
        (sum: number, b: any) => sum + Number(b.actualPreparedPortions || 0),
        0
      );

      const kitchenRegisters = await prisma.kitchenRegister.findMany({
        where: {
          tenantId,
          businessDate: { gte: startDayUtc, lte: endDayUtc }
        },
        include: { items: true, batches: true }
      });

      let totalPortionsWaste = 0;
      let totalStaffMeals = 0;
      let totalComplimentary = 0;
      for (const reg of kitchenRegisters) {
        const isUnbatchedDemoReg = reg.id === 'reg-today-001' && (!reg.batches || reg.batches.length === 0);
        if (isUnbatchedDemoReg) continue;
        for (const item of reg.items) {
          totalPortionsWaste += Number(item.wastePortions || 0);
          totalStaffMeals += Number(item.staffMealPortions || 0);
          totalComplimentary += Number(item.complimentaryPortions || 0);
        }
      }

      // 6. Visualizations & Analytical Intelligence
      // 6a. Hourly Sales & Dining Traffic Distribution in Africa/Lusaka Time (UTC+2)
      let minHour = 6;
      let maxHour = 22;
      for (const s of salesInPeriod) {
        const h = getLusakaHour(s.createdAt);
        if (h < minHour) minHour = h;
        if (h > maxHour) maxHour = h;
      }

      const hourlySalesMap: { [hour: number]: { count: number; total: number } } = {};
      for (let h = minHour; h <= maxHour; h++) {
        hourlySalesMap[h] = { count: 0, total: 0 };
      }

      // 6b. Category Revenue Breakdown
      const categoryRevenueMap: { [cat: string]: { name: string; revenue: number; portions: number } } = {};

      // 6c. Top Dishes Ranking
      const dishSalesMap: { [menuItemId: string]: { name: string; portions: number; revenue: number; cost: number } } = {};

      let totalItemRevenue = 0;

      for (const s of salesInPeriod) {
        const saleHour = getLusakaHour(s.createdAt);
        if (!hourlySalesMap[saleHour]) {
          hourlySalesMap[saleHour] = { count: 0, total: 0 };
        }
        hourlySalesMap[saleHour].count += 1;
        hourlySalesMap[saleHour].total += Number(s.totalAmount);

        for (const item of s.items) {
          const itemRev = Number(item.subtotal || item.quantity * Number(item.unitPrice));
          const itemCost = item.quantity * Number(item.unitCost || item.menuItem?.estimatedCost || 0);
          const catName = item.menuItem?.category?.name || 'General Menu';
          totalItemRevenue += itemRev;

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

      // Format Hourly Stats sorted by hour
      const hourlyDistribution = Object.keys(hourlySalesMap)
        .map((h) => Number(h))
        .sort((a, b) => a - b)
        .map((hour) => {
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
      const categoryDenominator = totalItemRevenue > 0 ? totalItemRevenue : todaySales;
      const categoryBreakdown = Object.values(categoryRevenueMap)
        .sort((a, b) => b.revenue - a.revenue)
        .map((c) => ({
          category: c.name,
          portions: c.portions,
          revenue: roundTo2Decimals(c.revenue),
          percentage: categoryDenominator > 0 ? Math.round((c.revenue / categoryDenominator) * 100) : 0
        }));

      // Average Ticket Size & Authentic Peak Velocity
      const totalTicketsCount = salesInPeriod.length;
      const averageTicketSize = totalTicketsCount > 0 ? roundTo2Decimals(todaySales / totalTicketsCount) : 0;

      let peakHour = 'No orders in period';
      let maxHourRevenue = 0;
      for (const h of hourlyDistribution) {
        if (h.revenue > maxHourRevenue) {
          maxHourRevenue = h.revenue;
          peakHour = `${h.label} (${h.orders} order${h.orders === 1 ? '' : 's'})`;
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
        activeDebtorCount,
        cogs: roundTo2Decimals(cogsToday),
        grossProfit,
        grossMarginPercentage,
        operatingExpenses: roundTo2Decimals(operatingExpenses),
        operatingProfit,
        inventoryValue: roundTo2Decimals(inventoryValue),
        lowStockCount,
        totalPortionsPrepared,
        totalPortionsSold,
        totalBeveragesSold,
        totalPortionsWaste,
        totalStaffMeals,
        totalComplimentary,
        voidsAndReversalsCount,
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
        activeDebtorCount: 0,
        cogs: 0,
        grossProfit: 0,
        grossMarginPercentage: 0,
        operatingExpenses: 0,
        operatingProfit: 0,
        inventoryValue: 0,
        lowStockCount: 0,
        totalPortionsPrepared: 0,
        totalPortionsSold: 0,
        totalBeveragesSold: 0,
        totalPortionsWaste: 0,
        totalStaffMeals: 0,
        totalComplimentary: 0,
        voidsAndReversalsCount: 0,
        totalTicketsCount: 0,
        averageTicketSize: 0,
        peakHour: 'No orders in period',
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
      where: {
        tenantId,
        id: { notIn: LEGACY_DEMO_EXPENSE_IDS }
      },
      include: { category: true },
      orderBy: { expenseDate: 'desc' }
    });
  }

  async recordExpense(tenantId: string, approvedById: string | undefined, data: any) {
    const paymentMethod = data.paymentMethod || 'CASH';
    const amount = Number(data.amount);

    return prisma.$transaction(async (tx: any) => {
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
          ...(data.expenseDate ? { expenseDate: new Date(data.expenseDate) } : {}),
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

  async updateExpense(
    tenantId: string,
    id: string,
    data: {
      categoryId?: string;
      amount?: number;
      payee?: string;
      description?: string;
      paymentMethod?: string;
      receiptNumber?: string | null;
      expenseDate?: string | null;
    }
  ) {
    const existing = await prisma.expense.findFirst({
      where: { id, tenantId }
    });
    if (!existing) {
      throw new Error('Operating expense record not found');
    }

    const updateData: any = {};
    if (data.categoryId) {
      const cat = await prisma.expenseCategory.findFirst({ where: { id: data.categoryId, tenantId } });
      if (cat) updateData.categoryId = cat.id;
    }
    if (data.amount !== undefined) updateData.amount = roundTo2Decimals(Math.max(0, Number(data.amount)));
    if (data.payee !== undefined) updateData.payee = data.payee;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
    if (data.receiptNumber !== undefined) updateData.receiptNumber = data.receiptNumber || null;
    if (data.expenseDate) {
      const parsedDate = new Date(data.expenseDate);
      if (!isNaN(parsedDate.getTime())) {
        updateData.expenseDate = parsedDate;
      }
    }

    return prisma.expense.update({
      where: { id: existing.id },
      data: updateData,
      include: { category: true }
    });
  }
}

export const financeService = new FinanceService();
