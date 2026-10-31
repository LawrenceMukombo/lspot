import { Router, Response } from 'express';
import { posService } from '../services/pos.service.js';
import { authService } from '../services/auth.service.js';
import { authenticate, RequestWithUser, requireRole } from '../middleware/auth.js';
import { auditMiddleware } from '../middleware/audit.js';
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
  auditMiddleware('POS_CHECKOUT', 'Sale'),
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
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const sales = await posService.getRecentSales(req.user!.tenantId, limit, startDate, endDate);
    return res.json({ success: true, data: sales });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Edit Sale details (Order type, Table number, Notes) by authorized staff/supervisor
posRouter.put(
  '/sales/:id',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER),
  auditMiddleware('UPDATE_SALE', 'Sale'),
  async (req: RequestWithUser, res: Response) => {
    try {
      const saleId = String(req.params.id);
      const updated = await posService.updateSale(saleId, req.user!.tenantId, req.body);
      return res.json({ success: true, message: 'Sale updated successfully', data: updated });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

// Reverse / Void Sale by Supervisor or Owner/Manager
posRouter.post(
  '/sales/:id/reverse',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.CASHIER),
  auditMiddleware('REVERSE_SALE', 'Sale'),
  async (req: RequestWithUser, res: Response) => {
    try {
      const saleId = String(req.params.id);
      const { reason, supervisorPin } = req.body;
      if (!reason || !reason.trim()) {
        return res.status(400).json({ success: false, message: 'Reason for sale reversal is mandatory' });
      }

      if (!supervisorPin || typeof supervisorPin !== 'string') {
        return res.status(401).json({ success: false, message: 'Supervisor Authorization PIN is required' });
      }

      const verification = await authService.verifySupervisorOverride(req.user!.tenantId, supervisorPin.trim());
      if (!verification.valid) {
        return res.status(401).json({ success: false, message: verification.message || 'Invalid Supervisor Authorization PIN' });
      }

      const reversed = await posService.reverseSale(
        saleId,
        req.user!.tenantId,
        verification.supervisor?.fullName || req.user!.fullName || req.user!.username,
        reason.trim()
      );
      return res.json({
        success: true,
        message: 'Sale reversed successfully. Stock and kitchen portions have been restored.',
        data: reversed
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

// Initiate Airtel Money / MTN MoMo USSD Push Collection
posRouter.post(
  '/momo-initiate',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER),
  async (req: RequestWithUser, res: Response) => {
    try {
      const result = await posService.initiateMobileMoneyPush(req.user!.tenantId, req.user!.id, req.body);
      return res.json({ success: true, message: result.message, data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

// Multi-Device Kitchen Display System (KDS) Tickets
posRouter.get('/kds-tickets', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const tickets = await posService.getKdsTickets(req.user!.tenantId);
    return res.json({ success: true, data: tickets });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

posRouter.patch('/kds-tickets/:id/status', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const ticketId = String(req.params.id);
    const updated = await posService.updateKdsTicketStatus(
      req.user!.tenantId,
      req.user!.id,
      ticketId,
      req.body.status,
      req.body.ticketData
    );
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

// Customer Loyalty Stamp Card Endpoints
posRouter.get('/loyalty/:phone', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const card = await posService.getLoyaltyCard(req.user!.tenantId, String(req.params.phone));
    return res.json({ success: true, data: card });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

posRouter.post('/loyalty/:phone', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const card = await posService.saveLoyaltyCard(
      req.user!.tenantId,
      req.user!.id,
      String(req.params.phone),
      req.body
    );
    return res.json({ success: true, data: card });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

