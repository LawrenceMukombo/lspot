import { prisma } from '@lspot/database';
import { roundTo2Decimals } from '@lspot/shared';

export class MenuService {
  async getCategories(tenantId: string) {
    return prisma.menuCategory.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: 'asc' }
    });
  }

  async createCategory(tenantId: string, name: string, description?: string, sortOrder?: number) {
    return prisma.menuCategory.create({
      data: {
        tenantId,
        name,
        description,
        ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {})
      }
    });
  }

  async updateCategory(tenantId: string, id: string, data: { name?: string; description?: string | null; sortOrder?: number; isActive?: boolean }) {
    const existing = await prisma.menuCategory.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new Error('Menu category not found');
    }
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.sortOrder !== undefined) updateData.sortOrder = Number(data.sortOrder);
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

    return prisma.menuCategory.update({
      where: { id: existing.id },
      data: updateData
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
    for (const key of ['name', 'description', 'imageUrl', 'categoryId', 'portionSize', 'sku', 'recipeId', 'isAvailable'] as const) {
      if (data[key] !== undefined) updateData[key] = data[key];
    }
    if (data.sellingPrice !== undefined) updateData.sellingPrice = Number(data.sellingPrice);
    if (data.estimatedCost !== undefined) updateData.estimatedCost = Number(data.estimatedCost);
    return prisma.menuItem.update({
      where: { id: existing.id },
      data: updateData,
      include: { category: true, recipe: true }
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
