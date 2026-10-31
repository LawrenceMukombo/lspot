import { prisma } from '@lspot/database';
import {
  calculateClosingPreparedPortions,
  KitchenRegisterStatus,
  StockMovementType,
  roundTo2Decimals,
  roundQuantity
} from '@lspot/shared';
import { authService } from './auth.service.js';

export function getLusakaBusinessDateBounds(referenceDate: Date = new Date()) {
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lusaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(referenceDate);

  // @db.Date in PostgreSQL/Prisma is represented as UTC midnight YYYY-MM-DDT00:00:00.000Z
  const businessDateUtc = new Date(`${dateStr}T00:00:00.000Z`);
  // Africa/Lusaka is UTC+02:00 year-round
  const startOfDayLusaka = new Date(`${dateStr}T00:00:00.000+02:00`);
  const endOfDayLusaka = new Date(`${dateStr}T23:59:59.999+02:00`);

  return {
    dateStr,
    businessDateUtc,
    startOfDayLusaka,
    endOfDayLusaka
  };
}

export class KitchenService {
  async getTodayRegister(tenantId: string, branchId?: string) {
    const { dateStr, businessDateUtc, startOfDayLusaka, endOfDayLusaka } = getLusakaBusinessDateBounds();

    // If branchId is not provided, find the primary branch for this tenant
    let targetBranchId = branchId;
    if (!targetBranchId) {
      const branch = await prisma.branch.findFirst({ where: { tenantId } });
      targetBranchId = branch?.id || '';
    }

    // 1. Find or create today's strict daily register (businessDate = today in Africa/Lusaka)
    let register = await prisma.kitchenRegister.findFirst({
      where: {
        tenantId,
        ...(targetBranchId ? { branchId: targetBranchId } : {}),
        businessDate: businessDateUtc
      },
      include: {
        items: {
          include: { menuItem: true }
        },
        batches: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!register) {
      register = await this.openRegister(tenantId, targetBranchId, dateStr);
    }

    // 2. Reconcile & close any stale OPEN registers from previous business days (< businessDateUtc)
    //    so yesterday's cooked food never accumulates into today's register (unsold leftovers become day-end waste).
    //    If any production batch was accidentally recorded TODAY onto a stale open register, migrate that batch to today's register.
    const staleOpenRegisters = await prisma.kitchenRegister.findMany({
      where: {
        tenantId,
        ...(targetBranchId ? { branchId: targetBranchId } : {}),
        status: KitchenRegisterStatus.OPEN,
        id: { not: register.id }
      },
      include: {
        items: true,
        batches: true
      }
    });

    if (staleOpenRegisters.length > 0) {
      await prisma.$transaction(async (tx: any) => {
        for (const staleReg of staleOpenRegisters) {
          // Identify batches that were actually cooked today vs on prior days
          const batchesCookedToday = staleReg.batches.filter(
            (b: any) => new Date(b.createdAt) >= startOfDayLusaka && new Date(b.createdAt) <= endOfDayLusaka
          );
          const batchesCookedPrior = staleReg.batches.filter(
            (b: any) => new Date(b.createdAt) < startOfDayLusaka || new Date(b.createdAt) > endOfDayLusaka
          );

          // Move today's batches onto today's register so today's cooked food is preserved
          for (const todayBatch of batchesCookedToday) {
            await tx.productionBatch.update({
              where: { id: todayBatch.id },
              data: { registerId: register!.id }
            });
          }

          // Recompute the stale register's items using only prior-day batches, and treat any unsold remainder as day-end waste
          for (const staleItem of staleReg.items) {
            const priorPrepared = batchesCookedPrior
              .filter((b: any) => b.menuItemId === staleItem.menuItemId)
              .reduce((sum: number, b: any) => sum + Number(b.actualPreparedPortions || 0), 0);

            const consumedBeforeClose =
              Number(staleItem.soldPortions || 0) +
              Number(staleItem.wastePortions || 0) +
              Number(staleItem.staffMealPortions || 0) +
              Number(staleItem.complimentaryPortions || 0);

            const unsoldLeftover = Math.max(
              0,
              Number(staleItem.openingPortions || 0) + priorPrepared - consumedBeforeClose
            );

            await tx.kitchenRegisterItem.update({
              where: { id: staleItem.id },
              data: {
                preparedPortions: priorPrepared,
                wastePortions: Number(staleItem.wastePortions || 0) + unsoldLeftover,
                remainingPortions: 0,
                closingPortions: 0,
                notes:
                  unsoldLeftover > 0
                    ? `Day-end auto-reconciled: ${unsoldLeftover} unsold portion(s) recorded as end-of-day waste`
                    : staleItem.notes
              }
            });
          }

          await tx.kitchenRegister.update({
            where: { id: staleReg.id },
            data: {
              status: KitchenRegisterStatus.CLOSED,
              closedAt: new Date(),
              notes: 'Auto-closed at end of business day (strict daily kitchen register policy)'
            }
          });
        }
      });
    }

    // 3. Ensure all active menu items are present in today's register items
    const activeMenuItems = await prisma.menuItem.findMany({
      where: { tenantId, isAvailable: true }
    });
    const currentItems = await prisma.kitchenRegisterItem.findMany({
      where: { registerId: register.id }
    });
    const existingMenuItemIds = new Set(currentItems.map((i: any) => i.menuItemId));
    const missingItems = activeMenuItems.filter((m: any) => !existingMenuItemIds.has(m.id));

    if (missingItems.length > 0) {
      await prisma.kitchenRegisterItem.createMany({
        data: missingItems.map((m: any) => ({
          registerId: register!.id,
          menuItemId: m.id,
          openingPortions: 0,
          preparedPortions: 0,
          soldPortions: 0,
          wastePortions: 0,
          staffMealPortions: 0,
          complimentaryPortions: 0,
          remainingPortions: 0,
          closingPortions: 0
        }))
      });
    }

    // 4. Authoritative Daily Sync: reconcile today's register items strictly against actual ProductionBatch records
    //    and real POS sales today (excluding legacy demo seed sales sale-001..005).
    const todayBatches = await prisma.productionBatch.findMany({
      where: { registerId: register.id }
    });
    const realSalesToday = await prisma.sale.findMany({
      where: {
        tenantId,
        id: { notIn: ['sale-001', 'sale-002', 'sale-003', 'sale-004', 'sale-005'] },
        paymentStatus: { not: 'REFUNDED' },
        createdAt: { gte: startOfDayLusaka, lte: endOfDayLusaka }
      },
      include: { items: true }
    });
    const soldByMenuItem = new Map<string, number>();
    for (const s of realSalesToday) {
      for (const it of s.items) {
        soldByMenuItem.set(it.menuItemId, (soldByMenuItem.get(it.menuItemId) || 0) + Number(it.quantity || 0));
      }
    }

    const todayItems = await prisma.kitchenRegisterItem.findMany({
      where: { registerId: register.id }
    });

    for (const item of todayItems) {
      const preparedToday = todayBatches
        .filter((b: any) => b.menuItemId === item.menuItemId)
        .reduce((sum: number, b: any) => sum + Number(b.actualPreparedPortions || 0), 0);
      const soldToday = soldByMenuItem.get(item.menuItemId) || 0;
      const isLegacySeedRowWithNoBatches =
        ['kitem-001', 'kitem-002', 'kitem-003', 'kitem-004', 'kitem-005'].includes(item.id) &&
        preparedToday === 0;
      const wasteToday = isLegacySeedRowWithNoBatches ? 0 : item.wastePortions;
      const staffToday = isLegacySeedRowWithNoBatches ? 0 : item.staffMealPortions;
      const compToday = isLegacySeedRowWithNoBatches ? 0 : item.complimentaryPortions;

      const remainingToday = calculateClosingPreparedPortions({
        openingPortions: 0,
        preparedPortions: preparedToday,
        soldPortions: soldToday,
        wastePortions: wasteToday,
        staffMealPortions: staffToday,
        complimentaryPortions: compToday
      });

      if (
        item.openingPortions !== 0 ||
        item.preparedPortions !== preparedToday ||
        item.soldPortions !== soldToday ||
        item.wastePortions !== wasteToday ||
        item.staffMealPortions !== staffToday ||
        item.complimentaryPortions !== compToday ||
        item.remainingPortions !== remainingToday
      ) {
        await prisma.kitchenRegisterItem.update({
          where: { id: item.id },
          data: {
            openingPortions: 0,
            preparedPortions: preparedToday,
            soldPortions: soldToday,
            wastePortions: wasteToday,
            staffMealPortions: staffToday,
            complimentaryPortions: compToday,
            remainingPortions: remainingToday
          }
        });
      }
    }

    // Re-fetch today's authoritative register with items and batches ordered newest-first
    return prisma.kitchenRegister.findUnique({
      where: { id: register.id },
      include: {
        items: {
          include: { menuItem: true }
        },
        batches: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }

  async openRegister(tenantId: string, branchId: string | undefined, businessDateStr: string) {
    const cleanDateStr = String(businessDateStr).split('T')[0];
    const businessDate = new Date(`${cleanDateStr}T00:00:00.000Z`);

    let targetBranchId = branchId;
    if (!targetBranchId) {
      const branch = await prisma.branch.findFirst({ where: { tenantId } });
      targetBranchId = branch?.id || '';
    }

    // Check if a register already exists for this branch and date
    const existing = await prisma.kitchenRegister.findFirst({
      where: {
        tenantId,
        branchId: targetBranchId,
        businessDate
      },
      include: {
        items: {
          include: { menuItem: true }
        },
        batches: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (existing) {
      return existing;
    }

    // Strict daily register: each day starts at 0 opening portions (yesterday's unsold cooked food does not carry over)
    const menuItems = await prisma.menuItem.findMany({
      where: { tenantId, isAvailable: true }
    });

    const register = await prisma.kitchenRegister.create({
      data: {
        tenantId,
        branchId: targetBranchId,
        businessDate,
        status: KitchenRegisterStatus.OPEN,
        items: {
          create: menuItems.map((m: any) => ({
            menuItemId: m.id,
            openingPortions: 0,
            preparedPortions: 0,
            soldPortions: 0,
            wastePortions: 0,
            staffMealPortions: 0,
            complimentaryPortions: 0,
            remainingPortions: 0,
            closingPortions: 0
          }))
        }
      },
      include: {
        items: {
          include: { menuItem: true }
        },
        batches: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    return register;
  }

  async recordProductionBatch(tenantId: string, chefId: string | undefined, data: any) {
    const register = await prisma.kitchenRegister.findFirst({
      where: { id: data.registerId, tenantId },
      include: { items: true }
    });

    if (!register || register.status === KitchenRegisterStatus.CLOSED) {
      throw new Error('Active kitchen register not found or already closed');
    }

    const menuItem = await prisma.menuItem.findFirst({
      where: { id: data.menuItemId, tenantId },
      include: {
        recipe: {
          include: { recipeIngredients: { include: { stockItem: true } } }
        }
      }
    });

    if (!menuItem) {
      throw new Error('Menu item not found');
    }

    // Atomic transaction: create batch, deduct raw ingredients from stock, increment prepared portions
    return prisma.$transaction(async (tx: any) => {
      // 1. Create production batch record
      const batch = await tx.productionBatch.create({
        data: {
          registerId: register.id,
          menuItemId: menuItem.id,
          plannedPortions: data.plannedPortions,
          actualPreparedPortions: data.actualPreparedPortions,
          chefId: chefId || null,
          notes: data.notes
        }
      });

      // 2. Deduct ingredient stock according to recipe if recipe exists (including preparation loss percentage)
      if (menuItem.recipe && menuItem.recipe.expectedPortionYield > 0) {
        const yieldRatio = data.actualPreparedPortions / menuItem.recipe.expectedPortionYield;

        for (const ing of menuItem.recipe.recipeIngredients) {
          const standardQty = Number(ing.quantity);
          const lossFactor = 1 + Number(ing.lossPercentage || 0) / 100;
          const requiredQty = roundQuantity(standardQty * yieldRatio * lossFactor);
          const unitCost = Number(ing.stockItem.averageUnitCost);

          const currentStock = Number(ing.stockItem.currentStock);
          const updatedStock = Math.max(0, roundQuantity(currentStock - requiredQty));

          await tx.stockItem.update({
            where: { id: ing.stockItemId },
            data: {
              currentStock: updatedStock,
              totalValue: roundTo2Decimals(updatedStock * unitCost)
            }
          });

          await tx.stockMovement.create({
            data: {
              tenantId,
              stockItemId: ing.stockItemId,
              movementType: StockMovementType.PRODUCTION_CONSUMPTION,
              quantity: -requiredQty,
              unitCost,
              totalValue: roundTo2Decimals(requiredQty * unitCost),
              referenceId: batch.id,
              notes: `Cooking consumption for batch: ${data.actualPreparedPortions} portions of ${menuItem.name}`
            }
          });
        }
      }

      // 3. Update Register Item prepared & remaining portions
      const regItem = await tx.kitchenRegisterItem.findFirst({
        where: { registerId: register.id, menuItemId: menuItem.id }
      });

      if (regItem) {
        const newPrepared = regItem.preparedPortions + data.actualPreparedPortions;
        const newRemaining = calculateClosingPreparedPortions({
          openingPortions: regItem.openingPortions,
          preparedPortions: newPrepared,
          soldPortions: regItem.soldPortions,
          wastePortions: regItem.wastePortions,
          staffMealPortions: regItem.staffMealPortions,
          complimentaryPortions: regItem.complimentaryPortions
        });

        await tx.kitchenRegisterItem.update({
          where: { id: regItem.id },
          data: {
            preparedPortions: newPrepared,
            remainingPortions: newRemaining
          }
        });
      } else {
        await tx.kitchenRegisterItem.create({
          data: {
            registerId: register.id,
            menuItemId: menuItem.id,
            openingPortions: 0,
            preparedPortions: data.actualPreparedPortions,
            soldPortions: 0,
            wastePortions: 0,
            staffMealPortions: 0,
            complimentaryPortions: 0,
            remainingPortions: data.actualPreparedPortions,
            closingPortions: 0
          }
        });
      }

      return batch;
    });
  }

  async recordWaste(tenantId: string, data: any) {
    const regItem = await prisma.kitchenRegisterItem.findFirst({
      where: {
        registerId: data.registerId,
        menuItemId: data.menuItemId,
        register: { tenantId }
      },
      include: { register: true, menuItem: true }
    });

    if (!regItem || regItem.register.status === KitchenRegisterStatus.CLOSED) {
      throw new Error('Register item not found or register closed');
    }

    const wastePortions = data.portionsWasted;
    let newWaste = regItem.wastePortions;
    let newStaff = regItem.staffMealPortions;
    let newComp = regItem.complimentaryPortions;

    if (data.isStaffMeal) {
      newStaff += wastePortions;
    } else if (data.isComplimentary) {
      newComp += wastePortions;
    } else {
      newWaste += wastePortions;
    }

    const remaining = calculateClosingPreparedPortions({
      openingPortions: regItem.openingPortions,
      preparedPortions: regItem.preparedPortions,
      soldPortions: regItem.soldPortions,
      wastePortions: newWaste,
      staffMealPortions: newStaff,
      complimentaryPortions: newComp
    });

    return prisma.kitchenRegisterItem.update({
      where: { id: regItem.id },
      data: {
        wastePortions: newWaste,
        staffMealPortions: newStaff,
        complimentaryPortions: newComp,
        remainingPortions: remaining,
        notes: data.wasteReason
      }
    });
  }

  async closeRegister(tenantId: string, registerId: string, supervisorPin: string, itemsClosing: any[]) {
    if (!supervisorPin) {
      throw new Error('Supervisor PIN is required to close and reconcile the kitchen register');
    }

    const verification = await authService.verifySupervisorOverride(tenantId, String(supervisorPin).trim());
    if (!verification.valid) {
      throw new Error(verification.message || 'Invalid Supervisor PIN for kitchen register closure');
    }

    const register = await prisma.kitchenRegister.findFirst({
      where: { id: registerId, tenantId }
    });
    if (!register) {
      throw new Error('Kitchen register not found');
    }

    return prisma.$transaction(async (tx: any) => {
      for (const item of itemsClosing) {
        const regItem = await tx.kitchenRegisterItem.findFirst({
          where: { registerId: register.id, menuItemId: item.menuItemId }
        });

        if (regItem) {
          await tx.kitchenRegisterItem.update({
            where: { id: regItem.id },
            data: {
              closingPortions: item.actualCountedPortions,
              notes: item.reasonForVariance || regItem.notes
            }
          });
        }
      }

      const closed = await tx.kitchenRegister.update({
        where: { id: register.id },
        data: {
          status: KitchenRegisterStatus.CLOSED,
          closedAt: new Date()
        },
        include: { items: { include: { menuItem: true } } }
      });

      return closed;
    });
  }
}

export const kitchenService = new KitchenService();
