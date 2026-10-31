import { Router, Response } from 'express';
import { restaurantService } from '../services/restaurant.service.js';
import { authenticate, RequestWithUser, requireRole } from '../middleware/auth.js';
import { auditMiddleware } from '../middleware/audit.js';
import { UserRole } from '@lspot/shared';

export const restaurantRouter = Router();

restaurantRouter.get('/profile', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const profile = await restaurantService.getProfile(req.user!.tenantId);
    return res.json({ success: true, data: profile });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

restaurantRouter.put(
  '/profile',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER),
  auditMiddleware('UPDATE_RESTAURANT_PROFILE', 'Tenant'),
  async (req: RequestWithUser, res: Response) => {
    try {
      const updated = await restaurantService.updateProfile(req.user!.tenantId, req.body);
      return res.json({ success: true, message: 'Profile updated successfully', data: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

restaurantRouter.get('/branches', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const branches = await restaurantService.getBranches(req.user!.tenantId);
    return res.json({ success: true, data: branches });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

restaurantRouter.get(
  '/integrations',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER),
  async (req: RequestWithUser, res: Response) => {
    try {
      const config = await restaurantService.getIntegrationsConfig(req.user!.tenantId);
      return res.json({ success: true, data: config });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

restaurantRouter.put(
  '/integrations',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER),
  async (req: RequestWithUser, res: Response) => {
    try {
      const updated = await restaurantService.updateIntegrationsConfig(
        req.user!.tenantId,
        req.user!.id,
        req.body
      );
      return res.json({
        success: true,
        message: 'Integration settings saved and activated.',
        data: updated
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

restaurantRouter.post(
  '/integrations/test',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER),
  async (req: RequestWithUser, res: Response) => {
    try {
      const target = req.body?.target || 'gateways';
      const result = await restaurantService.testIntegrationConnection(req.user!.tenantId, target);
      return res.json({ success: true, message: result.message, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

restaurantRouter.get(
  '/audit-events',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER, UserRole.AUDITOR),
  async (req: RequestWithUser, res: Response) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const events = await restaurantService.getAuditEvents(req.user!.tenantId, limit);
      return res.json({ success: true, data: events });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);
