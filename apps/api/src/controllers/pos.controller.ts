import { Router, Response } from 'express';
import { posService } from '../services/pos.service.js';
import { authenticate, RequestWithUser, requireRole } from '../middleware/auth.js';
import { PosCheckoutSchema } from '@lspot/validation';
import { UserRole } from '@lspot/shared';

export const posRouter = Router();

posRouter.get('/catalog', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const catalog = await posService.getCatalog(req.user!.tenantId);
    return res.json({ success: true, data: catalog });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

posRouter.post(
  '/checkout',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER),
  async (req: RequestWithUser, res: Response) => {
    try {
      const parsed = PosCheckoutSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: parsed.error.issues
        });
      }

      const sale = await posService.checkout(
        req.user!.tenantId,
        req.user!.branchId,
        req.user!.id,
        parsed.data
      );
      return res.status(201).json({ success: true, message: 'Sale completed successfully', data: sale });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

posRouter.get('/sales', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const sales = await posService.getRecentSales(req.user!.tenantId);
    return res.json({ success: true, data: sales });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
