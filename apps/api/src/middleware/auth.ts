import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole, DEFAULT_TENANT_ID, DEFAULT_BRANCH_ID } from '@lspot/shared';

export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  branchId: string;
  username: string;
  fullName: string;
  role: UserRole;
}

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

const JWT_SECRET = process.env.JWT_SECRET || 'lspot-restaurant-super-secret-jwt-key-2026';

export function authenticate(req: RequestWithUser, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Provide a development fallback default user context if running in dev and no token
    if (process.env.NODE_ENV !== 'production') {
      req.user = {
        id: '22222222-2222-2222-2222-222222222222',
        tenantId: DEFAULT_TENANT_ID,
        branchId: DEFAULT_BRANCH_ID,
        username: 'manager',
        fullName: 'Mulenga Banda (Manager)',
        role: UserRole.MANAGER
      };
      return next();
    }
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.',
      code: 'UNAUTHORIZED'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token.',
      code: 'INVALID_TOKEN'
    });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: RequestWithUser, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
        code: 'UNAUTHORIZED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Role '${req.user.role}' is not authorized to perform this operation.`,
        code: 'FORBIDDEN'
      });
    }

    next();
  };
}
