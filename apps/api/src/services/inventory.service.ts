import { prisma } from '@lspot/database';
import {
  calculateMovingAverageCost,
  roundTo2Decimals,
  roundQuantity,
  StockMovementType
} from '@lspot/shared';
import { authService } from './auth.service.js';

export class InventoryService {
  /** Resolve a location id; falls back to tenant's main store / kitchen when id is missing or unknown. */
  private async resolveLocationId(tenantId: string, id: string | null | undefined, kind: 'STORE' | 'KITCHEN'): Promise<string | null> {
    if (id) {
      const found = await prisma.stockLocation.findFirst({ where: { id, tenantId } });
      if (found) return found.id;
    }
    const fallback = await prisma.stockLocation.findFirst({
      where: { tenantId, ...(kind === 'KITCHEN' ? { isKitchen: true } : { isMainStore: true }) }
    });
    return fallback?.id ?? null;
  }
  async getStockItems(tenantId: string) {
    const items = await prisma.stockItem.findMany({
      where: { tenantId, isActive: true },
      include: {
        category: true
      },
      orderBy: { name: 'asc' }
    });

    return items.map((i) => {
      const stock = Number(i.currentStock);
      const reorder = Number(i.reorderLevel);
      const unitCost = Number(i.averageUnitCost);
      const totalValue = roundTo2Decimals(stock * unitCost);

      return {
        ...i,
        currentStock: stock,
        reorderLevel: reorder,
        averageUnitCost: unitCost,
        totalValue,
        isLowStock: stock <= reorder
      };
    });
  }

