import { prisma } from '@lspot/database';
import { roundTo2Decimals } from '@lspot/shared';

export class MenuService {
  async getCategories(tenantId: string) {
    return prisma.menuCategory.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: 'asc' }
    });
  }

  async createCategory(tenantId: string, name: string, description?: string) {
    return prisma.menuCategory.create({
      data: {
        tenantId,
        name,
        description
      }
    });
  }

  async getMenuItems(tenantId: string, categoryId?: string) {
    const items = await prisma.menuItem.findMany({
      where: {
        tenantId,
        status: { not: 'ARCHIVED' },
        ...(categoryId ? { categoryId } : {})
      },
      include: {
        category: true,
        recipe: {
          include: {
            recipeIngredients: {
              include: { stockItem: true }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    return items.map((item: any) => {
      const price = Number(item.sellingPrice);
      const cost = Number(item.estimatedCost);
      const margin = price > 0 ? roundTo2Decimals(((price - cost) / price) * 100) : 0;
      return {
        ...item,
        sellingPrice: price,
        estimatedCost: cost,
        grossMarginPercentage: margin
      };
    });
  }

  async createMenuItem(tenantId: string, branchId: string, data: any) {
    return prisma.menuItem.create({
      data: {
        tenantId,
        branchId,
        name: data.name,
        description: data.description,
        imageUrl: data.imageUrl,
        categoryId: data.categoryId,
        sellingPrice: data.sellingPrice,
        portionSize: data.portionSize || 'Single Portion',
        estimatedCost: data.estimatedCost || 0,
        isAvailable: data.isAvailable ?? true,
        sku: data.sku
      }
    });
  }

  async updateMenuItem(tenantId: string, id: string, data: any) {
    const existing = await prisma.menuItem.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new Error('Menu item not found');
    }

    const updateData: any = {};
    for (const key of ['name', 'description', 'imageUrl', 'categoryId', 'portionSize', 'sku', 'isAvailable'] as const) {
      if (data[key] !== undefined && data[key] !== null) updateData[key] = data[key];
    }
    if (data.sellingPrice !== undefined) updateData.sellingPrice = Number(data.sellingPrice);
    return prisma.menuItem.update({
      where: { id: existing.id },
      data: updateData,
      include: { category: true }
    });
  }

  // Soft delete: retire item from sale while preserving sales history
  async retireMenuItem(tenantId: string, id: string) {
    const existing = await prisma.menuItem.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new Error('Menu item not found');
    }

    return prisma.menuItem.update({
      where: { id: existing.id },
      data: { isAvailable: false, status: 'ARCHIVED' }
    });
  }
}

export const menuService = new MenuService();
