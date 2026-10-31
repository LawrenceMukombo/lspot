import React, { useState, useEffect } from 'react';
import {
  Receipt,
  PlusCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart
} from 'lucide-react';
import { apiRequest } from '../api.js';
import { EnterpriseTable, Column } from '../components/EnterpriseTable.js';
import { formatZMW } from '@lspot/shared';

export function FinanceView() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Modal
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expCategoryId, setExpCategoryId] = useState('');
  const [expAmount, setExpAmount] = useState(250);
  const [expPayee, setExpPayee] = useState('');
  const [expDescription, setExpDescription] = useState('');
  const [expMethod, setExpMethod] = useState('CASH');

  useEffect(() => {
    loadFinance();
  }, []);

  const loadFinance = async () => {
    setIsLoading(true);
    try {
      const [exp, dash, cats] = await Promise.all([
        apiRequest('/finance/expenses'),
        apiRequest('/finance/dashboard'),
        apiRequest('/finance/expense-categories').catch(() => [])
      ]);
      if (exp) setExpenses(exp);
      if (dash) setDashboard(dash);
      if (Array.isArray(cats) && cats.length > 0) {
        setCategories(cats);
        if (!expCategoryId) setExpCategoryId(cats[0].id);
      }
    } catch (e: any) {
      console.warn('Network error loading finance data:', e);
      setExpenses((prev: any[]) => (prev.length > 0 ? prev : []));
      setDashboard((prev: any) => prev || {
        todaySales: 0,
        cogs: 0,
        grossProfit: 0,
        operatingExpenses: 0,
        operatingProfit: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecordExpense = async () => {
    if (!expPayee || !expDescription) {
      alert('Please fill in Payee and Description');
      return;
    }
    try {
      await apiRequest('/finance/expenses', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: expCategoryId || 'exp-002',
          amount: Number(expAmount),
          payee: expPayee,
          description: expDescription,
          paymentMethod: expMethod
        })
      });
      setShowAddExpense(false);
      loadFinance();
      alert('Operating expense recorded successfully!');
    } catch (err: any) {
      alert(`Failed to record expense: ${err.message}`);
    }
  };

  const columns: Column<any>[] = [
    { key: 'expenseDate', header: 'Date', render: (row) => <span className="text-xs font-mono">{new Date(row.expenseDate).toLocaleDateString()}</span> },
    { key: 'category', header: 'Expense Category', render: (row) => <span className="font-semibold text-slate-200">{row.category?.name}</span> },
    { key: 'payee', header: 'Payee / Vendor', render: (row) => <span className="font-bold text-slate-100">{row.payee}</span> },
    { key: 'description', header: 'Description', render: (row) => <span className="text-xs text-slate-400">{row.description}</span> },
    { key: 'paymentMethod', header: 'Method', render: (row) => <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">{row.paymentMethod}</span> },
    { key: 'amount', header: 'Amount (ZMW)', render: (row) => <span className="font-mono font-bold text-rose-400">{formatZMW(row.amount)}</span> }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Financial Ledger & Profit and Loss Statement</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Operating expenses, Cost of Goods Sold (COGS), gross margins & net operating profit for The LSpot Restaurant.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddExpense(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-amber-500/20"
        >
          <PlusCircle className="w-4 h-4" />
          Record Operating Expense
        </button>
      </div>

      {/* P&L Visual Breakdown Cards */}
      {dashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs text-slate-400 uppercase font-semibold">1. Revenue (Sales)</span>
            <p className="text-xl font-mono font-bold text-white">{formatZMW(dashboard.todaySales)}</p>
          </div>
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs text-slate-400 uppercase font-semibold">2. Less: COGS (Raw Materials)</span>
            <p className="text-xl font-mono font-bold text-rose-400">-{formatZMW(dashboard.cogs)}</p>
          </div>
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs text-slate-400 uppercase font-semibold">3. Gross Profit (Margin)</span>
            <p className="text-xl font-mono font-bold text-amber-400">{formatZMW(dashboard.grossProfit)}</p>
          </div>
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs text-slate-400 uppercase font-semibold">4. Net Operating Profit</span>
            <p className="text-xl font-mono font-extrabold text-emerald-400">{formatZMW(dashboard.operatingProfit)}</p>
          </div>
        </div>
      )}

      {/* Expense Ledger Table */}
      <EnterpriseTable
        columns={columns}
        data={expenses}
        title="Operating Expense Records"
        searchPlaceholder="Search expenses by payee or description..."
        isLoading={isLoading}
      />

      {/* Record Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-white">Record Restaurant Operating Expense</h3>
            <p className="text-xs text-slate-400">
              Direct cash or bank expenditure for cooking gas, power, transport, or supplies.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Expense Category</label>
                <select
                  value={expCategoryId}
                  onChange={(e) => setExpCategoryId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Choose Category --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Amount (ZMW)</label>
                  <input
                    type="number"
                    min="1"
                    value={expAmount}
                    onChange={(e) => setExpAmount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 font-mono text-rose-400 font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Payment Method</label>
                  <select
                    value={expMethod}
                    onChange={(e) => setExpMethod(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="CASH">Cash Drawer</option>
                    <option value="AIRTEL_MONEY">Airtel Money</option>
                    <option value="MTN_MOMO">MTN MoMo</option>
                    <option value="BANK_TRANSFER">Bank Account</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Payee / Vendor</label>
                <input
                  type="text"
                  placeholder="e.g. Afrox / ZESCO"
                  value={expPayee}
                  onChange={(e) => setExpPayee(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Description / Purpose</label>
                <input
                  type="text"
                  placeholder="e.g. Kitchen gas refill for Manyama Branch"
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowAddExpense(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordExpense}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold rounded-xl shadow-lg shadow-amber-500/20"
              >
                Save Expense
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
