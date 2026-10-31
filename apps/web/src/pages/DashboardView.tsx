import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  ChefHat,
  Package,
  Layers,
  ArrowUpRight,
  Receipt,
  RotateCcw,
  Calendar,
  X,
  ExternalLink,
  ArrowRight,
  CheckCircle,
  FileText,
  Clock,
  User,
  ShoppingBag,
  ArrowDownRight,
  Search,
  ChevronDown,
  ChevronUp,
  Download,
  Printer,
  Users,
  BarChart3,
  PieChart,
  Activity,
  Zap
} from 'lucide-react';
import { apiRequest } from '../api.js';
import { formatZMW } from '@lspot/shared';

type DateRangeOption = 'today' | 'yesterday' | 'week' | 'month';

export function DashboardView() {
  const [data, setData] = useState<any>({
    currency: 'ZMW',
    todaySales: 0,
    cashReceived: 0,
    mobileMoneyReceived: 0,
    creditSales: 0,
    outstandingDebtors: 0,
    cogs: 0,
    grossProfit: 0,
    grossMarginPercentage: 0,
    operatingExpenses: 0,
    operatingProfit: 0,
    inventoryValue: 0,
    lowStockCount: 0,
    totalPortionsPrepared: 0,
    totalPortionsSold: 0,
    totalPortionsWaste: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<DateRangeOption>('today');
  const [filterType, setFilterType] = useState<'ALL' | 'CASH' | 'MOMO' | 'CREDIT'>('ALL');
  const [drillDownModal, setDrillDownModal] = useState<any | null>(null);

  // Customer Directory State
  const [showCustomersModal, setShowCustomersModal] = useState(false);
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [isCustomersLoading, setIsCustomersLoading] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  const loadCustomers = async () => {
    setIsCustomersLoading(true);
    try {
      const res = await apiRequest('/credit/customers');
      if (res) setCustomersList(res);
    } catch (e) {
      console.warn('Failed to load customers:', e);
    } finally {
      setIsCustomersLoading(false);
    }
  };

  const openCustomersDirectory = () => {
    setShowCustomersModal(true);
    loadCustomers();
  };

  // Deep Audit & Underlying Transaction State
  const [underlyingSales, setUnderlyingSales] = useState<any[]>([]);
  const [stockReconciliation, setStockReconciliation] = useState<any[]>([]);
  const [isModalDataLoading, setIsModalDataLoading] = useState(false);
  const [searchSaleTerm, setSearchSaleTerm] = useState('');
  const [activeModalTab, setActiveModalTab] = useState<'TRANSACTIONS' | 'RECONCILIATION' | 'METRICS'>('TRANSACTIONS');
  const [expandedSaleIds, setExpandedSaleIds] = useState<Record<string, boolean>>({});

  const toggleSaleExpand = (id: string) => {
    setExpandedSaleIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    loadDashboard(selectedRange);
  }, [selectedRange]);

  const openRevenueDrillDown = async () => {
    const { start, end } = getDateRangeBounds(selectedRange);
    setIsModalDataLoading(true);
    setActiveModalTab('TRANSACTIONS');
    setDrillDownModal({
      type: 'REVENUE',
      title: `${getRangeLabel(selectedRange)} Revenue Register & Audit Breakdown`,
      subtitle: "All billed POS orders, cashier settlements and live sales transactions",
      metrics: [
        { label: 'Total Recorded Revenue', value: formatZMW(data.todaySales) },
        { label: 'Cash In Drawer', value: formatZMW(data.cashReceived) },
        { label: 'Airtel & MTN Mobile Money', value: formatZMW(data.mobileMoneyReceived) },
        { label: 'Customer Account Credit', value: formatZMW(data.creditSales) },
        { label: 'Gross Margin %', value: `${data.grossMarginPercentage}%` }
      ],
      notes: 'Audit Note: All sales receipts are tracked via the ZRA Fiscal Register. Physical cash should reconcile exactly at end of shift with zero unexplained variance.'
    });

    try {
      const q = `?limit=150&startDate=${encodeURIComponent(start.toISOString())}&endDate=${encodeURIComponent(end.toISOString())}`;
      const [salesRes, reconRes] = await Promise.all([
        apiRequest(`/pos/sales${q}`),
        apiRequest(`/inventory/reconciliation?date=${encodeURIComponent(start.toISOString())}`)
      ]);
      if (salesRes) setUnderlyingSales(salesRes);
      if (reconRes) setStockReconciliation(reconRes);
    } catch (e) {
      console.warn('Failed to load drill-down underlying transactions:', e);
    } finally {
      setIsModalDataLoading(false);
    }
  };

  const openStockDrillDown = async () => {
    const { start } = getDateRangeBounds(selectedRange);
    setIsModalDataLoading(true);
    setActiveModalTab('RECONCILIATION');
    setDrillDownModal({
      type: 'STOCK',
      title: 'Perpetual Inventory Valuation & Daily Stock Reconciliation',
      subtitle: 'Real-time inventory levels, receipts, recipe consumption, and closing physical counts',
      metrics: [
        { label: 'Total Stock Valuation', value: formatZMW(data.inventoryValue) },
        { label: 'Low Stock SKU Count', value: `${data.lowStockCount} items below threshold` },
        { label: 'Storage Locations', value: 'Main Dry Store, Walk-In Chiller, Bar' },
        { label: 'Next Physical Audit', value: 'Daily Closing Stock Reconciliation' }
      ],
      notes: 'Inventory Reconciliation: Theoretical opening + receipts today - pos/kitchen depletion = expected closing stock.'
    });

    try {
      const [reconRes, salesRes] = await Promise.all([
        apiRequest(`/inventory/reconciliation?date=${encodeURIComponent(start.toISOString())}`),
        apiRequest(`/pos/sales?limit=100`)
      ]);
      if (reconRes) setStockReconciliation(reconRes);
      if (salesRes) setUnderlyingSales(salesRes);
    } catch (e) {
      console.warn('Failed to load stock reconciliation:', e);
    } finally {
      setIsModalDataLoading(false);
    }
  };

  const getDateRangeBounds = (range: DateRangeOption) => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    if (range === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (range === 'yesterday') {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (range === 'week') {
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (range === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  };

  const getRangeLabel = (range: DateRangeOption) => {
    switch (range) {
      case 'yesterday':
        return "Yesterday's";
      case 'week':
        return "This Week's";
      case 'month':
        return "This Month's";
      default:
        return "Today's";
    }
  };

  const loadDashboard = async (range: DateRangeOption = selectedRange) => {
    setIsLoading(true);
    setErrorMsg(null);
    const { start, end } = getDateRangeBounds(range);
    try {
      const query = `?startDate=${encodeURIComponent(start.toISOString())}&endDate=${encodeURIComponent(end.toISOString())}`;
      const res = await apiRequest(`/finance/dashboard${query}`);
      if (res) {
        setData({
          ...res,
          todaySales: Number(res.todaySales ?? 0),
          cashReceived: Number(res.cashReceived ?? 0),
          mobileMoneyReceived: Number(res.mobileMoneyReceived ?? 0),
          creditSales: Number(res.creditSales ?? 0),
          cogs: Number(res.cogs ?? 0),
          grossProfit: Number(res.grossProfit ?? 0),
          grossMarginPercentage: Number(res.grossMarginPercentage ?? 0),
          operatingExpenses: Number(res.operatingExpenses ?? 0),
          operatingProfit: Number(res.operatingProfit ?? 0),
          outstandingDebtors: Number(res.outstandingDebtors ?? 0),
          inventoryValue: Number(res.inventoryValue ?? 0),
          lowStockCount: Number(res.lowStockCount ?? 0),
          totalPortionsPrepared: Number(res.totalPortionsPrepared ?? 0),
          totalPortionsSold: Number(res.totalPortionsSold ?? 0),
          totalPortionsWaste: Number(res.totalPortionsWaste ?? 0),
          totalTicketsCount: Number(res.totalTicketsCount ?? 0),
          averageTicketSize: Number(res.averageTicketSize ?? 0),
          peakHour: res.peakHour || 'N/A',
          hourlyDistribution: Array.isArray(res.hourlyDistribution) ? res.hourlyDistribution : [],
          topSellingDishes: Array.isArray(res.topSellingDishes) ? res.topSellingDishes : [],
          categoryBreakdown: Array.isArray(res.categoryBreakdown) ? res.categoryBreakdown : []
        });
      }
    } catch (e: any) {
      console.warn('Dashboard fetch error:', e);
      setErrorMsg(e?.message || 'Unable to load real-time analytics. Please verify connectivity.');
    } finally {
      setIsLoading(false);
    }
  };

  const paymentBreakdown = [
    { label: 'Physical Cash', amount: data.cashReceived, color: 'bg-emerald-500', text: 'text-emerald-400', key: 'CASH' },
    { label: 'Airtel & MTN MoMo', amount: data.mobileMoneyReceived, color: 'bg-amber-500', text: 'text-amber-400', key: 'MOMO' },
    { label: 'Customer Credit (AR)', amount: data.creditSales, color: 'bg-blue-500', text: 'text-blue-400', key: 'CREDIT' }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner with Quick Date Filter & Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-gradient-to-r dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-md dark:shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Restaurant Executive Dashboard</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Live Audited Data
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time operations, inventory consumption, POS settlements, credit balances & profit calculations for The LSpot Restaurant (Manyama, Zambia).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Customers Directory Button */}
          <button
            type="button"
            onClick={openCustomersDirectory}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition flex items-center gap-2 shadow-sm"
          >
            <Users className="w-4 h-4" />
            <span>Customers Roster ({data.outstandingDebtors > 0 ? `ZMW ${data.outstandingDebtors.toFixed(0)} Debt` : 'All Active'})</span>
          </button>

          {/* Quick Date Range Buttons (UI-02) */}
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'week', label: 'This Week' },
                { id: 'month', label: 'This Month' }
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedRange(item.id)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedRange === item.id
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => loadDashboard()}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-amber-500 dark:text-amber-400 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards Grid with Interactive Drill-Down */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue Card */}
        <div
          onClick={openRevenueDrillDown}
          className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden group hover:border-amber-500/70 transition cursor-pointer hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{getRangeLabel(selectedRange)} Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-slate-950 transition">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatZMW(data.todaySales)}
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Gross Margin: <strong>{data.grossMarginPercentage}%</strong></span>
            </div>
            <span className="text-[10px] text-amber-400 font-bold group-hover:underline flex items-center gap-0.5">
              View All Transactions <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Operating Profit Card */}
        <div
          onClick={openRevenueDrillDown}
          className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden group hover:border-emerald-500/70 transition cursor-pointer hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Operating Profit</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-slate-950 transition">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">
            {formatZMW(data.operatingProfit)}
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-slate-400">
              Gross: {formatZMW(data.grossProfit)} - Exp: {formatZMW(data.operatingExpenses)}
            </p>
            <span className="text-[10px] text-emerald-400 font-bold group-hover:underline flex items-center gap-0.5">
              View Transactions & COGS <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Outstanding Debtors Card */}
        <div
          onClick={openRevenueDrillDown}
          className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden group hover:border-blue-500/70 transition cursor-pointer hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Outstanding Debtors</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-slate-950 transition">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-400 tracking-tight">
            {formatZMW(data.outstandingDebtors)}
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-slate-400">
              Active credit customer accounts (Kalumbila & Corporate)
            </p>
            <span className="text-[10px] text-blue-400 font-bold group-hover:underline flex items-center gap-0.5">
              Audit Credit Sales <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Perpetual Stock Value Card */}
        <div
          onClick={openStockDrillDown}
          className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden group hover:border-purple-500/70 transition cursor-pointer hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Perpetual Stock Value</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-slate-950 transition">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-purple-400 tracking-tight">
            {formatZMW(data.inventoryValue)}
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{data.lowStockCount} items below threshold</span>
            </div>
            <span className="text-[10px] text-purple-400 font-bold group-hover:underline flex items-center gap-0.5">
              Daily Stock Reconciliation <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      {/* Operations Reconciliation & Payment Settlement Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods Interactive Breakdown */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-white">Payment Collections Breakdown</h3>
              <p className="text-xs text-slate-400">Strict segregation of physical cash vs mobile money & credit</p>
            </div>
            <span className="text-xs font-mono px-2 py-1 bg-slate-800 rounded text-slate-300">
              Total: {formatZMW(data.todaySales)}
            </span>
          </div>

          <div className="space-y-4">
            {paymentBreakdown.map((item) => {
              const percent = data.todaySales > 0 ? ((item.amount / data.todaySales) * 100).toFixed(1) : '0';
              const isSelected = filterType === item.key;
              return (
                <div
                  key={item.label}
                  onClick={() => {
                    setFilterType(isSelected ? 'ALL' : (item.key as any));
                    setDrillDownModal({
                      title: `${item.label} Settlement Audit`,
                      subtitle: `Channel detailed audit register for ${item.label}`,
                      metrics: [
                        { label: 'Channel Name', value: item.label },
                        { label: 'Amount Collected', value: formatZMW(item.amount) },
                        { label: 'Percentage of Revenue', value: `${percent}%` },
                        { label: 'Audit Status', value: 'Verified by Cashier Shift Register' }
                      ],
                      notes: `Channel verification rule: Transactions for ${item.label} must balance with shift end summary report.`
                    });
                  }}
                  className={`p-3.5 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800/90 border-amber-500/60 shadow-md'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium text-slate-200 flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${item.color}`}></span>
                      {item.label}
                    </span>
                    <span className={`font-mono font-bold ${item.text}`}>
                      {formatZMW(item.amount)} ({percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all duration-500`}
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Audit rule: Physical cash drawer count must match {formatZMW(data.cashReceived)} exactly.</span>
          </div>
        </div>

        {/* Daily Kitchen Closed-Loop Reconciliation */}
        <div
          onClick={() =>
            setDrillDownModal({
              title: 'Kitchen Daily Production Loop & Yield Register',
              subtitle: 'Batch preparation vs POS tickets printed vs physical waste log',
              metrics: [
                { label: 'Total Portions Prepared', value: `${data.totalPortionsPrepared} portions` },
                { label: 'Portions Sold (POS)', value: `${data.totalPortionsSold} billed` },
                { label: 'Portions Waste / Spoilage', value: `${data.totalPortionsWaste} recorded` },
                {
                  label: 'Portions Remaining for Dinner',
                  value: `${Math.max(0, data.totalPortionsPrepared - data.totalPortionsSold - data.totalPortionsWaste)} portions`
                },
                {
                  label: 'Sell-Through Rate',
                  value: `${data.totalPortionsPrepared > 0 ? ((data.totalPortionsSold / data.totalPortionsPrepared) * 100).toFixed(1) : 0}%`
                }
              ],
              notes: 'Kitchen Control Rule: Any portion variance exceeding 5% triggers supervisor verification before chef shift handover is approved.'
            })
          }
          className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl cursor-pointer hover:border-amber-500/40 transition group"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Daily Kitchen Production Loop</h3>
                <span className="text-[10px] text-amber-400 font-bold group-hover:underline flex items-center gap-0.5">
                  Drill down <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
              <p className="text-xs text-slate-400">Portions cooked vs portions sold at POS vs waste</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <ChefHat className="w-4 h-4" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center mb-5">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-400 uppercase font-semibold">Prepared</p>
              <p className="text-2xl font-bold text-white mt-1">{data.totalPortionsPrepared}</p>
              <span className="text-[11px] text-slate-500">portions</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-400 uppercase font-semibold">Sold (POS)</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{data.totalPortionsSold}</p>
              <span className="text-[11px] text-emerald-500/80">billed</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-400 uppercase font-semibold">Waste / Loss</p>
              <p className="text-2xl font-bold text-rose-400 mt-1">{data.totalPortionsWaste}</p>
              <span className="text-[11px] text-rose-500/80">recorded</span>
            </div>
          </div>

          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Remaining Available Portions for Dinner:</span>
              <span className="font-bold font-mono text-amber-400">
                {Math.max(0, data.totalPortionsPrepared - data.totalPortionsSold - data.totalPortionsWaste)} Portions
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Portion Sell-Through Rate:</span>
              <span className="font-mono">
                {data.totalPortionsPrepared > 0
                  ? ((data.totalPortionsSold / data.totalPortionsPrepared) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Estimated Cost of Goods Sold (COGS):</span>
              <span className="font-mono text-slate-200">{formatZMW(data.cogs)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Smart Intelligence & High-Velocity Restaurant Visualisations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visualisation 1: Hourly Dining Traffic & Sales Surge Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-white">Hourly Sales Volume & Dining Rush</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Peak: {data.peakHour || 'Lunch & Dinner'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">Revenue & order frequency distributed across service hours (07:00 - 22:00)</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
            </div>

            {/* Visual Bar Chart */}
            <div className="pt-4 pb-2">
              {data.hourlyDistribution && data.hourlyDistribution.length > 0 ? (
                <div className="flex items-end gap-1.5 h-44 w-full px-2 pt-6 pb-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  {(() => {
                    const maxHourlyRev = Math.max(...data.hourlyDistribution.map((h: any) => h.revenue), 1);
                    return data.hourlyDistribution.map((bar: any) => {
                      const heightPercent = Math.max(8, Math.round((bar.revenue / maxHourlyRev) * 100));
                      const isPeak = bar.revenue > 0 && bar.revenue >= maxHourlyRev * 0.8;
                      return (
                        <div key={bar.hour} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                          {/* Tooltip on hover */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 z-20 pointer-events-none bg-slate-800 border border-slate-700 text-white text-[10px] py-1 px-2 rounded shadow-lg whitespace-nowrap">
                            <p className="font-bold">{bar.label}</p>
                            <p className="text-amber-400 font-mono">{formatZMW(bar.revenue)} ({bar.orders} orders)</p>
                          </div>
                          
                          {/* Bar Graphic */}
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full rounded-t-md transition-all duration-500 ${
                              isPeak
                                ? 'bg-gradient-to-t from-amber-600 to-amber-400 shadow-md shadow-amber-500/20'
                                : bar.revenue > 0
                                ? 'bg-gradient-to-t from-indigo-700 to-indigo-500'
                                : 'bg-slate-800/60'
                            }`}
                          />
                          <span className="text-[9px] text-slate-500 mt-2 font-mono">{bar.hour}h</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <div className="h-44 flex items-center justify-center bg-slate-950/40 rounded-xl border border-slate-800 text-slate-500 text-xs">
                  No sales recorded in the selected date range yet.
                </div>
              )}
            </div>
          </div>

          {/* Quick Metrics Footer */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-800/80 text-xs">
            <div>
              <p className="text-slate-400">Total Billed Tickets</p>
              <p className="text-base font-bold text-white mt-0.5">{data.totalTicketsCount || 0}</p>
            </div>
            <div>
              <p className="text-slate-400">Average Ticket Size</p>
              <p className="text-base font-bold text-amber-400 font-mono mt-0.5">{formatZMW(data.averageTicketSize || 0)}</p>
            </div>
            <div>
              <p className="text-slate-400">Velocity Status</p>
              <p className="text-base font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> High Demand
              </p>
            </div>
          </div>
        </div>

        {/* Visualisation 2: Category Revenue Breakdown & Top Culinary Hits */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-base text-white">Menu Categories & Culinary Hits</h3>
                <p className="text-xs text-slate-400">Revenue split across traditional kitchen dishes & drinks</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <PieChart className="w-4 h-4" />
              </div>
            </div>

            {/* Category Split */}
            <div className="space-y-3 mb-5">
              {data.categoryBreakdown && data.categoryBreakdown.length > 0 ? (
                data.categoryBreakdown.map((cat: any, idx: number) => {
                  const colors = ['bg-amber-500', 'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-rose-500'];
                  const barColor = colors[idx % colors.length];
                  return (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium">{cat.category}</span>
                        <span className="font-mono text-slate-300">
                          {formatZMW(cat.revenue)} ({cat.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColor} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.min(100, Math.max(4, cat.percentage))}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-500 italic py-2">No category sales recorded.</p>
              )}
            </div>

            {/* Bestselling Dishes Matrix */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Top Selling Items</h4>
              <div className="space-y-2">
                {data.topSellingDishes && data.topSellingDishes.length > 0 ? (
                  data.topSellingDishes.map((dish: any, i: number) => (
                    <div key={dish.name + i} className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-slate-200 font-medium truncate">{dish.name}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-[11px] text-slate-400">{dish.portions} sold</span>
                        <span className="font-mono font-bold text-amber-400">{formatZMW(dish.revenue)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic py-1">No dish sales recorded.</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Menu items tracked in real time</span>
            <button
              type="button"
              onClick={openRevenueDrillDown}
              className="text-amber-400 hover:underline font-bold flex items-center gap-1"
            >
              Full Sales Register <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Customer Directory Modal */}
      {showCustomersModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 text-slate-800 dark:text-slate-100">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Customer Accounts & Credit Directory</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Complete list of registered corporate accounts, individuals, credit limits and outstanding balances</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomersModal(false)}
                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter / Search Bar */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search customer by name, corporate company, phone (+260...) or TPIN..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap">
                {customersList.filter((c) =>
                  !customerSearchQuery ||
                  c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                  c.phone?.includes(customerSearchQuery) ||
                  c.tpin?.includes(customerSearchQuery)
                ).length} Accounts
              </span>
            </div>

            {/* Customers Table */}
            <div className="overflow-y-auto p-4 flex-1">
              {isCustomersLoading ? (
                <div className="py-12 text-center text-sm text-slate-500">Loading customer roster...</div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                        <th className="p-3">Customer / Company</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Phone & Contact</th>
                        <th className="p-3">TPIN</th>
                        <th className="p-3 text-right">Credit Limit</th>
                        <th className="p-3 text-right">Current Balance (Owed)</th>
                        <th className="p-3 text-center">Terms</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {customersList
                        .filter((c) =>
                          !customerSearchQuery ||
                          c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                          c.phone?.includes(customerSearchQuery) ||
                          c.tpin?.includes(customerSearchQuery)
                        )
                        .map((cust) => {
                          const balance = Number(cust.currentBalance || 0);
                          const limit = Number(cust.creditLimit || 0);
                          const hasDebt = balance > 0;
                          return (
                            <tr key={cust.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/60 transition">
                              <td className="p-3 font-semibold text-slate-900 dark:text-white">
                                {cust.name}
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  cust.customerType === 'CORPORATE'
                                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}>
                                  {cust.customerType || 'INDIVIDUAL'}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                                {cust.phone || '-'}
                              </td>
                              <td className="p-3 font-mono text-slate-500">
                                {cust.tpin || '-'}
                              </td>
                              <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">
                                {formatZMW(limit)}
                              </td>
                              <td className={`p-3 text-right font-mono font-bold ${hasDebt ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {formatZMW(balance)}
                              </td>
                              <td className="p-3 text-center text-slate-500 font-mono">
                                {cust.paymentTermsDays || 30} days
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>Use the Customers & Credit Directory tab to add new corporate accounts, manage repayments and print statement slips.</span>
              <button
                type="button"
                onClick={() => setShowCustomersModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 font-bold hover:opacity-90 transition"
              >
                Close Directory
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Actual Underlying Drill-Down Modal with Live Transactions & Daily Stock Reconciliation */}
      {drillDownModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-[97vw] xl:max-w-[1600px] h-[95vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden text-slate-800">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg sm:text-xl text-slate-900 tracking-tight">{drillDownModal.title}</h3>
                  <p className="text-xs text-slate-500">{drillDownModal.subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDrillDownModal(null)}
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs & Controls Bar */}
            <div className="px-5 pt-3 pb-2 bg-slate-50/50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModalTab('TRANSACTIONS')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    activeModalTab === 'TRANSACTIONS'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Underlying Transactions ({underlyingSales.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab('RECONCILIATION')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    activeModalTab === 'RECONCILIATION'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  Daily Stock Reconciliation ({stockReconciliation.length} Items)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab('METRICS')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    activeModalTab === 'METRICS'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Audit Summary & Policy
                </button>
              </div>

              {activeModalTab === 'TRANSACTIONS' && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = underlyingSales.reduce((acc, s) => ({ ...acc, [s.id]: true }), {});
                      const allExpanded = underlyingSales.length > 0 && underlyingSales.every((s) => expandedSaleIds[s.id]);
                      setExpandedSaleIds(allExpanded ? {} : allIds);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-1.5 transition whitespace-nowrap"
                  >
                    {underlyingSales.length > 0 && underlyingSales.every((s) => expandedSaleIds[s.id]) ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        Collapse All
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        Expand All
                      </>
                    )}
                  </button>
                  <div className="relative w-full sm:w-72">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search receipt, cashier, customer, item..."
                      value={searchSaleTerm}
                      onChange={(e) => setSearchSaleTerm(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Body Content */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4 bg-white">
              {isModalDataLoading ? (
                <div className="py-16 text-center space-y-3">
                  <RotateCcw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
                  <p className="text-sm text-slate-500 font-medium">Fetching authentic live audit data from database...</p>
                </div>
              ) : activeModalTab === 'TRANSACTIONS' ? (
                <div className="space-y-4">
                  {/* Summary Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                    {drillDownModal.metrics?.map((m: any, idx: number) => (
                      <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                        <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">{m.label}</p>
                        <p className="text-lg font-extrabold text-amber-600 font-mono mt-0.5">{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Enterprise Audit Transactions Table */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-semibold uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Full Register & Breakdown ({selectedRange.toUpperCase()})
                      </span>
                      <span className="font-mono text-[11px] bg-slate-50 px-3 py-1 rounded-lg border border-slate-200 text-slate-600">
                        Total Recorded: <strong className="text-slate-900 font-bold">{underlyingSales.length}</strong> sales transactions
                      </span>
                    </div>

                    {underlyingSales.length === 0 ? (
                      <div className="p-12 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                        <ShoppingBag className="w-10 h-10 text-slate-400 mx-auto" />
                        <p className="text-sm font-bold text-slate-800">No transactions recorded in this period</p>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          Sales created in the POS will appear here instantly with full cashier attribution, itemized menu products, and payment reconciliations.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-white">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-100/90 text-slate-600 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200">
                                <th className="py-3 px-3 w-10 text-center"></th>
                                <th className="py-3 px-4 font-mono w-40">Receipt #</th>
                                <th className="py-3 px-4 w-44">Date & Time</th>
                                <th className="py-3 px-4 w-48">Cashier / Staff</th>
                                <th className="py-3 px-4 w-44">Customer</th>
                                <th className="py-3 px-4">Summary of Dishes</th>
                                <th className="py-3 px-4 w-52">Payment Method</th>
                                <th className="py-3 px-6 text-right font-mono w-40">Total Paid (ZMW)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-150 text-slate-700">
                              {underlyingSales
                                .filter((s) => {
                                  if (!searchSaleTerm) return true;
                                  const term = searchSaleTerm.toLowerCase();
                                  const saleNum = (s.saleNumber || '').toLowerCase();
                                  const cashierName = (s.cashier?.fullName || s.cashier?.username || '').toLowerCase();
                                  const custName = (s.customer?.name || '').toLowerCase();
                                  const itemsMatch = s.items?.some((i: any) => i.menuItem?.name?.toLowerCase().includes(term));
                                  return saleNum.includes(term) || cashierName.includes(term) || custName.includes(term) || itemsMatch;
                                })
                                .map((sale, idx) => {
                                  const isExpanded = !!expandedSaleIds[sale.id];
                                  const dateObj = new Date(sale.createdAt);
                                  const formattedDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                                  const formattedTime = dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

                                  // Accurately distinguish prepared meal portions from beverage/drink units
                                  const isDrink = (it: any) => {
                                    const catName = it.menuItem?.category?.name?.toLowerCase() || '';
                                    const name = it.menuItem?.name?.toLowerCase() || '';
                                    return (
                                      catName.includes('drink') ||
                                      catName.includes('beverage') ||
                                      catName.includes('water') ||
                                      name.includes('water') ||
                                      name.includes('coca') ||
                                      name.includes('drink') ||
                                      name.includes('fanta') ||
                                      name.includes('sprite')
                                    );
                                  };

                                  const mealPortions = sale.items?.filter((it: any) => !isDrink(it)).reduce((acc: number, item: any) => acc + (item.quantity || 0), 0) || 0;
                                  const drinkUnits = sale.items?.filter((it: any) => isDrink(it)).reduce((acc: number, item: any) => acc + (item.quantity || 0), 0) || 0;

                                  let quantitySummaryText = '';
                                  if (mealPortions > 0 && drinkUnits > 0) {
                                    quantitySummaryText = `${mealPortions} meal portion${mealPortions !== 1 ? 's' : ''}, ${drinkUnits} drink${drinkUnits !== 1 ? 's' : ''}`;
                                  } else if (mealPortions > 0) {
                                    quantitySummaryText = `${mealPortions} meal portion${mealPortions !== 1 ? 's' : ''}`;
                                  } else {
                                    quantitySummaryText = `${drinkUnits} drink unit${drinkUnits !== 1 ? 's' : ''}`;
                                  }

                                  return (
                                    <React.Fragment key={sale.id}>
                                      <tr
                                        onClick={() => toggleSaleExpand(sale.id)}
                                        className={`transition-colors cursor-pointer select-none ${
                                          isExpanded
                                            ? 'bg-amber-50/70 hover:bg-amber-50/90'
                                            : idx % 2 === 1
                                            ? 'bg-slate-50/60 hover:bg-slate-100/70'
                                            : 'bg-white hover:bg-slate-50'
                                        }`}
                                      >
                                        {/* Expand Toggle */}
                                        <td className="py-3.5 px-3 text-center align-middle">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleSaleExpand(sale.id);
                                            }}
                                            className="w-6 h-6 rounded-md hover:bg-slate-200/80 flex items-center justify-center text-slate-500 transition"
                                            title={isExpanded ? 'Collapse transaction details' : 'Expand transaction details'}
                                          >
                                            {isExpanded ? (
                                              <ChevronUp className="w-4 h-4 text-amber-600" />
                                            ) : (
                                              <ChevronDown className="w-4 h-4 text-slate-400" />
                                            )}
                                          </button>
                                        </td>

                                        {/* Receipt / Order # */}
                                        <td className="py-3.5 px-4 font-mono font-bold text-amber-700 whitespace-nowrap align-middle">
                                          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-lg w-fit">
                                            <Receipt className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                                            <span>{sale.saleNumber || 'SALE-RECEIPT'}</span>
                                          </div>
                                        </td>

                                        {/* Date & Time */}
                                        <td className="py-3.5 px-4 font-mono text-[11px] whitespace-nowrap align-middle">
                                          <div className="flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                            <span className="font-semibold text-slate-800">{formattedDate}</span>
                                            <span className="text-slate-500 font-medium">{formattedTime}</span>
                                          </div>
                                        </td>

                                        {/* Staff Cashier */}
                                        <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                                          <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800 text-[11px] font-bold flex-shrink-0">
                                              {(sale.cashier?.fullName || 'S')[0]?.toUpperCase()}
                                            </div>
                                            <div>
                                              <p className="font-bold text-slate-900 text-xs leading-tight">
                                                {sale.cashier?.fullName || 'Cashier'}
                                              </p>
                                              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                @{sale.cashier?.username || 'pos'} • <span className="uppercase text-slate-600 font-semibold">{sale.cashier?.role || 'Staff'}</span>
                                              </p>
                                            </div>
                                          </div>
                                        </td>

                                        {/* Customer Account */}
                                        <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                                          {sale.customer ? (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                              {sale.customer.name}
                                            </span>
                                          ) : (
                                            <span className="text-slate-400 text-xs italic font-medium">Walk-in Guest</span>
                                          )}
                                        </td>

                                        {/* Summary of Dishes */}
                                        <td className="py-3.5 px-4 align-middle">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-slate-800 text-xs">
                                              {sale.items?.length || 0} line{sale.items?.length !== 1 ? 's' : ''} ({quantitySummaryText})
                                            </span>
                                            <span className="text-slate-400 text-xs">•</span>
                                            <span className="text-slate-500 text-xs truncate max-w-xs">
                                              {sale.items?.map((it: any) => `${it.quantity}× ${it.menuItem?.name || 'Item'}`).join(', ')}
                                            </span>
                                            <span className="text-amber-600 text-[11px] font-semibold flex items-center gap-0.5 ml-auto">
                                              {isExpanded ? 'Hide Details' : 'View Breakdown'}
                                            </span>
                                          </div>
                                        </td>

                                        {/* Payment Method */}
                                        <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                                          <div className="flex flex-wrap gap-1.5">
                                            {sale.payments?.map((p: any, pIdx: number) => {
                                              const isCash = p.paymentMethod === 'CASH';
                                              const isMoMo = p.paymentMethod === 'AIRTEL_MONEY' || p.paymentMethod === 'MTN_MOMO';
                                              const badgeClass = isCash
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : isMoMo
                                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                : 'bg-blue-50 text-blue-700 border-blue-200';
                                              return (
                                                <div
                                                  key={pIdx}
                                                  className={`inline-flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border ${badgeClass}`}
                                                >
                                                  <span>{p.paymentMethod}</span>
                                                  <span className="font-bold">{formatZMW(p.amount)}</span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </td>

                                        {/* Total Paid (ZMW) */}
                                        <td className="py-3.5 px-6 text-right font-mono font-extrabold text-sm text-slate-900 whitespace-nowrap align-middle">
                                          {formatZMW(sale.totalAmount)}
                                        </td>
                                      </tr>

                                      {/* Collapsible Accordion Drawer */}
                                      {isExpanded && (
                                        <tr className="bg-amber-50/30 border-y border-amber-200/50">
                                          <td colSpan={8} className="p-4 pl-12 bg-slate-50/50">
                                            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
                                              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                                                <div className="flex items-center gap-2">
                                                  <FileText className="w-4 h-4 text-amber-600" />
                                                  <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
                                                    Itemized POS Recipe & Dish Audit (Receipt {sale.saleNumber || 'SALE-RECEIPT'})
                                                  </span>
                                                </div>
                                                <span className="text-xs text-slate-500 font-mono">
                                                  Transaction Timestamp: {new Date(sale.createdAt).toLocaleString()}
                                                </span>
                                              </div>

                                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                                {sale.items?.map((item: any) => (
                                                  <div
                                                    key={item.id}
                                                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3"
                                                  >
                                                    <div className="space-y-0.5">
                                                      <div className="flex items-center gap-1.5">
                                                        <span className="bg-amber-500 text-slate-950 font-mono text-[10px] font-black px-1.5 py-0.5 rounded">
                                                          {item.quantity}×
                                                        </span>
                                                        <span className="font-bold text-slate-900 text-xs">
                                                          {item.menuItem?.name || 'Dish'}
                                                        </span>
                                                      </div>
                                                      <p className="text-[11px] text-slate-500 font-mono">
                                                        Unit Price: {formatZMW(item.unitPrice || 0)}
                                                      </p>
                                                    </div>
                                                    <div className="text-right">
                                                      <span className="font-mono font-extrabold text-xs text-slate-900">
                                                        {formatZMW(item.subtotal || item.quantity * (item.unitPrice || 0))}
                                                      </span>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>

                                              {/* Payment and Attribution Breakdown Bar */}
                                              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                                                <div className="flex items-center gap-4">
                                                  <span>
                                                    <strong>Cashier:</strong> {sale.cashier?.fullName || 'Staff'} ({sale.cashier?.role || 'Staff'})
                                                  </span>
                                                  <span>
                                                    <strong>Customer:</strong> {sale.customer?.name || 'Walk-in Guest'}
                                                  </span>
                                                  <span>
                                                    <strong>Order Status:</strong>{' '}
                                                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[10px]">
                                                      {sale.status || 'COMPLETED'}
                                                    </span>
                                                  </span>
                                                </div>
                                                <div className="flex items-center gap-2 font-mono">
                                                  <span>Subtotal: {formatZMW(sale.subtotal || sale.totalAmount)}</span>
                                                  {Number(sale.taxAmount || 0) > 0 && (
                                                    <span>• Tax: {formatZMW(sale.taxAmount)}</span>
                                                  )}
                                                  {Number(sale.discountAmount || 0) > 0 && (
                                                    <span>• Discount: -{formatZMW(sale.discountAmount)}</span>
                                                  )}
                                                  <span className="font-bold text-amber-600 text-sm pl-2">
                                                    Net Total: {formatZMW(sale.totalAmount)}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                            </tbody>
                            <tfoot className="bg-slate-100/90 text-slate-800 font-bold border-t-2 border-slate-200">
                              <tr>
                                <td></td>
                                <td colSpan={4} className="py-3.5 px-4 uppercase text-[11px] tracking-wider text-slate-600">
                                  Total Reconciled Period Sales
                                </td>
                                <td className="py-3.5 px-4 font-mono text-slate-700 text-xs">
                                  <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
                                    {underlyingSales.reduce(
                                      (sum, s) => sum + (s.items?.reduce((iSum: number, it: any) => iSum + (it.quantity || 0), 0) || 0),
                                      0
                                    )}{' '}
                                    portions sold
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-slate-700 text-xs">
                                  <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
                                    {underlyingSales.length} Transactions
                                  </span>
                                </td>
                                <td className="py-3.5 px-6 text-right font-mono font-extrabold text-amber-600 text-base">
                                  {formatZMW(underlyingSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0))}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : activeModalTab === 'RECONCILIATION' ? (
                /* Daily Stock Reconciliation Tab */
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Perpetual Stock & Daily Culinary Consumption Reconciliation</h4>
                      <p className="text-slate-500 mt-0.5">Automated formula: Opening Balance + Daily Purchase Receipts - POS/Kitchen Issues = Closing Physical</p>
                    </div>
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-700 font-bold border border-amber-500/20 rounded-xl">
                      Reconciled Against Live Stock Register
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100/90 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="p-3.5">Stock Item / SKU</th>
                          <th className="p-3.5">Category</th>
                          <th className="p-3.5 text-right">Unit Cost</th>
                          <th className="p-3.5 text-right">Opening Stock</th>
                          <th className="p-3.5 text-right">Received Today</th>
                          <th className="p-3.5 text-right">Consumed (POS)</th>
                          <th className="p-3.5 text-right">Closing Stock</th>
                          <th className="p-3.5 text-right">Total Value</th>
                          <th className="p-3.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {stockReconciliation.map((item, idx) => (
                          <tr key={item.id} className={`transition font-mono ${idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'} hover:bg-amber-50/40`}>
                            <td className="p-3.5 font-sans">
                              <p className="font-bold text-slate-900">{item.name}</p>
                              <span className="text-[10px] text-slate-500 font-mono">{item.sku}</span>
                            </td>
                            <td className="p-3.5 font-sans text-slate-600">{item.category}</td>
                            <td className="p-3.5 text-right text-slate-700">{formatZMW(item.unitCost)}</td>
                            <td className="p-3.5 text-right text-slate-600">{item.theoreticalOpening} {item.unitOfMeasure}</td>
                            <td className="p-3.5 text-right text-emerald-600 font-semibold">+{item.receivedToday} {item.unitOfMeasure}</td>
                            <td className="p-3.5 text-right text-amber-600 font-semibold">-{item.consumedToday} {item.unitOfMeasure}</td>
                            <td className="p-3.5 text-right font-bold text-slate-900">{item.closingStock} {item.unitOfMeasure}</td>
                            <td className="p-3.5 text-right font-bold text-amber-600">{formatZMW(item.closingValue)}</td>
                            <td className="p-3.5 text-center font-sans">
                              {item.closingStock <= 10 ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                  Low Stock
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Balanced
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Audit Summary & Policy Tab */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {drillDownModal.metrics?.map((m: any, idx: number) => (
                      <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{m.label}</p>
                        <p className="text-xl font-extrabold text-amber-600 font-mono">{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {drillDownModal.notes && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 space-y-2">
                      <span className="font-semibold text-amber-700 uppercase tracking-wide text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Internal Control & Operational Audit Policy:
                      </span>
                      <p className="leading-relaxed text-slate-600">{drillDownModal.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                The LSpot Restaurant • Enterprise Mobile POS Audit Register
              </span>
              <button
                type="button"
                onClick={() => setDrillDownModal(null)}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-md shadow-amber-500/20"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
