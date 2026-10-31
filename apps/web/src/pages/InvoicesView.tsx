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
  MessageSquare,
  Mail,
  Copy,
  Check
} from 'lucide-react';
import { apiRequest } from '../api.js';
import { EnterpriseTable, Column } from '../components/EnterpriseTable.js';
import { toast } from '../components/Toast.js';
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

  // Edit Invoice modal
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  const [invForm, setInvForm] = useState({
    invoiceNumber: '',
    customerId: '',
    invoiceType: 'CONSOLIDATED',
    issueDate: '',
    dueDate: '',
    totalAmount: 0,
    amountPaid: 0,
    status: 'ISSUED',
    notes: ''
  });

  const openEditInvoice = (inv: any) => {
    setEditingInvoice(inv);
    setInvForm({
      invoiceNumber: inv.invoiceNumber || '',
      customerId: inv.customerId || inv.customer?.id || '',
      invoiceType: inv.invoiceType || 'CONSOLIDATED',
      issueDate: inv.issueDate ? new Date(inv.issueDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      totalAmount: Number(inv.totalAmount || 0),
      amountPaid: Number(inv.amountPaid || 0),
      status: inv.status || 'ISSUED',
      notes: inv.notes || ''
    });
  };

  const handleSaveInvoice = async () => {
    if (!editingInvoice) return;
    try {
      await apiRequest(`/invoices/${editingInvoice.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          invoiceNumber: invForm.invoiceNumber,
          customerId: invForm.customerId,
          invoiceType: invForm.invoiceType,
          issueDate: invForm.issueDate,
          dueDate: invForm.dueDate,
          subtotal: Number(invForm.totalAmount),
          totalAmount: Number(invForm.totalAmount),
          amountPaid: Number(invForm.amountPaid),
          status: invForm.status,
          notes: invForm.notes || null
        })
      });
      toast.success(`Invoice ${invForm.invoiceNumber} updated.`, 'Invoice Updated');
      setEditingInvoice(null);
      loadInvoices();
    } catch (err: any) {
      toast.critical(`Failed to update invoice: ${err.message}`, 'Invoice Update Error');
    }
  };

  useEffect(() => {
    loadInvoices();
    loadCustomers();
  }, []);

  const loadInvoices = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest('/invoices');
      if (data) setInvoices(data);
    } catch (e: any) {
      console.warn('Network error loading invoices:', e);
      setInvoices((prev) => (prev.length > 0 ? prev : []));
    } finally {
      setIsLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const cust = await apiRequest('/credit/customers');
      if (cust) setCustomers(cust);
    } catch (e: any) {
      console.warn('Network error loading customers for invoices:', e);
      setCustomers((prev) => (prev.length > 0 ? prev : []));
    }
  };

  const handleGenerateConsolidated = async () => {
    if (!targetCustomerId) {
      toast.warning('Please select a corporate or individual customer account.', 'Customer Selection Required');
      return;
    }
    try {
      const inv = await apiRequest('/invoices/consolidate-daily', {
        method: 'POST',
        body: JSON.stringify({ customerId: targetCustomerId, date: targetDate })
      });
      setShowConsolidateModal(false);
      loadInvoices();
      toast.success(`Consolidated invoice ${inv.invoiceNumber} generated successfully.`, 'Invoice Generated');
    } catch (err: any) {
      toast.info(`${err.message}`, 'Invoice Consolidation Notice');
    }
  };

  const handleWhatsAppShare = (inv: any) => {
    const phone = inv.customer?.phone?.replace(/[^0-9]/g, '') || '';
    const text = encodeURIComponent(
      `Hello ${inv.customer?.name},\n\n` +
      `Here is your invoice *${inv.invoiceNumber}* from *${RESTAURANT_NAME}* (Manyama, Zambia):\n` +
      `Total Due: *${formatZMW(inv.totalAmount)}*\n` +
      `Due Date: ${new Date(inv.dueDate).toLocaleDateString()}\n\n` +
      `Payment Options: Airtel Money / MTN MoMo or Direct Bank Deposit.\n` +
      `Thank you for your business!`
    );
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  const handleEmailShare = (inv: any) => {
    const email = inv.customer?.email || 'finance@client.zm';
    const subject = encodeURIComponent(`Invoice ${inv.invoiceNumber} from ${RESTAURANT_NAME}`);
    const body = encodeURIComponent(
      `Dear ${inv.customer?.name},\n\n` +
      `Please find details of your invoice ${inv.invoiceNumber} issued by ${RESTAURANT_NAME} (Manyama, Zambia):\n\n` +
      `Invoice Number: ${inv.invoiceNumber}\n` +
      `Issue Date: ${new Date(inv.issueDate).toLocaleDateString()}\n` +
      `Due Date: ${new Date(inv.dueDate).toLocaleDateString()}\n` +
      `Total Amount Due: ${formatZMW(inv.totalAmount)}\n` +
      `Amount Paid: ${formatZMW(inv.amountPaid)}\n` +
      `Status: ${inv.status}\n\n` +
      `Payment Instructions:\n` +
      `- Airtel Money Merchant / MTN MoMo\n` +
      `- Standard Bank Transfer (Reference: ${inv.invoiceNumber})\n\n` +
      `Thank you for dining with us.\n\n` +
      `Best regards,\nAccounts Department\n${RESTAURANT_NAME}, Manyama, Kalumbila, Zambia`
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
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
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedInvoice(row);
            }}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition"
            title="Preview Printable Invoice"
          >
            <Printer className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Print</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleWhatsAppShare(row);
            }}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:border dark:border-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
            title="Share via WhatsApp"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEmailShare(row);
            }}
            className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white dark:bg-sky-950 dark:hover:bg-sky-900 dark:border dark:border-sky-800 dark:text-sky-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
            title="Send via Email"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email</span>
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
        onRowClick={(row) => setSelectedInvoice(row)}
        onEditRow={openEditInvoice}
        canEdit={true}
      />

      {/* Edit Invoice Modal */}
      {editingInvoice && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-white">Edit Invoice — {editingInvoice.invoiceNumber}</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Invoice Number</label>
                  <input
                    type="text"
                    value={invForm.invoiceNumber}
                    onChange={(e) => setInvForm({ ...invForm, invoiceNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-amber-400 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Invoice Type</label>
                  <select
                    value={invForm.invoiceType}
                    onChange={(e) => setInvForm({ ...invForm, invoiceType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="SINGLE">SINGLE</option>
                    <option value="CONSOLIDATED">CONSOLIDATED</option>
                    <option value="MONTHLY">MONTHLY</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Billed Customer</label>
                <select
                  value={invForm.customerId}
                  onChange={(e) => setInvForm({ ...invForm, customerId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={invForm.issueDate}
                    onChange={(e) => setInvForm({ ...invForm, issueDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Due Date</label>
                  <input
                    type="date"
                    value={invForm.dueDate}
                    onChange={(e) => setInvForm({ ...invForm, dueDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Total (ZMW)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={invForm.totalAmount}
                    onChange={(e) => setInvForm({ ...invForm, totalAmount: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Paid (ZMW)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={invForm.amountPaid}
                    onChange={(e) => setInvForm({ ...invForm, amountPaid: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-emerald-400 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Status</label>
                  <select
                    value={invForm.status}
                    onChange={(e) => setInvForm({ ...invForm, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="ISSUED">ISSUED</option>
                    <option value="PARTIAL">PARTIAL</option>
                    <option value="PAID">PAID</option>
                    <option value="OVERDUE">OVERDUE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Invoice Description / Notes</label>
                <textarea
                  rows={2}
                  value={invForm.notes}
                  onChange={(e) => setInvForm({ ...invForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setEditingInvoice(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveInvoice}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold rounded-xl"
              >
                Save Invoice
              </button>
            </div>
          </div>
        </div>
      )}

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
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl flex items-center gap-1.5 shadow-md"
              >
                <MessageSquare className="w-4 h-4" />
                Send via WhatsApp
              </button>
              <button
                onClick={() => handleEmailShare(selectedInvoice)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm rounded-xl flex items-center gap-1.5 shadow-md"
              >
                <Mail className="w-4 h-4" />
                Send via Email
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl flex items-center gap-1.5 shadow-md"
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
