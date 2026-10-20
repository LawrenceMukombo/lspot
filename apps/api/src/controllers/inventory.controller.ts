import { Router, Response } from 'express';
import { inventoryService } from '../services/inventory.service.js';
import { authenticate, RequestWithUser, requireRole } from '../middleware/auth.js';
import { StockReceiptSchema, StockTransferSchema, StockAdjustmentSchema } from '@lspot/validation';
import { UserRole } from '@lspot/shared';

export const inventoryRouter = Router();

inventoryRouter.get('/items', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const items = await inventoryService.getStockItems(req.user!.tenantId);
    return res.json({ success: true, data: items });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

inventoryRouter.get('/movements', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const movements = await inventoryService.getMovements(req.user!.tenantId);
    return res.json({ success: true, data: movements });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

inventoryRouter.post(
  '/receive',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.STOREKEEPER),
  async (req: RequestWithUser, res: Response) => {
    try {
      const parsed = StockReceiptSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: parsed.error.issues
        });
      }

      const receipt = await inventoryService.receiveStock(req.user!.tenantId, parsed.data);
      return res.status(201).json({ success: true, message: 'Stock received successfully', data: receipt });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

inventoryRouter.post(
  '/transfer',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.STOREKEEPER, UserRole.CHEF),
  async (req: RequestWithUser, res: Response) => {
    try {
      const parsed = StockTransferSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: parsed.error.issues
        });
      }

      const transfer = await inventoryService.transferStock(req.user!.tenantId, parsed.data);
      return res.status(201).json({ success: true, message: 'Stock transferred successfully', data: transfer });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

inventoryRouter.post(
  '/adjust',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER),
  async (req: RequestWithUser, res: Response) => {
    try {
      const parsed = StockAdjustmentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: parsed.error.issues
        });
      }

      const adjustment = await inventoryService.adjustStock(req.user!.tenantId, parsed.data);
      return res.json({ success: true, message: 'Stock adjusted successfully', data: adjustment });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);
