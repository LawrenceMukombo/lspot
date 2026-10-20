import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Calculator,
  PlusCircle,
  Layers,
  Scale,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { apiRequest } from '../api.js';
import { EnterpriseTable, Column } from '../components/EnterpriseTable.js';
import { formatZMW } from '@lspot/shared';

export function MenuView() {
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [targetPortions, setTargetPortions] = useState<number>(30);
  const [scaledResult, setScaledResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadMenu();
    loadRecipes();
  }, []);

  const loadMenu = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest('/menu/items');
      if (data) setMenuItems(data);
    } catch (e) {
      // Fallback
      setMenuItems([
        { id: 'm1', name: 'Nshima with Chicken', category: { name: 'Traditional Meals' }, sellingPrice: 65, estimatedCost: 28.5, grossMarginPercentage: 56.2, portionSize: 'Standard Portion', isAvailable: true },
        { id: 'm2', name: 'Nshima with Beef Stew', category: { name: 'Traditional Meals' }, sellingPrice: 70, estimatedCost: 32.0, grossMarginPercentage: 54.3, portionSize: 'Standard Portion', isAvailable: true },
        { id: 'm3', name: 'Nshima with Bream Fish', category: { name: 'Traditional Meals' }, sellingPrice: 75, estimatedCost: 36.0, grossMarginPercentage: 52.0, portionSize: 'Whole Fish Portion', isAvailable: true },
        { id: 'm4', name: 'Rice with Chicken', category: { name: 'Traditional Meals' }, sellingPrice: 65, estimatedCost: 29.0, grossMarginPercentage: 55.4, portionSize: 'Standard Portion', isAvailable: true },
        { id: 'm5', name: 'Beans with Nshima & Veg', category: { name: 'Traditional Meals' }, sellingPrice: 40, estimatedCost: 14.0, grossMarginPercentage: 65.0, portionSize: 'Standard Portion', isAvailable: true }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecipes = async () => {
    try {
      const data = await apiRequest('/recipes');
      if (data && data.length > 0) {
        setRecipes(data);
        setSelectedRecipeId(data[0].id);
        handleScale(data[0].id, 30);
      } else {
        // Fallback default recipe
        setRecipes([
          {
            id: 'r1',
            name: 'Standard Nshima with Chicken Recipe (10 Portions Base)',
            expectedPortionYield: 10,
            recipeIngredients: [
              { stockItem: { name: 'Mealie Meal' }, quantity: 2.5, unitOfMeasure: 'kg' },
              { stockItem: { name: 'Fresh Chicken' }, quantity: 2.5, unitOfMeasure: 'kg' },
              { stockItem: { name: 'Cooking Oil' }, quantity: 0.25, unitOfMeasure: 'l' },
              { stockItem: { name: 'Fresh Tomatoes' }, quantity: 0.5, unitOfMeasure: 'kg' },
              { stockItem: { name: 'Onions' }, quantity: 0.25, unitOfMeasure: 'kg' },
              { stockItem: { name: 'Rape / Vegetables' }, quantity: 1.0, unitOfMeasure: 'kg' }
            ]
          }
        ]);
        setSelectedRecipeId('r1');
        handleFallbackScale(30);
      }
    } catch (e) {
      handleFallbackScale(30);
    }
  };

  const handleScale = async (recipeId: string, portions: number) => {
    try {
      const res = await apiRequest('/recipes/scale', {
        method: 'POST',
        body: JSON.stringify({ recipeId, targetPortions: portions })
      });
      if (res) setScaledResult(res);
    } catch (e) {
      handleFallbackScale(portions);
    }
  };

  const handleFallbackScale = (portions: number) => {
    const scale = portions / 10;
    setScaledResult({
      recipeName: 'Standard Nshima with Chicken',
      targetPortions: portions,
      scaleFactor: scale,
      totalEstimatedCost: 285.0 * scale,
      costPerPortion: 28.5,
      ingredients: [
        { stockItemName: 'Mealie Meal', baseQuantity: 2.5, scaledQuantity: 2.5 * scale, unitOfMeasure: 'kg', estimatedCost: 30 * scale },
        { stockItemName: 'Fresh Chicken', baseQuantity: 2.5, scaledQuantity: 2.5 * scale, unitOfMeasure: 'kg', estimatedCost: 112.5 * scale },
        { stockItemName: 'Cooking Oil', baseQuantity: 0.25, scaledQuantity: 0.25 * scale, unitOfMeasure: 'l', estimatedCost: 8.75 * scale },
        { stockItemName: 'Fresh Tomatoes', baseQuantity: 0.5, scaledQuantity: 0.5 * scale, unitOfMeasure: 'kg', estimatedCost: 9 * scale },
        { stockItemName: 'Onions', baseQuantity: 0.25, scaledQuantity: 0.25 * scale, unitOfMeasure: 'kg', estimatedCost: 5 * scale },
        { stockItemName: 'Rape / Vegetables', baseQuantity: 1.0, scaledQuantity: 1.0 * scale, unitOfMeasure: 'kg', estimatedCost: 15 * scale }
      ]
    });
  };

  const menuColumns: Column<any>[] = [
    { key: 'name', header: 'Menu Dish', render: (row) => <span className="font-bold text-slate-100">{row.name}</span> },
    { key: 'category', header: 'Category', render: (row) => <span className="text-slate-400">{row.category?.name}</span> },
    { key: 'portionSize', header: 'Portion Size', render: (row) => <span className="text-xs text-slate-400">{row.portionSize}</span> },
    { key: 'sellingPrice', header: 'Selling Price (ZMW)', render: (row) => <span className="font-mono font-bold text-amber-400">{formatZMW(row.sellingPrice)}</span> },
    { key: 'estimatedCost', header: 'Est. Portion Cost', render: (row) => <span className="font-mono text-slate-300">{formatZMW(row.estimatedCost)}</span> },
    {
      key: 'grossMarginPercentage',
      header: 'Gross Margin',
      render: (row) => (
        <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
          {row.grossMarginPercentage}%
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Menu Catalog & Dynamic Recipe Scaler</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Standard recipes, BOM yields, portion sizes, gross profit margins, and dynamic kitchen scaling.
            </p>
          </div>
        </div>
      </div>

      {/* Menu Catalog Table */}
      <EnterpriseTable
        columns={menuColumns}
        data={menuItems}
        title="Restaurant Dishes & Selling Prices"
        searchPlaceholder="Search menu dishes..."
        isLoading={isLoading}
      />

      {/* Dynamic Recipe Scaler Widget */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <Calculator className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-base text-white">Interactive Kitchen Recipe Scaler</h3>
              <p className="text-xs text-slate-400">
                Scale any standard recipe batch to exact required portion counts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Target Portions:</span>
            {[10, 20, 30, 50, 100].map((p) => (
              <button
                key={p}
                onClick={() => {
                  setTargetPortions(p);
                  if (selectedRecipeId) handleScale(selectedRecipeId, p);
                }}
                className={`px-3 py-1 rounded-lg font-mono text-xs font-bold transition ${
                  targetPortions === p
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {p} Portions
              </button>
            ))}
          </div>
        </div>

        {scaledResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400">Scaled Recipe</span>
                <p className="font-bold text-slate-200 mt-0.5">{scaledResult.recipeName}</p>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400">Est. Total Batch Cost</span>
                <p className="font-mono font-bold text-amber-400 text-lg mt-0.5">
                  {formatZMW(scaledResult.totalEstimatedCost)}
                </p>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="text-xs text-slate-400">Est. Cost Per Plate</span>
                <p className="font-mono font-bold text-emerald-400 text-lg mt-0.5">
                  {formatZMW(scaledResult.costPerPortion)}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-xs uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5">Raw Ingredient</th>
                    <th className="px-4 py-2.5">Standard Base Qty (10 Portions)</th>
                    <th className="px-4 py-2.5">Required Scaled Qty for Store Issue</th>
                    <th className="px-4 py-2.5">UOM</th>
                    <th className="px-4 py-2.5">Est. Ingredient Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {scaledResult.ingredients?.map((ing: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-sans font-semibold text-slate-200">{ing.stockItemName}</td>
                      <td className="px-4 py-3 text-slate-400">{ing.baseQuantity}</td>
                      <td className="px-4 py-3 font-bold text-amber-400 text-sm">{ing.scaledQuantity}</td>
                      <td className="px-4 py-3 text-slate-400">{ing.unitOfMeasure}</td>
                      <td className="px-4 py-3 text-emerald-400">{formatZMW(ing.estimatedCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
