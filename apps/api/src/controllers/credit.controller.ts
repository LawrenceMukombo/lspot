import { Router, Response } from 'express';
import { creditService } from '../services/credit.service.js';
import { authenticate, RequestWithUser, requireRole } from '../middleware/auth.js';
import { CreateCustomerSchema, CustomerPaymentSchema } from '@lspot/validation';
import { UserRole } from '@lspot/shared';

export const creditRouter = Router();

creditRouter.get('/customers', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const customers = await creditService.getCustomers(req.user!.tenantId);
    return res.json({ success: true, data: customers });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

creditRouter.post(
  '/customers',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT),
  async (req: RequestWithUser, res: Response) => {
    try {
      const parsed = CreateCustomerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: parsed.error.issues
        });
      }

      const customer = await creditService.createCustomer(req.user!.tenantId, parsed.data);
      return res.status(201).json({ success: true, data: customer });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

creditRouter.get('/customers/:id/ledger', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const ledger = await creditService.getCustomerLedger(id);
    return res.json({ success: true, data: ledger });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

creditRouter.post(
  '/payments',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.CASHIER),
  async (req: RequestWithUser, res: Response) => {
    try {
      const parsed = CustomerPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: parsed.error.issues
        });
      }

      const payment = await creditService.recordCustomerPayment(req.user!.tenantId, parsed.data);
      return res.status(201).json({ success: true, message: 'Payment recorded and allocated successfully', data: payment });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

creditRouter.get('/ageing', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const ageing = await creditService.getAgeingReport(req.user!.tenantId);
    return res.json({ success: true, data: ageing });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
