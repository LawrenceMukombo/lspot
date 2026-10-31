import { Router, Response } from 'express';
import { zraService } from '../services/zra.service.js';
import { authenticate, RequestWithUser, requireRole } from '../middleware/auth.js';
import { auditMiddleware } from '../middleware/audit.js';
import { UserRole } from '@lspot/shared';

export const zraRouter = Router();

zraRouter.get(
  '/compliance-status',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT),
  async (req: RequestWithUser, res: Response) => {
    try {
      const status = await zraService.getComplianceStatus(req.user!.tenantId);
      return res.json({ success: true, data: status });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

zraRouter.put(
  '/config',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER),
  auditMiddleware('UPDATE_ZRA_CONFIG', 'ZraConfig'),
  async (req: RequestWithUser, res: Response) => {
    try {
      const updated = await zraService.updateZraConfig(req.user!.tenantId, req.user!.id, req.body);
      return res.json({
        success: true,
        message: 'ZRA Smart Invoice configuration updated successfully.',
        data: updated
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

zraRouter.post(
  '/sales/:id/fiscalize',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.CASHIER),
  auditMiddleware('FISCALIZE_SALE', 'Sale'),
  async (req: RequestWithUser, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await zraService.generateFiscalInvoiceSignature(req.user!.tenantId, id);
      return res.json({ success: true, message: 'Sale fiscalized successfully', data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

zraRouter.post(
  '/fiscalize-batch',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT),
  auditMiddleware('BATCH_FISCALIZE_SALES', 'Sale'),
  async (req: RequestWithUser, res: Response) => {
    try {
      const result = await zraService.fiscalizePendingBatch(req.user!.tenantId);
      return res.json({
        success: true,
        message: `Successfully fiscalized ${result.fiscalizedCount} pending sale(s).`,
        data: result
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);
