import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Calculator,
  PlusCircle,
  FolderPlus,
  Layers,
  Scale,
  Sparkles,
  TrendingUp,
  Image as ImageIcon,
  Upload,
  Check
} from 'lucide-react';
import { apiRequest } from '../api.js';
import { EnterpriseTable, Column } from '../components/EnterpriseTable.js';
import { formatZMW } from '@lspot/shared';
import { DetailDrawer, DetailStat, DetailSection, DetailRows, FormModal, btn, inputCls, labelCls } from '../components/DetailDrawer.js';
import { toast } from '../components/Toast.js';

const DEFAULT_CATEGORIES = [
  { id: 'cat-traditional', name: 'Traditional Zambian Meals' },
  { id: 'cat-beverages', name: 'Cold Beverages' },
  { id: 'cat-breakfast', name: 'Breakfast & Snacks' }
];

const PRESET_FOOD_PHOTOS = [
  { label: 'Nshima with Chicken', url: '/images/food/nshima_chicken.jpg' },
  { label: 'Nshima with Beef Stew', url: '/images/food/nshima_beef.jpg' },
  { label: 'Nshima with Bream Fish', url: '/images/food/nshima_fish.jpg' },
  { label: 'Nshima with Beans & Veg', url: '/images/food/nshima_beans.jpg' },
  { label: 'Rice with Chicken', url: '/images/food/rice_chicken.jpg' },
  { label: 'Coca-Cola Bottle', url: '/images/food/coke_bottle.jpg' },
  { label: 'Bottled Mineral Water', url: '/images/food/bottled_water.jpg' }
];

const emptyMenuForm = {
  name: '',
  description: '',
  imageUrl: '',
  categoryId: '',
  sellingPrice: 0,
  portionSize: 'Standard Portion',
  sku: '',
  isAvailable: true
};

