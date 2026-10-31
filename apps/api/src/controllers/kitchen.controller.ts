import { Router, Response } from 'express';
import { kitchenService } from '../services/kitchen.service.js';
import { authenticate, RequestWithUser, requireRole } from '../middleware/auth.js';
import {
  OpenKitchenRegisterSchema,
  RecordProductionBatchSchema,
  RecordKitchenWasteSchema,
  CloseKitchenRegisterSchema
} from '@lspot/validation';
import { UserRole } from '@lspot/shared';

export const kitchenRouter = Router();

kitchenRouter.get('/registers/today', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const register = await kitchenService.getTodayRegister(
      req.user!.tenantId,
      req.user!.branchId
    );
    return res.json({ success: true, data: register });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

kitchenRouter.post(
  '/registers/open',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.CHEF),
  async (req: RequestWithUser, res: Response) => {
    try {
      const parsed = OpenKitchenRegisterSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: parsed.error.issues
        });
      }

      const register = await kitchenService.openRegister(
        req.user!.tenantId,
        req.user!.branchId,
        parsed.data.businessDate
      );
      return res.status(201).json({ success: true, data: register });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

kitchenRouter.post(
  '/batches',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.CHEF),
  async (req: RequestWithUser, res: Response) => {
    try {
      const parsed = RecordProductionBatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: parsed.error.issues
        });
      }

      const batch = await kitchenService.recordProductionBatch(
        req.user!.tenantId,
        req.user!.id,
        parsed.data
      );
      return res.status(201).json({ success: true, message: 'Production batch recorded', data: batch });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

kitchenRouter.post(
  '/waste',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.CHEF, UserRole.KITCHEN_ASSISTANT),
  async (req: RequestWithUser, res: Response) => {
    try {
      const parsed = RecordKitchenWasteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: parsed.error.issues
        });
      }

      const waste = await kitchenService.recordWaste(req.user!.tenantId, parsed.data);
      return res.json({ success: true, message: 'Kitchen waste recorded', data: waste });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

kitchenRouter.post(
  '/registers/close',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.CHEF),
  async (req: RequestWithUser, res: Response) => {
    try {
      const parsed = CloseKitchenRegisterSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: parsed.error.issues
        });
      }

      const closed = await kitchenService.closeRegister(
        req.user!.tenantId,
        parsed.data.registerId,
        parsed.data.supervisorPin,
        parsed.data.itemsClosing
      );
      return res.json({ success: true, message: 'Kitchen register closed and reconciled', data: closed });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

kitchenRouter.put(
  '/items/:id',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.CHEF),
  async (req: RequestWithUser, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updated = await kitchenService.updateRegisterItem(req.user!.tenantId, id, req.body);
      return res.json({ success: true, message: 'Kitchen register item updated', data: updated });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

kitchenRouter.put(
  '/batches/:id',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.CHEF),
  async (req: RequestWithUser, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updated = await kitchenService.updateProductionBatch(req.user!.tenantId, id, req.body);
      return res.json({ success: true, message: 'Cooking batch updated', data: updated });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);
