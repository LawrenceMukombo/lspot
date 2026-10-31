import { Router, Response } from 'express';
import { shiftService } from '../services/shift.service.js';
import { authenticate, RequestWithUser, requireRole } from '../middleware/auth.js';
import { OpenShiftSchema, CloseShiftSchema } from '@lspot/validation';
import { UserRole } from '@lspot/shared';

export const shiftRouter = Router();

shiftRouter.get('/current', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const shift = await shiftService.getCurrentShift(req.user!.id, req.user!.tenantId);
    return res.json({ success: true, data: shift });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

shiftRouter.post(
  '/open',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER),
  async (req: RequestWithUser, res: Response) => {
    try {
      const parsed = OpenShiftSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: parsed.error.issues
        });
      }

      const shift = await shiftService.openShift(
        req.user!.tenantId,
        req.user!.branchId,
        req.user!.id,
        parsed.data
      );
      return res.status(201).json({ success: true, message: 'Shift opened successfully', data: shift });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

shiftRouter.post(
  '/close',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER),
  async (req: RequestWithUser, res: Response) => {
    try {
      const parsed = CloseShiftSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: parsed.error.issues
        });
      }

      const closed = await shiftService.closeShift(req.user!.tenantId, parsed.data.shiftId, parsed.data);
      return res.json({ success: true, message: 'Shift closed and balanced successfully', data: closed });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

shiftRouter.post(
  '/withdraw',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER),
  async (req: RequestWithUser, res: Response) => {
    try {
      const updated = await shiftService.recordCashWithdrawal(req.user!.tenantId, req.user!.id, req.body);
      return res.json({
        success: true,
        message: 'Cash withdrawal (Safe Drop) recorded and drawer balance updated.',
        data: updated
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

shiftRouter.get(
  '/history',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.AUDITOR),
  async (req: RequestWithUser, res: Response) => {
    try {
      const history = await shiftService.getShiftHistory(req.user!.tenantId);
      return res.json({ success: true, data: history });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

shiftRouter.put(
  '/:id',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT),
  async (req: RequestWithUser, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updated = await shiftService.updateShift(req.user!.tenantId, id, req.body);
      return res.json({ success: true, message: 'Shift updated successfully', data: updated });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);