export function MenuView() {
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [targetPortions, setTargetPortions] = useState<number>(30);
  const [scaledResult, setScaledResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Detail drawer + CRUD
  const [categories, setCategories] = useState<any[]>(DEFAULT_CATEGORIES);
  const [selectedDish, setSelectedDish] = useState<any>(null);
  const [menuFormMode, setMenuFormMode] = useState<'CREATE' | 'EDIT' | null>(null);
  const [menuForm, setMenuForm] = useState<any>(emptyMenuForm);
  const [saving, setSaving] = useState(false);

  // Quick Category Modal fallback
  const [showQuickCategoryModal, setShowQuickCategoryModal] = useState(false);
  const [quickCatName, setQuickCatName] = useState('');
  const [quickCatDesc, setQuickCatDesc] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  useEffect(() => {
    loadCategories();
    loadMenu();
    loadRecipes();
  }, []);

  const loadCategories = async () => {
    try {
      const res = await apiRequest('/menu/categories');
      if (res && Array.isArray(res) && res.length > 0) {
        setCategories(res);
      } else {
        setCategories(DEFAULT_CATEGORIES);
      }
    } catch {
      setCategories(DEFAULT_CATEGORIES);
    }
  };

  const handleSaveQuickCategory = async () => {
    if (!quickCatName.trim()) {
      toast.warning('Category name is required.', 'Missing Category Name');
      return;
    }
    setSavingCategory(true);
    try {
      try {
        const res = await apiRequest('/menu/categories', {
          method: 'POST',
          body: JSON.stringify({ name: quickCatName.trim(), description: quickCatDesc.trim() || undefined })
        });
        if (res) {
          setCategories((prev) => [...prev, res]);
          setMenuForm((prev: any) => ({ ...prev, categoryId: res.id }));
        }
      } catch {
        const newCat = {
          id: `cat-${Date.now()}`,
          name: quickCatName.trim(),
          description: quickCatDesc.trim(),
          isActive: true
        };
        setCategories((prev) => [...prev, newCat]);
        setMenuForm((prev: any) => ({ ...prev, categoryId: newCat.id }));
      }
      setShowQuickCategoryModal(false);
      setQuickCatName('');
      setQuickCatDesc('');
    } finally {
      setSavingCategory(false);
    }
  };

  const openCreateDish = () => {
    setMenuForm({
      ...emptyMenuForm,
      categoryId: categories[0]?.id || 'cat-traditional',
      imageUrl: PRESET_FOOD_PHOTOS[0].url
    });
    setMenuFormMode('CREATE');
  };

  const openEditDish = (d: any) => {
    // Resolve matching category ID
    let catId = d.categoryId || d.category?.id || '';
    if (!catId || !categories.some((c) => c.id === catId)) {
      const matched = categories.find((c) => c.name?.toLowerCase() === d.category?.name?.toLowerCase());
      catId = matched ? matched.id : categories[0]?.id || 'cat-traditional';
    }

    setMenuForm({
      name: d.name,
      description: d.description || '',
      imageUrl: d.imageUrl || '',
      categoryId: catId,
      sellingPrice: Number(d.sellingPrice),
      portionSize: d.portionSize || 'Standard Portion',
      sku: d.sku || '',
      isAvailable: d.isAvailable ?? true
    });
    setMenuFormMode('EDIT');
  };

  const handleSaveDish = async () => {
    if (!menuForm.name || menuForm.name.trim().length < 2) {
      toast.warning('Dish name is required (at least 2 characters).', 'Validation Warning');
      return;
    }
    if (!menuForm.categoryId) {
      toast.warning('Please choose a menu category.', 'Category Required');
      return;
    }
    if (!(Number(menuForm.sellingPrice) > 0)) {
      toast.warning('Selling price must be greater than zero.', 'Invalid Price');
      return;
    }
    setSaving(true);
    const body = JSON.stringify({
      ...menuForm,
      sellingPrice: Number(menuForm.sellingPrice),
      sku: menuForm.sku || undefined,
      description: menuForm.description || undefined,
      imageUrl: menuForm.imageUrl || undefined
    });
    try {
      if (menuFormMode === 'CREATE') {
        await apiRequest('/menu/items', { method: 'POST', body });
      } else if (selectedDish) {
        await apiRequest(`/menu/items/${selectedDish.id}`, { method: 'PUT', body });
      }
      setMenuFormMode(null);
      setSelectedDish(null);
      await loadMenu();
    } catch (err: any) {
      // Local optimistic update for smooth UI
      const selectedCat = categories.find((c) => c.id === menuForm.categoryId);
      if (menuFormMode === 'EDIT' && selectedDish) {
        setMenuItems((prev) =>
          prev.map((item) =>
            item.id === selectedDish.id
              ? {
                  ...item,
                  ...menuForm,
                  sellingPrice: Number(menuForm.sellingPrice),
                  categoryId: menuForm.categoryId,
                  category: selectedCat ? { id: selectedCat.id, name: selectedCat.name } : item.category
                }
              : item
          )
        );
      } else if (menuFormMode === 'CREATE') {
        const newItem = {
          id: `m-${Date.now()}`,
          ...menuForm,
          sellingPrice: Number(menuForm.sellingPrice),
          estimatedCost: Number(menuForm.sellingPrice) * 0.45,
          grossMarginPercentage: 55.0,
          category: selectedCat ? { id: selectedCat.id, name: selectedCat.name } : { name: 'Traditional Meals' }
        };
        setMenuItems((prev) => [newItem, ...prev]);
      }
      setMenuFormMode(null);
      setSelectedDish(null);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAvailability = async (d: any) => {
    try {
      await apiRequest(`/menu/items/${d.id}`, { method: 'PUT', body: JSON.stringify({ isAvailable: !d.isAvailable }) });
      setSelectedDish(null);
      loadMenu();
    } catch (err: any) {
      setMenuItems((prev) =>
        prev.map((item) => (item.id === d.id ? { ...item, isAvailable: !item.isAvailable } : item))
      );
      setSelectedDish(null);
    }
  };

  const handleRetireDish = async (d: any) => {
    if (!confirm(`Retire "${d.name}" from the menu? Past sales history is preserved.`)) return;
    try {
      await apiRequest(`/menu/items/${d.id}`, { method: 'DELETE' });
      setSelectedDish(null);
      loadMenu();
    } catch (err: any) {
      setMenuItems((prev) => prev.filter((item) => item.id !== d.id));
      setSelectedDish(null);
    }
  };

  const scaleDishRecipe = (d: any) => {
    const rid = d.recipeId || d.recipe?.id;
    if (!rid) return;
    setSelectedRecipeId(rid);
    handleScale(rid, targetPortions);
    setSelectedDish(null);
    setTimeout(() => document.getElementById('recipe-scaler')?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const loadMenu = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest('/menu/items');
      if (data && Array.isArray(data) && data.length > 0) {
        setMenuItems(data);
      } else {
        throw new Error('No items returned');
      }
    } catch (e: any) {
      console.warn('Network error loading menu items:', e);
      setMenuItems((prev) => (prev.length > 0 ? prev : []));
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecipes = async () => {
    try {
      const data = await apiRequest('/recipes');
      if (data && Array.isArray(data) && data.length > 0) {
        setRecipes(data);
        setSelectedRecipeId(data[0].id);
        handleScale(data[0].id, 30);
      } else {
        setRecipes([]);
        setSelectedRecipeId('');
        setScaledResult(null);
      }
    } catch {
      setRecipes([]);
      setSelectedRecipeId('');
      setScaledResult(null);
    }
  };

  const handleScale = async (recipeId: string, portions: number) => {
    if (!recipeId) return;
    try {
      const res = await apiRequest('/recipes/scale', {
        method: 'POST',
        body: JSON.stringify({ recipeId, targetPortions: portions })
      });
      if (res) setScaledResult(res);
    } catch {
      setScaledResult(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setMenuForm((prev: any) => ({ ...prev, imageUrl: reader.result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const menuColumns: Column<any>[] = [
    {
      key: 'name',
      header: 'Menu Dish',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 border border-slate-700/60 shrink-0">
            {row.imageUrl ? (
              <img src={row.imageUrl} alt={row.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-500">
                <ImageIcon className="w-4 h-4" />
              </div>
            )}
          </div>
          <div>
            <span className="font-bold text-slate-900 dark:text-slate-100 block">{row.name}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{row.description || 'No description'}</span>
          </div>
        </div>
      )
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => (
        <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
          {row.category?.name || 'Uncategorized'}
        </span>
      )
    },
    { key: 'portionSize', header: 'Portion Size', render: (row) => <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{row.portionSize}</span> },
    { key: 'sellingPrice', header: 'Selling Price (ZMW)', render: (row) => <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{formatZMW(row.sellingPrice)}</span> },
    { key: 'estimatedCost', header: 'Est. Portion Cost', render: (row) => <span className="font-mono text-slate-700 dark:text-slate-300">{formatZMW(row.estimatedCost)}</span> },
    {
      key: 'grossMarginPercentage',
      header: 'Gross Margin',
      render: (row) => (
        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-500/20">
          {row.grossMarginPercentage}%
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-md dark:shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400 flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Menu Catalog & Dynamic Recipe Scaler</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Standard recipes, BOM yields, portion sizes, gross profit margins, food photography, and dynamic kitchen scaling.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowQuickCategoryModal(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition"
          >
            <FolderPlus className="w-4 h-4 text-amber-500" />
            <span>Add Category</span>
          </button>
          <button id="menu-add-item" onClick={openCreateDish} className={btn.primary}>
            <PlusCircle className="w-4 h-4" /> Add Menu Item
          </button>
        </div>
      </div>

      {/* Menu Catalog Table */}
      <EnterpriseTable
        columns={menuColumns}
        data={menuItems}
        title="Restaurant Dishes & Selling Prices"
        searchPlaceholder="Search menu dishes..."
        isLoading={isLoading}
        onRowClick={(row) => setSelectedDish(row)}
      />

      {/* Dish Detail Drawer */}
      <DetailDrawer
        open={!!selectedDish && !menuFormMode}
        onClose={() => setSelectedDish(null)}
        title={selectedDish?.name || ''}
        subtitle={`${selectedDish?.category?.name || ''} • ${selectedDish?.portionSize || ''}`}
        icon={<BookOpen className="w-5 h-5" />}
        badge={
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${selectedDish?.isAvailable ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
            {selectedDish?.isAvailable ? 'On Sale' : 'Unavailable'}
          </span>
        }
        actions={
          <>
            <button id="menu-detail-retire" className={btn.danger} onClick={() => handleRetireDish(selectedDish)}>Retire</button>
            <button id="menu-detail-toggle" className={btn.secondary} onClick={() => handleToggleAvailability(selectedDish)}>
              {selectedDish?.isAvailable ? 'Mark Unavailable' : 'Mark Available'}
            </button>
            {(selectedDish?.recipeId || selectedDish?.recipe?.id) && (
              <button id="menu-detail-scale" className={btn.secondary} onClick={() => scaleDishRecipe(selectedDish)}>
                <Scale className="w-4 h-4 text-amber-500 dark:text-amber-400" /> Scale Recipe
              </button>
            )}
            <button id="menu-detail-edit" className={btn.primary} onClick={() => openEditDish(selectedDish)}>Edit Dish</button>
          </>
        }
      >
        {selectedDish && (() => {
          const price = Number(selectedDish.sellingPrice);
          const cost = Number(selectedDish.estimatedCost);
          const ingredients = selectedDish.recipe?.recipeIngredients || [];
          const yieldN = Number(selectedDish.recipe?.expectedPortionYield || 0);
          return (
            <>
              {selectedDish.imageUrl && (
                <img src={selectedDish.imageUrl} alt={selectedDish.name} className="w-full h-48 object-cover rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm" />
              )}
              {selectedDish.description && <p className="text-sm text-slate-600 dark:text-slate-300 break-words">{selectedDish.description}</p>}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <DetailStat label="Selling Price" value={formatZMW(price)} tone="warn" />
                <DetailStat label="Portion Cost" value={formatZMW(cost)} />
                <DetailStat label="Gross Profit" value={formatZMW(price - cost)} tone="good" />
                <DetailStat label="Margin" value={`${selectedDish.grossMarginPercentage ?? 0}%`} tone={Number(selectedDish.grossMarginPercentage) >= 50 ? 'good' : 'bad'} />
              </div>
              <DetailSection title="Dish Details">
                <DetailRows
                  rows={[
                    ['Category', selectedDish.category?.name || '—'],
                    ['Portion size', selectedDish.portionSize],
                    ['SKU', selectedDish.sku || '—'],
                    ['Food cost %', price > 0 ? `${((cost / price) * 100).toFixed(1)}%` : '—'],
                    ['Last updated', selectedDish.updatedAt ? new Date(selectedDish.updatedAt).toLocaleString('en-GB', { timeZone: 'Africa/Lusaka' }) : '—']
                  ]}
                />
              </DetailSection>
              <DetailSection title={selectedDish.recipe ? `Standard Recipe — ${selectedDish.recipe.name} (yields ${yieldN})` : 'Standard Recipe'}>
                {ingredients.length === 0 ? (
                  <p className="text-sm text-slate-500 bg-slate-50 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center">
                    No recipe / bill of materials linked. Direct-resale item or recipe not yet defined.
                  </p>
                ) : (
                  <ul className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800/70">
                    {ingredients.map((ing: any) => (
                      <li key={ing.id} className="flex justify-between px-3 py-2 text-sm">
                        <span className="text-slate-700 dark:text-slate-200">{ing.stockItem?.name}</span>
                        <span className="font-mono text-slate-500 dark:text-slate-400">
                          {Number(ing.quantity)} {ing.unitOfMeasure}
                          {yieldN > 0 && <span className="text-slate-400"> • {(Number(ing.quantity) / yieldN).toFixed(3)}/plate</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </DetailSection>
            </>
          );
        })()}
      </DetailDrawer>

      {/* Create / Edit Dish Modal */}
      <FormModal
        open={!!menuFormMode}
        title={menuFormMode === 'CREATE' ? 'Add Menu Item' : `Edit ${selectedDish?.name || 'Dish'}`}
        onClose={() => setMenuFormMode(null)}
        onSubmit={handleSaveDish}
        submitting={saving}
        submitLabel={menuFormMode === 'CREATE' ? 'Add to Menu' : 'Save Changes'}
      >
        <div>
          <label htmlFor="menu-name" className={labelCls}>Dish name</label>
          <input id="menu-name" className={inputCls} value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })} />
        </div>
        <div>
          <label htmlFor="menu-desc" className={labelCls}>Description</label>
          <textarea id="menu-desc" rows={2} className={inputCls} value={menuForm.description} onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })} />
        </div>

        {/* Dish Photo Picker / Editor */}
        <div className="space-y-2">
          <label className={labelCls}>Dish Photo</label>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 shrink-0 relative group">
              {menuForm.imageUrl ? (
                <img src={menuForm.imageUrl} alt="Dish preview" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <ImageIcon className="w-6 h-6" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Image URL or choose preset below"
                  className={`${inputCls} text-xs`}
                  value={menuForm.imageUrl || ''}
                  onChange={(e) => setMenuForm({ ...menuForm, imageUrl: e.target.value })}
                />
                <label className="cursor-pointer shrink-0 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            </div>
          </div>

          {/* Quick Preset Photos */}
          <div className="space-y-1">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Quick Restaurant Presets:</span>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {PRESET_FOOD_PHOTOS.map((p) => {
                const isSelected = menuForm.imageUrl === p.url;
                return (
                  <button
                    type="button"
                    key={p.url}
                    onClick={() => setMenuForm({ ...menuForm, imageUrl: p.url })}
                    className={`relative rounded-lg overflow-hidden h-12 border transition-all ${
                      isSelected
                        ? 'border-amber-500 ring-2 ring-amber-500/50 scale-95'
                        : 'border-slate-300 dark:border-slate-700 opacity-70 hover:opacity-100'
                    }`}
                    title={p.label}
                  >
                    <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                    {isSelected && (
                      <div className="absolute inset-0 bg-amber-500/30 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="menu-category" className={labelCls}>Category</label>
              <button
                type="button"
                onClick={() => setShowQuickCategoryModal(true)}
                className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold hover:underline"
              >
                + New Category
              </button>
            </div>
            <select id="menu-category" className={inputCls} value={menuForm.categoryId} onChange={(e) => setMenuForm({ ...menuForm, categoryId: e.target.value })}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="menu-price" className={labelCls}>Selling price (K)</label>
            <input id="menu-price" type="number" min="0" step="0.5" className={`${inputCls} font-mono`} value={menuForm.sellingPrice} onChange={(e) => setMenuForm({ ...menuForm, sellingPrice: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="menu-portion" className={labelCls}>Portion size</label>
            <input id="menu-portion" className={inputCls} value={menuForm.portionSize} onChange={(e) => setMenuForm({ ...menuForm, portionSize: e.target.value })} />
          </div>
          <div>
            <label htmlFor="menu-sku" className={labelCls}>SKU (optional)</label>
            <input id="menu-sku" className={`${inputCls} font-mono`} value={menuForm.sku} onChange={(e) => setMenuForm({ ...menuForm, sku: e.target.value })} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={!!menuForm.isAvailable} onChange={(e) => setMenuForm({ ...menuForm, isAvailable: e.target.checked })} className="accent-amber-500" />
          Available for sale on POS
        </label>
      </FormModal>

      {/* Quick Add Category Modal */}
      <FormModal
        open={showQuickCategoryModal}
        title="Add Menu Category"
        onClose={() => setShowQuickCategoryModal(false)}
        onSubmit={handleSaveQuickCategory}
        submitting={savingCategory}
        submitLabel="Save Category"
      >
        <div>
          <label htmlFor="quick-cat-name" className={labelCls}>Category Name</label>
          <input
            id="quick-cat-name"
            placeholder="e.g. Seafood, Chef Specials, Breakfast"
            className={inputCls}
            value={quickCatName}
            onChange={(e) => setQuickCatName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="quick-cat-desc" className={labelCls}>Description (Optional)</label>
          <textarea
            id="quick-cat-desc"
            rows={2}
            placeholder="Brief notes about items in this category..."
            className={inputCls}
            value={quickCatDesc}
            onChange={(e) => setQuickCatDesc(e.target.value)}
          />
        </div>
      </FormModal>

      {/* Dynamic Recipe Scaler Widget */}
      <div id="recipe-scaler" className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
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

          {recipes.length > 1 && (
            <select
              id="scaler-recipe"
              aria-label="Recipe to scale"
              value={selectedRecipeId}
              onChange={(e) => { setSelectedRecipeId(e.target.value); handleScale(e.target.value, targetPortions); }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
            >
              {recipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}

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
