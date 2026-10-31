import { prisma } from '@lspot/database';
import {
  calculateShiftCashReconciliation,
  roundTo2Decimals,
  ShiftStatus
} from '@lspot/shared';
import { authService } from './auth.service.js';

export class ShiftService {
  async getCurrentShift(cashierId: string, tenantId?: string) {
    return prisma.cashierShift.findFirst({
      where: {
        cashierId,
        ...(tenantId ? { tenantId } : {}),
        status: ShiftStatus.OPEN
      },
      include: {
        cashier: { select: { fullName: true, username: true } },
        sales: {
          include: { payments: true }
        }
      },
      orderBy: { startedAt: 'desc' }
    });
  }

  async openShift(tenantId: string, branchId: string, cashierId: string, data: any) {
    const existing = await this.getCurrentShift(cashierId, tenantId);
    if (existing) {
      throw new Error('Cashier already has an open shift. Please close it first.');
    }

    const openingFloat = Number(data.openingFloat || 0);

    return prisma.cashierShift.create({
      data: {
        tenantId,
        branchId,
        cashierId,
        status: ShiftStatus.OPEN,
        openingFloat,
        expectedCash: openingFloat
      },
      include: {
        cashier: { select: { fullName: true } }
      }
    });
  }

  async closeShift(tenantId: string, shiftId: string, data: any) {
    const shift = await prisma.cashierShift.findFirst({
      where: { id: shiftId, tenantId }
    });

    if (!shift || shift.status !== ShiftStatus.OPEN) {
      throw new Error('Active shift not found');
    }

    const recon = calculateShiftCashReconciliation({
      openingFloat: Number(shift.openingFloat),
      cashSales: Number(shift.cashSales),
      cashCreditCollections: Number(shift.cashCreditCollections),
      approvedCashExpenses: Number(shift.cashExpenses),
      cashWithdrawals: Number(shift.cashWithdrawals),
      actualCashCounted: Number(data.actualCashCounted)
    });

    // FIN-02: Check cash tolerance from business settings
    const settings = await prisma.businessSetting.findFirst({
      where: { tenantId: shift.tenantId }
    });
    const tolerance = settings ? Number(settings.cashToleranceZmw) : 5.0;

    let supervisorId: string | null = null;
    let varianceExplanation = data.varianceExplanation || null;

    if (Math.abs(recon.variance) > tolerance) {
      if (!data.supervisorPin) {
        throw new Error(
          `Cash variance of K ${Math.abs(recon.variance).toFixed(2)} exceeds allowable tolerance of K ${tolerance.toFixed(2)}. Supervisor PIN approval is required.`
        );
      }

      // Verify supervisor PIN using AuthService (supports hashed and legacy PINs)
      const verification = await authService.verifySupervisorOverride(shift.tenantId, String(data.supervisorPin).trim());
      if (!verification.valid || !verification.supervisor) {
        throw new Error('Invalid Supervisor PIN. Only authorized managers or owners can approve cash shift variances.');
      }

      supervisorId = verification.supervisor.id;
      varianceExplanation = varianceExplanation
        ? `${varianceExplanation} (Approved by supervisor: ${verification.supervisor.fullName})`
        : `Approved by supervisor: ${verification.supervisor.fullName}`;
    }

    const closed = await prisma.cashierShift.update({
      where: { id: shift.id },
      data: {
        status: ShiftStatus.CLOSED,
        closedAt: new Date(),
        actualCashCounted: recon.actualCashCounted,
        expectedCash: recon.expectedClosingCash,
        variance: recon.variance,
        varianceExplanation,
        supervisorId
      },
      include: {
        cashier: { select: { fullName: true } }
      }
    });

    return {
      ...closed,
      reconciliation: recon
    };
  }

  async recordCashWithdrawal(
    tenantId: string,
    cashierId: string,
    data: { shiftId?: string; amount: number; reason: string; supervisorPin: string }
  ) {
    const amount = roundTo2Decimals(Number(data.amount || 0));
    if (amount <= 0) {
      throw new Error('Cash withdrawal amount must be greater than zero.');
    }
    if (!data.reason || !data.reason.trim()) {
      throw new Error('Reason for safe drop / cash withdrawal is mandatory.');
    }
    if (!data.supervisorPin) {
      throw new Error('Supervisor PIN is required to authorize a cash drawer withdrawal.');
    }

    const verification = await authService.verifySupervisorOverride(tenantId, String(data.supervisorPin).trim());
    if (!verification.valid || !verification.supervisor) {
      throw new Error('Invalid Supervisor PIN. Only authorized managers or owners can approve cash withdrawals.');
    }

    const shift = data.shiftId
      ? await prisma.cashierShift.findFirst({ where: { id: data.shiftId, tenantId, status: ShiftStatus.OPEN } })
      : await this.getCurrentShift(cashierId, tenantId);

    if (!shift || shift.status !== ShiftStatus.OPEN) {
      throw new Error('No active open shift found for this cashier.');
    }

    const newWithdrawals = roundTo2Decimals(Number(shift.cashWithdrawals) + amount);
    const newExpected = roundTo2Decimals(
      Number(shift.openingFloat) +
        Number(shift.cashSales) +
        Number(shift.cashCreditCollections) -
        Number(shift.cashExpenses) -
        newWithdrawals
    );

    const updatedShift = await prisma.cashierShift.update({
      where: { id: shift.id },
      data: {
        cashWithdrawals: newWithdrawals,
        expectedCash: newExpected
      },
      include: {
        cashier: { select: { fullName: true, username: true } }
      }
    });

    await prisma.auditEvent.create({
      data: {
        tenantId,
        userId: verification.supervisor.id,
        action: 'SHIFT_CASH_WITHDRAWAL',
        entityType: 'CashierShift',
        entityId: shift.id,
        details: {
          amount,
          reason: data.reason.trim(),
          approvedBy: verification.supervisor.fullName,
          newWithdrawalsTotal: newWithdrawals,
          newExpectedCash: newExpected
        }
      }
    });

    return updatedShift;
  }

  async getShiftHistory(tenantId: string, limit = 50) {
    return prisma.cashierShift.findMany({
      where: { tenantId },
      include: {
        cashier: { select: { fullName: true, username: true } }
      },
      orderBy: { startedAt: 'desc' },
      take: limit
    });
  }
}

export const shiftService = new ShiftService();
