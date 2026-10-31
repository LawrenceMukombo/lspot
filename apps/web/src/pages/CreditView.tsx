import React, { useState, useEffect } from 'react';
import {
  Users,
  CreditCard,
  PlusCircle,
  Banknote,
  Clock,
  CheckCircle,
  AlertCircle,
  Printer,
  MessageSquare,
  Mail,
  Calculator,
  ArrowRight,
  Edit2,
  Trash2,
  FileText,
  RotateCcw,
  X
} from 'lucide-react';
import { apiRequest } from '../api.js';
import { EnterpriseTable, Column } from '../components/EnterpriseTable.js';
import { formatZMW, PaymentMethod } from '@lspot/shared';

export function CreditView() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [ageingReport, setAgeingReport] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'CUSTOMERS' | 'AGEING'>('CUSTOMERS');
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [showPayModal, setShowPayModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [viewingLedgerCustomer, setViewingLedgerCustomer] = useState<any | null>(null);
  const [customerLedgerData, setCustomerLedgerData] = useState<any | null>(null);
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);

  // Repayment form
  const [payCustomerId, setPayCustomerId] = useState('');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [payReference, setPayReference] = useState('');
  const [payReceipt, setPayReceipt] = useState<any>(null);

  // Customer form (Create / Edit)
  const [newCustName, setNewCustName] = useState('');
  const [newCustType, setNewCustType] = useState('CORPORATE');
  const [newCustPhone, setNewCustPhone] = useState('+260 97 ');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustTpin, setNewCustTpin] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustLimit, setNewCustLimit] = useState(10000);
  const [newCustTerms, setNewCustTerms] = useState(30);

  useEffect(() => {
    loadCreditData();
  }, []);

  const loadCreditData = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest('/credit/customers');
      if (data) setCustomers(data);
      const ageing = await apiRequest('/credit/ageing');
      if (ageing) setAgeingReport(ageing);
    } catch (e: any) {
      console.warn('Network error loading credit data:', e);
      setCustomers((prev) => (prev.length > 0 ? prev : []));
      setAgeingReport((prev) => (prev.length > 0 ? prev : []));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingCustomer(null);
    setNewCustName('');
    setNewCustType('CORPORATE');
    setNewCustPhone('+260 97 ');
    setNewCustEmail('');
    setNewCustTpin('');
    setNewCustAddress('');
    setNewCustLimit(10000);
    setNewCustTerms(30);
    setShowAddCustomerModal(true);
  };

  const handleOpenEditModal = (customer: any) => {
    setEditingCustomer(customer);
    setNewCustName(customer.name || '');
    setNewCustType(customer.customerType || 'CORPORATE');
    setNewCustPhone(customer.phone || '');
    setNewCustEmail(customer.email || '');
    setNewCustTpin(customer.tpin || '');
    setNewCustAddress(customer.address || '');
    setNewCustLimit(Number(customer.creditLimit || 0));
    setNewCustTerms(Number(customer.paymentTermsDays || 30));
    setShowAddCustomerModal(true);
  };

  const handleOpenLedger = async (customer: any) => {
    setViewingLedgerCustomer(customer);
    setIsLedgerLoading(true);
    try {
      const ledger = await apiRequest(`/credit/customers/${customer.id}/ledger`);
      setCustomerLedgerData(ledger);
    } catch (err: any) {
      alert(`Failed to load customer ledger: ${err.message}`);
    } finally {
      setIsLedgerLoading(false);
    }
  };

  const handleDeleteCustomer = async (customer: any) => {
    if (Number(customer.currentBalance) > 0) {
      alert(`Cannot deactivate ${customer.name}. The account has an active debt of ${formatZMW(customer.currentBalance)}. Please receive debt settlement before deactivating.`);
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to deactivate customer "${customer.name}"?\n\nThis will safely soft-delete their credit profile while preserving all historical audit receipts and invoices.`
    );
    if (!confirmDelete) return;

    try {
      await apiRequest(`/credit/customers/${customer.id}`, { method: 'DELETE' });
      await loadCreditData();
    } catch (err: any) {
      alert(`Failed to deactivate customer: ${err.message}`);
    }
  };

  const selectedRepayCustomer = customers.find((c) => c.id === payCustomerId);
  const currentOwing = Number(selectedRepayCustomer?.currentBalance || 0);
  const calculatedBalance = Math.max(0, currentOwing - Number(payAmount || 0));
  const isOverpaying = Number(payAmount || 0) > currentOwing;

  const handleOpenRepayModal = (customer?: any) => {
    if (customer) {
      setPayCustomerId(customer.id);
      setPayAmount(Number(customer.currentBalance || 0));
    } else if (customers.length > 0) {
      const firstWithDebt = customers.find((c) => Number(c.currentBalance) > 0) || customers[0];
      setPayCustomerId(firstWithDebt.id);
      setPayAmount(Number(firstWithDebt.currentBalance || 0));
    }
    setPayReference(`REC-${Date.now().toString().slice(-6)}`);
    setShowPayModal(true);
  };

  const handleCustomerChange = (customerId: string) => {
    setPayCustomerId(customerId);
    const target = customers.find((c) => c.id === customerId);
    if (target) {
      setPayAmount(Number(target.currentBalance || 0));
    } else {
      setPayAmount(0);
    }
  };

  const handleRecordRepayment = async () => {
    if (!payCustomerId) {
      alert('Please select a debtor customer to receive repayment.');
      return;
    }
    const numAmount = Number(payAmount);
    if (!numAmount || numAmount <= 0) {
      alert('Payment amount must be greater than zero.');
      return;
    }
    if (currentOwing <= 0) {
      alert(`${selectedRepayCustomer?.name || 'Customer'} has zero outstanding debt (K 0.00). No repayment is due.`);
      return;
    }
    if (numAmount > currentOwing) {
      const confirmOverpay = window.confirm(
        `Warning: Payment amount (${formatZMW(numAmount)}) exceeds the total outstanding debt (${formatZMW(currentOwing)}).\n\nDo you wish to allocate the remaining ${formatZMW(numAmount - currentOwing)} as an unapplied advance credit deposit?`
      );
      if (!confirmOverpay) return;
    }

    try {
      const res = await apiRequest('/credit/payments', {
        method: 'POST',
        body: JSON.stringify({
          customerId: payCustomerId,
          amount: numAmount,
          paymentMethod: payMethod,
          reference: payReference
        })
      });
      setShowPayModal(false);
      loadCreditData();
      setPayReceipt({
        customer: selectedRepayCustomer,
        amountPaid: numAmount,
        previousOwing: currentOwing,
        remainingBalance: Math.max(0, currentOwing - numAmount),
        paymentMethod: payMethod,
        reference: payReference,
        date: new Date().toISOString()
      });
    } catch (err: any) {
      alert(`Repayment failed: ${err.message}`);
    }
  };

  const handleSaveCustomer = async () => {
    if (!newCustName.trim()) {
      alert('Customer or organization name is required.');
      return;
    }
    if (!newCustPhone.trim()) {
      alert('Contact phone number is required.');
      return;
    }

    try {
      if (editingCustomer) {
        await apiRequest(`/credit/customers/${editingCustomer.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: newCustName,
            customerType: newCustType,
            phone: newCustPhone,
            email: newCustEmail || null,
            tpin: newCustTpin || null,
            address: newCustAddress || null,
            creditLimit: Number(newCustLimit),
            paymentTermsDays: Number(newCustTerms)
          })
        });
      } else {
        await apiRequest('/credit/customers', {
          method: 'POST',
          body: JSON.stringify({
            name: newCustName,
            customerType: newCustType,
            phone: newCustPhone,
            email: newCustEmail || null,
            tpin: newCustTpin || null,
            address: newCustAddress || null,
            creditLimit: Number(newCustLimit),
            paymentTermsDays: Number(newCustTerms)
          })
        });
      }
      setShowAddCustomerModal(false);
      setEditingCustomer(null);
      await loadCreditData();
    } catch (err: any) {
      alert(`Customer save failed: ${err.message}`);
    }
  };

  const customerColumns: Column<any>[] = [
    {
      key: 'name',
      header: 'Customer / Organization',
      render: (row) => (
        <div>
          <p className="font-bold text-slate-100 leading-tight">{row.name}</p>
          {row.tpin && (
            <p className="text-[10px] text-slate-500 font-mono">TPIN: {row.tpin}</p>
          )}
        </div>
      )
    },
    {
      key: 'customerType',
      header: 'Type',
      render: (row) => (
        <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-medium border border-slate-700/60">
          {row.customerType}
        </span>
      )
    },
    {
      key: 'phone',
      header: 'Contact Phone',
      render: (row) => (
        <div>
          <span className="font-mono text-xs text-slate-300 font-semibold">{row.phone}</span>
          {row.email && (
            <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{row.email}</p>
          )}
        </div>
      )
    },
    {
      key: 'creditLimit',
      header: 'Credit Limit',
      render: (row) => <span className="font-mono font-medium text-slate-300">{formatZMW(row.creditLimit)}</span>
    },
    {
      key: 'currentBalance',
      header: 'Owed Balance (AR)',
      render: (row) => (
        <span
          className={`font-mono font-extrabold ${
            Number(row.currentBalance) > 0 ? 'text-rose-400' : 'text-slate-400'
          }`}
        >
          {formatZMW(row.currentBalance)}
        </span>
      )
    },
    {
      key: 'availableCredit',
      header: 'Available Headroom',
      render: (row) => (
        <span className="font-mono font-bold text-emerald-400">
          {formatZMW(row.availableCredit)}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Collection Action',
      render: (row) => (
        <div className="flex items-center gap-2">
          {Number(row.currentBalance) > 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenRepayModal(row);
              }}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition shadow-sm"
              title="Receive and allocate payment"
            >
              <Banknote className="w-3.5 h-3.5" />
              <span>Pay ({formatZMW(row.currentBalance)})</span>
            </button>
          ) : (
            <span className="text-xs text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-900">
              Settled (K 0)
            </span>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEditModal(row);
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition border border-slate-700"
            title="Edit Customer Details (CRUD)"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenLedger(row);
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-500 hover:text-white text-slate-300 transition border border-slate-700"
            title="View Historical Ledger & Credit Sales"
          >
            <FileText className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteCustomer(row);
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-400 transition border border-slate-700"
            title="Deactivate Customer Account"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  const ageingColumns: Column<any>[] = [
    { key: 'customerName', header: 'Debtor Name', render: (row) => <span className="font-bold">{row.customerName}</span> },
    { key: 'totalBalance', header: 'Total Debt', render: (row) => <span className="font-mono font-bold text-amber-400">{formatZMW(row.totalBalance)}</span> },
    { key: 'current', header: 'Current (< 30 days)', render: (row) => <span className="font-mono text-emerald-400">{formatZMW(row.current)}</span> },
    { key: 'days30', header: '31 - 60 Days', render: (row) => <span className="font-mono text-amber-400">{formatZMW(row.days30)}</span> },
    { key: 'days60', header: '61 - 90 Days', render: (row) => <span className="font-mono text-rose-400">{formatZMW(row.days60)}</span> },
    { key: 'days90Plus', header: '90+ Days Overdue', render: (row) => <span className="font-mono font-extrabold text-rose-500">{formatZMW(row.days90Plus)}</span> }
  ];

  const totalOwed = customers.reduce((sum, c) => sum + Number(c.currentBalance || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">Customer Credit & Accounts Receivable</h2>
              <span className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono text-xs font-bold rounded-lg">
                Total Outstanding Debtors: {formatZMW(totalOwed)}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Corporate & individual credit lines, debt limits, payment collections & aged receivables.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleOpenRepayModal()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-500/20"
          >
            <Banknote className="w-4 h-4" />
            Receive Debt Payment
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-xl border border-slate-700 transition"
          >
            <PlusCircle className="w-4 h-4 text-amber-400" />
            Add Credit Customer
          </button>

          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('CUSTOMERS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'CUSTOMERS' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              Customer Directory
            </button>
            <button
              onClick={() => setActiveTab('AGEING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'AGEING' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              Aged Debtors
            </button>
          </div>
        </div>
      </div>

      {/* Enterprise Data Table */}
      {activeTab === 'CUSTOMERS' ? (
        <EnterpriseTable
          columns={customerColumns}
          data={customers}
          title="Customer Credit Accounts & Balances"
          searchPlaceholder="Search customer or phone..."
          isLoading={isLoading}
          onEditRow={handleOpenEditModal}
          onDeleteRow={handleDeleteCustomer}
          canEdit={true}
          canDelete={true}
        />
      ) : (
        <EnterpriseTable
          columns={ageingColumns}
          data={ageingReport}
          title="Debtors Ageing Analysis (Days Overdue)"
          searchPlaceholder="Search debtor..."
          isLoading={isLoading}
        />
      )}

      {/* Record Repayment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-lg text-white">Record Customer Debt Repayment</h3>
                <p className="text-xs text-slate-400">
                  Prepopulates debt owing, verifies payment headroom, and allocates to oldest unpaid invoices.
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Banknote className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Debtor Customer</label>
                <select
                  value={payCustomerId}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Choose Debtor Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — Current Debt: {formatZMW(c.currentBalance)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Debt & Balance Preview Card */}
              {selectedRepayCustomer && (
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Customer Selected:</span>
                    <span className="font-bold text-slate-200">{selectedRepayCustomer.name}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-slate-800/80">
                    <div className="p-2 bg-slate-900/60 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Owing</span>
                      <span className="font-mono font-extrabold text-sm text-rose-400 block mt-0.5">
                        {formatZMW(currentOwing)}
                      </span>
                    </div>

                    <div className="p-2 bg-slate-900/60 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Amount Paying</span>
                      <span className="font-mono font-extrabold text-sm text-emerald-400 block mt-0.5">
                        {formatZMW(Number(payAmount || 0))}
                      </span>
                    </div>

                    <div className="p-2 bg-slate-900/60 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Remaining Due</span>
                      <span
                        className={`font-mono font-extrabold text-sm block mt-0.5 ${
                          calculatedBalance === 0 ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {formatZMW(calculatedBalance)}
                      </span>
                    </div>
                  </div>

                  {/* Overpayment Alert */}
                  {isOverpaying && (
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        Payment exceeds debt by <strong>{formatZMW(Number(payAmount) - currentOwing)}</strong>. Advance will sit as unapplied credit.
                      </span>
                    </div>
                  )}

                  {/* Quick Settle Full Amount Button */}
                  {currentOwing > 0 && Number(payAmount) !== currentOwing && (
                    <button
                      type="button"
                      onClick={() => setPayAmount(currentOwing)}
                      className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5"
                    >
                      <Calculator className="w-3.5 h-3.5 text-amber-400" />
                      <span>Set to Full Outstanding Amount ({formatZMW(currentOwing)})</span>
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Repayment Amount (ZMW)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={payAmount || ''}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-base focus:outline-none focus:border-amber-500 font-mono font-extrabold text-emerald-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Method</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value={PaymentMethod.CASH}>Cash</option>
                    <option value={PaymentMethod.AIRTEL_MONEY}>Airtel Money</option>
                    <option value={PaymentMethod.MTN_MOMO}>MTN MoMo</option>
                    <option value={PaymentMethod.BANK_TRANSFER}>Bank Transfer</option>
                    <option value={PaymentMethod.CARD}>Debit/Credit Card</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Payment Reference / Cheque / Txn ID
                </label>
                <input
                  type="text"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  placeholder="e.g. TXN-102938 or BANK-DEP"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecordRepayment}
                disabled={!payCustomerId || Number(payAmount) <= 0}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-sm font-extrabold rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Confirm Payment ({formatZMW(Number(payAmount || 0))})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Repayment Settlement Receipt Modal with WhatsApp & Email Send */}
      {payReceipt && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 font-sans">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7" />
            </div>

            <div className="text-center">
              <h3 className="font-extrabold text-lg text-white">Payment Received & Allocated!</h3>
              <p className="text-xs text-slate-400 font-mono">{payReceipt.reference}</p>
            </div>

            {/* Receipt Card */}
            <div className="p-4 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-2.5 text-slate-800 dark:text-slate-200 font-mono">
              <div className="text-center border-b border-dashed border-slate-300 dark:border-slate-700 pb-2 mb-2 font-sans">
                <p className="font-extrabold text-sm text-slate-900 dark:text-white">THE LSPOT RESTAURANT</p>
                <p className="text-[10px] text-slate-500">Manyama, Kalumbila District, Zambia</p>
                <p className="text-[10px] text-slate-500">Official Debt Collection Receipt</p>
              </div>

              <div className="flex justify-between font-sans">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold text-slate-900 dark:text-white">{payReceipt.customer?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Previous Debt:</span>
                <span className="text-rose-500 font-bold">{formatZMW(payReceipt.previousOwing)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Amount Paid:</span>
                <span className="text-emerald-500 font-bold">{formatZMW(payReceipt.amountPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Settlement Mode:</span>
                <span className="font-semibold">{payReceipt.paymentMethod}</span>
              </div>
              <div className="flex justify-between border-t border-dashed border-slate-300 dark:border-slate-700 pt-2 font-bold text-sm text-slate-900 dark:text-white font-sans">
                <span>REMAINING BALANCE:</span>
                <span className="font-mono text-amber-500">{formatZMW(payReceipt.remainingBalance)}</span>
              </div>
            </div>

            {/* WhatsApp & Email Sharing Actions */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">
                Instant Dispatch to Client
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const phone = payReceipt.customer?.phone?.replace(/[^0-9]/g, '') || '';
                    const text = encodeURIComponent(
                      `Hello ${payReceipt.customer?.name},\n\n` +
                      `*Payment Receipt Confirmation*\n` +
                      `We have received your payment of *${formatZMW(payReceipt.amountPaid)}* via ${payReceipt.paymentMethod} (Ref: ${payReceipt.reference}).\n\n` +
                      `Previous Debt: ${formatZMW(payReceipt.previousOwing)}\n` +
                      `Remaining Balance: *${formatZMW(payReceipt.remainingBalance)}*\n\n` +
                      `Thank you for your valued partnership!\n` +
                      `*The LSpot Restaurant*, Manyama, Zambia`
                    );
                    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-md"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Send WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const email = payReceipt.customer?.email || 'accounts@client.zm';
                    const subject = encodeURIComponent(`Payment Receipt - ${payReceipt.reference} - The LSpot Restaurant`);
                    const body = encodeURIComponent(
                      `Dear ${payReceipt.customer?.name},\n\n` +
                      `This email confirms receipt of ${formatZMW(payReceipt.amountPaid)} towards your credit account.\n\n` +
                      `Transaction Reference: ${payReceipt.reference}\n` +
                      `Method: ${payReceipt.paymentMethod}\n` +
                      `Previous Owing: ${formatZMW(payReceipt.previousOwing)}\n` +
                      `New Outstanding Balance: ${formatZMW(payReceipt.remainingBalance)}\n\n` +
                      `Thank you for choosing The LSpot Restaurant.\n\nBest regards,\nManagement\nThe LSpot Restaurant, Manyama, Kalumbila, Zambia`
                    );
                    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl transition shadow-md"
                >
                  <Mail className="w-4 h-4" />
                  <span>Send Email</span>
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPayReceipt(null)}
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Customer Modal (CRUD) */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-lg text-white">
                  {editingCustomer ? 'Edit Customer Credit Account' : 'Register Credit Customer'}
                </h3>
                <p className="text-xs text-slate-400">
                  {editingCustomer
                    ? `Update contact details, credit limits, or TPIN for ${editingCustomer.name}`
                    : 'Set up a new corporate or individual account with approved credit headroom.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddCustomerModal(false);
                  setEditingCustomer(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Customer / Organization Name *
                </label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. Lumwana Mining Contractors"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Customer Type</label>
                  <select
                    value={newCustType}
                    onChange={(e) => setNewCustType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="CORPORATE">Corporate</option>
                    <option value="INDIVIDUAL">Individual</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Phone Number *</label>
                  <input
                    type="text"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    placeholder="+260 97..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newCustEmail}
                    onChange={(e) => setNewCustEmail(e.target.value)}
                    placeholder="finance@client.zm"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">ZRA TPIN (Fiscal)</label>
                  <input
                    type="text"
                    value={newCustTpin}
                    onChange={(e) => setNewCustTpin(e.target.value)}
                    placeholder="10-digit TPIN"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Approved Credit Limit (ZMW)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={newCustLimit}
                    onChange={(e) => setNewCustLimit(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Payment Terms (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newCustTerms}
                    onChange={(e) => setNewCustTerms(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Physical / Delivery Address</label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder="Plot #, Mine Road, Kalumbila"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowAddCustomerModal(false);
                  setEditingCustomer(null);
                }}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomer}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-extrabold rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{editingCustomer ? 'Update Customer' : 'Save Account'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Ledger & Credit Sales History Modal */}
      {viewingLedgerCustomer && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">
                    {viewingLedgerCustomer.name} — Customer Ledger & Statement
                  </h3>
                  <p className="text-xs text-slate-400">
                    Audit trail of all POS meals billed on credit, consolidated statements & repayments.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setViewingLedgerCustomer(null);
                  setCustomerLedgerData(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Credit Limit</span>
                  <span className="font-mono font-bold text-slate-200 text-sm mt-0.5 block">
                    {formatZMW(viewingLedgerCustomer.creditLimit)}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Current Balance (AR)</span>
                  <span className="font-mono font-extrabold text-rose-400 text-sm mt-0.5 block">
                    {formatZMW(viewingLedgerCustomer.currentBalance)}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Available Headroom</span>
                  <span className="font-mono font-extrabold text-emerald-400 text-sm mt-0.5 block">
                    {formatZMW(viewingLedgerCustomer.availableCredit)}
                  </span>
                </div>
              </div>

              {isLedgerLoading ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <RotateCcw className="w-6 h-6 animate-spin mx-auto text-amber-500" />
                  <p className="text-xs">Loading ledger entries and order history...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                      Credit POS Sales & Meals Billed
                    </h4>
                    {customerLedgerData?.sales?.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                        No credit sales recorded for this customer yet.
                      </p>
                    ) : (
                      <div className="border border-slate-800 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
                            <tr>
                              <th className="p-2.5">Date</th>
                              <th className="p-2.5">Sale #</th>
                              <th className="p-2.5">Itemized Dishes</th>
                              <th className="p-2.5 text-right">Total (ZMW)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 text-slate-300">
                            {customerLedgerData?.sales?.map((s: any) => (
                              <tr key={s.id} className="hover:bg-slate-800/40">
                                <td className="p-2.5 font-mono text-[11px] text-slate-400">
                                  {new Date(s.createdAt).toLocaleDateString()} {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="p-2.5 font-mono font-bold text-amber-400">{s.saleNumber}</td>
                                <td className="p-2.5">
                                  {s.items?.map((it: any) => `${it.quantity}× ${it.menuItem?.name}`).join(', ')}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold text-white">
                                  {formatZMW(s.totalAmount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                      Issued Invoices & Settlement History
                    </h4>
                    {customerLedgerData?.invoices?.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                        No invoices generated for this customer yet.
                      </p>
                    ) : (
                      <div className="border border-slate-800 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
                            <tr>
                              <th className="p-2.5">Invoice #</th>
                              <th className="p-2.5">Issue Date</th>
                              <th className="p-2.5">Due Date</th>
                              <th className="p-2.5 text-right">Invoice Total</th>
                              <th className="p-2.5 text-right">Amount Paid</th>
                              <th className="p-2.5 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 text-slate-300">
                            {customerLedgerData?.invoices?.map((inv: any) => (
                              <tr key={inv.id} className="hover:bg-slate-800/40">
                                <td className="p-2.5 font-mono font-bold text-blue-400">{inv.invoiceNumber}</td>
                                <td className="p-2.5 font-mono text-[11px] text-slate-400">
                                  {new Date(inv.issueDate).toLocaleDateString()}
                                </td>
                                <td className="p-2.5 font-mono text-[11px] text-slate-400">
                                  {new Date(inv.dueDate).toLocaleDateString()}
                                </td>
                                <td className="p-2.5 text-right font-mono">{formatZMW(inv.totalAmount)}</td>
                                <td className="p-2.5 text-right font-mono font-bold text-emerald-400">
                                  {formatZMW(inv.amountPaid)}
                                </td>
                                <td className="p-2.5 text-center">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                                    {inv.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">
                Customer ID: {viewingLedgerCustomer.id}
              </span>
              <button
                type="button"
                onClick={() => {
                  setViewingLedgerCustomer(null);
                  setCustomerLedgerData(null);
                }}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
