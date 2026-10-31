import { Router, Response } from 'express';
import { menuService } from '../services/menu.service.js';
import { authenticate, RequestWithUser, requireRole } from '../middleware/auth.js';
import { CreateMenuItemSchema, UpdateMenuItemSchema } from '@lspot/validation';
import { UserRole } from '@lspot/shared';

export const menuRouter = Router();

menuRouter.get('/categories', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const categories = await menuService.getCategories(req.user!.tenantId);
    return res.json({ success: true, data: categories });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

menuRouter.post(
  '/categories',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER),
  async (req: RequestWithUser, res: Response) => {
    try {
      const { name, description } = req.body;
      const category = await menuService.createCategory(req.user!.tenantId, name, description);
      return res.status(201).json({ success: true, data: category });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

menuRouter.get('/items', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const { categoryId } = req.query;
    const items = await menuService.getMenuItems(
      req.user!.tenantId,
      categoryId ? String(categoryId) : undefined
    );
    return res.json({ success: true, data: items });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

menuRouter.post(
  '/items',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.CHEF),
  async (req: RequestWithUser, res: Response) => {
    try {
      const parsed = CreateMenuItemSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: parsed.error.issues
        });
      }

      const item = await menuService.createMenuItem(
        req.user!.tenantId,
        req.user!.branchId,
        parsed.data
      );
      return res.status(201).json({ success: true, data: item });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

menuRouter.put(
  '/items/:id',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.CHEF),
  async (req: RequestWithUser, res: Response) => {
    try {
      const parsed = UpdateMenuItemSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: parsed.error.issues
        });
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updated = await menuService.updateMenuItem(req.user!.tenantId, id, parsed.data);
      return res.json({ success: true, data: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

menuRouter.delete(
  '/items/:id',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER),
  async (req: RequestWithUser, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await menuService.retireMenuItem(req.user!.tenantId, id);
      return res.json({ success: true, message: 'Menu item retired from sale' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);
