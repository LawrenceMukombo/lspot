import { Router, Response } from 'express';
import { authService } from '../services/auth.service.js';
import { LoginSchema, VerifyPinSchema } from '@lspot/validation';
import { authenticate, RequestWithUser } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res: Response) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: parsed.error.issues
      });
    }

    const result = await authService.login(parsed.data.username, parsed.data.password);
    return res.json({
      success: true,
      message: 'Logged in successfully',
      data: result
    });
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      message: err.message || 'Login failed',
      code: 'AUTH_FAILED'
    });
  }
});

authRouter.post('/verify-pin', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const parsed = VerifyPinSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PIN format',
        code: 'VALIDATION_ERROR'
      });
    }

    const isValid = await authService.verifyPin(req.user!.id, parsed.data.pin);
    return res.json({
      success: true,
      data: { valid: isValid }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message,
      code: 'SERVER_ERROR'
    });
  }
});

authRouter.get('/me', authenticate, async (req: RequestWithUser, res: Response) => {
  return res.json({
    success: true,
    data: req.user
  });
});
