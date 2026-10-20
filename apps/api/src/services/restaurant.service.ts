import { prisma } from '@lspot/database';

export class RestaurantService {
  async getProfile(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        branches: true,
        businessSettings: true
      }
    });
    return tenant;
  }

  async updateProfile(tenantId: string, data: any) {
    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: data.name,
        country: 'Zambia',
        currency: data.currency || 'ZMW',
        timezone: data.timezone || 'Africa/Lusaka',
        tpin: data.tpin
      }
    });

    if (data.cashToleranceZmw !== undefined) {
      const setting = await prisma.businessSetting.findFirst({
        where: { tenantId }
      });
      if (setting) {
        await prisma.businessSetting.update({
          where: { id: setting.id },
          data: {
            cashToleranceZmw: data.cashToleranceZmw,
            operatingHoursStart: data.operatingHoursStart,
            operatingHoursEnd: data.operatingHoursEnd
          }
        });
      }
    }

    return updated;
  }

  async getBranches(tenantId: string) {
    return prisma.branch.findMany({
      where: { tenantId, isActive: true }
    });
  }
}

export const restaurantService = new RestaurantService();
