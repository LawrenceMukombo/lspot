import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  Share2,
  Calendar,
  Building,
  CheckCircle,
  Clock,
  Send,
  MessageSquare
} from 'lucide-react';
import { apiRequest } from '../api.js';
import { EnterpriseTable, Column } from '../components/EnterpriseTable.js';
import { formatZMW, RESTAURANT_NAME, RESTAURANT_LOCATION } from '@lspot/shared';

export function InvoicesView() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Consolidated generation modal
  const [showConsolidateModal, setShowConsolidateModal] = useState(false);
  const [targetCustomerId, setTargetCustomerId] = useState('');
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadInvoices();
    loadCustomers();
  }, []);

  const loadInvoices = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest('/invoices');
      if (data) setInvoices(data);
    } catch (e) {
      // Fallback
      setInvoices([
        { id: 'inv-01', invoiceNumber: 'INV-CON-20261019', customer: { name: 'Kalumbila Mining Services Ltd', phone: '+260971112233' }, invoiceType: 'DAILY_CONSOLIDATED', issueDate: '2026-10-19', dueDate: '2026-11-18', totalAmount: 2150, amountPaid: 0, status: 'ISSUED', deliveryStatus: 'DELIVERED' },
        { id: 'inv-02', invoiceNumber: 'INV-20261018-04', customer: { name: 'Manyama Transport & Logistics', phone: '+260964445566' }, invoiceType: 'STANDARD', issueDate: '2026-10-18', dueDate: '2026-11-01', totalAmount: 850, amountPaid: 850, status: 'PAID', deliveryStatus: 'DELIVERED' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const cust = await apiRequest('/credit/customers');
      if (cust) setCustomers(cust);
    } catch (e) {
      setCustomers([
        { id: 'c1', name: 'Kalumbila Mining Services Ltd' },
        { id: 'c2', name: 'Manyama Transport & Logistics' }
      ]);
    }
  };

  const handleGenerateConsolidated = async () => {
    if (!targetCustomerId) {
      alert('Please select a customer');
      return;
    }
    try {
      const inv = await apiRequest('/invoices/consolidate-daily', {
        method: 'POST',
        body: JSON.stringify({ customerId: targetCustomerId, date: targetDate })
      });
      setShowConsolidateModal(false);
      loadInvoices();
      alert(`Consolidated invoice ${inv.invoiceNumber} generated successfully!`);
    } catch (err: any) {
      alert(`Consolidation note: ${err.message}`);
    }
  };

  const handleWhatsAppShare = (inv: any) => {
    const phone = inv.customer?.phone?.replace(/[^0-9]/g, '') || '';
    const text = encodeURIComponent(
      `Hello ${inv.customer?.name},\n\n` +
      `Here is your invoice *${inv.invoiceNumber}* from *${RESTAURANT_NAME}* (Manyama, Zambia):\n` +
      `Total Due: *${formatZMW(inv.totalAmount)}*\n` +
      `Due Date: ${new Date(inv.dueDate).toLocaleDateString()}\n\n` +
      `Thank you for your business!`
    );
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  const columns: Column<any>[] = [
    { key: 'invoiceNumber', header: 'Invoice #', render: (row) => <span className="font-mono font-bold text-amber-400">{row.invoiceNumber}</span> },
    { key: 'customer', header: 'Billed Customer', render: (row) => <span className="font-bold text-slate-100">{row.customer?.name}</span> },
    { key: 'invoiceType', header: 'Type', render: (row) => <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">{row.invoiceType}</span> },
    { key: 'issueDate', header: 'Date', render: (row) => <span className="text-xs font-mono">{new Date(row.issueDate).toLocaleDateString()}</span> },
    { key: 'dueDate', header: 'Due Date', render: (row) => <span className="text-xs font-mono">{new Date(row.dueDate).toLocaleDateString()}</span> },
    { key: 'totalAmount', header: 'Total (ZMW)', render: (row) => <span className="font-mono font-bold text-slate-100">{formatZMW(row.totalAmount)}</span> },
    { key: 'amountPaid', header: 'Paid', render: (row) => <span className="font-mono text-emerald-400">{formatZMW(row.amountPaid)}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span
          className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
            row.status === 'PAID'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : row.status === 'OVERDUE'
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          }`}
        >
          {row.status}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSelectedInvoice(row)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs flex items-center gap-1"
            title="Preview Printable Invoice"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            Print
          </button>
          <button
            onClick={() => handleWhatsAppShare(row)}
            className="p-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded-lg text-xs flex items-center gap-1"
            title="Share via WhatsApp"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            WhatsApp
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Invoicing & Customer Statements</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Daily consolidated billing, itemized PDF layouts, and instant WhatsApp dispatch.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowConsolidateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-amber-500/20"
        >
          <Calendar className="w-4 h-4" />
          Consolidate Daily Credit
        </button>
      </div>

      {/* Enterprise Data Table */}
      <EnterpriseTable
        columns={columns}
        data={invoices}
        title="Customer Invoices Registry"
        searchPlaceholder="Search invoice # or customer..."
        isLoading={isLoading}
      />

      {/* Consolidate Modal */}
      {showConsolidateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-white">Generate Daily Consolidated Credit Invoice</h3>
            <p className="text-xs text-slate-400">
              Aggregates all individual credit meals for the selected date into one clean formal company invoice without duplicate debt.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Customer / Organization</label>
                <select
                  value={targetCustomerId}
                  onChange={(e) => setTargetCustomerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Transaction Business Date</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowConsolidateModal(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateConsolidated}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold rounded-xl shadow-lg shadow-amber-500/20"
              >
                Run Consolidation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Invoice Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Invoice Printable Sheet */}
            <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-slate-200 space-y-5">
              <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-amber-400">{RESTAURANT_NAME}</h3>
                  <p className="text-xs text-slate-400">{RESTAURANT_LOCATION}</p>
                  <p className="text-xs text-slate-400">Tel: +260 97 000 0000 | info@lspot.zm</p>
                </div>
                <div className="text-right">
                  <h4 className="text-lg font-mono font-bold text-white">INVOICE</h4>
                  <p className="font-mono text-xs text-amber-400 font-bold">{selectedInvoice.invoiceNumber}</p>
                  <p className="text-xs text-slate-400 mt-1">Date: {new Date(selectedInvoice.issueDate).toLocaleDateString()}</p>
                  <p className="text-xs text-slate-400">Due: {new Date(selectedInvoice.dueDate).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-900/60 rounded-lg">
                  <p className="font-bold text-slate-400 uppercase tracking-wider mb-1">Billed To:</p>
                  <p className="text-sm font-bold text-white">{selectedInvoice.customer?.name}</p>
                  <p className="text-slate-400">Phone: {selectedInvoice.customer?.phone}</p>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-lg">
                  <p className="font-bold text-slate-400 uppercase tracking-wider mb-1">Invoice Details:</p>
                  <p>Billing Type: <strong>{selectedInvoice.invoiceType}</strong></p>
                  <p>Status: <strong className="text-amber-400">{selectedInvoice.status}</strong></p>
                </div>
              </div>

              <div className="pt-2">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="py-2">Description</th>
                      <th className="py-2 text-right">Amount (ZMW)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    <tr>
                      <td className="py-2.5">
                        <span className="font-semibold text-slate-200">
                          {selectedInvoice.notes || 'Meal Catering Services & Food Orders'}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold">
                        {formatZMW(selectedInvoice.totalAmount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-sm">
                <div>
                  <p className="text-xs text-slate-400">Payment Instructions: Airtel / MTN MoMo or Direct Bank Deposit</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Total Due:</span>
                  <span className="text-xl font-mono font-extrabold text-amber-400">
                    {formatZMW(selectedInvoice.totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm rounded-xl"
              >
                Close
              </button>
              <button
                onClick={() => handleWhatsAppShare(selectedInvoice)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl flex items-center gap-1.5"
              >
                <MessageSquare className="w-4 h-4" />
                Send via WhatsApp
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
