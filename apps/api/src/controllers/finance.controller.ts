import { Router, Response } from 'express';
import { financeService } from '../services/finance.service.js';
import { authenticate, RequestWithUser, requireRole } from '../middleware/auth.js';
import { CreateExpenseSchema } from '@lspot/validation';
import { UserRole } from '@lspot/shared';

export const financeRouter = Router();

financeRouter.get('/dashboard', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const rawStart = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const startDate = rawStart && !isNaN(rawStart.getTime()) ? rawStart : undefined;

    const rawEnd = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const endDate = rawEnd && !isNaN(rawEnd.getTime()) ? rawEnd : undefined;

    const summary = await financeService.getDashboardSummary(req.user!.tenantId, startDate, endDate);
    return res.json({ success: true, data: summary });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

financeRouter.get('/expenses', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const expenses = await financeService.getExpenses(req.user!.tenantId);
    return res.json({ success: true, data: expenses });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

financeRouter.post(
  '/expenses',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT),
  async (req: RequestWithUser, res: Response) => {
    try {
      const parsed = CreateExpenseSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: parsed.error.issues
        });
      }

      const expense = await financeService.recordExpense(
        req.user!.tenantId,
        req.user!.id,
        parsed.data
      );
      return res.status(201).json({ success: true, message: 'Expense recorded successfully', data: expense });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);
