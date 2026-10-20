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
import { formatZMW } from '@lspot/shared';

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
    } catch (e) {
      // Fallback sample data
      setItems([
        { id: 'i1', sku: 'ING-MM-01', name: 'Mealie Meal (Breakfast)', category: { name: 'Raw Ingredients' }, unitOfMeasure: 'kg', currentStock: 250, averageUnitCost: 12.0, totalValue: 3000.0, reorderLevel: 20, isLowStock: false },
        { id: 'i2', sku: 'ING-CHK-01', name: 'Fresh Chicken', category: { name: 'Raw Ingredients' }, unitOfMeasure: 'kg', currentStock: 80, averageUnitCost: 45.0, totalValue: 3600.0, reorderLevel: 15, isLowStock: false },
        { id: 'i3', sku: 'ING-BEEF-01', name: 'Fresh Beef (Stewing)', category: { name: 'Raw Ingredients' }, unitOfMeasure: 'kg', currentStock: 60, averageUnitCost: 55.0, totalValue: 3300.0, reorderLevel: 15, isLowStock: false },
        { id: 'i4', sku: 'ING-FISH-01', name: 'Bream Fish (Frozen)', category: { name: 'Raw Ingredients' }, unitOfMeasure: 'kg', currentStock: 50, averageUnitCost: 60.0, totalValue: 3000.0, reorderLevel: 10, isLowStock: false },
        { id: 'i5', sku: 'ING-OIL-01', name: 'Cooking Oil', category: { name: 'Raw Ingredients' }, unitOfMeasure: 'l', currentStock: 8, averageUnitCost: 35.0, totalValue: 280.0, reorderLevel: 10, isLowStock: true },
        { id: 'i6', sku: 'BEV-COKE-350', name: 'Coca Cola 350ml Glass', category: { name: 'Direct Resale Beverages' }, unitOfMeasure: 'pcs', currentStock: 120, averageUnitCost: 10.0, totalValue: 1200.0, reorderLevel: 24, isLowStock: false },
        { id: 'i7', sku: 'BEV-WATER-500', name: 'Natural Mineral Water 500ml', category: { name: 'Direct Resale Beverages' }, unitOfMeasure: 'pcs', currentStock: 150, averageUnitCost: 5.0, totalValue: 750.0, reorderLevel: 30, isLowStock: false }
      ]);
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
        />
      ) : (
        <EnterpriseTable
          columns={movementColumns}
          data={movements}
          title="Append-Only Perpetual Stock Movement History"
          searchPlaceholder="Search movements by item or event..."
          isLoading={isLoading}
        />
      )}

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
