import { prisma } from '@lspot/database';
import { roundTo2Decimals, RESTAURANT_NAME, RESTAURANT_LOCATION, formatZMW } from '@lspot/shared';

export class InvoiceService {
  async getInvoices(tenantId: string) {
    return prisma.invoice.findMany({
      where: { tenantId },
      include: {
        customer: true,
        payments: true
      },
      orderBy: { issueDate: 'desc' }
    });
  }

  async getInvoiceById(tenantId: string, id: string) {
    return prisma.invoice.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        payments: true,
        saleLinks: {
          include: {
            sale: {
              include: { items: { include: { menuItem: true } } }
            }
          }
        }
      }
    });
  }

  async consolidateDailyCreditInvoices(tenantId: string, customerId: string, dateStr: string) {
    const targetDate = new Date(dateStr);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Find all credit sales for this customer on targetDate that are not already linked to an invoice
    const creditSales = await prisma.sale.findMany({
      where: {
        tenantId,
        customerId,
        paymentStatus: 'CREDIT',
        createdAt: { gte: startOfDay, lte: endOfDay },
        invoiceSaleLink: { none: {} }
      },
      include: { items: { include: { menuItem: true } } }
    });

    if (creditSales.length === 0) {
      throw new Error('No unconsolidated credit sales found for this customer on the specified date');
    }

    const totalSubtotal = creditSales.reduce((sum: number, s: any) => sum + Number(s.subtotal), 0);
    const totalAmount = creditSales.reduce((sum: number, s: any) => sum + Number(s.totalAmount), 0);

    const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
    if (!customer) throw new Error('Customer not found');

    const invoiceNumber = `INV-CON-${Date.now().toString().slice(-8)}`;
    const dueDate = new Date(targetDate);
    dueDate.setDate(dueDate.getDate() + (customer.paymentTermsDays || 30));

    return prisma.$transaction(async (tx: any) => {
      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          customerId,
          invoiceNumber,
          invoiceType: 'DAILY_CONSOLIDATED',
          issueDate: targetDate,
          dueDate,
          subtotal: roundTo2Decimals(totalSubtotal),
          totalAmount: roundTo2Decimals(totalAmount),
          amountPaid: 0,
          status: 'ISSUED',
          notes: `Consolidated daily credit invoice for ${creditSales.length} meals on ${dateStr}`,
          saleLinks: {
            create: creditSales.map((s: any) => ({
              saleId: s.id
            }))
          }
        },
        include: {
          customer: true,
          saleLinks: {
            include: {
              sale: {
                include: { items: { include: { menuItem: true } } }
              }
            }
          }
        }
      });

      return invoice;
    });
  }

  generateWhatsAppShareUrl(invoice: any): string {
    const phone = invoice.customer?.phone?.replace(/[^0-9]/g, '') || '';
    const text = encodeURIComponent(
      `Hello ${invoice.customer?.name},\n\n` +
      `Here is your invoice ${invoice.invoiceNumber} from ${RESTAURANT_NAME} (Manyama, Zambia):\n` +
      `Total Amount: ${formatZMW(Number(invoice.totalAmount))}\n` +
      `Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}\n` +
      `Status: ${invoice.status}\n\n` +
      `Thank you for dining with The LSpot Restaurant!`
    );
    return `https://wa.me/${phone}?text=${text}`;
  }

  async sendInvoice(tenantId: string, invoiceId: string, deliveryMethod: string) {
    const invoice = await this.getInvoiceById(tenantId, invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    const shareUrl = this.generateWhatsAppShareUrl(invoice);

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { deliveryStatus: 'DELIVERED' }
    });

    return {
      invoiceId: invoice.id,
      deliveryMethod,
      deliveryStatus: 'DELIVERED',
      shareUrl
    };
  }

  async updateInvoice(
    tenantId: string,
    id: string,
    data: {
      invoiceNumber?: string;
      customerId?: string;
      invoiceType?: string;
      issueDate?: string;
      dueDate?: string;
      subtotal?: number;
      totalAmount?: number;
      amountPaid?: number;
      status?: string;
      notes?: string | null;
    }
  ) {
    const existing = await prisma.invoice.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new Error('Invoice not found');
    }

    const updateData: any = {};
    if (data.invoiceNumber !== undefined && data.invoiceNumber.trim()) updateData.invoiceNumber = data.invoiceNumber.trim();
    if (data.customerId !== undefined && data.customerId.trim()) updateData.customerId = data.customerId.trim();
    if (data.invoiceType !== undefined) updateData.invoiceType = data.invoiceType;
    if (data.issueDate) {
      const d = new Date(data.issueDate);
      if (!isNaN(d.getTime())) updateData.issueDate = d;
    }
    if (data.dueDate) {
      const d = new Date(data.dueDate);
      if (!isNaN(d.getTime())) updateData.dueDate = d;
    }
    if (data.subtotal !== undefined) updateData.subtotal = roundTo2Decimals(Math.max(0, Number(data.subtotal)));
    if (data.totalAmount !== undefined) {
      updateData.totalAmount = roundTo2Decimals(Math.max(0, Number(data.totalAmount)));
      if (data.subtotal === undefined) updateData.subtotal = updateData.totalAmount;
    }
    if (data.amountPaid !== undefined) updateData.amountPaid = roundTo2Decimals(Math.max(0, Number(data.amountPaid)));
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes || null;

    return prisma.invoice.update({
      where: { id: existing.id },
      data: updateData,
      include: { customer: true, payments: true }
    });
  }
}

export const invoiceService = new InvoiceService();
