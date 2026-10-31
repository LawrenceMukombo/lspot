import { prisma } from '@lspot/database';
import { posService } from './pos.service.js';
import { kitchenService } from './kitchen.service.js';
import { inventoryService } from './inventory.service.js';

export class SyncService {
  async processBatch(tenantId: string, branchId: string, cashierId: string, deviceId: string, commands: any[]) {
    const results: any[] = [];

    for (const cmd of commands) {
      // 1. Idempotency check in sync_commands
      const existing = await prisma.syncCommand.findUnique({
        where: { idempotencyKey: cmd.idempotencyKey }
      });

      if (existing) {
        results.push({
          idempotencyKey: cmd.idempotencyKey,
          status: 'ALREADY_PROCESSED',
          message: 'Command previously processed successfully.'
        });
        continue;
      }

      try {
        let actionResult: any = null;

        if (cmd.commandType === 'POS_CHECKOUT') {
          actionResult = await posService.checkout(tenantId, branchId, cashierId, {
            ...cmd.payload,
            idempotencyKey: cmd.idempotencyKey
          });
        } else if (cmd.commandType === 'KITCHEN_BATCH') {
          actionResult = await kitchenService.recordProductionBatch(tenantId, cashierId, cmd.payload);
        } else if (cmd.commandType === 'KITCHEN_WASTE') {
          actionResult = await kitchenService.recordWaste(tenantId, cmd.payload);
        } else if (cmd.commandType === 'STOCK_RECEIPT') {
          actionResult = await inventoryService.receiveStock(tenantId, cmd.payload);
        }

        await prisma.syncCommand.create({
          data: {
            deviceId,
            idempotencyKey: cmd.idempotencyKey,
            commandType: cmd.commandType,
            payload: cmd.payload,
            status: 'PROCESSED',
            clientTime: new Date(cmd.clientTimestamp)
          }
        });

        results.push({
          idempotencyKey: cmd.idempotencyKey,
          status: 'PROCESSED',
          data: actionResult
        });
      } catch (err: any) {
        await prisma.syncCommand.create({
          data: {
            deviceId,
            idempotencyKey: cmd.idempotencyKey,
            commandType: cmd.commandType,
            payload: cmd.payload,
            status: 'CONFLICT',
            errorMessage: err.message,
            clientTime: new Date(cmd.clientTimestamp)
          }
        });

        results.push({
          idempotencyKey: cmd.idempotencyKey,
          status: 'CONFLICT',
          error: err.message
        });
      }
    }

    return results;
  }

  async getDeltaSync(tenantId: string) {
    const categories = await prisma.menuCategory.findMany({
      where: { tenantId, isActive: true }
    });
    const menuItems = await prisma.menuItem.findMany({
      where: { tenantId, isAvailable: true }
    });
    const customers = await prisma.customer.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        phone: true,
        creditLimit: true,
        currentBalance: true,
        paymentTermsDays: true
      }
    });

    return {
      syncedAt: new Date().toISOString(),
      categories,
      menuItems,
      customers
    };
  }
}

export const syncService = new SyncService();
