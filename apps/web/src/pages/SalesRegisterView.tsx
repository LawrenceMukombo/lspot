import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  RefreshCw,
  Clock,
  RotateCcw,
  Edit3,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { apiRequest } from '../api.js';
import { toast } from '../components/Toast.js';
import { formatZMW } from '@lspot/shared';

interface DailySale {
  id: string;
  saleNumber: string;
  orderType: string;
  tableNumber?: string | null;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  paymentStatus: string;
  notes?: string | null;
  createdAt: string;
  cashier?: {
    fullName: string;
    username: string;
    role: string;
  };
  customer?: {
    name: string;
    phone?: string;
  };
  items?: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    notes?: string | null;
    menuItem?: {
      id: string;
      name: string;
      portionSize?: string;
      category?: {
        name: string;
      };
    };
  }>;
  payments?: Array<{
    id: string;
    paymentMethod: string;
    amount: number;
    reference?: string | null;
  }>;
}

export function SalesRegisterView() {
  const [sales, setSales] = useState<DailySale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'CREDIT' | 'REFUNDED'>('ALL');
  const [expandedSaleIds, setExpandedSaleIds] = useState<Record<string, boolean>>({});

  // Reversal Modal State
  const [reversalTargetSale, setReversalTargetSale] = useState<DailySale | null>(null);
  const [reversalReason, setReversalReason] = useState('Customer changed mind / Wrong order entered');
  const [supervisorPin, setSupervisorPin] = useState('1234');
  const [isReversing, setIsReversing] = useState(false);
  const [reversalError, setReversalError] = useState<string | null>(null);

  // Edit Modal State
  const [editTargetSale, setEditTargetSale] = useState<DailySale | null>(null);
  const [editOrderType, setEditOrderType] = useState('DINE_IN');
  const [editTableNumber, setEditTableNumber] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest('/pos/sales?limit=250');
      if (Array.isArray(data)) {
        setSales(data);
      }
    } catch (err: any) {
      console.error('Error fetching sales list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedSaleIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenReverseModal = (sale: DailySale) => {
    setReversalTargetSale(sale);
    setReversalReason('Customer cancelled order / voided');
    setSupervisorPin('1234');
    setReversalError(null);
  };

  const handleExecuteReversal = async () => {
    if (!reversalTargetSale) return;
    if (!reversalReason.trim()) {
      setReversalError('Please provide a mandatory reversal reason for the audit trail.');
      return;
    }

    setIsReversing(true);
    setReversalError(null);
    try {
      await apiRequest(`/pos/sales/${reversalTargetSale.id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({
          reason: reversalReason.trim(),
          supervisorPin: supervisorPin.trim()
        })
      });

      setReversalTargetSale(null);
      await loadSales();
      toast.success(
        'Sale transaction successfully reversed! Beverage stock and kitchen portions have been restored.',
        'Sale Reversal Confirmed'
      );
    } catch (err: any) {
      setReversalError(err.message || 'Failed to reverse sale');
    } finally {
      setIsReversing(false);
    }
  };

  const handleOpenEditModal = (sale: DailySale) => {
    setEditTargetSale(sale);
    setEditOrderType(sale.orderType || 'DINE_IN');
    setEditTableNumber(sale.tableNumber || '');
    setEditNotes(sale.notes || '');
  };

  const handleExecuteEdit = async () => {
    if (!editTargetSale) return;

    setIsEditing(true);
    try {
      await apiRequest(`/pos/sales/${editTargetSale.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          orderType: editOrderType,
          tableNumber: editTableNumber,
          notes: editNotes
        })
      });

      setEditTargetSale(null);
      toast.info(`Updated sale details for ${editTargetSale.saleNumber}.`, 'Sale Record Updated');
      await loadSales();
    } catch (err: any) {
      toast.critical(`Failed to update sale: ${err.message}`, 'Sale Update Error');
    } finally {
      setIsEditing(false);
    }
  };

  // Filtered sales
  const filteredSales = sales.filter((sale) => {
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'REFUNDED' && sale.paymentStatus === 'REFUNDED') ||
      (statusFilter === 'CREDIT' && sale.paymentStatus === 'CREDIT') ||
      (statusFilter === 'PAID' && sale.paymentStatus === 'PAID');

    const searchLower = search.toLowerCase();
    const matchesSearch =
      !search ||
      sale.saleNumber?.toLowerCase().includes(searchLower) ||
      sale.cashier?.fullName?.toLowerCase().includes(searchLower) ||
      sale.customer?.name?.toLowerCase().includes(searchLower) ||
      sale.tableNumber?.toLowerCase().includes(searchLower) ||
      sale.items?.some((i) => i.menuItem?.name?.toLowerCase().includes(searchLower));

    return matchesStatus && matchesSearch;
  });

  // Calculate live daily stats
  const totalRevenue = sales
    .filter((s) => s.paymentStatus !== 'REFUNDED')
    .reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);

  const totalReversals = sales
    .filter((s) => s.paymentStatus === 'REFUNDED')
    .reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);

  const isDrink = (it: any) => {
    const cat = it.menuItem?.category?.name?.toLowerCase() || '';
    const name = it.menuItem?.name?.toLowerCase() || '';
    return (
      cat.includes('drink') ||
      cat.includes('beverage') ||
      cat.includes('water') ||
      name.includes('water') ||
      name.includes('coca') ||
      name.includes('drink') ||
      name.includes('fanta') ||
      name.includes('sprite')
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">Daily Sales & Settlement Register</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                AUDITED
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live chronological sales ledger with supervisor voiding, reversibility, and stock replenishment
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadSales}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition border bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Sales</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Total Net Revenue</span>
          <span className="font-mono text-2xl font-black text-amber-400 mt-1 block">
            {formatZMW(totalRevenue)}
          </span>
          <span className="text-xs text-slate-500 mt-1 block">
            {sales.filter((s) => s.paymentStatus !== 'REFUNDED').length} active transactions
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Reversed / Voided</span>
          <span className="font-mono text-2xl font-black text-rose-400 mt-1 block">
            {formatZMW(totalReversals)}
          </span>
          <span className="text-xs text-slate-500 mt-1 block">
            {sales.filter((s) => s.paymentStatus === 'REFUNDED').length} reversed orders
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Average Ticket Size</span>
          <span className="font-mono text-2xl font-black text-emerald-400 mt-1 block">
            {formatZMW(
              sales.length > 0 ? totalRevenue / Math.max(1, sales.filter((s) => s.paymentStatus !== 'REFUNDED').length) : 0
            )}
          </span>
          <span className="text-xs text-slate-500 mt-1 block">Per customer order</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by receipt #, cashier, customer, table, dish..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(['ALL', 'PAID', 'CREDIT', 'REFUNDED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                statusFilter === st
                  ? 'bg-amber-500 text-slate-950 border-amber-500 font-extrabold shadow-md'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Sales Transactions Enterprise Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-sm">Chronological Sales Records</h3>
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-mono font-bold">
              {filteredSales.length} records
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 uppercase tracking-wider text-[11px] font-bold">
                <th className="py-3 px-3 w-8 text-center"></th>
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Cashier</th>
                <th className="py-3 px-4">Customer / Table</th>
                <th className="py-3 px-4">Items / Portions Breakdown</th>
                <th className="py-3 px-4 text-right">Total (ZMW)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Supervisor Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Receipt className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold">No sales transactions found</p>
                    <p className="text-[11px] mt-0.5">Try adjusting your search criteria or date filter</p>
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale, idx) => {
                  const isExpanded = !!expandedSaleIds[sale.id];
                  const isReversed = sale.paymentStatus === 'REFUNDED';
                  const dateObj = new Date(sale.createdAt);
                  const formattedDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                  const formattedTime = dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

                  const mealPortions = sale.items?.filter((it) => !isDrink(it)).reduce((acc, i) => acc + (i.quantity || 0), 0) || 0;
                  const drinkUnits = sale.items?.filter((it) => isDrink(it)).reduce((acc, i) => acc + (i.quantity || 0), 0) || 0;

                  let portionsLabel = '';
                  if (mealPortions > 0 && drinkUnits > 0) {
                    portionsLabel = `${mealPortions} meals, ${drinkUnits} drinks`;
                  } else if (mealPortions > 0) {
                    portionsLabel = `${mealPortions} meal portion${mealPortions !== 1 ? 's' : ''}`;
                  } else {
                    portionsLabel = `${drinkUnits} drink${drinkUnits !== 1 ? 's' : ''}`;
                  }

                  return (
                    <React.Fragment key={sale.id}>
                      <tr
                        onClick={() => toggleExpand(sale.id)}
                        className={`transition-colors cursor-pointer select-none ${
                          isReversed
                            ? 'bg-rose-50/40 hover:bg-rose-50/60 opacity-80'
                            : isExpanded
                            ? 'bg-amber-50/70 hover:bg-amber-50/90'
                            : idx % 2 === 1
                            ? 'bg-slate-50/60 hover:bg-slate-100/70'
                            : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-3 text-center align-middle">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(sale.id);
                            }}
                            className="w-6 h-6 rounded-md hover:bg-slate-200/80 flex items-center justify-center text-slate-500"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-amber-600" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                          </button>
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-amber-800 whitespace-nowrap align-middle">
                          <span className={`px-2 py-0.5 rounded border ${isReversed ? 'bg-rose-50 border-rose-200 text-rose-700 line-through' : 'bg-amber-50 border-amber-200'}`}>
                            {sale.saleNumber}
                          </span>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap align-middle font-mono text-[11px]">
                          <span className="font-semibold text-slate-800">{formattedDate}</span>{' '}
                          <span className="text-slate-500">{formattedTime}</span>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap align-middle">
                          <span className="font-semibold text-slate-800">{sale.cashier?.fullName || 'Cashier'}</span>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap align-middle">
                          <div>
                            <span className="font-semibold text-slate-800">
                              {sale.customer ? sale.customer.name : 'Walk-in Guest'}
                            </span>
                            {sale.tableNumber && (
                              <span className="text-[10px] text-amber-700 font-bold ml-1.5 px-1.5 py-0.5 bg-amber-100/80 rounded">
                                {sale.tableNumber}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 align-middle">
                          <span className="font-semibold text-slate-800">{portionsLabel}</span>
                          <span className="text-slate-400 mx-1">•</span>
                          <span className="text-slate-500 truncate max-w-xs inline-block align-bottom">
                            {sale.items?.map((it) => `${it.quantity}× ${it.menuItem?.name || 'Item'}`).join(', ')}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-sm align-middle whitespace-nowrap">
                          <span className={isReversed ? 'text-rose-600 line-through' : 'text-slate-900'}>
                            {formatZMW(sale.totalAmount)}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center align-middle whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isReversed
                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                : sale.paymentStatus === 'CREDIT'
                                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {sale.paymentStatus}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center align-middle whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(sale)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-slate-300 flex items-center gap-1 text-[11px] transition"
                              title="Edit order type, table, or notes"
                            >
                              <Edit3 className="w-3 h-3 text-slate-600" />
                              <span>Edit</span>
                            </button>

                            {!isReversed && (
                              <button
                                onClick={() => handleOpenReverseModal(sale)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg border border-rose-300 flex items-center gap-1 text-[11px] transition shadow-sm"
                                title="Reverse / Void sale transaction and restore inventory"
                              >
                                <RotateCcw className="w-3 h-3 text-rose-600" />
                                <span>Reverse</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Collapsible Expanded Line Items & Receipts Audit Details */}
                      {isExpanded && (
                        <tr className="bg-amber-50/30">
                          <td colSpan={9} className="p-4 border-b border-amber-200/60">
                            <div className="bg-white rounded-xl border border-amber-200/80 p-4 shadow-sm space-y-3">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                  <Receipt className="w-4 h-4 text-amber-600" />
                                  <span>Itemized Receipt Breakdown & Stock Audit</span>
                                </span>
                                <span className="font-mono text-[11px] text-slate-500">
                                  Sale ID: {sale.id}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {sale.items?.map((it) => (
                                  <div
                                    key={it.id}
                                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between"
                                  >
                                    <div>
                                      <p className="font-bold text-slate-800 text-xs">
                                        {it.quantity}× {it.menuItem?.name || 'Item'}
                                      </p>
                                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                        Unit Price: {formatZMW(it.unitPrice)}
                                      </p>
                                    </div>
                                    <span className="font-mono font-bold text-amber-700 text-xs">
                                      {formatZMW(it.subtotal)}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {/* Reversal / Notes Information */}
                              {sale.notes && (
                                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                                  <strong>Audit Notes:</strong> {sale.notes}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supervisor Reversal Authorization Modal */}
      {reversalTargetSale && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-rose-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 border-b border-rose-100 pb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Reverse / Void Sale</h3>
                <p className="text-xs text-slate-500 font-mono">{reversalTargetSale.saleNumber}</p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
              <p className="font-bold">Important Audit Notice:</p>
              <p>Reversing this sale will:</p>
              <ul className="list-disc pl-4 space-y-0.5 mt-1">
                <li>Mark sale status as <strong>REFUNDED</strong></li>
                <li>Restore <strong>Kitchen Prepared Portions</strong> to today's register</li>
                <li>Replenish <strong>Beverage Stock</strong> in perpetual inventory</li>
                <li>Revert Cashier Shift expected cash collections or Customer credit balance</li>
              </ul>
            </div>

            {reversalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
                {reversalError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Reason for Reversal (Mandatory):</label>
                <textarea
                  rows={2}
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-rose-500"
                  placeholder="Explain why this sale is being voided..."
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Supervisor Authorization PIN:</label>
                <input
                  type="password"
                  value={supervisorPin}
                  onChange={(e) => setSupervisorPin(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-mono focus:outline-none focus:border-rose-500"
                  placeholder="Enter 4-digit supervisor PIN (Default: 1234)"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReversalTargetSale(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl border border-slate-300 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isReversing}
                onClick={handleExecuteReversal}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-rose-900/20 disabled:opacity-50"
              >
                {isReversing ? 'Reversing...' : 'Confirm Reversal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Sale Metadata Modal */}
      {editTargetSale && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Edit Sale Details</h3>
                <p className="text-xs text-slate-500 font-mono">{editTargetSale.saleNumber}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Order Type:</label>
                <select
                  value={editOrderType}
                  onChange={(e) => setEditOrderType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-amber-500"
                >
                  <option value="DINE_IN">Dine In</option>
                  <option value="TAKEAWAY">Takeaway</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Table Number:</label>
                <input
                  type="text"
                  value={editTableNumber}
                  onChange={(e) => setEditTableNumber(e.target.value)}
                  placeholder="e.g. Table 4"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Order Notes:</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Notes or guest instructions..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditTargetSale(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl border border-slate-300 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isEditing}
                onClick={handleExecuteEdit}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl transition shadow-md disabled:opacity-50"
              >
                {isEditing ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
