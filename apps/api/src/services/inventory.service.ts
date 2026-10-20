import { prisma } from '@lspot/database';
import {
  calculateMovingAverageCost,
  roundTo2Decimals,
  roundQuantity,
  StockMovementType
} from '@lspot/shared';

export class InventoryService {
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
    const stockItem = await prisma.stockItem.findUnique({
      where: { id: data.stockItemId }
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
          destinationLocationId: data.destinationLocationId,
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
    const stockItem = await prisma.stockItem.findUnique({
      where: { id: data.stockItemId }
    });

    if (!stockItem) {
      throw new Error('Stock item not found');
    }

    const qty = Number(data.quantity);
    const unitCost = Number(stockItem.averageUnitCost);

    return prisma.stockMovement.create({
      data: {
        tenantId,
        stockItemId: stockItem.id,
        sourceLocationId: data.sourceLocationId,
        destinationLocationId: data.destinationLocationId,
        movementType: StockMovementType.STORE_TO_KITCHEN_ISSUE,
        quantity: qty,
        unitCost,
        totalValue: roundTo2Decimals(qty * unitCost),
        notes: data.notes
      }
    });
  }

  async adjustStock(tenantId: string, data: any) {
    const stockItem = await prisma.stockItem.findUnique({
      where: { id: data.stockItemId }
    });

    if (!stockItem) {
      throw new Error('Stock item not found');
    }

    const currentQty = Number(stockItem.currentStock);
    const countedQty = Number(data.countedQuantity);
    const varianceQty = roundQuantity(countedQty - currentQty);
    const unitCost = Number(stockItem.averageUnitCost);

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
          sourceLocationId: data.locationId,
          movementType: StockMovementType.PHYSICAL_COUNT_ADJUSTMENT,
          quantity: varianceQty,
          unitCost,
          totalValue: roundTo2Decimals(varianceQty * unitCost),
          notes: `Stock count adjustment: ${data.reason}`
        }
      });
    });
  }
}

export const inventoryService = new InventoryService();
