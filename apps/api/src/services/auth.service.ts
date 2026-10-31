import { prisma } from '@lspot/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  UserRole,
  DEFAULT_TENANT_ID,
  DEFAULT_BRANCH_ID,
  RESTAURANT_NAME,
  RESTAURANT_LOCATION,
  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE
} from '@lspot/shared';
import { getJwtSecret } from '../middleware/auth.js';

async function matchesPin(plainPin: string, storedPin: string | null | undefined): Promise<boolean> {
  if (!storedPin || !plainPin) return false;
  if (storedPin.startsWith('$2a$') || storedPin.startsWith('$2b$') || storedPin.startsWith('$2y$')) {
    return bcrypt.compare(plainPin, storedPin);
  }
  return storedPin === plainPin;
}

function maskPin(storedPin: string | null | undefined): string | null {
  if (!storedPin) return null;
  if (storedPin.startsWith('$2')) return '••••';
  return '•'.repeat(Math.min(6, Math.max(4, storedPin.length)));
}

export class AuthService {
  private bootstrapCompleted = false;

  private async ensureBootstrapUsers() {
    if (this.bootstrapCompleted) return;
    try {
      const tenant = await prisma.tenant.upsert({
        where: { id: DEFAULT_TENANT_ID },
        update: {},
        create: {
          id: DEFAULT_TENANT_ID,
          name: RESTAURANT_NAME,
          tradingName: RESTAURANT_NAME,
          country: 'Zambia',
          currency: DEFAULT_CURRENCY,
          timezone: DEFAULT_TIMEZONE,
          isActive: true
        }
      });

      const branch = await prisma.branch.upsert({
        where: { id: DEFAULT_BRANCH_ID },
        update: {},
        create: {
          id: DEFAULT_BRANCH_ID,
          tenantId: tenant.id,
          name: 'Manyama Main Branch',
          code: 'MNY-01',
          address: RESTAURANT_LOCATION,
          phone: '+260 97 000 0000',
          isMain: true,
          isActive: true
        }
      });

      const bootstrapAccounts = [
        {
          id: '00000000-0000-0000-0000-000000000001',
          username: 'superadmin',
          fullName: 'Lawrence Mukombo (Super Admin)',
          role: UserRole.SUPER_ADMIN,
          email: 'admin@lamtoninvestments.com',
          passwordPlain: process.env.SUPER_ADMIN_PASSWORD || 'LSpot@Admin2026!',
          supervisorPin: process.env.SUPER_ADMIN_PIN || '8899'
        },
        {
          id: '11111111-1111-1111-1111-111111111111',
          username: 'owner',
          fullName: 'Executive Owner',
          role: UserRole.OWNER,
          email: 'owner@lspot.zm',
          passwordPlain: process.env.OWNER_PASSWORD || 'LSpot@Owner2026!',
          supervisorPin: process.env.OWNER_PIN || '9999'
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          username: 'manager',
          fullName: 'Mulenga Banda (Manager)',
          role: UserRole.MANAGER,
          email: 'manager@lspot.zm',
          passwordPlain: process.env.MANAGER_PASSWORD || 'LSpot@Manager2026!',
          supervisorPin: process.env.MANAGER_PIN || '1234'
        }
      ];

      for (const acct of bootstrapAccounts) {
        const existing = await prisma.user.findUnique({ where: { username: acct.username } });
        const passwordHash = await bcrypt.hash(acct.passwordPlain, 10);
        if (!existing) {
          await prisma.user.create({
            data: {
              id: acct.id,
              tenantId: tenant.id,
              branchId: branch.id,
              username: acct.username,
              fullName: acct.fullName,
              email: acct.email,
              passwordHash,
              supervisorPin: acct.supervisorPin,
              role: acct.role,
              isActive: true
            }
          });
        } else if (!existing.lastLoginAt) {
          // Ensure initial production password and PIN are active before first login
          await prisma.user.update({
            where: { id: existing.id },
            data: {
              passwordHash,
              supervisorPin: acct.supervisorPin,
              role: acct.role,
              isActive: true
            }
          });
        }
      }

      this.bootstrapCompleted = true;
    } catch (err) {
      console.warn('Bootstrap user check skipped:', err);
    }
  }

