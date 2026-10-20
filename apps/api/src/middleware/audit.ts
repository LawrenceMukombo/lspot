import { Response, NextFunction } from 'express';
import { RequestWithUser } from './auth.js';
import { prisma } from '@lspot/database';

export async function logAuditEvent(
  tenantId: string,
  userId: string | undefined,
  action: string,
  entityType: string,
  entityId?: string,
  details?: any,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    await prisma.auditEvent.create({
      data: {
        tenantId,
        userId: userId || null,
        action,
        entityType,
        entityId: entityId || null,
        details: details || {},
        ipAddress: ipAddress || null,
        userAgent: userAgent || null
      }
    });
  } catch (err) {
    console.error('Failed to write audit event:', err);
  }
}

export function auditMiddleware(action: string, entityType: string) {
  return (req: RequestWithUser, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        logAuditEvent(
          req.user.tenantId,
          req.user.id,
          action,
          entityType,
          req.params.id || body?.data?.id,
          { method: req.method, url: req.originalUrl },
          req.ip,
          req.get('user-agent')
        );
      }
      return originalJson(body);
    };
    next();
  };
}
