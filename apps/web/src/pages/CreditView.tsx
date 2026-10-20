import React, { useState, useEffect } from 'react';
import {
  Users,
  CreditCard,
  PlusCircle,
  Banknote,
  Clock,
  CheckCircle,
  AlertCircle
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

  // Repayment form
  const [payCustomerId, setPayCustomerId] = useState('');
  const [payAmount, setPayAmount] = useState(1000);
  const [payMethod, setPayMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [payReference, setPayReference] = useState('BANK-DEP-1029');

  // Customer form
  const [newCustName, setNewCustName] = useState('');
  const [newCustType, setNewCustType] = useState('CORPORATE');
  const [newCustPhone, setNewCustPhone] = useState('+260 97 ');
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
    } catch (e) {
      // Fallback
      setCustomers([
        { id: 'c1', name: 'Kalumbila Mining Services Ltd', customerType: 'CORPORATE', phone: '+260 97 111 2233', tpin: '1002345678', creditLimit: 15000, currentBalance: 3250, availableCredit: 11750, paymentTermsDays: 30, status: 'ACTIVE' },
        { id: 'c2', name: 'Manyama Transport & Logistics', customerType: 'CORPORATE', phone: '+260 96 444 5566', tpin: '1008765432', creditLimit: 8000, currentBalance: 1450, availableCredit: 6550, paymentTermsDays: 14, status: 'ACTIVE' },
        { id: 'c3', name: 'Dr. Mwape Kangwa', customerType: 'INDIVIDUAL', phone: '+260 97 777 8899', creditLimit: 2000, currentBalance: 420, availableCredit: 1580, paymentTermsDays: 7, status: 'ACTIVE' }
      ]);
      setAgeingReport([
        { customerName: 'Kalumbila Mining Services Ltd', totalBalance: 3250, current: 2100, days30: 1150, days60: 0, days90Plus: 0 },
        { customerName: 'Manyama Transport & Logistics', totalBalance: 1450, current: 800, days30: 650, days60: 0, days90Plus: 0 },
        { customerName: 'Dr. Mwape Kangwa', totalBalance: 420, current: 420, days30: 0, days60: 0, days90Plus: 0 }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecordRepayment = async () => {
    if (!payCustomerId) {
      alert('Please select a customer');
      return;
    }
    try {
      await apiRequest('/credit/payments', {
        method: 'POST',
        body: JSON.stringify({
          customerId: payCustomerId,
          amount: Number(payAmount),
          paymentMethod: payMethod,
          reference: payReference
        })
      });
      setShowPayModal(false);
      loadCreditData();
      alert('Repayment posted and allocated to oldest invoices successfully!');
    } catch (err: any) {
      alert(`Repayment failed: ${err.message}`);
    }
  };

  const handleCreateCustomer = async () => {
    if (!newCustName) return;
    try {
      await apiRequest('/credit/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: newCustName,
          customerType: newCustType,
          phone: newCustPhone,
          creditLimit: Number(newCustLimit),
          paymentTermsDays: Number(newCustTerms)
        })
      });
      setShowAddCustomerModal(false);
      loadCreditData();
    } catch (err: any) {
      alert(`Registration failed: ${err.message}`);
    }
  };

  const customerColumns: Column<any>[] = [
    { key: 'name', header: 'Customer / Organization', render: (row) => <span className="font-bold text-slate-100">{row.name}</span> },
    { key: 'customerType', header: 'Type', render: (row) => <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">{row.customerType}</span> },
    { key: 'phone', header: 'Contact Phone', render: (row) => <span className="font-mono text-xs text-slate-400">{row.phone}</span> },
    { key: 'creditLimit', header: 'Credit Limit', render: (row) => <span className="font-mono text-slate-300">{formatZMW(row.creditLimit)}</span> },
    { key: 'currentBalance', header: 'Owed Balance (AR)', render: (row) => <span className="font-mono font-bold text-rose-400">{formatZMW(row.currentBalance)}</span> },
    { key: 'availableCredit', header: 'Available Headroom', render: (row) => <span className="font-mono font-bold text-emerald-400">{formatZMW(row.availableCredit)}</span> },
    { key: 'paymentTermsDays', header: 'Terms', render: (row) => <span className="text-xs text-slate-400">{row.paymentTermsDays} days</span> }
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
            onClick={() => setShowPayModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-500/20"
          >
            <Banknote className="w-4 h-4" />
            Receive Debt Payment
          </button>

          <button
            onClick={() => setShowAddCustomerModal(true)}
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-white">Record Customer Debt Repayment</h3>
            <p className="text-xs text-slate-400">
              Payment will automatically decrease customer balance and be allocated against unpaid invoices in chronological order.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Customer</label>
                <select
                  value={payCustomerId}
                  onChange={(e) => setPayCustomerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — Owes: {formatZMW(c.currentBalance)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Amount (ZMW)</label>
                  <input
                    type="number"
                    min="1"
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 font-mono font-bold text-emerald-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Method</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value={PaymentMethod.CASH}>Cash</option>
                    <option value={PaymentMethod.AIRTEL_MONEY}>Airtel Money</option>
                    <option value={PaymentMethod.MTN_MOMO}>MTN MoMo</option>
                    <option value={PaymentMethod.BANK_TRANSFER}>Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Payment Reference / Cheque / Txn ID</label>
                <input
                  type="text"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowPayModal(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordRepayment}
                className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/20"
              >
                Post Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-white">Register Credit Customer</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Customer / Organization Name</label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. Lumwana Mining Contractors"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Customer Type</label>
                  <select
                    value={newCustType}
                    onChange={(e) => setNewCustType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="CORPORATE">Corporate</option>
                    <option value="INDIVIDUAL">Individual</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Approved Credit Limit (ZMW)</label>
                  <input
                    type="number"
                    min="0"
                    value={newCustLimit}
                    onChange={(e) => setNewCustLimit(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Payment Terms (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={newCustTerms}
                    onChange={(e) => setNewCustTerms(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowAddCustomerModal(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCustomer}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold rounded-xl shadow-lg shadow-amber-500/20"
              >
                Save Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
