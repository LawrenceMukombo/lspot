import { Router, Response } from 'express';
import { recipeService } from '../services/recipe.service.js';
import { authenticate, RequestWithUser, requireRole } from '../middleware/auth.js';
import { CreateRecipeSchema, ScaleRecipeSchema } from '@lspot/validation';
import { UserRole } from '@lspot/shared';

export const recipeRouter = Router();

recipeRouter.get('/', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const recipes = await recipeService.getRecipes(req.user!.tenantId);
    return res.json({ success: true, data: recipes });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

recipeRouter.post(
  '/',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.CHEF),
  async (req: RequestWithUser, res: Response) => {
    try {
      const parsed = CreateRecipeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: parsed.error.issues
        });
      }

      const recipe = await recipeService.createRecipe(req.user!.tenantId, parsed.data);
      return res.status(201).json({ success: true, data: recipe });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

recipeRouter.post('/scale', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const parsed = ScaleRecipeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.issues
      });
    }

    const scaled = await recipeService.scaleRecipe(
      parsed.data.recipeId,
      parsed.data.targetPortions
    );
    return res.json({ success: true, data: scaled });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});
