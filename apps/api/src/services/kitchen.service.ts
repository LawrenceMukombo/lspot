import { prisma } from '@lspot/database';
import {
  calculateClosingPreparedPortions,
  KitchenRegisterStatus,
  StockMovementType,
  roundTo2Decimals,
  roundQuantity
} from '@lspot/shared';

export class KitchenService {
  async getTodayRegister(tenantId: string, branchId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let register = await prisma.kitchenRegister.findFirst({
      where: {
        tenantId,
        branchId,
        businessDate: today
      },
      include: {
        items: {
          include: { menuItem: true }
        },
        batches: true
      }
    });

    // If no register exists for today, automatically initialize one with all active menu items
    if (!register) {
      register = await this.openRegister(tenantId, branchId, today.toISOString().split('T')[0]);
    }

    return register;
  }

  async openRegister(tenantId: string, branchId: string, businessDateStr: string) {
    const businessDate = new Date(businessDateStr);
    businessDate.setHours(0, 0, 0, 0);

    // Fetch active salable menu items
    const menuItems = await prisma.menuItem.findMany({
      where: { tenantId, isAvailable: true }
    });

    const register = await prisma.kitchenRegister.create({
      data: {
        tenantId,
        branchId,
        businessDate,
        status: KitchenRegisterStatus.OPEN,
        items: {
          create: menuItems.map((m) => ({
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
        batches: true
      }
    });

    return register;
  }

  async recordProductionBatch(tenantId: string, chefId: string | undefined, data: any) {
    const register = await prisma.kitchenRegister.findUnique({
      where: { id: data.registerId },
      include: { items: true }
    });

    if (!register || register.status === KitchenRegisterStatus.CLOSED) {
      throw new Error('Active kitchen register not found or already closed');
    }

    const menuItem = await prisma.menuItem.findUnique({
      where: { id: data.menuItemId },
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

      // 2. Deduct ingredient stock according to recipe if recipe exists
      if (menuItem.recipe && menuItem.recipe.expectedPortionYield > 0) {
        const yieldRatio = data.actualPreparedPortions / menuItem.recipe.expectedPortionYield;

        for (const ing of menuItem.recipe.recipeIngredients) {
          const standardQty = Number(ing.quantity);
          const requiredQty = roundQuantity(standardQty * yieldRatio);
          const unitCost = Number(ing.stockItem.averageUnitCost);

          const currentStock = Number(ing.stockItem.currentStock);
          const updatedStock = Math.max(0, currentStock - requiredQty);

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
      }

      return batch;
    });
  }

  async recordWaste(data: any) {
    const regItem = await prisma.kitchenRegisterItem.findFirst({
      where: { registerId: data.registerId, menuItemId: data.menuItemId },
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

  async closeRegister(registerId: string, supervisorPin: string, itemsClosing: any[]) {
    return prisma.$transaction(async (tx) => {
      for (const item of itemsClosing) {
        const regItem = await tx.kitchenRegisterItem.findFirst({
          where: { registerId, menuItemId: item.menuItemId }
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
        where: { id: registerId },
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
