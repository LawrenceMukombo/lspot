import { prisma } from '@lspot/database';
import { ZraStatus } from '@lspot/shared';

export interface ZraFiscalPayload {
  tpin: string;
  invoiceNumber: string;
  customerName?: string;
  customerTpin?: string;
  dateTime: string;
  taxRates: {
    standardRate16: number;
    zeroRated: number;
    exempt: number;
  };
  totalAmount: number;
  taxAmount: number;
}

export class ZraService {
  async getComplianceStatus(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { businessSettings: true }
    });

    const pendingFiscalSales = await prisma.sale.count({
      where: { tenantId, zraStatus: ZraStatus.PENDING_SUBMISSION }
    });

    const fiscalizedSales = await prisma.sale.count({
      where: { tenantId, zraStatus: ZraStatus.FISCALIZED }
    });

    return {
      tpin: tenant?.tpin || 'Pending Registration',
      smartInvoiceEnabled: tenant?.businessSettings[0]?.taxEnabled || false,
      vatRate: `${Number(tenant?.businessSettings[0]?.taxRatePercent || 16)}%`,
      fiscalizedSalesCount: fiscalizedSales,
      pendingSubmissionCount: pendingFiscalSales,
      adapterStatus: 'READY_FOR_INTEGRATION_KEYS'
    };
  }

  async generateFiscalInvoiceSignature(saleId: string) {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { customer: true, items: true, tenant: true }
    });

    if (!sale) throw new Error('Sale not found');

    const fiscalCode = `ZRA-${Date.now().toString(36).toUpperCase()}-${sale.saleNumber.slice(-4)}`;

    await prisma.sale.update({
      where: { id: sale.id },
      data: {
        zraStatus: ZraStatus.FISCALIZED,
        fiscalInvoiceNo: fiscalCode
      }
    });

    return {
      saleId: sale.id,
      saleNumber: sale.saleNumber,
      fiscalInvoiceNo: fiscalCode,
      status: ZraStatus.FISCALIZED,
      timestamp: new Date().toISOString()
    };
  }
}

export const zraService = new ZraService();
