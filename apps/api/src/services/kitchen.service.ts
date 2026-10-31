import { prisma } from '@lspot/database';
import {
  calculateClosingPreparedPortions,
  KitchenRegisterStatus,
  StockMovementType,
  roundTo2Decimals,
  roundQuantity
} from '@lspot/shared';
import { authService } from './auth.service.js';

export class KitchenService {
  async getTodayRegister(tenantId: string, branchId?: string) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // If branchId is not provided, find the primary branch for this tenant
    let targetBranchId = branchId;
    if (!targetBranchId) {
      const branch = await prisma.branch.findFirst({ where: { tenantId } });
      targetBranchId = branch?.id || '';
    }

    let register = await prisma.kitchenRegister.findFirst({
      where: {
        tenantId,
        ...(targetBranchId ? { branchId: targetBranchId } : {}),
        businessDate: {
          gte: startOfToday,
          lte: endOfToday
        }
      },
      include: {
        items: {
          include: { menuItem: true }
        },
        batches: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // If not found with exact date range, check for any currently OPEN kitchen register for this tenant/branch
    if (!register) {
      register = await prisma.kitchenRegister.findFirst({
        where: {
          tenantId,
          ...(targetBranchId ? { branchId: targetBranchId } : {}),
          status: KitchenRegisterStatus.OPEN
        },
        include: {
          items: {
            include: { menuItem: true }
          },
          batches: true
        },
        orderBy: { businessDate: 'desc' }
      });
    }

    // If still no register exists, automatically open one
    if (!register) {
      register = await this.openRegister(tenantId, targetBranchId, startOfToday.toISOString().split('T')[0]);
    } else {
      // Ensure all active menu items are present in today's register items
      const activeMenuItems = await prisma.menuItem.findMany({
        where: { tenantId, isAvailable: true }
      });
      const existingMenuItemIds = new Set(register.items.map((i) => i.menuItemId));
      const missingItems = activeMenuItems.filter((m) => !existingMenuItemIds.has(m.id));

      if (missingItems.length > 0) {
        await prisma.kitchenRegisterItem.createMany({
          data: missingItems.map((m) => ({
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

        // Re-fetch register with all items
        register = await prisma.kitchenRegister.findUnique({
          where: { id: register.id },
          include: {
            items: {
              include: { menuItem: true }
            },
            batches: true
          }
        });
      }
    }

    return register;
  }

  async openRegister(tenantId: string, branchId: string | undefined, businessDateStr: string) {
    const businessDate = new Date(businessDateStr);
    businessDate.setHours(0, 0, 0, 0);

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
        batches: true
      }
    });

    if (existing) {
      return existing;
    }

    // Carry forward closingPortions from the most recent closed register for this branch
    const previousClosedRegister = await prisma.kitchenRegister.findFirst({
      where: {
        tenantId,
        ...(targetBranchId ? { branchId: targetBranchId } : {}),
        status: KitchenRegisterStatus.CLOSED,
        businessDate: { lt: businessDate }
      },
      include: { items: true },
      orderBy: { businessDate: 'desc' }
    });

    const carryForwardMap = new Map<string, number>();
    if (previousClosedRegister) {
      for (const prevItem of previousClosedRegister.items) {
        const carryOver = Math.max(0, Number(prevItem.closingPortions || 0));
        if (carryOver > 0) {
          carryForwardMap.set(prevItem.menuItemId, carryOver);
        }
      }
    }

    // Fetch active salable menu items
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
          create: menuItems.map((m) => {
            const opening = carryForwardMap.get(m.id) || 0;
            return {
              menuItemId: m.id,
              openingPortions: opening,
              preparedPortions: 0,
              soldPortions: 0,
              wastePortions: 0,
              staffMealPortions: 0,
              complimentaryPortions: 0,
              remainingPortions: opening,
              closingPortions: 0
            };
          })
        }
      },
      include: {
        items: {
          include: { menuItem: true }
        },
        batches: true
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
    return prisma.$transaction(async (tx) => {
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

    return prisma.$transaction(async (tx) => {
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
