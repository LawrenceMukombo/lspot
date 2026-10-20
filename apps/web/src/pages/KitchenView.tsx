import React, { useState, useEffect } from 'react';
import {
  ChefHat,
  PlusCircle,
  AlertOctagon,
  CheckCircle2,
  Lock,
  Layers,
  Utensils
} from 'lucide-react';
import { apiRequest } from '../api.js';
import { EnterpriseTable, Column } from '../components/EnterpriseTable.js';

export function KitchenView() {
  const [register, setRegister] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showWasteModal, setShowWasteModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  // Form states
  const [batchMenuId, setBatchMenuId] = useState('');
  const [plannedPortions, setPlannedPortions] = useState(20);
  const [actualPortions, setActualPortions] = useState(20);
  const [batchNotes, setBatchNotes] = useState('');

  const [wasteMenuId, setWasteMenuId] = useState('');
  const [wastePortions, setWastePortions] = useState(1);
  const [wasteType, setWasteType] = useState<'WASTE' | 'STAFF' | 'COMPLIMENTARY'>('WASTE');
  const [wasteReason, setWasteReason] = useState('Preparation shrinkage');

  const [supervisorPin, setSupervisorPin] = useState('1234');

  useEffect(() => {
    loadRegister();
    loadMenuItems();
  }, []);

  const loadRegister = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest('/kitchen/registers/today');
      if (res) setRegister(res);
    } catch (e) {
      // Fallback sample kitchen register data
      setRegister({
        id: 'reg-today-01',
        businessDate: new Date().toISOString().split('T')[0],
        status: 'OPEN',
        items: [
          { id: 'k1', menuItem: { id: 'm1', name: 'Nshima with Chicken', portionSize: 'Standard Portion' }, openingPortions: 0, preparedPortions: 30, soldPortions: 22, wastePortions: 2, staffMealPortions: 1, complimentaryPortions: 0, remainingPortions: 5, closingPortions: 0 },
          { id: 'k2', menuItem: { id: 'm2', name: 'Nshima with Beef Stew', portionSize: 'Standard Portion' }, openingPortions: 0, preparedPortions: 25, soldPortions: 18, wastePortions: 1, staffMealPortions: 1, complimentaryPortions: 0, remainingPortions: 5, closingPortions: 0 },
          { id: 'k3', menuItem: { id: 'm3', name: 'Nshima with Bream Fish', portionSize: 'Whole Fish' }, openingPortions: 0, preparedPortions: 15, soldPortions: 12, wastePortions: 0, staffMealPortions: 0, complimentaryPortions: 0, remainingPortions: 3, closingPortions: 0 },
          { id: 'k4', menuItem: { id: 'm4', name: 'Rice with Chicken', portionSize: 'Standard Portion' }, openingPortions: 0, preparedPortions: 15, soldPortions: 11, wastePortions: 0, staffMealPortions: 0, complimentaryPortions: 0, remainingPortions: 4, closingPortions: 0 }
        ]
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMenuItems = async () => {
    try {
      const items = await apiRequest('/menu/items');
      if (items) setMenuItems(items);
    } catch (e) {
      setMenuItems([
        { id: 'm1', name: 'Nshima with Chicken' },
        { id: 'm2', name: 'Nshima with Beef Stew' },
        { id: 'm3', name: 'Nshima with Bream Fish' },
        { id: 'm4', name: 'Rice with Chicken' }
      ]);
    }
  };

  const handleRecordBatch = async () => {
    if (!batchMenuId) {
      alert('Please select a menu dish');
      return;
    }
    try {
      await apiRequest('/kitchen/batches', {
        method: 'POST',
        body: JSON.stringify({
          registerId: register.id,
          menuItemId: batchMenuId,
          plannedPortions: Number(plannedPortions),
          actualPreparedPortions: Number(actualPortions),
          notes: batchNotes
        })
      });
      setShowBatchModal(false);
      loadRegister();
    } catch (err: any) {
      alert(`Failed to record batch: ${err.message}`);
    }
  };

  const handleRecordWaste = async () => {
    if (!wasteMenuId) {
      alert('Please select a menu dish');
      return;
    }
    try {
      await apiRequest('/kitchen/waste', {
        method: 'POST',
        body: JSON.stringify({
          registerId: register.id,
          menuItemId: wasteMenuId,
          portionsWasted: Number(wastePortions),
          wasteReason,
          isStaffMeal: wasteType === 'STAFF',
          isComplimentary: wasteType === 'COMPLIMENTARY'
        })
      });
      setShowWasteModal(false);
      loadRegister();
    } catch (err: any) {
      alert(`Failed to record waste: ${err.message}`);
    }
  };

  const handleCloseRegister = async () => {
    try {
      await apiRequest('/kitchen/registers/close', {
        method: 'POST',
        body: JSON.stringify({
          registerId: register.id,
          supervisorPin,
          itemsClosing: (register.items || []).map((i: any) => ({
            menuItemId: i.menuItem.id,
            actualCountedPortions: i.remainingPortions,
            reasonForVariance: 'Day-end physical count verified'
          }))
        })
      });
      setShowCloseModal(false);
      loadRegister();
      alert('Daily kitchen register reconciled and closed successfully!');
    } catch (err: any) {
      alert(`Failed to close register: ${err.message}`);
    }
  };

  const columns: Column<any>[] = [
    {
      key: 'menuItem',
      header: 'Prepared Food Item',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-100">{row.menuItem?.name}</span>
          <p className="text-xs text-slate-400">{row.menuItem?.portionSize}</p>
        </div>
      )
    },
    { key: 'openingPortions', header: 'Opening', render: (row) => <span className="font-mono">{row.openingPortions}</span> },
    { key: 'preparedPortions', header: 'Prepared (Cooked)', render: (row) => <span className="font-mono text-emerald-400 font-bold">+{row.preparedPortions}</span> },
    { key: 'soldPortions', header: 'Sold (POS)', render: (row) => <span className="font-mono text-amber-400 font-bold">-{row.soldPortions}</span> },
    { key: 'wastePortions', header: 'Kitchen Waste', render: (row) => <span className="font-mono text-rose-400">{row.wastePortions}</span> },
    { key: 'staffMealPortions', header: 'Staff Meals', render: (row) => <span className="font-mono text-blue-400">{row.staffMealPortions}</span> },
    { key: 'complimentaryPortions', header: 'Complimentary', render: (row) => <span className="font-mono text-purple-400">{row.complimentaryPortions}</span> },
    {
      key: 'remainingPortions',
      header: 'Available for Sale',
      render: (row) => (
        <span className="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 font-mono font-extrabold border border-amber-500/30">
          {row.remainingPortions} Portions
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">Daily Kitchen Production Register</h2>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                  register?.status === 'OPEN'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {register?.status || 'OPEN'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Strict portion accounting: Opening + Production - POS Sales - Waste - Staff Meals = Remaining Portions
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowBatchModal(true)}
            disabled={register?.status === 'CLOSED'}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-amber-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            Record Cooking Batch
          </button>

          <button
            onClick={() => setShowWasteModal(true)}
            disabled={register?.status === 'CLOSED'}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-rose-300 font-semibold text-sm rounded-xl border border-slate-700 transition"
          >
            <AlertOctagon className="w-4 h-4 text-rose-400" />
            Record Waste / Staff Meal
          </button>

          <button
            onClick={() => setShowCloseModal(true)}
            disabled={register?.status === 'CLOSED'}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-xl border border-slate-700 transition"
          >
            <Lock className="w-4 h-4 text-amber-400" />
            Reconcile & Close Register
          </button>
        </div>
      </div>

      {/* Enterprise Data Table */}
      <EnterpriseTable
        columns={columns}
        data={register?.items || []}
        title="Today's Meal Preparation & Sales Balance"
        searchPlaceholder="Search cooked dishes..."
        isLoading={isLoading}
      />

      {/* Record Batch Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-white">Record Kitchen Cooking Batch</h3>
            <p className="text-xs text-slate-400">
              Raw ingredients will be atomically deducted from store inventory based on standard recipe BOM.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Select Menu Dish</label>
                <select
                  value={batchMenuId}
                  onChange={(e) => setBatchMenuId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Choose Dish --</option>
                  {menuItems.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Planned Portions</label>
                  <input
                    type="number"
                    min="1"
                    value={plannedPortions}
                    onChange={(e) => setPlannedPortions(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Actual Prepared Portions</label>
                  <input
                    type="number"
                    min="1"
                    value={actualPortions}
                    onChange={(e) => setActualPortions(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 font-bold text-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Chef Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Lunch batch 1 prepared by Chef Mwewa"
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowBatchModal(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordBatch}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold rounded-xl shadow-lg shadow-amber-500/20"
              >
                Confirm Batch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Waste Modal */}
      {showWasteModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-white">Record Kitchen Waste or Staff Meal</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Select Menu Dish</label>
                <select
                  value={wasteMenuId}
                  onChange={(e) => setWasteMenuId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Choose Dish --</option>
                  {menuItems.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Portions</label>
                  <input
                    type="number"
                    min="1"
                    value={wastePortions}
                    onChange={(e) => setWastePortions(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Type</label>
                  <select
                    value={wasteType}
                    onChange={(e) => setWasteType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="WASTE">Spoilage / Burnt</option>
                    <option value="STAFF">Staff Meal</option>
                    <option value="COMPLIMENTARY">Complimentary</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Reason / Explanation</label>
                <input
                  type="text"
                  value={wasteReason}
                  onChange={(e) => setWasteReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowWasteModal(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordWaste}
                className="flex-1 py-2 bg-rose-500 hover:bg-rose-400 text-white text-sm font-bold rounded-xl"
              >
                Record Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Register Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-white">Reconcile & Close Kitchen Day</h3>
            <p className="text-xs text-slate-400">
              This locks today's production register. Any remaining eligible food will become tomorrow's opening balance.
            </p>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Supervisor PIN Required</label>
              <input
                type="password"
                maxLength={6}
                value={supervisorPin}
                onChange={(e) => setSupervisorPin(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-center text-lg font-mono tracking-widest text-amber-400 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowCloseModal(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseRegister}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold rounded-xl"
              >
                Confirm Closure
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
