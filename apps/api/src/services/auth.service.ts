import { prisma } from '@lspot/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRole } from '@lspot/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'lspot-restaurant-super-secret-jwt-key-2026';

export class AuthService {
  async login(username: string, passwordPlain: string) {
    const user = await prisma.user.findFirst({
      where: { username, isActive: true },
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

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });

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

  async verifyPin(supervisorId: string, pin: string) {
    const user = await prisma.user.findUnique({
      where: { id: supervisorId }
    });

    if (!user || !user.supervisorPin) {
      return false;
    }

    return user.supervisorPin === pin;
  }
}

export const authService = new AuthService();
