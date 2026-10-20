import { Router, Response } from 'express';
import { restaurantService } from '../services/restaurant.service.js';
import { authenticate, RequestWithUser, requireRole } from '../middleware/auth.js';
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
  requireRole(UserRole.OWNER, UserRole.MANAGER),
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