  async login(username: string, passwordPlain: string) {
    await this.ensureBootstrapUsers();
    const normalizedUsername = username.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        username: { equals: normalizedUsername, mode: 'insensitive' },
        isActive: true
      },
      include: { tenant: true }
    });

    if (!user) {
      throw new Error('Invalid username or password');
    }

    const isMatch = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid username or password');
    }

    const payload = {
      id: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId || '',
      username: user.username,
      fullName: user.fullName,
      role: user.role as UserRole
    };

    const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '1d' });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        tenantId: user.tenantId,
        tenantName: user.tenant.name
      }
    };
  }

  async loginWithPin(pin: string, options?: { username?: string; tenantId?: string }) {
    await this.ensureBootstrapUsers();
    const targetTenantId = options?.tenantId || DEFAULT_TENANT_ID;
    const candidates = await prisma.user.findMany({
      where: {
        tenantId: targetTenantId,
        isActive: true,
        supervisorPin: { not: null },
        ...(options?.username ? { username: options.username } : {})
      },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' }
    });

    let matchedUser: (typeof candidates)[number] | null = null;
    for (const candidate of candidates) {
      if (await matchesPin(pin, candidate.supervisorPin)) {
        matchedUser = candidate;
        break;
      }
    }

    if (!matchedUser) {
      throw new Error('Invalid PIN or staff account is inactive');
    }

    const payload = {
      id: matchedUser.id,
      tenantId: matchedUser.tenantId,
      branchId: matchedUser.branchId || '',
      username: matchedUser.username,
      fullName: matchedUser.fullName,
      role: matchedUser.role as UserRole
    };

    const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '1d' });

    await prisma.user.update({
      where: { id: matchedUser.id },
      data: { lastLoginAt: new Date() }
    });

    return {
      token,
      user: {
        id: matchedUser.id,
        username: matchedUser.username,
        fullName: matchedUser.fullName,
        role: matchedUser.role,
        tenantId: matchedUser.tenantId,
        tenantName: matchedUser.tenant.name
      }
    };
  }

  async verifyPin(supervisorId: string, pin: string) {
    const user = await prisma.user.findUnique({
      where: { id: supervisorId }
    });

    if (!user || !user.supervisorPin) {
      return false;
    }

    return matchesPin(pin, user.supervisorPin);
  }

  async verifySupervisorOverride(tenantId: string, pin: string) {
    const supervisors = await prisma.user.findMany({
      where: {
        tenantId,
        supervisorPin: { not: null },
        isActive: true,
        role: { in: [UserRole.OWNER, UserRole.MANAGER, UserRole.SUPER_ADMIN] }
      },
      orderBy: { createdAt: 'asc' }
    });

    for (const supervisor of supervisors) {
      if (await matchesPin(pin, supervisor.supervisorPin)) {
        return {
          valid: true,
          supervisor: {
            id: supervisor.id,
            fullName: supervisor.fullName,
            role: supervisor.role
          }
        };
      }
    }

    return { valid: false, message: 'Invalid supervisor PIN or unauthorized role' };
  }

  async getUsers(tenantId: string) {
    await this.ensureBootstrapUsers();
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        tenantId: true,
        branchId: true,
        username: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        supervisorPin: true,
        lastLoginAt: true,
        createdAt: true
      },
      orderBy: { fullName: 'asc' }
    });

    return users.map((u: any) => ({
      ...u,
      hasSupervisorPin: Boolean(u.supervisorPin),
      supervisorPin: maskPin(u.supervisorPin)
    }));
  }

  async createUser(tenantId: string, data: any, actorRole?: UserRole) {
    const requestedRole = (data.role || UserRole.CASHIER) as UserRole;
    if (
      actorRole === UserRole.MANAGER &&
      (requestedRole === UserRole.OWNER || requestedRole === UserRole.SUPER_ADMIN)
    ) {
      throw new Error('Managers cannot create Owner or Super Admin accounts.');
    }

    const existing = await prisma.user.findFirst({
      where: {
        tenantId,
        OR: [
          { username: data.username },
          ...(data.email ? [{ email: data.email }] : [])
        ]
      }
    });

    if (existing) {
      throw new Error('A user with this username or email already exists.');
    }

    const passwordHash = await bcrypt.hash(data.password || 'lspot1234', 10);
    const hashedPin = data.supervisorPin ? await bcrypt.hash(String(data.supervisorPin), 10) : null;

    const created = await prisma.user.create({
      data: {
        tenantId,
        branchId: data.branchId || null,
        username: data.username,
        fullName: data.fullName,
        email: data.email || null,
        phone: data.phone || null,
        passwordHash,
        supervisorPin: hashedPin,
        role: requestedRole,
        isActive: data.isActive !== undefined ? data.isActive : true
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        supervisorPin: true,
        isActive: true,
        createdAt: true
      }
    });

    return {
      ...created,
      hasSupervisorPin: Boolean(created.supervisorPin),
      supervisorPin: maskPin(created.supervisorPin)
    };
  }

  async updateUser(tenantId: string, id: string, data: any, actorRole?: UserRole) {
    const existing = await prisma.user.findFirst({
      where: { id, tenantId }
    });
    if (!existing) {
      throw new Error('User not found in this tenant');
    }

    if (actorRole === UserRole.MANAGER) {
      if (existing.role === UserRole.OWNER || existing.role === UserRole.SUPER_ADMIN) {
        throw new Error('Managers cannot modify Owner or Super Admin accounts.');
      }
      if (data.role === UserRole.OWNER || data.role === UserRole.SUPER_ADMIN) {
        throw new Error('Managers cannot assign Owner or Super Admin roles.');
      }
    }

    const updateData: any = {};
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.supervisorPin !== undefined && !String(data.supervisorPin).startsWith('•')) {
      updateData.supervisorPin = data.supervisorPin
        ? await bcrypt.hash(String(data.supervisorPin), 10)
        : null;
    }
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        supervisorPin: true,
        isActive: true,
        updatedAt: true
      }
    });

    return {
      ...updated,
      hasSupervisorPin: Boolean(updated.supervisorPin),
      supervisorPin: maskPin(updated.supervisorPin)
    };
  }

  async deleteUser(tenantId: string, id: string, actorRole?: UserRole) {
    // Check if user belongs to tenant and has associated financial or shift audit records
    const userWithRecords = await prisma.user.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            sales: true,
            cashierShifts: true,
            auditEvents: true
          }
        }
      }
    });

    if (!userWithRecords) {
      throw new Error('User not found');
    }

    if (
      actorRole === UserRole.MANAGER &&
      (userWithRecords.role === UserRole.OWNER || userWithRecords.role === UserRole.SUPER_ADMIN)
    ) {
      throw new Error('Managers cannot delete or deactivate Owner or Super Admin accounts.');
    }

    const hasAuditHistory =
      userWithRecords._count.sales > 0 ||
      userWithRecords._count.cashierShifts > 0 ||
      userWithRecords._count.auditEvents > 0;

    if (hasAuditHistory) {
      // Soft-delete / deactivate to preserve immutable financial audit trail
      return prisma.user.update({
        where: { id: userWithRecords.id },
        data: { isActive: false },
        select: { id: true, username: true, fullName: true, isActive: true }
      });
    }

    // Direct deletion if no transactional history is bound to this user
    return prisma.user.delete({
      where: { id: userWithRecords.id },
      select: { id: true, username: true, fullName: true }
    });
  }
}

export const authService = new AuthService();
