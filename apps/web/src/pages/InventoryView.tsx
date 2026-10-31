import React, { useState, useEffect } from 'react';
import {
  Package,
  PlusCircle,
  ArrowRightLeft,
  Sliders,
  History,
  AlertTriangle
} from 'lucide-react';
import { apiRequest } from '../api.js';
import { EnterpriseTable, Column } from '../components/EnterpriseTable.js';
import { formatZMW, UnitOfMeasure, StockCategoryType } from '@lspot/shared';
import { DetailDrawer, DetailStat, DetailSection, DetailRows, FormModal, btn, inputCls, labelCls } from '../components/DetailDrawer.js';

const emptyStockForm = {
  name: '',
  sku: '',
  category: StockCategoryType.RAW_INGREDIENT as string,
  unitOfMeasure: UnitOfMeasure.KILOGRAM as string,
  reorderLevel: 5,
  initialQuantity: 0,
  unitCost: 0
};

export function InventoryView() {
  const [items, setItems] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'ITEMS' | 'MOVEMENTS'>('ITEMS');
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Form states
  const [receiveItemId, setReceiveItemId] = useState('');
  const [receiveQty, setReceiveQty] = useState(50);
  const [receiveUnitCost, setReceiveUnitCost] = useState(15.0);
  const [supplierRef, setSupplierRef] = useState('INV-SUP-001');

  const [transferItemId, setTransferItemId] = useState('');
  const [transferQty, setTransferQty] = useState(10);

  // Detail drawer + CRUD forms
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [stockFormMode, setStockFormMode] = useState<'CREATE' | 'EDIT' | null>(null);
  const [stockForm, setStockForm] = useState<any>(emptyStockForm);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustCount, setAdjustCount] = useState(0);
  const [adjustReason, setAdjustReason] = useState('Physical stock count');
  const [adjustPin, setAdjustPin] = useState('');
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setStockForm(emptyStockForm);
    setStockFormMode('CREATE');
  };

  const openEdit = (item: any) => {
    setStockForm({
      name: item.name,
      sku: item.sku,
      unitOfMeasure: item.unitOfMeasure,
      reorderLevel: Number(item.reorderLevel)
    });
    setStockFormMode('EDIT');
  };

  const handleSaveStockItem = async () => {
    if (!stockForm.name || stockForm.name.trim().length < 2) return alert('Item name is required');
    if (!stockForm.sku || stockForm.sku.trim().length < 2) return alert('SKU / Code is required');
    setSaving(true);
    try {
      if (stockFormMode === 'CREATE') {
        await apiRequest('/inventory/items', {
          method: 'POST',
          body: JSON.stringify({
            ...stockForm,
            reorderLevel: Number(stockForm.reorderLevel),
            initialQuantity: Number(stockForm.initialQuantity),
            unitCost: Number(stockForm.unitCost)
          })
        });
      } else if (selectedItem) {
        await apiRequest(`/inventory/items/${selectedItem.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: stockForm.name,
            sku: stockForm.sku,
            unitOfMeasure: stockForm.unitOfMeasure,
            reorderLevel: Number(stockForm.reorderLevel)
          })
        });
      }
      setStockFormMode(null);
      setSelectedItem(null);
      loadInventory();
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (item: any) => {
    if (!confirm(`Deactivate "${item.name}"? It will be hidden from stock lists but its movement history is preserved.`)) return;
    try {
      await apiRequest(`/inventory/items/${item.id}`, { method: 'DELETE' });
      setSelectedItem(null);
      loadInventory();
    } catch (err: any) {
      alert(`Deactivation failed: ${err.message}`);
    }
  };

  const handleAdjust = async () => {
    if (!selectedItem) return;
    if (!/^\d{4,6}$/.test(adjustPin)) return alert('Supervisor PIN (4-6 digits) is required');
    setSaving(true);
    try {
      await apiRequest('/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({
          stockItemId: selectedItem.id,
          countedQuantity: Number(adjustCount),
          reason: adjustReason,
          supervisorPin: adjustPin
        })
      });
      setShowAdjustModal(false);
      setSelectedItem(null);
      setAdjustPin('');
      loadInventory();
    } catch (err: any) {
      alert(`Adjustment failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest('/inventory/items');
      if (data) setItems(data);
      const movs = await apiRequest('/inventory/movements');
      if (movs) setMovements(movs);
    } catch (e: any) {
      console.warn('Network error loading inventory items:', e);
      setItems((prev) => (prev.length > 0 ? prev : []));
      setMovements((prev) => (prev.length > 0 ? prev : []));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReceiveStock = async () => {
    if (!receiveItemId) {
      alert('Please select an item');
      return;
    }
    try {
      await apiRequest('/inventory/receive', {
        method: 'POST',
        body: JSON.stringify({
          stockItemId: receiveItemId,
          destinationLocationId: 'loc-0000-0000-0000-000000000001',
          quantity: Number(receiveQty),
          unitCost: Number(receiveUnitCost),
          invoiceReference: supplierRef
        })
      });
      setShowReceiveModal(false);
      loadInventory();
      alert('Stock received and Moving Average Unit Cost updated!');
    } catch (err: any) {
      alert(`Receipt failed: ${err.message}`);
    }
  };

  const handleTransferStock = async () => {
    if (!transferItemId) {
      alert('Please select an item');
      return;
    }
    try {
      await apiRequest('/inventory/transfer', {
        method: 'POST',
        body: JSON.stringify({
          stockItemId: transferItemId,
          sourceLocationId: 'loc-0000-0000-0000-000000000001',
          destinationLocationId: 'loc-0000-0000-0000-000000000002',
          quantity: Number(transferQty),
          notes: 'Daily issue from Main Store to Kitchen'
        })
      });
      setShowTransferModal(false);
      loadInventory();
      alert('Stock transferred to kitchen successfully!');
    } catch (err: any) {
      alert(`Transfer failed: ${err.message}`);
    }
  };

  const itemColumns: Column<any>[] = [
    { key: 'sku', header: 'SKU / Code', render: (row) => <span className="font-mono text-amber-400 font-semibold">{row.sku}</span> },
    { key: 'name', header: 'Stock Item Name', render: (row) => <span className="font-bold text-slate-100">{row.name}</span> },
    { key: 'category', header: 'Category', render: (row) => <span className="text-slate-400">{row.category?.name || 'Raw'}</span> },
    { key: 'unitOfMeasure', header: 'UOM', render: (row) => <span className="font-mono">{row.unitOfMeasure}</span> },
    {
      key: 'currentStock',
      header: 'Current Stock',
      render: (row) => (
        <span
          className={`font-mono font-bold ${
            row.isLowStock ? 'text-rose-400' : 'text-slate-200'
          }`}
        >
          {row.currentStock} {row.unitOfMeasure}
        </span>
      )
    },
    { key: 'averageUnitCost', header: 'WAC Unit Cost', render: (row) => <span className="font-mono text-slate-300">{formatZMW(row.averageUnitCost)}</span> },
    { key: 'totalValue', header: 'Total Value', render: (row) => <span className="font-mono font-bold text-emerald-400">{formatZMW(row.totalValue)}</span> },
    {
      key: 'status',
      header: 'Inventory Health',
      render: (row) =>
        row.isLowStock ? (
          <span className="flex items-center gap-1 text-xs text-rose-400 font-semibold bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
            <AlertTriangle className="w-3 h-3" /> Reorder Needed
          </span>
        ) : (
          <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
            Optimal Stock
          </span>
        )
    }
  ];

  const movementColumns: Column<any>[] = [
    { key: 'createdAt', header: 'Date & Time', render: (row) => <span className="text-xs font-mono">{new Date(row.createdAt).toLocaleString()}</span> },
    { key: 'stockItem', header: 'Item', render: (row) => <span className="font-bold">{row.stockItem?.name}</span> },
    { key: 'movementType', header: 'Event Type', render: (row) => <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-amber-400">{row.movementType}</span> },
    { key: 'quantity', header: 'Quantity', render: (row) => <span className="font-mono font-bold">{row.quantity}</span> },
    { key: 'totalValue', header: 'Value Impact', render: (row) => <span className="font-mono text-emerald-400 font-semibold">{formatZMW(row.totalValue)}</span> },
    { key: 'notes', header: 'Reference / Notes', render: (row) => <span className="text-xs text-slate-400">{row.notes || row.referenceId || '—'}</span> }
  ];

  const totalInventoryVal = items.reduce((sum, i) => sum + Number(i.totalValue || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">Perpetual Inventory & Store Management</h2>
              <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 text-purple-300 font-mono text-xs font-bold rounded-lg">
                Total Valuation: {formatZMW(totalInventoryVal)}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Moving Weighted Average Costing (WAC) & full double-entry stock movement traceability.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="inventory-new-item"
            onClick={openCreate}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-xl border border-slate-700 transition"
          >
            <PlusCircle className="w-4 h-4 text-amber-400" />
            New Stock Item
          </button>

          <button
            onClick={() => setShowReceiveModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-amber-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            Receive Goods (Supplier)
          </button>

          <button
            onClick={() => setShowTransferModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-xl border border-slate-700 transition"
          >
            <ArrowRightLeft className="w-4 h-4 text-amber-400" />
            Issue to Kitchen
          </button>

          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('ITEMS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'ITEMS' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              Stock Items
            </button>
            <button
              onClick={() => setActiveTab('MOVEMENTS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'MOVEMENTS' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              Movements Ledger
            </button>
          </div>
        </div>
      </div>

      {/* Enterprise Data Table */}
      {activeTab === 'ITEMS' ? (
        <EnterpriseTable
          columns={itemColumns}
          data={items}
          title="Stock Master List & Valuations"
          searchPlaceholder="Search stock items or SKU..."
          isLoading={isLoading}
          onRowClick={(row) => setSelectedItem(row)}
        />
      ) : (
        <EnterpriseTable
          columns={movementColumns}
          data={movements}
          title="Append-Only Perpetual Stock Movement History"
          searchPlaceholder="Search movements by item or event..."
          isLoading={isLoading}
          onRowClick={(row) => {
            const item = items.find((i) => i.id === row.stockItemId);
            if (item) setSelectedItem(item);
          }}
        />
      )}

      {/* Stock Item Detail Drawer */}
      <DetailDrawer
        open={!!selectedItem && !stockFormMode && !showAdjustModal}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.name || ''}
        subtitle={`SKU ${selectedItem?.sku || ''} • ${selectedItem?.category?.name || 'Uncategorised'}`}
        icon={<Package className="w-5 h-5" />}
        badge={
          selectedItem?.isLowStock ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-rose-500/10 text-rose-400">Reorder Needed</span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-emerald-500/10 text-emerald-400">Optimal</span>
          )
        }
        actions={
          <>
            <button id="inventory-detail-deactivate" className={btn.danger} onClick={() => handleDeactivate(selectedItem)}>Deactivate</button>
            <button id="inventory-detail-adjust" className={btn.secondary} onClick={() => { setAdjustCount(Number(selectedItem.currentStock)); setShowAdjustModal(true); }}>
              <Sliders className="w-4 h-4 text-amber-400" /> Physical Count
            </button>
            <button id="inventory-detail-edit" className={btn.secondary} onClick={() => openEdit(selectedItem)}>Edit</button>
            <button id="inventory-detail-receive" className={btn.primary} onClick={() => { setReceiveItemId(selectedItem.id); setReceiveUnitCost(Number(selectedItem.averageUnitCost) || 1); setSelectedItem(null); setShowReceiveModal(true); }}>
              <PlusCircle className="w-4 h-4" /> Receive
            </button>
          </>
        }
      >
        {selectedItem && (() => {
          const itemMovements = movements.filter((m) => m.stockItemId === selectedItem.id);
          const stock = Number(selectedItem.currentStock);
          const reorder = Number(selectedItem.reorderLevel);
          const pct = reorder > 0 ? Math.min(100, Math.round((stock / (reorder * 3)) * 100)) : 100;
          return (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <DetailStat label="Current Stock" value={`${stock} ${selectedItem.unitOfMeasure}`} tone={selectedItem.isLowStock ? 'bad' : 'default'} />
                <DetailStat label="Reorder Level" value={`${reorder} ${selectedItem.unitOfMeasure}`} tone="warn" />
                <DetailStat label="WAC Unit Cost" value={formatZMW(selectedItem.averageUnitCost)} />
                <DetailStat label="Total Value" value={formatZMW(selectedItem.totalValue)} tone="good" />
              </div>
              <div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className={`h-full ${selectedItem.isLowStock ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Stock cover vs 3× reorder level</p>
              </div>
              <DetailSection title="Item Master Data">
                <DetailRows
                  rows={[
                    ['SKU / Code', <span className="font-mono text-amber-400">{selectedItem.sku}</span>],
                    ['Unit of measure', selectedItem.unitOfMeasure],
                    ['Category', selectedItem.category?.name || '—'],
                    ['Barcode', selectedItem.barcode || '—'],
                    ['Created', selectedItem.createdAt ? new Date(selectedItem.createdAt).toLocaleString('en-GB', { timeZone: 'Africa/Lusaka' }) : '—'],
                    ['Last updated', selectedItem.updatedAt ? new Date(selectedItem.updatedAt).toLocaleString('en-GB', { timeZone: 'Africa/Lusaka' }) : '—']
                  ]}
                />
              </DetailSection>
              <DetailSection title={`Recent Movements (${itemMovements.length})`}>
                {itemMovements.length === 0 ? (
                  <p className="text-sm text-slate-500 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl p-4 text-center">No stock movements recorded yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {itemMovements.slice(0, 15).map((m) => (
                      <li key={m.id} className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-amber-400">{m.movementType}</span>
                          <span className={`font-mono font-bold ${Number(m.quantity) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {Number(m.quantity) > 0 ? '+' : ''}{Number(m.quantity)} {selectedItem.unitOfMeasure}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-400 mt-1">
                          <span>{new Date(m.createdAt).toLocaleString('en-GB', { timeZone: 'Africa/Lusaka' })}</span>
                          <span className="font-mono">{formatZMW(m.totalValue)}</span>
                        </div>
                        {(m.notes || m.referenceId) && <p className="text-xs text-slate-300 mt-1 break-words">{m.notes || m.referenceId}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </DetailSection>
            </>
          );
        })()}
      </DetailDrawer>

      {/* Create / Edit Stock Item */}
      <FormModal
        open={!!stockFormMode}
        title={stockFormMode === 'CREATE' ? 'New Stock Item' : `Edit ${selectedItem?.name || 'Stock Item'}`}
        subtitle={stockFormMode === 'CREATE' ? 'Opening balance is recorded at the given unit cost.' : 'Quantities change only via Receive, Issue or Physical Count to keep the ledger auditable.'}
        onClose={() => setStockFormMode(null)}
        onSubmit={handleSaveStockItem}
        submitting={saving}
        submitLabel={stockFormMode === 'CREATE' ? 'Create Item' : 'Save Changes'}
      >
        <div>
          <label htmlFor="stock-name" className={labelCls}>Item name</label>
          <input id="stock-name" className={inputCls} value={stockForm.name} onChange={(e) => setStockForm({ ...stockForm, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="stock-sku" className={labelCls}>SKU / Code</label>
            <input id="stock-sku" className={`${inputCls} font-mono`} value={stockForm.sku} onChange={(e) => setStockForm({ ...stockForm, sku: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <label htmlFor="stock-uom" className={labelCls}>Unit of measure</label>
            <select id="stock-uom" className={inputCls} value={stockForm.unitOfMeasure} onChange={(e) => setStockForm({ ...stockForm, unitOfMeasure: e.target.value })}>
              {Object.values(UnitOfMeasure).map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        {stockFormMode === 'CREATE' && (
          <div>
            <label htmlFor="stock-category" className={labelCls}>Category type</label>
            <select id="stock-category" className={inputCls} value={stockForm.category} onChange={(e) => setStockForm({ ...stockForm, category: e.target.value })}>
              {Object.values(StockCategoryType).map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="stock-reorder" className={labelCls}>Reorder level</label>
            <input id="stock-reorder" type="number" min="0" className={inputCls} value={stockForm.reorderLevel} onChange={(e) => setStockForm({ ...stockForm, reorderLevel: e.target.value })} />
          </div>
          {stockFormMode === 'CREATE' && (
            <>
              <div>
                <label htmlFor="stock-opening" className={labelCls}>Opening qty</label>
                <input id="stock-opening" type="number" min="0" className={inputCls} value={stockForm.initialQuantity} onChange={(e) => setStockForm({ ...stockForm, initialQuantity: e.target.value })} />
              </div>
              <div>
                <label htmlFor="stock-cost" className={labelCls}>Unit cost (K)</label>
                <input id="stock-cost" type="number" min="0" step="0.01" className={inputCls} value={stockForm.unitCost} onChange={(e) => setStockForm({ ...stockForm, unitCost: e.target.value })} />
              </div>
            </>
          )}
        </div>
      </FormModal>

      {/* Physical Count Adjustment */}
      <FormModal
        open={showAdjustModal}
        title={`Physical Count — ${selectedItem?.name || ''}`}
        subtitle={`System quantity: ${selectedItem?.currentStock ?? 0} ${selectedItem?.unitOfMeasure || ''}. Variance is posted as an auditable adjustment movement.`}
        onClose={() => setShowAdjustModal(false)}
        onSubmit={handleAdjust}
        submitting={saving}
        submitLabel="Post Adjustment"
      >
        <div>
          <label htmlFor="adjust-count" className={labelCls}>Counted quantity</label>
          <input id="adjust-count" type="number" min="0" step="0.01" className={inputCls} value={adjustCount} onChange={(e) => setAdjustCount(Number(e.target.value))} />
          <p className="text-xs mt-1 text-slate-400">
            Variance: <span className={`font-mono font-bold ${adjustCount - Number(selectedItem?.currentStock || 0) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{(adjustCount - Number(selectedItem?.currentStock || 0)).toFixed(2)}</span>
          </p>
        </div>
        <div>
          <label htmlFor="adjust-reason" className={labelCls}>Reason</label>
          <input id="adjust-reason" className={inputCls} value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
        </div>
        <div>
          <label htmlFor="adjust-pin" className={labelCls}>Supervisor PIN</label>
          <input id="adjust-pin" type="password" inputMode="numeric" maxLength={6} className={`${inputCls} font-mono`} value={adjustPin} onChange={(e) => setAdjustPin(e.target.value.replace(/\D/g, ''))} />
        </div>
      </FormModal>

      {/* Receive Goods Modal */}
      {showReceiveModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-white">Receive Goods from Supplier</h3>
            <p className="text-xs text-slate-400">
              Receipt will update physical stock and recalculate Moving Weighted Average Cost (WAC).
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Stock Item</label>
                <select
                  value={receiveItemId}
                  onChange={(e) => setReceiveItemId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Choose Item --</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unitOfMeasure}) — Current WAC: {formatZMW(i.averageUnitCost)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Received Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={receiveQty}
                    onChange={(e) => setReceiveQty(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Unit Cost (ZMW)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={receiveUnitCost}
                    onChange={(e) => setReceiveUnitCost(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 font-mono text-emerald-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Supplier Invoice / Delivery Note #</label>
                <input
                  type="text"
                  value={supplierRef}
                  onChange={(e) => setSupplierRef(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowReceiveModal(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleReceiveStock}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold rounded-xl shadow-lg shadow-amber-500/20"
              >
                Accept Goods
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer to Kitchen Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-white">Transfer Stock to Kitchen Area</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Stock Item</label>
                <select
                  value={transferItemId}
                  onChange={(e) => setTransferItemId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Choose Item --</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unitOfMeasure}) — Available: {i.currentStock}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Transfer Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={transferQty}
                  onChange={(e) => setTransferQty(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowTransferModal(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleTransferStock}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold rounded-xl shadow-lg shadow-amber-500/20"
              >
                Dispatch to Kitchen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
