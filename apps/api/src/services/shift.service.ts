import { prisma } from '@lspot/database';
import {
  calculateShiftCashReconciliation,
  roundTo2Decimals,
  ShiftStatus
} from '@lspot/shared';

export class ShiftService {
  async getCurrentShift(cashierId: string) {
    return prisma.cashierShift.findFirst({
      where: { cashierId, status: ShiftStatus.OPEN },
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
    const existing = await this.getCurrentShift(cashierId);
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

  async closeShift(shiftId: string, data: any) {
    const shift = await prisma.cashierShift.findUnique({
      where: { id: shiftId }
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

      // Verify supervisor PIN
      const supervisor = await prisma.user.findFirst({
        where: {
          tenantId: shift.tenantId,
          supervisorPin: data.supervisorPin,
          role: { in: ['OWNER', 'MANAGER', 'SUPER_ADMIN', 'ACCOUNTANT'] },
          isActive: true
        }
      });

      if (!supervisor) {
        throw new Error('Invalid Supervisor PIN. Only authorized managers or owners can approve cash shift variances.');
      }

      supervisorId = supervisor.id;
      varianceExplanation = varianceExplanation
        ? `${varianceExplanation} (Approved by supervisor: ${supervisor.fullName})`
        : `Approved by supervisor: ${supervisor.fullName}`;
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
