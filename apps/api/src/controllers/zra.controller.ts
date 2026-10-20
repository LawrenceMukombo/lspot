import { Router, Response } from 'express';
import { zraService } from '../services/zra.service.js';
import { authenticate, RequestWithUser, requireRole } from '../middleware/auth.js';
import { UserRole } from '@lspot/shared';

export const zraRouter = Router();

zraRouter.get(
  '/compliance-status',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT),
  async (req: RequestWithUser, res: Response) => {
    try {
      const status = await zraService.getComplianceStatus(req.user!.tenantId);
      return res.json({ success: true, data: status });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

zraRouter.post(
  '/sales/:id/fiscalize',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.CASHIER),
  async (req: RequestWithUser, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await zraService.generateFiscalInvoiceSignature(id);
      return res.json({ success: true, message: 'Sale fiscalized successfully', data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);