  async getMovements(tenantId: string, limit = 100) {
    return prisma.stockMovement.findMany({
      where: { tenantId },
      include: {
        stockItem: true,
        sourceLocation: true,
        destinationLocation: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  async receiveStock(tenantId: string, data: any) {
    const stockItem = await prisma.stockItem.findFirst({
      where: { id: data.stockItemId, tenantId }
    });

    if (!stockItem) {
      throw new Error('Stock item not found');
    }

    const currentQty = Number(stockItem.currentStock);
    const currentCost = Number(stockItem.averageUnitCost);
    const incomingQty = Number(data.quantity);
    const incomingCost = Number(data.unitCost);

    // Recalculate Moving Weighted Average Cost
    const newUnitCost = calculateMovingAverageCost(currentQty, currentCost, incomingQty, incomingCost);
    const newStockQty = roundQuantity(currentQty + incomingQty);
    const newTotalVal = roundTo2Decimals(newStockQty * newUnitCost);
    const destinationLocationId = await this.resolveLocationId(tenantId, data.destinationLocationId, 'STORE');

    // Atomic transaction: movement record + balance update
    return prisma.$transaction(async (tx) => {
      await tx.stockItem.update({
        where: { id: stockItem.id },
        data: {
          currentStock: newStockQty,
          averageUnitCost: newUnitCost,
          totalValue: newTotalVal
        }
      });

      const movement = await tx.stockMovement.create({
        data: {
          tenantId,
          stockItemId: stockItem.id,
          destinationLocationId,
          movementType: StockMovementType.PURCHASE_RECEIPT,
          quantity: incomingQty,
          unitCost: incomingCost,
          totalValue: roundTo2Decimals(incomingQty * incomingCost),
          referenceId: data.invoiceReference,
          notes: data.notes
        }
      });

      return movement;
    });
  }

  async transferStock(tenantId: string, data: any) {
    const stockItem = await prisma.stockItem.findFirst({
      where: { id: data.stockItemId, tenantId }
    });

    if (!stockItem) {
      throw new Error('Stock item not found');
    }

    const qty = Number(data.quantity);
    const unitCost = Number(stockItem.averageUnitCost);
    const sourceLocationId = await this.resolveLocationId(tenantId, data.sourceLocationId, 'STORE');
    const destinationLocationId = await this.resolveLocationId(tenantId, data.destinationLocationId, 'KITCHEN');

    return prisma.stockMovement.create({
      data: {
        tenantId,
        stockItemId: stockItem.id,
        sourceLocationId,
        destinationLocationId,
        movementType: StockMovementType.STORE_TO_KITCHEN_ISSUE,
        quantity: qty,
        unitCost,
        totalValue: roundTo2Decimals(qty * unitCost),
        notes: data.notes
      }
    });
  }

  async adjustStock(tenantId: string, data: any) {
    if (!data.supervisorPin) {
      throw new Error('Supervisor PIN is required for stock adjustments');
    }

    const verification = await authService.verifySupervisorOverride(tenantId, String(data.supervisorPin).trim());
    if (!verification.valid) {
      throw new Error(verification.message || 'Invalid Supervisor PIN for stock adjustment');
    }

    const stockItem = await prisma.stockItem.findFirst({
      where: { id: data.stockItemId, tenantId }
    });

    if (!stockItem) {
      throw new Error('Stock item not found');
    }

    const currentQty = Number(stockItem.currentStock);
    const countedQty = Number(data.countedQuantity);
    const varianceQty = roundQuantity(countedQty - currentQty);
    const unitCost = Number(stockItem.averageUnitCost);
    const adjustLocationId = await this.resolveLocationId(tenantId, data.locationId, 'STORE');

    return prisma.$transaction(async (tx) => {
      await tx.stockItem.update({
        where: { id: stockItem.id },
        data: {
          currentStock: countedQty,
          totalValue: roundTo2Decimals(countedQty * unitCost)
        }
      });

      return tx.stockMovement.create({
        data: {
          tenantId,
          stockItemId: stockItem.id,
          sourceLocationId: adjustLocationId,
          movementType: StockMovementType.PHYSICAL_COUNT_ADJUSTMENT,
          quantity: varianceQty,
          unitCost,
          totalValue: roundTo2Decimals(varianceQty * unitCost),
          notes: `Stock count adjustment: ${data.reason} (Approved by ${verification.supervisor?.fullName})`
        }
      });
    });
  }

  async createStockItem(tenantId: string, data: any) {
    let categoryId = data.categoryId;
    if (!categoryId) {
      const cat = await prisma.stockCategory.findFirst({
        where: { tenantId }
      });
      if (cat) {
        categoryId = cat.id;
      } else {
        const newCat = await prisma.stockCategory.create({
          data: {
            tenantId,
            name: data.category ? String(data.category).replace(/_/g, ' ') : 'General Inventory',
            code: data.category || 'GEN'
          }
        });
        categoryId = newCat.id;
      }
    }

    const initialQty = Number(data.initialQuantity || 0);
    const unitCost = Number(data.unitCost || 0);

    return prisma.stockItem.create({
      data: {
        tenantId,
        categoryId,
        name: data.name,
        sku: data.sku,
        unitOfMeasure: data.unitOfMeasure,
        reorderLevel: Number(data.reorderLevel || 5),
        currentStock: initialQty,
        averageUnitCost: unitCost,
        totalValue: roundTo2Decimals(initialQty * unitCost),
        isActive: true
      },
      include: { category: true }
    });
  }

  async updateStockItem(tenantId: string, id: string, data: any) {
    const existing = await prisma.stockItem.findFirst({
      where: { id, tenantId }
    });
    if (!existing) {
      throw new Error('Stock item not found');
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.unitOfMeasure !== undefined) updateData.unitOfMeasure = data.unitOfMeasure;
    if (data.reorderLevel !== undefined) updateData.reorderLevel = Number(data.reorderLevel);
    if (data.currentStock !== undefined) {
      updateData.currentStock = Number(data.currentStock);
      if (data.unitCost !== undefined) {
        updateData.averageUnitCost = Number(data.unitCost);
        updateData.totalValue = roundTo2Decimals(Number(data.currentStock) * Number(data.unitCost));
      }
    }
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

    return prisma.stockItem.update({
      where: { id: existing.id },
      data: updateData,
      include: { category: true }
    });
  }

  async deleteStockItem(tenantId: string, id: string) {
    const existing = await prisma.stockItem.findFirst({
      where: { id, tenantId }
    });
    if (!existing) {
      throw new Error('Stock item not found');
    }

    return prisma.stockItem.update({
      where: { id: existing.id },
      data: { isActive: false }
    });
  }

  async getDailyStockReconciliation(tenantId: string, targetDate = new Date()) {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const stockItems = await prisma.stockItem.findMany({
      where: { tenantId, isActive: true },
      include: { category: true },
      orderBy: { name: 'asc' }
    });

    const movements = await prisma.stockMovement.findMany({
      where: {
        tenantId,
        createdAt: { gte: startOfDay, lte: endOfDay }
      }
    });

    return stockItems.map((item) => {
      const itemMovements = movements.filter((m) => m.stockItemId === item.id);
      
      let receivedToday = 0;
      let consumedToday = 0;
      let adjustedToday = 0;

      for (const m of itemMovements) {
        const qty = Number(m.quantity);
        if (m.movementType === StockMovementType.PURCHASE_RECEIPT) {
          receivedToday += Math.abs(qty);
        } else if (m.movementType === StockMovementType.SALE_REVERSAL) {
          consumedToday = Math.max(0, consumedToday - Math.abs(qty));
        } else if (
          m.movementType === StockMovementType.PRODUCTION_CONSUMPTION ||
          m.movementType === StockMovementType.POS_SALE_DEDUCTION ||
          m.movementType === StockMovementType.WASTE_PREPARATION ||
          m.movementType === StockMovementType.WASTE_EXPIRED
        ) {
          consumedToday += Math.abs(qty);
        } else if (m.movementType === StockMovementType.PHYSICAL_COUNT_ADJUSTMENT) {
          adjustedToday += qty;
        }
      }

      const currentStock = Number(item.currentStock);
      const theoreticalOpening = roundQuantity(Math.max(0, currentStock - receivedToday + consumedToday - adjustedToday));
      const unitCost = Number(item.averageUnitCost);

      return {
        id: item.id,
        name: item.name,
        sku: item.sku,
        category: item.category?.name || 'General',
        unitOfMeasure: item.unitOfMeasure,
        unitCost,
        theoreticalOpening,
        receivedToday: roundQuantity(receivedToday),
        consumedToday: roundQuantity(consumedToday),
        adjustedToday: roundQuantity(adjustedToday),
        closingStock: currentStock,
        closingValue: roundTo2Decimals(currentStock * unitCost),
        variance: 0
      };
    });
  }
}

export const inventoryService = new InventoryService();
