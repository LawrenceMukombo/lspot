import { prisma } from '@lspot/database';
import { ZraStatus } from '@lspot/shared';
import { restaurantService } from './restaurant.service.js';
import { LEGACY_DEMO_SALE_IDS } from './finance.service.js';

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

    const integrations = await restaurantService.getIntegrationsConfig(tenantId);

    const pendingFiscalSales = await prisma.sale.count({
      where: {
        tenantId,
        id: { notIn: LEGACY_DEMO_SALE_IDS },
        zraStatus: ZraStatus.PENDING_SUBMISSION,
        paymentStatus: { not: 'REFUNDED' }
      }
    });

    const fiscalizedSales = await prisma.sale.count({
      where: {
        tenantId,
        id: { notIn: LEGACY_DEMO_SALE_IDS },
        zraStatus: ZraStatus.FISCALIZED,
        paymentStatus: { not: 'REFUNDED' }
      }
    });

    return {
      tpin: tenant?.tpin || 'Pending Registration',
      smartInvoiceEnabled: tenant?.businessSettings[0]?.taxEnabled ?? integrations.zraConfig.taxEnabled,
      vatRate: `${Number(tenant?.businessSettings[0]?.taxRatePercent ?? integrations.zraConfig.taxRatePercent ?? 16)}%`,
      taxRatePercent: Number(tenant?.businessSettings[0]?.taxRatePercent ?? integrations.zraConfig.taxRatePercent ?? 16),
      taxInclusive: integrations.zraConfig.taxInclusive,
      autoFiscalizeOnCheckout: integrations.zraConfig.autoFiscalizeOnCheckout,
      vsdcMode: integrations.zraConfig.vsdcMode,
      vsdcBaseUrl: integrations.zraConfig.vsdcBaseUrl,
      branchCode: integrations.zraConfig.branchCode,
      deviceSerial: integrations.zraConfig.deviceSerial,
      fiscalizedSalesCount: fiscalizedSales,
      pendingSubmissionCount: pendingFiscalSales,
      adapterStatus: integrations.zraConfig.vsdcMode === 'PRODUCTION_VSDC' ? 'PRODUCTION_VSDC_ACTIVE' : 'READY_FOR_INTEGRATION_KEYS'
    };
  }

  async updateZraConfig(tenantId: string, userId: string | undefined, data: any) {
    if (data.tpin !== undefined) {
      await restaurantService.updateProfile(tenantId, {
        tpin: data.tpin,
        taxEnabled: data.taxEnabled,
        taxRatePercent: data.taxRatePercent
      });
    }
    await restaurantService.updateIntegrationsConfig(tenantId, userId, {
      zraConfig: {
        vsdcMode: data.vsdcMode || 'LOCAL_SIGNATURE',
        vsdcBaseUrl: data.vsdcBaseUrl || 'http://localhost:8080/vsdc',
        branchCode: data.branchCode || '000',
        deviceSerial: data.deviceSerial || 'LSPOT-VSDC-001',
        taxEnabled: Boolean(data.taxEnabled),
        taxRatePercent: Number(data.taxRatePercent ?? 16),
        taxInclusive: Boolean(data.taxInclusive ?? true),
        autoFiscalizeOnCheckout: Boolean(data.autoFiscalizeOnCheckout ?? false)
      }
    });
    return this.getComplianceStatus(tenantId);
  }

  async generateFiscalInvoiceSignature(tenantId: string, saleId: string) {
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, tenantId },
      include: { customer: true, items: { include: { menuItem: true } }, tenant: true }
    });

    if (!sale) throw new Error('Sale not found');

    const integrations = await restaurantService.getIntegrationsConfig(tenantId);
    const branchCode = integrations.zraConfig.branchCode || '000';
    const fiscalCode = `ZRA-${branchCode}-${Date.now().toString(36).toUpperCase()}-${sale.saleNumber.slice(-4)}`;

    const taxRate = Number(integrations.zraConfig.taxRatePercent || 16);
    const computedTax =
      Number(sale.taxAmount) > 0
        ? Number(sale.taxAmount)
        : integrations.zraConfig.taxEnabled
        ? Number((Number(sale.totalAmount) - Number(sale.totalAmount) / (1 + taxRate / 100)).toFixed(2))
        : 0;

    await prisma.sale.update({
      where: { id: sale.id },
      data: {
        zraStatus: ZraStatus.FISCALIZED,
        fiscalInvoiceNo: fiscalCode,
        taxAmount: computedTax
      }
    });

    return {
      saleId: sale.id,
      saleNumber: sale.saleNumber,
      fiscalInvoiceNo: fiscalCode,
      taxAmount: computedTax,
      vsdcMode: integrations.zraConfig.vsdcMode,
      status: ZraStatus.FISCALIZED,
      timestamp: new Date().toISOString()
    };
  }

  async fiscalizePendingBatch(tenantId: string) {
    const pending = await prisma.sale.findMany({
      where: {
        tenantId,
        id: { notIn: LEGACY_DEMO_SALE_IDS },
        zraStatus: { not: ZraStatus.FISCALIZED },
        paymentStatus: { not: 'REFUNDED' }
      },
      take: 100
    });

    const results = [];
    for (const sale of pending) {
      const res = await this.generateFiscalInvoiceSignature(tenantId, sale.id);
      results.push(res);
    }

    return {
      fiscalizedCount: results.length,
      results
    };
  }
}

export const zraService = new ZraService();
