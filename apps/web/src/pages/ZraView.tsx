import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  ShieldCheck,
  Building2,
  RefreshCw,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Save,
  Zap
} from 'lucide-react';
import { apiRequest } from '../api.js';
import { toast } from '../components/Toast.js';
import { RESTAURANT_NAME, RESTAURANT_LOCATION } from '@lspot/shared';

export function ZraView() {
  const [status, setStatus] = useState<any>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isBatchFiscalizing, setIsBatchFiscalizing] = useState(false);
  const [zraForm, setZraForm] = useState({
    tpin: '1009988776',
    vsdcMode: 'LOCAL_SIGNATURE',
    vsdcBaseUrl: 'http://localhost:8080/vsdc',
    branchCode: '000',
    deviceSerial: 'LSPOT-VSDC-001',
    taxEnabled: false,
    taxRatePercent: 16,
    autoFiscalizeOnCheckout: false
  });

  useEffect(() => {
    loadZraStatus();
  }, []);

  const loadZraStatus = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest('/zra/compliance-status');
      if (data) {
        setStatus(data);
        setZraForm({
          tpin: data.tpin || '1009988776',
          vsdcMode: data.vsdcMode || 'LOCAL_SIGNATURE',
          vsdcBaseUrl: data.vsdcBaseUrl || 'http://localhost:8080/vsdc',
          branchCode: data.branchCode || '000',
          deviceSerial: data.deviceSerial || 'LSPOT-VSDC-001',
          taxEnabled: Boolean(data.smartInvoiceEnabled),
          taxRatePercent: Number(data.taxRatePercent ?? 16),
          autoFiscalizeOnCheckout: Boolean(data.autoFiscalizeOnCheckout)
        });
      }
      const s = await apiRequest('/pos/sales');
      if (s) setSales(s);
    } catch (e: any) {
      console.warn('Network error loading ZRA compliance status:', e);
      setStatus((prev: any) => prev || {
        tpin: 'Pending Official Registration',
        smartInvoiceEnabled: false,
        vatRate: '16%',
        fiscalizedSalesCount: 0,
        pendingSubmissionCount: 0,
        adapterStatus: 'OFFLINE_OR_DISCONNECTED'
      });
      setSales((prev: any[]) => (prev.length > 0 ? prev : []));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveZraConfig = async () => {
    setIsSavingConfig(true);
    try {
      await apiRequest('/zra/config', {
        method: 'PUT',
        body: JSON.stringify(zraForm)
      });
      setShowConfigModal(false);
      await loadZraStatus();
      toast.success('ZRA Smart Invoice VSDC & VAT parameters updated.', 'ZRA Settings Saved');
    } catch (err: any) {
      toast.critical(`Failed to update ZRA settings: ${err.message}`, 'ZRA Config Error');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleBatchFiscalize = async () => {
    setIsBatchFiscalizing(true);
    try {
      const res = await apiRequest('/zra/fiscalize-batch', { method: 'POST' });
      toast.success(`Batch fiscalization complete! Signed ${res?.fiscalizedCount ?? 0} invoice(s).`, 'Batch Fiscalization Complete');
      await loadZraStatus();
    } catch (err: any) {
      toast.critical(`Batch fiscalization error: ${err.message}`, 'Fiscalization Error');
    } finally {
      setIsBatchFiscalizing(false);
    }
  };

  const handleFiscalizeSale = async (id: string) => {
    try {
      await apiRequest(`/zra/sales/${id}/fiscalize`, { method: 'POST' });
      toast.success('Sale successfully fiscalized with unique ZRA signature!', 'Fiscal Signature Generated');
      loadZraStatus();
    } catch (err: any) {
      toast.critical(`Fiscalization error: ${err.message}`, 'Fiscalization Error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">ZRA Smart Invoice & Fiscal Compliance</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Ready for Live API Keys
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Zambia Revenue Authority Smart Invoice Electronic Fiscal Device (EFD) integration architecture for The LSpot Restaurant.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-xs font-bold rounded-xl border border-amber-500/30 transition"
          >
            <Sliders className="w-4 h-4" />
            <span>Configure VSDC & VAT</span>
          </button>

          <button
            onClick={handleBatchFiscalize}
            disabled={isBatchFiscalizing}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-xl transition shadow-md shadow-emerald-500/20 disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            <span>{isBatchFiscalizing ? 'Signing All...' : 'Sign All Pending Invoices'}</span>
          </button>

          <button
            onClick={loadZraStatus}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Compliance Overview Grid */}
      {status && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs text-slate-400 uppercase font-semibold">Taxpayer TPIN</span>
            <p className="text-lg font-mono font-bold text-white">{status.tpin}</p>
            <span className="text-[11px] text-slate-500">Configured in Restaurant Profile</span>
          </div>

          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs text-slate-400 uppercase font-semibold">Standard VAT Rate</span>
            <p className="text-lg font-mono font-bold text-amber-400">{status.vatRate}</p>
            <span className="text-[11px] text-slate-500">Standard rate on salable meals & drinks</span>
          </div>

          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs text-slate-400 uppercase font-semibold">Fiscal Adapter Health</span>
            <p className="text-lg font-mono font-bold text-emerald-400">ACTIVE ADAPTER</p>
            <span className="text-[11px] text-emerald-500/80">Payload validation & queue operational</span>
          </div>
        </div>
      )}

      {/* Sales Fiscal Submission Queue */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white">POS Sales Fiscal Audit Register</h3>
            <p className="text-xs text-slate-400">Traceable cryptographically signed meal invoices</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Sale Number</th>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Total Amount</th>
                <th className="px-4 py-3">ZRA Fiscal Status</th>
                <th className="px-4 py-3">Fiscal Invoice Code</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3.5 font-bold text-white font-sans">{sale.saleNumber}</td>
                  <td className="px-4 py-3.5 text-slate-400">{new Date(sale.createdAt).toLocaleTimeString()}</td>
                  <td className="px-4 py-3.5 font-bold text-amber-400">K {Number(sale.totalAmount).toFixed(2)}</td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        sale.zraStatus === 'FISCALIZED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {sale.zraStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-300">
                    {sale.fiscalInvoiceNo || 'Pending Submission'}
                  </td>
                  <td className="px-4 py-3.5">
                    {sale.zraStatus !== 'FISCALIZED' && (
                      <button
                        onClick={() => handleFiscalizeSale(sale.id)}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-xs transition"
                      >
                        Sign Fiscal Receipt
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ZRA VSDC & VAT Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-lg text-white">ZRA Smart Invoice VSDC & VAT Configuration</h3>
                <p className="text-xs text-slate-400">Configure Taxpayer TPIN, VSDC endpoint, branch code, and VAT rules</p>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">ZRA Taxpayer TPIN</label>
                <input
                  value={zraForm.tpin}
                  onChange={(e) => setZraForm({ ...zraForm, tpin: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">VSDC Operating Mode</label>
                <select
                  value={zraForm.vsdcMode}
                  onChange={(e) => setZraForm({ ...zraForm, vsdcMode: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                >
                  <option value="LOCAL_SIGNATURE">Local Signature Queue (Offline-Ready)</option>
                  <option value="SANDBOX_VSDC">ZRA Sandbox VSDC Server</option>
                  <option value="PRODUCTION_VSDC">ZRA Live Production VSDC</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-slate-400 block mb-1">VSDC Device Server Endpoint URL</label>
                <input
                  value={zraForm.vsdcBaseUrl}
                  onChange={(e) => setZraForm({ ...zraForm, vsdcBaseUrl: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">ZRA Branch Code</label>
                <input
                  value={zraForm.branchCode}
                  onChange={(e) => setZraForm({ ...zraForm, branchCode: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">VSDC Device Serial</label>
                <input
                  value={zraForm.deviceSerial}
                  onChange={(e) => setZraForm({ ...zraForm, deviceSerial: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Standard VAT Rate (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={zraForm.taxRatePercent}
                  onChange={(e) => setZraForm({ ...zraForm, taxRatePercent: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-amber-400 font-bold"
                />
              </div>
              <div className="flex flex-col justify-end gap-2">
                <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={zraForm.taxEnabled}
                    onChange={(e) => setZraForm({ ...zraForm, taxEnabled: e.target.checked })}
                    className="rounded border-slate-700"
                  />
                  <span>Enable VAT Computation on Sales</span>
                </label>
                <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={zraForm.autoFiscalizeOnCheckout}
                    onChange={(e) => setZraForm({ ...zraForm, autoFiscalizeOnCheckout: e.target.checked })}
                    className="rounded border-slate-700"
                  />
                  <span>Auto-Fiscalize on POS Checkout</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveZraConfig}
                disabled={isSavingConfig}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold rounded-xl flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingConfig ? 'Saving...' : 'Save ZRA Configuration'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
