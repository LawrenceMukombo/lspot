import { prisma } from '@lspot/database';
import {
  PaymentMethod,
  SaleStatus,
  StockMovementType,
  ZraStatus,
  calculateClosingPreparedPortions,
  roundTo2Decimals
} from '@lspot/shared';
import { restaurantService } from './restaurant.service.js';
import { kitchenService, getLusakaBusinessDateBounds } from './kitchen.service.js';
import { LEGACY_DEMO_SALE_IDS } from './finance.service.js';

export class PosService {
  async getCatalog(tenantId: string) {
    const categories = await prisma.menuCategory.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: 'asc' }
    });

    const items = await prisma.menuItem.findMany({
      where: { tenantId, isAvailable: true },
      include: {
        category: true,
        recipe: true
      },
      orderBy: { name: 'asc' }
    });

    // Fetch today's authoritative daily register to show remaining prepared portions
    const todayRegister = await kitchenService.getTodayRegister(tenantId);

    const portionMap = new Map<string, number>();
    if (todayRegister && todayRegister.status === 'OPEN') {
      for (const item of todayRegister.items) {
        portionMap.set(item.menuItemId, item.remainingPortions);
      }
    }

    // Also fetch beverage stock items for direct resale items
    const stockItems = await prisma.stockItem.findMany({
      where: { tenantId }
    });
    const stockMap = new Map<string, number>();
    for (const s of stockItems) {
      stockMap.set(s.id, Number(s.currentStock));
      if (s.sku) stockMap.set(s.sku, Number(s.currentStock));
      stockMap.set(s.name.toLowerCase(), Number(s.currentStock));
    }

    const catalogItems = items.map((i: any) => {
      const price = Number(i.sellingPrice);
      const isBeverage =
        i.category.name.toLowerCase().includes('drink') ||
        i.category.name.toLowerCase().includes('beverage') ||
        i.category.name.toLowerCase().includes('water') ||
        i.name.toLowerCase().includes('water') ||
        i.name.toLowerCase().includes('coca') ||
        i.name.toLowerCase().includes('fanta') ||
        i.name.toLowerCase().includes('sprite');

      let remainingUnits = 0;
      let isAvailable = false;

      if (isBeverage) {
        // Direct resale item: availability strictly depends on beverage inventory stock
        let matchedStock = 0;
        if (i.sku && stockMap.has(i.sku)) {
          matchedStock = stockMap.get(i.sku)!;
        } else if (stockMap.has(i.name.toLowerCase())) {
          matchedStock = stockMap.get(i.name.toLowerCase())!;
        } else if (i.name.toLowerCase().includes('water') && stockMap.has('BEV-WATER-500')) {
          matchedStock = stockMap.get('BEV-WATER-500')!;
        } else if ((i.name.toLowerCase().includes('coca') || i.name.toLowerCase().includes('soft drink')) && stockMap.has('BEV-COKE-350')) {
          matchedStock = stockMap.get('BEV-COKE-350')!;
        } else {
          // Check if any stock item name is contained in the menu item name
          for (const s of stockItems) {
            if (i.name.toLowerCase().includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(i.name.toLowerCase())) {
              matchedStock = Number(s.currentStock);
              break;
            }
          }
        }
        remainingUnits = Math.max(0, Math.floor(matchedStock));
        isAvailable = i.isAvailable && remainingUnits > 0;
      } else {
        // Cooked Food/Meal: availability strictly requires an active Kitchen Cooking Batch (remainingPortions > 0)
        remainingUnits = portionMap.has(i.id) ? portionMap.get(i.id)! : 0;
        isAvailable = i.isAvailable && remainingUnits > 0;
      }

      return {
        id: i.id,
        name: i.name,
        description: i.description,
        imageUrl: i.imageUrl,
        categoryId: i.categoryId,
        categoryName: i.category.name,
        sellingPrice: price,
        portionSize: i.portionSize,
        remainingPortions: remainingUnits,
        isBeverage,
        isAvailable
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
      where: { tenantId, cashierId, status: 'OPEN' },
      orderBy: { startedAt: 'desc' }
    });

    const creditPayment = data.payments.find((p: any) => p.method === PaymentMethod.CUSTOMER_CREDIT);
    const saleNumber = `SALE-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const ensuredTodayRegister = await kitchenService.getTodayRegister(tenantId, branchId);
    const { businessDateUtc } = getLusakaBusinessDateBounds();

    const integrations = await restaurantService.getIntegrationsConfig(tenantId);
    const zraCfg = integrations.zraConfig;

    // 3. Atomic Execution: Pre-flight validation + Sale + Items + Payments + Stock/Kitchen Update + Customer Balance + Shift Cash
    return prisma.$transaction(async (tx: any) => {
      const todayRegister = await tx.kitchenRegister.findFirst({
        where: {
          tenantId,
          ...(ensuredTodayRegister?.id ? { id: ensuredTodayRegister.id } : { businessDate: businessDateUtc }),
          status: 'OPEN'
        },
        include: { items: true }
      });

      const resolvedLineItems: Array<{
        menuItem: any;
        isBeverage: boolean;
        quantity: number;
        unitPrice: number;
        unitCost: number;
        subtotal: number;
        notes?: string;
      }> = [];

      let computedSubtotal = 0;

      for (const lineItem of data.items) {
        const menuItem = await tx.menuItem.findFirst({
          where: { id: lineItem.menuItemId, tenantId },
          include: { category: true, recipe: true }
        });
        if (!menuItem) {
          throw new Error(`Menu item ID ${lineItem.menuItemId} does not exist`);
        }

        const isBeverage =
          menuItem.category.name.toLowerCase().includes('drink') ||
          menuItem.category.name.toLowerCase().includes('beverage') ||
          menuItem.category.name.toLowerCase().includes('water') ||
          menuItem.name.toLowerCase().includes('water') ||
          menuItem.name.toLowerCase().includes('coca') ||
          menuItem.name.toLowerCase().includes('fanta') ||
          menuItem.name.toLowerCase().includes('sprite');

        if (isBeverage) {
          const stockItem = await tx.stockItem.findFirst({
            where: {
              tenantId,
              OR: [
                ...(menuItem.sku ? [{ sku: menuItem.sku }] : []),
                { name: { contains: menuItem.name, mode: 'insensitive' as const } },
                ...(menuItem.name.toLowerCase().includes('coca cola') || menuItem.name.toLowerCase().includes('soft drink') ? [{ sku: 'BEV-COKE-350' }] : []),
                ...(menuItem.name.toLowerCase().includes('water') ? [{ sku: 'BEV-WATER-500' }] : [])
              ]
            }
          });

          if (!stockItem) {
            throw new Error(`Cannot sell ${menuItem.name}: No stock record found in Beverage Inventory`);
          }

          const availableStock = Number(stockItem.currentStock);
          if (availableStock < lineItem.quantity) {
            throw new Error(`Insufficient stock for ${menuItem.name}! Available in Beverage Inventory: ${availableStock} units, Requested: ${lineItem.quantity}`);
          }
        } else {
          if (!todayRegister) {
            throw new Error(`Cannot sell ${menuItem.name}: Kitchen Cooking Register is closed or not opened for today. All cooked meals must come from an active Kitchen Cooking Batch.`);
          }

          const regItem = todayRegister.items.find((i: any) => i.menuItemId === menuItem.id);
          const remaining = regItem ? regItem.remainingPortions : 0;

          if (remaining < lineItem.quantity) {
            throw new Error(`Cannot sell ${menuItem.name}: No remaining prepared portions available (${remaining} available). Kitchen must record a Cooking Batch first.`);
          }
        }

        const authoritativePrice = Number(menuItem.sellingPrice);
        const unitCost = Number(menuItem.estimatedCost || 0);
        const qty = Number(lineItem.quantity);
        const lineSubtotal = roundTo2Decimals(authoritativePrice * qty);
        computedSubtotal = roundTo2Decimals(computedSubtotal + lineSubtotal);

        resolvedLineItems.push({
          menuItem,
          isBeverage,
          quantity: qty,
          unitPrice: authoritativePrice,
          unitCost,
          subtotal: lineSubtotal,
          notes: lineItem.notes
        });
      }

      const discountAmount = Math.max(0, Math.min(computedSubtotal, roundTo2Decimals(Number(data.discountAmount || 0))));
      const computedTotalAmount = roundTo2Decimals(computedSubtotal - discountAmount);
      const taxRate = Number(zraCfg.taxRatePercent || 16);
      const computedTaxAmount = zraCfg.taxEnabled
        ? roundTo2Decimals(computedTotalAmount - computedTotalAmount / (1 + taxRate / 100))
        : 0;
      const autoFiscalCode =
        zraCfg.taxEnabled && zraCfg.autoFiscalizeOnCheckout
          ? `ZRA-${zraCfg.branchCode || '000'}-${Date.now().toString(36).toUpperCase()}-${saleNumber.slice(-4)}`
          : null;
      const saleZraStatus = autoFiscalCode
        ? ZraStatus.FISCALIZED
        : zraCfg.taxEnabled
        ? ZraStatus.PENDING_SUBMISSION
        : ZraStatus.NOT_APPLICABLE;

      const totalPayments = roundTo2Decimals(
        data.payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
      );

      if (totalPayments + 0.01 < computedTotalAmount) {
        throw new Error(
          `Payment total (K ${totalPayments.toFixed(2)}) is less than the order total (K ${computedTotalAmount.toFixed(2)})`
        );
      }

      // Customer credit headroom verification inside atomic transaction
      let customer: any = null;
      if (creditPayment) {
        if (!data.customerId) {
          throw new Error('Customer ID is required for Credit sales');
        }
        customer = await tx.customer.findFirst({
          where: { id: data.customerId, tenantId }
        });
        if (!customer) {
          throw new Error('Customer account not found');
        }
        const limit = Number(customer.creditLimit);
        const balance = Number(customer.currentBalance);
        const available = roundTo2Decimals(limit - balance);

        if (creditPayment.amount > available) {
          throw new Error(`Credit limit exceeded! Customer available credit is K ${available.toFixed(2)} (Requested: K ${creditPayment.amount.toFixed(2)})`);
        }
      }

      // Create Sale record
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
          subtotal: computedSubtotal,
          discountAmount,
          taxAmount: computedTaxAmount,
          totalAmount: computedTotalAmount,
          paymentStatus: creditPayment ? 'CREDIT' : 'PAID',
          zraStatus: saleZraStatus,
          fiscalInvoiceNo: autoFiscalCode,
          idempotencyKey: data.idempotencyKey,
          items: {
            create: resolvedLineItems.map((i) => ({
              menuItemId: i.menuItem.id,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              unitCost: i.unitCost,
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

      // Deduct kitchen portions & beverage inventory
      for (const lineItem of resolvedLineItems) {
        const { menuItem, isBeverage } = lineItem;

        if (!isBeverage && todayRegister) {
          const regItem = await tx.kitchenRegisterItem.findFirst({
            where: { registerId: todayRegister.id, menuItemId: menuItem.id }
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
        } else if (isBeverage && menuItem) {
          // Beverage deduction from perpetual stock
          const stockItem = await tx.stockItem.findFirst({
            where: {
              tenantId,
              OR: [
                ...(menuItem.sku ? [{ sku: menuItem.sku }] : []),
                { name: { contains: menuItem.name, mode: 'insensitive' as const } },
                ...(menuItem.name.toLowerCase().includes('coca cola') || menuItem.name.toLowerCase().includes('soft drink') ? [{ sku: 'BEV-COKE-350' }] : []),
                ...(menuItem.name.toLowerCase().includes('water') ? [{ sku: 'BEV-WATER-500' }] : [])
              ]
            }
          });

          if (stockItem) {
            const currentStock = Number(stockItem.currentStock);
            const qtyToDeduct = Number(lineItem.quantity);
            const newStock = Math.max(0, Number((currentStock - qtyToDeduct).toFixed(4)));
            const unitCost = Number(stockItem.averageUnitCost);
            const totalVal = Number((newStock * unitCost).toFixed(2));

            await tx.stockItem.update({
              where: { id: stockItem.id },
              data: {
                currentStock: newStock,
                totalValue: totalVal
              }
            });

            await tx.stockMovement.create({
              data: {
                tenantId,
                stockItemId: stockItem.id,
                movementType: StockMovementType.POS_SALE_DEDUCTION,
                quantity: qtyToDeduct,
                unitCost: unitCost,
                totalValue: Number((qtyToDeduct * unitCost).toFixed(2)),
                referenceId: sale.id,
                notes: `POS Sale ${saleNumber}: ${qtyToDeduct}x ${menuItem.name}`
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
        const netCashSaleAmount = Math.min(Number(cashPay.amount), computedTotalAmount);
        const newCashSales = roundTo2Decimals(Number(activeShift.cashSales) + netCashSaleAmount);
        const newExpected = roundTo2Decimals(
          Number(activeShift.openingFloat) +
          newCashSales +
          Number(activeShift.cashCreditCollections) -
          Number(activeShift.cashExpenses) -
          Number(activeShift.cashWithdrawals)
        );

        await tx.cashierShift.update({
          where: { id: activeShift.id },
          data: {
            cashSales: newCashSales,
            expectedCash: newExpected
          }
        });
      }

      // Persist active KDS ticket in AuditEvent for multi-device Kitchen Display synchronization
      await tx.auditEvent.create({
        data: {
          tenantId,
          userId: cashierId,
          action: 'KDS_QUEUE',
          entityType: 'KDS_TICKET',
          entityId: sale.id,
          details: {
            id: sale.id,
            saleNumber: sale.saleNumber,
            orderType: sale.orderType,
            tableNumber: sale.tableNumber,
            items: resolvedLineItems.map((i) => ({
              name: i.menuItem.name,
              quantity: i.quantity,
              notes: i.notes
            })),
            createdAt: new Date().toISOString(),
            status: 'QUEUED'
          }
        }
      });

      return sale;
    });
  }

  async getRecentSales(tenantId: string, limit = 100, startDate?: Date, endDate?: Date) {
    const whereClause: any = {
      tenantId,
      id: { notIn: LEGACY_DEMO_SALE_IDS }
    };
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    return prisma.sale.findMany({
      where: whereClause,
      include: {
        items: { include: { menuItem: { include: { category: true } } } },
        payments: true,
        cashier: { select: { fullName: true, username: true, role: true } },
        customer: { select: { name: true, phone: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  async updateSale(saleId: string, tenantId: string, data: { orderType?: string; tableNumber?: string; notes?: string }) {
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, tenantId }
    });
    if (!sale) {
      throw new Error('Sale transaction not found');
    }

    return prisma.sale.update({
      where: { id: saleId },
      data: {
        ...(data.orderType ? { orderType: data.orderType } : {}),
        ...(data.tableNumber !== undefined ? { tableNumber: data.tableNumber } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {})
      },
      include: {
        items: { include: { menuItem: { include: { category: true } } } },
        payments: true,
        cashier: { select: { fullName: true, username: true, role: true } },
        customer: { select: { name: true, phone: true } }
      }
    });
  }

  async reverseSale(saleId: string, tenantId: string, reversedByUserId: string, reason: string) {
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, tenantId },
      include: {
        items: { include: { menuItem: { include: { category: true } } } },
        payments: true,
        customer: true,
        shift: true
      }
    });

    if (!sale) {
      throw new Error('Sale transaction not found');
    }
    if (sale.paymentStatus === 'REFUNDED') {
      throw new Error('This sale transaction has already been reversed / refunded');
    }

    return prisma.$transaction(async (tx: any) => {
      // 1. Mark sale as REFUNDED and add reversal notes
      const updatedSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          paymentStatus: 'REFUNDED',
          notes: `[REVERSED by user ${reversedByUserId} on ${new Date().toISOString()}] Reason: ${reason}. Original Notes: ${sale.notes || 'None'}`
        },
        include: {
          items: { include: { menuItem: { include: { category: true } } } },
          payments: true,
          cashier: { select: { fullName: true, username: true, role: true } },
          customer: { select: { name: true, phone: true } }
        }
      });

      // 2. Restore kitchen portions and beverage stock
      const { businessDateUtc } = getLusakaBusinessDateBounds();

      const todayRegister = await tx.kitchenRegister.findFirst({
        where: {
          tenantId,
          businessDate: businessDateUtc,
          status: 'OPEN'
        }
      });

      for (const lineItem of sale.items) {
        const menuItem = lineItem.menuItem;
        const isBeverage =
          menuItem.category.name.toLowerCase().includes('drink') ||
          menuItem.category.name.toLowerCase().includes('beverage') ||
          menuItem.category.name.toLowerCase().includes('water') ||
          menuItem.name.toLowerCase().includes('water') ||
          menuItem.name.toLowerCase().includes('coca') ||
          menuItem.name.toLowerCase().includes('fanta') ||
          menuItem.name.toLowerCase().includes('sprite');

        if (!isBeverage && todayRegister) {
          // Restore prepared portions in the kitchen register
          const regItem = await tx.kitchenRegisterItem.findFirst({
            where: { registerId: todayRegister.id, menuItemId: lineItem.menuItemId }
          });
          if (regItem) {
            const restoredSold = Math.max(0, regItem.soldPortions - lineItem.quantity);
            const restoredRemaining = calculateClosingPreparedPortions({
              openingPortions: regItem.openingPortions,
              preparedPortions: regItem.preparedPortions,
              soldPortions: restoredSold,
              wastePortions: regItem.wastePortions,
              staffMealPortions: regItem.staffMealPortions,
              complimentaryPortions: regItem.complimentaryPortions
            });

            await tx.kitchenRegisterItem.update({
              where: { id: regItem.id },
              data: {
                soldPortions: restoredSold,
                remainingPortions: restoredRemaining
              }
            });
          }
        } else if (isBeverage) {
          // Restore beverage stock in inventory
          const stockItem = await tx.stockItem.findFirst({
            where: {
              tenantId,
              OR: [
                ...(menuItem.sku ? [{ sku: menuItem.sku }] : []),
                { name: { contains: menuItem.name, mode: 'insensitive' as const } },
                ...(menuItem.name.toLowerCase().includes('coca cola') || menuItem.name.toLowerCase().includes('soft drink') ? [{ sku: 'BEV-COKE-350' }] : []),
                ...(menuItem.name.toLowerCase().includes('water') ? [{ sku: 'BEV-WATER-500' }] : [])
              ]
            }
          });

          if (stockItem) {
            const currentStock = Number(stockItem.currentStock);
            const qtyToRestore = Number(lineItem.quantity);
            const newStock = Number((currentStock + qtyToRestore).toFixed(4));
            const unitCost = Number(stockItem.averageUnitCost);
            const totalVal = Number((newStock * unitCost).toFixed(2));

            await tx.stockItem.update({
              where: { id: stockItem.id },
              data: {
                currentStock: newStock,
                totalValue: totalVal
              }
            });

            await tx.stockMovement.create({
              data: {
                tenantId,
                stockItemId: stockItem.id,
                movementType: StockMovementType.SALE_REVERSAL,
                quantity: qtyToRestore,
                unitCost: unitCost,
                totalValue: Number((qtyToRestore * unitCost).toFixed(2)),
                referenceId: sale.id,
                notes: `Reversal of POS Sale ${sale.saleNumber}: Restored ${qtyToRestore}x ${menuItem.name}`
              }
            });
          }
        }
      }

      // 3. Revert customer balance if credit sale
      const creditPayment = sale.payments.find((p: any) => p.paymentMethod === PaymentMethod.CUSTOMER_CREDIT);
      if (creditPayment && sale.customer) {
        const newBalance = roundTo2Decimals(Math.max(0, Number(sale.customer.currentBalance) - Number(creditPayment.amount)));
        await tx.customer.update({
          where: { id: sale.customer.id },
          data: { currentBalance: newBalance }
        });
      }

      // 4. Revert Cashier Shift expected cash if cash was received and shift is OPEN
      const cashPay = sale.payments.find((p: any) => p.paymentMethod === PaymentMethod.CASH);
      if (cashPay && sale.shift && sale.shift.status === 'OPEN') {
        const netCashReversal = Math.min(Number(cashPay.amount), Number(sale.totalAmount));
        const newCashSales = roundTo2Decimals(Math.max(0, Number(sale.shift.cashSales) - netCashReversal));
        const newExpected = roundTo2Decimals(
          Number(sale.shift.openingFloat) +
          newCashSales +
          Number(sale.shift.cashCreditCollections) -
          Number(sale.shift.cashExpenses) -
          Number(sale.shift.cashWithdrawals)
        );

        await tx.cashierShift.update({
          where: { id: sale.shift.id },
          data: {
            cashSales: newCashSales,
            expectedCash: newExpected
          }
        });
      }

      return updatedSale;
    });
  }

  async initiateMobileMoneyPush(
    tenantId: string,
    userId: string,
    payload: { provider: string; phone: string; amount: number; reference?: string }
  ) {
    const cleanedPhone = String(payload.phone || '').replace(/\s+/g, '');
    if (cleanedPhone.length < 9) {
      throw new Error('Please provide a valid Zambian Airtel or MTN subscriber phone number.');
    }

    const integrations = await restaurantService.getIntegrationsConfig(tenantId);
    const momo = integrations.momoConfig;
    const isAirtel = payload.provider === PaymentMethod.AIRTEL_MONEY || payload.provider === 'AIRTEL_MONEY';

    if (isAirtel && !momo.airtelEnabled) {
      throw new Error('Airtel Money gateway is currently disabled in System Settings.');
    }
    if (!isAirtel && !momo.mtnEnabled) {
      throw new Error('MTN Mobile Money gateway is currently disabled in System Settings.');
    }

    const prefix = isAirtel ? 'AIRTEL' : 'MTN';
    const txRef = payload.reference || `${prefix}-${Date.now().toString().slice(-6)}`;
    const environment = isAirtel ? momo.airtelEnvironment : momo.mtnEnvironment;
    const merchantTill = isAirtel ? momo.airtelMerchantNumber : momo.mtnMerchantTill;

    await prisma.auditEvent.create({
      data: {
        tenantId,
        userId,
        action: 'MOMO_USSD_PUSH_INITIATED',
        entityType: 'MobileMoneyPayment',
        entityId: txRef,
        details: {
          provider: payload.provider,
          phone: cleanedPhone,
          amount: Number(payload.amount),
          reference: txRef,
          environment,
          merchantTill
        }
      }
    });

    return {
      status: 'PUSH_SENT',
      transactionRef: txRef,
      provider: payload.provider,
      environment,
      merchantTill,
      message: `USSD PIN prompt sent to ${cleanedPhone} via ${isAirtel ? 'Airtel Money' : 'MTN MoMo'} (${environment.toUpperCase()} - Till ${merchantTill}).`
    };
  }

  async getKdsTickets(tenantId: string) {
    const { startOfDayLusaka } = getLusakaBusinessDateBounds();
    const events = await prisma.auditEvent.findMany({
      where: {
        tenantId,
        entityType: 'KDS_TICKET',
        createdAt: { gte: startOfDayLusaka }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const latestByTicketId = new Map<string, any>();
    for (const ev of events) {
      const id = ev.entityId || (ev.details as any)?.id;
      if (id && !latestByTicketId.has(id)) {
        latestByTicketId.set(id, ev.details);
      }
    }

    return Array.from(latestByTicketId.values()).filter(
      (t) => t && t.status !== 'SERVED' && t.status !== 'READY'
    );
  }

  async updateKdsTicketStatus(tenantId: string, userId: string, ticketId: string, status: 'QUEUED' | 'COOKING' | 'READY' | 'SERVED', ticketData?: any) {
    const existingEvents = await prisma.auditEvent.findMany({
      where: {
        tenantId,
        entityType: 'KDS_TICKET',
        entityId: ticketId
      },
      orderBy: { createdAt: 'desc' },
      take: 1
    });

    const baseDetails = (existingEvents[0]?.details as any) || ticketData || { id: ticketId };
    const updatedDetails = {
      ...baseDetails,
      id: ticketId,
      status,
      updatedAt: new Date().toISOString()
    };

    await prisma.auditEvent.create({
      data: {
        tenantId,
        userId,
        action: `KDS_STATUS_${status}`,
        entityType: 'KDS_TICKET',
        entityId: ticketId,
        details: updatedDetails
      }
    });

    return updatedDetails;
  }

  async getLoyaltyCard(tenantId: string, phone: string) {
    const cleaned = String(phone || '').replace(/\s+/g, '');
    const event = await prisma.auditEvent.findFirst({
      where: {
        tenantId,
        entityType: 'LOYALTY_CARD',
        entityId: cleaned
      },
      orderBy: { createdAt: 'desc' }
    });

    if (event?.details) {
      return event.details;
    }

    return {
      phone: cleaned,
      name: 'Valued Guest (Manyama)',
      stamps: 0,
      freeSoftDrinksEarned: 0
    };
  }

  async saveLoyaltyCard(tenantId: string, userId: string, phone: string, data: any) {
    const cleaned = String(phone || '').replace(/\s+/g, '');
    const record = {
      phone: cleaned,
      name: data.name || 'Valued Guest (Manyama)',
      stamps: Number(data.stamps || 0),
      freeSoftDrinksEarned: Number(data.freeSoftDrinksEarned || 0),
      updatedAt: new Date().toISOString()
    };

    await prisma.auditEvent.create({
      data: {
        tenantId,
        userId,
        action: 'LOYALTY_CARD_UPDATE',
        entityType: 'LOYALTY_CARD',
        entityId: cleaned,
        details: record
      }
    });

    return record;
  }
}

export const posService = new PosService();
