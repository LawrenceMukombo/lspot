import { prisma } from '@lspot/database';
import { roundTo2Decimals, roundQuantity } from '@lspot/shared';

export class RecipeService {
  async getRecipes(tenantId: string) {
    return prisma.recipe.findMany({
      where: { tenantId },
      include: {
        menuItem: true,
        recipeIngredients: {
          include: { stockItem: true }
        }
      }
    });
  }

  async createRecipe(tenantId: string, data: any) {
    // Calculate standard batch cost
    let totalStandardCost = 0;
    const stockItems = await prisma.stockItem.findMany({
      where: { id: { in: data.ingredients.map((i: any) => i.stockItemId) } }
    });

    const itemCostMap = new Map(stockItems.map((si) => [si.id, Number(si.averageUnitCost)]));

    for (const ing of data.ingredients) {
      const unitCost = itemCostMap.get(ing.stockItemId) || 0;
      const ingCost = ing.quantity * unitCost * (1 + (ing.lossPercentage || 0) / 100);
      totalStandardCost += ingCost;
    }

    const recipe = await prisma.recipe.create({
      data: {
        tenantId,
        name: data.name,
        batchQuantity: data.batchQuantity,
        expectedPortionYield: data.expectedPortionYield,
        standardCost: roundTo2Decimals(totalStandardCost),
        instructions: data.instructions,
        recipeIngredients: {
          create: data.ingredients.map((i: any) => ({
            stockItemId: i.stockItemId,
            quantity: i.quantity,
            unitOfMeasure: i.unitOfMeasure,
            lossPercentage: i.lossPercentage || 0
          }))
        }
      },
      include: {
        recipeIngredients: {
          include: { stockItem: true }
        }
      }
    });

    // Update menu item estimated cost per portion
    if (data.menuItemId) {
      const costPerPortion = data.expectedPortionYield > 0
        ? roundTo2Decimals(totalStandardCost / data.expectedPortionYield)
        : totalStandardCost;

      await prisma.menuItem.update({
        where: { id: data.menuItemId },
        data: {
          recipeId: recipe.id,
          estimatedCost: costPerPortion
        }
      });
    }

    return recipe;
  }

  async scaleRecipe(recipeId: string, targetPortions: number) {
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        recipeIngredients: {
          include: { stockItem: true }
        }
      }
    });

    if (!recipe) {
      throw new Error('Recipe not found');
    }

    const scaleFactor = targetPortions / recipe.expectedPortionYield;
    const scaledIngredients = recipe.recipeIngredients.map((ing) => {
      const baseQty = Number(ing.quantity);
      const scaledQty = roundQuantity(baseQty * scaleFactor);
      const unitCost = Number(ing.stockItem.averageUnitCost);
      const estimatedCost = roundTo2Decimals(scaledQty * unitCost);

      return {
        stockItemId: ing.stockItemId,
        stockItemName: ing.stockItem.name,
        sku: ing.stockItem.sku,
        unitOfMeasure: ing.unitOfMeasure,
        baseQuantity: baseQty,
        scaledQuantity: scaledQty,
        unitCost,
        estimatedCost
      };
    });

    const totalEstimatedCost = scaledIngredients.reduce((sum, item) => sum + item.estimatedCost, 0);

    return {
      recipeId: recipe.id,
      recipeName: recipe.name,
      baseYield: recipe.expectedPortionYield,
      targetPortions,
      scaleFactor: roundTo2Decimals(scaleFactor),
      totalEstimatedCost: roundTo2Decimals(totalEstimatedCost),
      costPerPortion: roundTo2Decimals(totalEstimatedCost / targetPortions),
      ingredients: scaledIngredients
    };
  }
}

export const recipeService = new RecipeService();
