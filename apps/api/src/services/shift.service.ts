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

    const closed = await prisma.cashierShift.update({
      where: { id: shift.id },
      data: {
        status: ShiftStatus.CLOSED,
        closedAt: new Date(),
        actualCashCounted: recon.actualCashCounted,
        expectedCash: recon.expectedClosingCash,
        variance: recon.variance,
        varianceExplanation: data.varianceExplanation || null
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
