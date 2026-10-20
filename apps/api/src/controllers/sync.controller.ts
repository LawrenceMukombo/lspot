import { Router, Response } from 'express';
import { syncService } from '../services/sync.service.js';
import { authenticate, RequestWithUser } from '../middleware/auth.js';
import { SyncBatchSchema } from '@lspot/validation';

export const syncRouter = Router();

syncRouter.post('/push', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const parsed = SyncBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.issues
      });
    }

    const results = await syncService.processBatch(
      req.user!.tenantId,
      req.user!.branchId,
      req.user!.id,
      parsed.data.deviceId,
      parsed.data.commands
    );

    return res.json({
      success: true,
      message: 'Batch synchronization processed',
      data: results
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

syncRouter.get('/pull', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const delta = await syncService.getDeltaSync(req.user!.tenantId);
    return res.json({ success: true, data: delta });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
