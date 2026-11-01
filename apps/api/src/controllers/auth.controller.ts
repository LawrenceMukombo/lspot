import { Router, Response } from 'express';
import { authService } from '../services/auth.service.js';
import { LoginSchema, VerifyPinSchema } from '@lspot/validation';
import { authenticate, RequestWithUser, requireRole, rateLimitAuth } from '../middleware/auth.js';
import { auditMiddleware } from '../middleware/audit.js';
import { UserRole } from '@lspot/shared';

export const authRouter = Router();

authRouter.post('/login', rateLimitAuth(15, 5 * 60 * 1000), async (req, res: Response) => {
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

authRouter.post('/pin-login', rateLimitAuth(10, 5 * 60 * 1000), async (req, res: Response) => {
  try {
    const { pin, username, tenantId } = req.body;
    if (!pin || typeof pin !== 'string') {
      return res.status(400).json({ success: false, message: 'PIN is required' });
    }

    const result = await authService.loginWithPin(pin, { username, tenantId });
    return res.json({
      success: true,
      message: 'Staff authenticated with PIN',
      data: result
    });
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      message: err.message || 'PIN authentication failed',
      code: 'AUTH_FAILED'
    });
  }
});

authRouter.post('/verify-pin', authenticate, rateLimitAuth(10, 5 * 60 * 1000), async (req: RequestWithUser, res: Response) => {
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

authRouter.post('/supervisor-override', authenticate, rateLimitAuth(10, 5 * 60 * 1000), async (req: RequestWithUser, res: Response) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ success: false, message: 'Supervisor PIN is required' });
    }

    const result = await authService.verifySupervisorOverride(req.user!.tenantId, pin);
    if (!result.valid) {
      return res.status(403).json({ success: false, message: result.message });
    }

    return res.json({
      success: true,
      message: 'Supervisor override approved',
      data: result.supervisor
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message,
      code: 'SERVER_ERROR'
    });
  }
});

authRouter.get(
  '/users',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER),
  async (req: RequestWithUser, res: Response) => {
    try {
      const users = await authService.getUsers(req.user!.tenantId);
      return res.json({ success: true, data: users });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

authRouter.post(
  '/users',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER),
  auditMiddleware('CREATE_USER', 'User'),
  async (req: RequestWithUser, res: Response) => {
    try {
      const user = await authService.createUser(req.user!.tenantId, req.body, req.user!.role);
      return res.status(201).json({ success: true, message: 'User created successfully', data: user });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

authRouter.put(
  '/users/:id',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER),
  auditMiddleware('UPDATE_USER', 'User'),
  async (req: RequestWithUser, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const user = await authService.updateUser(req.user!.tenantId, id, req.body, req.user!.role);
      return res.json({ success: true, message: 'User updated successfully', data: user });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

authRouter.delete(
  '/users/:id',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.MANAGER),
  auditMiddleware('DELETE_USER', 'User'),
  async (req: RequestWithUser, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await authService.deleteUser(req.user!.tenantId, id, req.user!.role);
      return res.json({ success: true, message: 'User deleted or archived successfully', data: result });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
);

authRouter.get('/me', authenticate, async (req: RequestWithUser, res: Response) => {
  return res.json({
    success: true,
    data: req.user
  });
});

authRouter.get('/biometrics', rateLimitAuth(30, 5 * 60 * 1000), async (_req: RequestWithUser, res: Response) => {
  try {
    const list = await authService.getBiometricRegistry();
    return res.json({ success: true, data: list });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

authRouter.post('/biometric-register', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const { credentialId, userId, username, fullName, type, deviceLabel, publicKey } = req.body || {};
    if (!credentialId || !userId || !type) {
      return res.status(400).json({
        success: false,
        message: 'credentialId, userId, and type are required for biometric registration.'
      });
    }
    const saved = await authService.registerBiometricCredential(req.user!.tenantId, {
      credentialId,
      userId,
      username: username || req.user!.username,
      fullName: fullName || req.user!.fullName,
      type,
      deviceLabel,
      publicKey
    });
    return res.status(201).json({
      success: true,
      message: `${type === 'face' ? 'Face ID' : 'Thumbprint'} registered successfully.`,
      data: saved
    });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

authRouter.delete('/biometrics/:userId/:type', authenticate, async (req: RequestWithUser, res: Response) => {
  try {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const type = (Array.isArray(req.params.type) ? req.params.type[0] : req.params.type) as 'thumbprint' | 'face';
    const result = await authService.removeBiometricCredential(req.user!.tenantId, userId, type);
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

authRouter.post('/biometric-login', rateLimitAuth(10, 5 * 60 * 1000), async (req: RequestWithUser, res: Response) => {
  try {
    const { credentialId, userId, username, type } = (req.body as any) || {};
    if (!credentialId && !userId) {
      return res.status(400).json({
        success: false,
        message: 'A registered biometric credential is required. Please register your biometric in Staff & User Management first.'
      });
    }
    const result = await authService.loginWithBiometric({ credentialId, userId, username, type });
    return res.json({
      success: true,
      message: `Authenticated via ${result.biometricType === 'face' ? 'Face Recognition' : 'Thumbprint'}`,
      data: result
    });
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      message: err.message || 'Biometric authentication failed',
      code: 'BIOMETRIC_AUTH_FAILED'
    });
  }
});

authRouter.post(
  '/request-password-reset',
  rateLimitAuth(8, 10 * 60 * 1000),
  async (req: RequestWithUser, res: Response) => {
    try {
      const { username, email, tenantId, supervisorPin } = (req.body as any) || {};
      const result = await authService.requestPasswordReset(username || email || '', tenantId, supervisorPin);
      return res.json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Failed to generate password recovery code.',
        code: 'PASSWORD_RESET_REQUEST_FAILED'
      });
    }
  }
);

authRouter.post(
  '/reset-password',
  rateLimitAuth(10, 10 * 60 * 1000),
  async (req: RequestWithUser, res: Response) => {
    try {
      const { username, newPassword, verificationMethod, pinOrCode, tenantId } = (req.body as any) || {};
      const result = await authService.recoverOrResetPassword({
        username,
        newPassword,
        verificationMethod: verificationMethod || 'STAFF_PIN',
        pinOrCode,
        tenantId
      });
      return res.json({
        success: true,
        message: `Password for @${result.username} has been reset successfully (${result.verifiedBy}). You may now sign in.`,
        data: result
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Password recovery / reset failed.',
        code: 'PASSWORD_RESET_FAILED'
      });
    }
  }
);

authRouter.post(
  '/change-password',
  authenticate,
  rateLimitAuth(10, 10 * 60 * 1000),
  auditMiddleware('CHANGE_PASSWORD', 'User'),
  async (req: RequestWithUser, res: Response) => {
    try {
      const { currentPasswordOrPin, newPassword } = (req.body as any) || {};
      const result = await authService.changePassword(
        req.user!.id,
        currentPasswordOrPin,
        newPassword
      );
      return res.json({
        success: true,
        message: 'Your password has been updated successfully.',
        data: result
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: err.message || 'Password update failed.',
        code: 'CHANGE_PASSWORD_FAILED'
      });
    }
  }
);
