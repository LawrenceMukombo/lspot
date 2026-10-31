import { Router, Response } from 'express';
import { invoiceService } from '../services/invoice.service.js';
import { authenticate, RequestWithUser, requireRole } from '../middleware/auth.js';
import { UserRole } from '@lspot/shared';

export const invoiceRouter = Router();

invoiceRouter.get('/', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const invoices = await invoiceService.getInvoices(req.user!.tenantId);
    return res.json({ success: true, data: invoices });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

invoiceRouter.get('/:id', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const invoice = await invoiceService.getInvoiceById(req.user!.tenantId, id);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    return res.json({ success: true, data: invoice });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

invoiceRouter.post(
  '/consolidate-daily',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT),
  async (req: RequestWithUser, res: Response) => {
    try {
      const { customerId, date } = req.body;
      if (!customerId || !date) {
        return res.status(400).json({ success: false, message: 'customerId and date (YYYY-MM-DD) are required' });
      }

      const invoice = await invoiceService.consolidateDailyCreditInvoices(
        req.user!.tenantId,
        customerId,
        date
      );
      return res.status(201).json({
        success: true,
        message: 'Daily credit invoice consolidated successfully',
        data: invoice
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

invoiceRouter.post('/:id/send', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const { deliveryMethod } = req.body;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await invoiceService.sendInvoice(req.user!.tenantId, id, deliveryMethod || 'WHATSAPP');
    return res.json({ success: true, message: 'Invoice dispatch processed', data: result });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});
