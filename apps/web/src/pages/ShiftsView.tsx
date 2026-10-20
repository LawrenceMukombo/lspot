import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  PlusCircle,
  Lock,
  Coins,
  CheckCircle,
  AlertTriangle,
  History
} from 'lucide-react';
import { apiRequest } from '../api.js';
import { EnterpriseTable, Column } from '../components/EnterpriseTable.js';
import { formatZMW } from '@lspot/shared';

export function ShiftsView() {
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [shiftHistory, setShiftHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  // Open Form
  const [openFloat, setOpenFloat] = useState(200);

  // Close Form
  const [actualCash, setActualCash] = useState(0);
  const [varianceNotes, setVarianceNotes] = useState('');

  useEffect(() => {
    loadShifts();
  }, []);

  const loadShifts = async () => {
    setIsLoading(true);
    try {
      const curr = await apiRequest('/shifts/current');
      setCurrentShift(curr);
      if (curr) {
        setActualCash(Number(curr.expectedCash || 0));
      }
      const hist = await apiRequest('/shifts/history');
      if (hist) setShiftHistory(hist);
    } catch (e) {
      // Fallback
      setCurrentShift({
        id: 'shift-01',
        cashier: { fullName: 'Bupe Tembo' },
        status: 'OPEN',
        startedAt: new Date().toISOString(),
        openingFloat: 200,
        cashSales: 1550,
        cashCreditCollections: 300,
        cashExpenses: 150,
        cashWithdrawals: 0,
        expectedCash: 1900
      });
      setActualCash(1900);
      setShiftHistory([
        { id: 's0', cashier: { fullName: 'Bupe Tembo' }, status: 'CLOSED', startedAt: '2026-10-19T07:30:00Z', closedAt: '2026-10-19T16:00:00Z', openingFloat: 200, cashSales: 2450, expectedCash: 2650, actualCashCounted: 2650, variance: 0 }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenShift = async () => {
    try {
      const res = await apiRequest('/shifts/open', {
        method: 'POST',
        body: JSON.stringify({ openingFloat: Number(openFloat) })
      });
      setShowOpenModal(false);
      loadShifts();
      alert('Shift opened successfully with cash float!');
    } catch (err: any) {
      alert(`Failed to open shift: ${err.message}`);
    }
  };

  const handleCloseShift = async () => {
    if (!currentShift) return;
    try {
      const res = await apiRequest('/shifts/close', {
        method: 'POST',
        body: JSON.stringify({
          shiftId: currentShift.id,
          actualCashCounted: Number(actualCash),
          varianceExplanation: varianceNotes
        })
      });
      setShowCloseModal(false);
      loadShifts();
      const variance = res.reconciliation?.variance || 0;
      if (variance === 0) {
        alert('Shift balanced perfectly with zero cash variance!');
      } else {
        alert(`Shift closed with variance of ${formatZMW(variance)}`);
      }
    } catch (err: any) {
      alert(`Failed to close shift: ${err.message}`);
    }
  };

  const calculatedVariance = currentShift
    ? Number(actualCash) - Number(currentShift.expectedCash || 0)
    : 0;

  const historyColumns: Column<any>[] = [
    { key: 'startedAt', header: 'Shift Started', render: (row) => <span className="text-xs font-mono">{new Date(row.startedAt).toLocaleString()}</span> },
    { key: 'cashier', header: 'Cashier', render: (row) => <span className="font-bold text-slate-100">{row.cashier?.fullName}</span> },
    { key: 'openingFloat', header: 'Float', render: (row) => <span className="font-mono text-slate-300">{formatZMW(row.openingFloat)}</span> },
    { key: 'cashSales', header: 'Cash Sales', render: (row) => <span className="font-mono text-emerald-400 font-bold">{formatZMW(row.cashSales)}</span> },
    { key: 'expectedCash', header: 'Expected Balance', render: (row) => <span className="font-mono text-amber-400 font-bold">{formatZMW(row.expectedCash)}</span> },
    { key: 'actualCashCounted', header: 'Counted Cash', render: (row) => <span className="font-mono font-bold">{row.actualCashCounted ? formatZMW(row.actualCashCounted) : '—'}</span> },
    {
      key: 'variance',
      header: 'Cash Variance',
      render: (row) => {
        const v = Number(row.variance || 0);
        if (v === 0) {
          return <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Balanced (K 0.00)</span>;
        }
        return (
          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${v < 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-blue-500/20 text-blue-400'}`}>
            {v < 0 ? `Short: ${formatZMW(v)}` : `Over: ${formatZMW(v)}`}
          </span>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Cashier Shift & Physical Cash Drawer Balancing</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Opening float, cash meal sales, credit collections, expense deductions & end-of-shift drawer count.
            </p>
          </div>
        </div>

        {currentShift ? (
          <button
            onClick={() => setShowCloseModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-rose-500/20"
          >
            <Lock className="w-4 h-4" />
            Balance Drawer & Close Shift
          </button>
        ) : (
          <button
            onClick={() => setShowOpenModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-amber-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            Open Cashier Shift
          </button>
        )}
      </div>

      {/* Current Active Shift Card */}
      {currentShift && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
              <h3 className="font-bold text-base text-white">
                Active Shift: {currentShift.cashier?.fullName || 'Cashier'}
              </h3>
              <span className="text-xs text-slate-400">
                (Opened {new Date(currentShift.startedAt).toLocaleTimeString()})
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block uppercase font-semibold">Expected Cash in Drawer</span>
              <span className="text-2xl font-mono font-extrabold text-amber-400">
                {formatZMW(currentShift.expectedCash)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400">Opening Float:</span>
              <p className="text-sm font-mono font-bold text-slate-200 mt-1">{formatZMW(currentShift.openingFloat)}</p>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400">+ Cash Meal Sales:</span>
              <p className="text-sm font-mono font-bold text-emerald-400 mt-1">{formatZMW(currentShift.cashSales)}</p>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400">+ Cash Debt Collections:</span>
              <p className="text-sm font-mono font-bold text-blue-400 mt-1">{formatZMW(currentShift.cashCreditCollections)}</p>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400">- Cash Expenses:</span>
              <p className="text-sm font-mono font-bold text-rose-400 mt-1">{formatZMW(currentShift.cashExpenses)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Shift History Table */}
      <EnterpriseTable
        columns={historyColumns}
        data={shiftHistory}
        title="Cashier Shift Reconciliation History"
        searchPlaceholder="Search shifts..."
        isLoading={isLoading}
      />

      {/* Open Shift Modal */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-white">Open Cashier Shift</h3>
            <p className="text-xs text-slate-400">
              Enter the starting physical cash float provided to the cashier drawer.
            </p>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Opening Cash Float (ZMW)</label>
              <input
                type="number"
                min="0"
                value={openFloat}
                onChange={(e) => setOpenFloat(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-base font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowOpenModal(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleOpenShift}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold rounded-xl shadow-lg shadow-amber-500/20"
              >
                Confirm Open
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift & Count Cash Modal */}
      {showCloseModal && currentShift && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-white">Count Physical Cash & Close Shift</h3>
            <p className="text-xs text-slate-400">
              Carefully count all notes and coins in the physical drawer.
            </p>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1">
              <div className="flex justify-between text-slate-300">
                <span>System Expected Cash:</span>
                <span className="font-mono font-bold text-amber-400">{formatZMW(currentShift.expectedCash)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Actual Physical Cash Counted (ZMW)</label>
                <input
                  type="number"
                  step="0.5"
                  value={actualCash}
                  onChange={(e) => setActualCash(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xl font-mono font-extrabold text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Variance Indicator */}
              <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono font-bold ${
                calculatedVariance === 0
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : calculatedVariance < 0
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
              }`}>
                <span>Variance:</span>
                <span>
                  {calculatedVariance === 0
                    ? 'Balanced (K 0.00)'
                    : calculatedVariance < 0
                    ? `Shortage: -${formatZMW(Math.abs(calculatedVariance))}`
                    : `Overage: +${formatZMW(calculatedVariance)}`}
                </span>
              </div>

              {calculatedVariance !== 0 && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Variance Explanation (Mandatory)</label>
                  <input
                    type="text"
                    placeholder="e.g. Petty cash coin rounding"
                    value={varianceNotes}
                    onChange={(e) => setVarianceNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowCloseModal(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseShift}
                className="flex-1 py-2 bg-rose-500 hover:bg-rose-400 text-white text-sm font-bold rounded-xl shadow-lg shadow-rose-500/20"
              >
                Submit & Sign-off
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
