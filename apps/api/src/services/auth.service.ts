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
    if (data.username !== undefined && data.username.trim() && data.username.trim() !== existing.username) {
      const nextUsername = data.username.trim();
      const collision = await prisma.user.findFirst({
        where: { username: nextUsername, id: { not: existing.id } }
      });
      if (collision) {
        throw new Error(`Username "${nextUsername}" is already in use.`);
      }
      updateData.username = nextUsername;
    }
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

  private biometricRegistryKey(tenantId: string) {
    return `biometric_credentials_registry_${tenantId}`;
  }

  async getBiometricRegistry(tenantId: string = DEFAULT_TENANT_ID): Promise<any[]> {
    await this.ensureBootstrapUsers();
    try {
      const record = await prisma.syncCommand.findUnique({
        where: { idempotencyKey: this.biometricRegistryKey(tenantId) }
      });
      if (record && Array.isArray(record.payload)) {
        return record.payload as any[];
      }
    } catch (e) {
      console.warn('Error reading biometric registry from DB:', e);
    }
    return [];
  }

  async registerBiometricCredential(
    tenantId: string = DEFAULT_TENANT_ID,
    record: {
      credentialId: string;
      userId: string;
      username: string;
      fullName: string;
      type: 'thumbprint' | 'face';
      deviceLabel?: string;
      publicKey?: string;
    }
  ) {
    await this.ensureBootstrapUsers();
    const existing = await this.getBiometricRegistry(tenantId);
    const filtered = existing.filter(
      (item: any) =>
        !(item.userId === record.userId && item.type === record.type) &&
        item.credentialId !== record.credentialId
    );
    const entry = {
      credentialId: record.credentialId,
      userId: record.userId,
      username: record.username,
      fullName: record.fullName,
      type: record.type,
      deviceLabel: record.deviceLabel || (record.type === 'face' ? 'Face ID Camera / Sensor' : 'Thumbprint Sensor'),
      publicKey: record.publicKey || '',
      registeredAt: new Date().toISOString()
    };
    filtered.push(entry);

    const key = this.biometricRegistryKey(tenantId);
    await prisma.syncCommand.upsert({
      where: { idempotencyKey: key },
      update: { payload: filtered as any, processedAt: new Date() },
      create: {
        deviceId: 'biometric-registry',
        idempotencyKey: key,
        commandType: 'BIOMETRIC_REGISTRY',
        payload: filtered as any,
        status: 'PROCESSED',
        clientTime: new Date()
      }
    });

    return entry;
  }

  async removeBiometricCredential(
    tenantId: string = DEFAULT_TENANT_ID,
    userId: string,
    type: 'thumbprint' | 'face'
  ) {
    const existing = await this.getBiometricRegistry(tenantId);
    const filtered = existing.filter(
      (item: any) => !(item.userId === userId && item.type === type)
    );
    const key = this.biometricRegistryKey(tenantId);
    await prisma.syncCommand.upsert({
      where: { idempotencyKey: key },
      update: { payload: filtered as any, processedAt: new Date() },
      create: {
        deviceId: 'biometric-registry',
        idempotencyKey: key,
        commandType: 'BIOMETRIC_REGISTRY',
        payload: filtered as any,
        status: 'PROCESSED',
        clientTime: new Date()
      }
    });
    return { removed: true, remaining: filtered.length };
  }

  async loginWithBiometric(data: {
    credentialId?: string;
    userId?: string;
    username?: string;
    type?: 'thumbprint' | 'face';
    tenantId?: string;
  }) {
    await this.ensureBootstrapUsers();
    const targetTenantId = data.tenantId || DEFAULT_TENANT_ID;
    const registry = await this.getBiometricRegistry(targetTenantId);
    const bioLabel = data.type === 'face' ? 'Face Recognition' : 'Thumbprint';

    let matchedRecord: any = null;
    if (data.credentialId) {
      matchedRecord = registry.find(
        (r: any) => r.credentialId === data.credentialId && (!data.type || r.type === data.type)
      );
    }
    if (!matchedRecord && data.userId) {
      matchedRecord = registry.find(
        (r: any) => r.userId === data.userId && (!data.type || r.type === data.type)
      );
    }

    if (!matchedRecord) {
      throw new Error(
        `No registered ${bioLabel} found. Biometrics must be registered in Staff & User Management before use.`
      );
    }

    let user = null;
    if (matchedRecord.userId) {
      user = await prisma.user.findFirst({
        where: { id: matchedRecord.userId, isActive: true },
        include: { tenant: true }
      });
    }
    if (!user && matchedRecord.username) {
      user = await prisma.user.findFirst({
        where: {
          username: { equals: String(matchedRecord.username).trim(), mode: 'insensitive' },
          isActive: true
        },
        include: { tenant: true }
      });
    }

    if (!user) {
      throw new Error('Biometric profile could not be matched to an active staff account.');
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
      biometricType: matchedRecord.type || data.type || 'thumbprint',
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

  async requestPasswordReset(
    usernameOrEmail: string,
    tenantId: string = DEFAULT_TENANT_ID,
    supervisorPin?: string
  ) {
    await this.ensureBootstrapUsers();
    const cleaned = String(usernameOrEmail || '').trim();
    if (!cleaned) {
      throw new Error('Please enter your username or registered email address.');
    }

    const user = await prisma.user.findFirst({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { username: { equals: cleaned, mode: 'insensitive' } },
          { email: { equals: cleaned, mode: 'insensitive' } }
        ]
      }
    });

    if (!user) {
      throw new Error('No active staff account found matching that username or email.');
    }

    // Verify supervisor authorization if generating a terminal override code
    let supervisorAuthorized = false;
    let supervisorName = '';
    if (supervisorPin && supervisorPin.trim()) {
      const override = await this.verifySupervisorOverride(tenantId, supervisorPin.trim());
      if (override.valid && override.supervisor) {
        supervisorAuthorized = true;
        supervisorName = override.supervisor.fullName;
      } else {
        throw new Error(override.message || 'Invalid Supervisor PIN provided.');
      }
    }

    // Generate cryptographically-seeded 6-digit recovery code valid for 15 minutes
    const randInt = Math.floor(100000 + Math.random() * 900000);
    const recoveryCode = String(randInt);
    const expiresAt = Date.now() + 15 * 60 * 1000;
    const key = `pwd_reset_otp_${user.id}`;

    await prisma.syncCommand.upsert({
      where: { idempotencyKey: key },
      update: {
        payload: {
          userId: user.id,
          username: user.username,
          code: recoveryCode,
          expiresAt,
          failedAttempts: 0,
          used: false,
          authorizedBy: supervisorAuthorized ? supervisorName : null,
          requestedAt: new Date().toISOString()
        } as any,
        processedAt: new Date()
      },
      create: {
        deviceId: 'password-recovery',
        idempotencyKey: key,
        commandType: 'PASSWORD_RESET_OTP',
        payload: {
          userId: user.id,
          username: user.username,
          code: recoveryCode,
          expiresAt,
          failedAttempts: 0,
          used: false,
          authorizedBy: supervisorAuthorized ? supervisorName : null,
          requestedAt: new Date().toISOString()
        } as any,
        status: 'PROCESSED',
        clientTime: new Date()
      }
    });

    await prisma.auditEvent.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entityType: 'User',
        entityId: user.id,
        details: {
          username: user.username,
          supervisorAuthorized,
          authorizedBy: supervisorAuthorized ? supervisorName : 'Self-Service Request',
          expiresAt: new Date(expiresAt).toISOString()
        }
      }
    });

    const maskedEmail = user.email
      ? user.email.replace(/^(..)(.*)(@.*)$/, (_m, a, b, c) => `${a}${'*'.repeat(Math.max(2, b.length))}${c}`)
      : null;

    const maskedPhone = user.phone
      ? user.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')
      : null;

    return {
      username: user.username,
      fullName: user.fullName,
      maskedEmail,
      maskedPhone,
      // Only reveal the code directly in API response if explicitly authorized by a Supervisor PIN
      recoveryCode: supervisorAuthorized ? recoveryCode : undefined,
      supervisorAuthorized,
      expiresInMinutes: 15,
      message: supervisorAuthorized
        ? `Emergency reset code generated and authorized by ${supervisorName}. Valid for 15 minutes.`
        : 'Recovery code generated. For immediate terminal reset, verify with your personal Staff PIN or have a Manager authorize.'
    };
  }

  async recoverOrResetPassword(data: {
    username: string;
    newPassword: string;
    verificationMethod: 'STAFF_PIN' | 'SUPERVISOR_PIN' | 'RECOVERY_CODE';
    pinOrCode: string;
    tenantId?: string;
  }) {
    await this.ensureBootstrapUsers();
    const targetTenantId = data.tenantId || DEFAULT_TENANT_ID;
    const cleanedUsername = String(data.username || '').trim();
    const cleanedCode = String(data.pinOrCode || '').trim();
    const newPassword = String(data.newPassword || '');

    if (!cleanedUsername) {
      throw new Error('Username or email is required.');
    }
    if (!cleanedCode) {
      throw new Error('Verification PIN or Recovery Code is required.');
    }
    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }

    const user = await prisma.user.findFirst({
      where: {
        tenantId: targetTenantId,
        isActive: true,
        OR: [
          { username: { equals: cleanedUsername, mode: 'insensitive' } },
          { email: { equals: cleanedUsername, mode: 'insensitive' } }
        ]
      }
    });

    if (!user) {
      throw new Error('No active staff account found for that username or email.');
    }

    let verifiedByDetail = '';

    if (data.verificationMethod === 'STAFF_PIN') {
      const isPinValid = await matchesPin(cleanedCode, user.supervisorPin);
      if (!isPinValid) {
        throw new Error('Invalid personal Staff PIN. Check your 4–6 digit PIN or use Supervisor Override.');
      }
      verifiedByDetail = 'Personal Staff PIN';
    } else if (data.verificationMethod === 'SUPERVISOR_PIN') {
      const override = await this.verifySupervisorOverride(user.tenantId, cleanedCode);
      if (!override.valid || !override.supervisor) {
        throw new Error(override.message || 'Invalid Supervisor / Manager / Owner Override PIN.');
      }
      // Prevent a Manager from resetting Super Admin or Owner password unless they are Owner/Super Admin
      if (
        (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.OWNER) &&
        override.supervisor.role === UserRole.MANAGER
      ) {
        throw new Error('A Manager PIN cannot reset an Owner or Super Admin password. Use Owner/Super Admin PIN.');
      }
      verifiedByDetail = `Supervisor Override (${override.supervisor.fullName})`;
    } else if (data.verificationMethod === 'RECOVERY_CODE') {
      const key = `pwd_reset_otp_${user.id}`;
      const otpRecord = await prisma.syncCommand.findUnique({
        where: { idempotencyKey: key }
      });
      const payload = (otpRecord?.payload || {}) as any;
      if (!otpRecord || !payload.code || payload.used) {
        throw new Error('No active recovery code found. Please request a new recovery code first.');
      }
      if (Number(payload.expiresAt || 0) < Date.now()) {
        throw new Error('Recovery code has expired. Please request a new 6-digit recovery code.');
      }
      if (String(payload.code).trim() !== cleanedCode) {
        const failedAttempts = (Number(payload.failedAttempts) || 0) + 1;
        const isLockedOut = failedAttempts >= 3;
        await prisma.syncCommand.update({
          where: { idempotencyKey: key },
          data: {
            payload: {
              ...payload,
              failedAttempts,
              ...(isLockedOut ? { used: true, invalidatedReason: 'MAX_FAILED_ATTEMPTS' } : {})
            } as any,
            processedAt: new Date()
          }
        });
        if (isLockedOut) {
          throw new Error('Too many incorrect code attempts. Recovery code has been invalidated for security.');
        }
        throw new Error(`Invalid 6-digit recovery code. ${3 - failedAttempts} attempt(s) remaining.`);
      }
      await prisma.syncCommand.update({
        where: { idempotencyKey: key },
        data: {
          payload: { ...payload, used: true, usedAt: new Date().toISOString() } as any,
          processedAt: new Date()
        }
      });
      verifiedByDetail = payload.authorizedBy
        ? `Manager-Authorized Recovery Code (${payload.authorizedBy})`
        : '6-Digit Recovery Code (OTP)';
    } else {
      throw new Error('Unsupported password recovery verification method.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });

    await prisma.auditEvent.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        action: 'PASSWORD_RESET_COMPLETED',
        entityType: 'User',
        entityId: user.id,
        details: {
          username: user.username,
          verificationMethod: data.verificationMethod,
          verifiedBy: verifiedByDetail
        }
      }
    });

    return {
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      verifiedBy: verifiedByDetail
    };
  }

  async changePassword(userId: string, currentPasswordOrPin: string, newPassword: string) {
    await this.ensureBootstrapUsers();
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!user || !user.isActive) {
      throw new Error('Active user account not found.');
    }

    const cleanedCurrent = String(currentPasswordOrPin || '').trim();
    const matchesCurrentPassword = await bcrypt.compare(cleanedCurrent, user.passwordHash);
    const matchesCurrentPin = await matchesPin(cleanedCurrent, user.supervisorPin);

    if (!matchesCurrentPassword && !matchesCurrentPin) {
      throw new Error('Current password or personal Staff PIN is incorrect.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });

    await prisma.auditEvent.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        action: 'PASSWORD_CHANGED',
        entityType: 'User',
        entityId: user.id,
        details: {
          username: user.username,
          verifiedWith: matchesCurrentPassword ? 'Current Password' : 'Staff PIN'
        }
      }
    });

    return {
      username: user.username,
      fullName: user.fullName
    };
  }
}

export const authService = new AuthService();
