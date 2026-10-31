import React, { useState, useEffect, useRef } from 'react';
import {
  ChefHat,
  PlusCircle,
  AlertOctagon,
  CheckCircle2,
  Lock,
  Layers,
  Utensils,
  Volume2,
  VolumeX,
  Bell,
  Timer,
  Flame,
  Check,
  Clock
} from 'lucide-react';
import { apiRequest } from '../api.js';
import { EnterpriseTable, Column } from '../components/EnterpriseTable.js';
import { DetailDrawer, DetailStat, DetailSection, DetailRows, btn } from '../components/DetailDrawer.js';
import { toast } from '../components/Toast.js';

interface KdsTicket {
  id: string;
  saleNumber: string;
  orderType: string;
  tableNumber?: string;
  items: { name: string; quantity: number; notes?: string }[];
  createdAt: string;
  status: 'QUEUED' | 'COOKING' | 'READY';
}

export function KitchenView() {
  const [register, setRegister] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // KDS Live Orders & Sound Chimes state (real POS orders only — no simulated data)
  const [kdsTickets, setKdsTickets] = useState<KdsTicket[]>([]);
  const [chimeEnabled, setChimeEnabled] = useState(true);
  const [lastChimedTicket, setLastChimedTicket] = useState<string | null>(null);
  // Live ticking timestamp updated every 10 seconds so waiting times tick in real-time
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  useEffect(() => {
    const timerInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(timerInterval);
  }, []);

  // Web Audio Synth Chime for Android POS / KDS devices
  const playKitchenChime = () => {
    if (!chimeEnabled) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const now = ctx.currentTime;

      // Two-tone bright kitchen bell chime (880Hz -> 1320Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.15);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.8);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1760, now + 0.2);
      gain2.gain.setValueAtTime(0.35, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.2);
      osc2.stop(now + 1.2);
    } catch {
      // AudioContext unavailable or blocked by autoplay policy
    }
  };

  useEffect(() => {
    // Listen for incoming POS kitchen ticket events
    const handleNewTicket = (e: any) => {
      const ticketData = e.detail;
      if (ticketData) {
        const newTicket: KdsTicket = {
          id: ticketData.id || `kds-${Date.now()}`,
          saleNumber: ticketData.saleNumber || 'NEW-ORD',
          orderType: ticketData.orderType || 'DINE_IN',
          tableNumber: ticketData.tableNumber,
          items: ticketData.items || [],
          createdAt: ticketData.createdAt || new Date().toISOString(),
          status: 'QUEUED'
        };
        setKdsTickets((prev) => [newTicket, ...prev]);
        setLastChimedTicket(newTicket.saleNumber);
        playKitchenChime();
        setTimeout(() => setLastChimedTicket(null), 4000);
      }
    };

    window.addEventListener('newKitchenTicketFired', handleNewTicket);
    return () => window.removeEventListener('newKitchenTicketFired', handleNewTicket);
  }, [chimeEnabled]);

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

  // Click-to-inspect detail drawer
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const openBatchFor = async (menuItemId?: string) => {
    if (menuItemId) setBatchMenuId(menuItemId);
    setSelectedItem(null);
    if (!register?.id) {
      await loadRegister();
    }
    setShowBatchModal(true);
  };

  const openWasteFor = async (menuItemId?: string) => {
    if (menuItemId) setWasteMenuId(menuItemId);
    setSelectedItem(null);
    if (!register?.id) {
      await loadRegister();
    }
    setShowWasteModal(true);
  };

  useEffect(() => {
    loadRegister();
    loadMenuItems();
    loadActiveKdsTickets();

    // Poll for new live kitchen orders every 10 seconds
    const pollInterval = setInterval(() => {
      loadActiveKdsTickets();
    }, 10000);
    return () => clearInterval(pollInterval);
  }, []);

  const loadActiveKdsTickets = async () => {
    try {
      const todayLusakaStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Lusaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());
      const startOfTodayLusaka = new Date(`${todayLusakaStr}T00:00:00.000+02:00`).getTime();

      const bumpedIds = new Set<string>(JSON.parse(localStorage.getItem('lspot_bumped_kds_ids') || '[]'));

      // Check local storage queue and purge any legacy simulated kds-init-* items or prior-day items
      const localKdsStr = localStorage.getItem('lspot_active_kds_orders');
      let localOrders: KdsTicket[] = [];
      if (localKdsStr) {
        try {
          const parsed = JSON.parse(localKdsStr);
          if (Array.isArray(parsed)) {
            localOrders = parsed.filter(
              (t: any) =>
                t &&
                t.id &&
                !String(t.id).startsWith('kds-init-') &&
                !bumpedIds.has(t.id) &&
                t.status !== 'READY' &&
                t.status !== 'SERVED' &&
                new Date(t.createdAt).getTime() >= startOfTodayLusaka
            );
            localStorage.setItem('lspot_active_kds_orders', JSON.stringify(localOrders));
          }
        } catch {}
      }

      // Fetch real multi-device KDS tickets from backend for today
      const backendKds = await apiRequest('/pos/kds-tickets').catch(() => []);
      const serverTickets: KdsTicket[] = Array.isArray(backendKds)
        ? backendKds.filter(
            (t: any) =>
              t &&
              t.id &&
              !String(t.id).startsWith('kds-init-') &&
              !bumpedIds.has(t.id) &&
              t.status !== 'READY' &&
              t.status !== 'SERVED' &&
              new Date(t.createdAt).getTime() >= startOfTodayLusaka
          )
        : [];

      // Merge local and server tickets avoiding duplicate IDs
      const combined = [...localOrders];
      const existingIds = new Set(combined.map((t) => t.id));
      for (const st of serverTickets) {
        if (!existingIds.has(st.id)) {
          combined.push(st);
          existingIds.add(st.id);
        }
      }

      setKdsTickets(combined);
    } catch (e) {
      console.warn('Error loading KDS orders:', e);
    }
  };

  const loadRegister = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest('/kitchen/registers/today');
      if (res) {
        setRegister(res);
        setSelectedItem((prev: any) => {
          if (!prev) return null;
          const prevMenuId = prev.menuItemId || prev.menuItem?.id;
          return (res.items || []).find((i: any) => (i.menuItemId || i.menuItem?.id) === prevMenuId) || prev;
        });
        window.dispatchEvent(new CustomEvent('kitchenRegisterUpdated'));
      }
    } catch (e: any) {
      console.warn('Network error loading today kitchen register:', e);
      setRegister(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMenuItems = async () => {
    try {
      const items = await apiRequest('/menu/items');
      if (items) setMenuItems(items);
    } catch (e: any) {
      console.warn('Network error loading menu items for kitchen batch:', e);
      setMenuItems([]);
    }
  };

  const handleRecordBatch = async () => {
    if (!batchMenuId) {
      toast.warning('Please select a menu dish to record a cooking batch.', 'Menu Dish Required');
      return;
    }

    try {
      let activeRegister = register;
      if (!activeRegister?.id) {
        // Fetch or auto-open today's register
        activeRegister = await apiRequest('/kitchen/registers/today');
        if (activeRegister) setRegister(activeRegister);
      }

      if (!activeRegister?.id) {
        toast.critical('Active kitchen register could not be initialized. Please check network connection.', 'Kitchen Register Error');
        return;
      }

      await apiRequest('/kitchen/batches', {
        method: 'POST',
        body: JSON.stringify({
          registerId: activeRegister.id,
          menuItemId: batchMenuId,
          plannedPortions: Number(plannedPortions),
          actualPreparedPortions: Number(actualPortions),
          notes: batchNotes
        })
      });
      setShowBatchModal(false);
      toast.success(`Recorded cooking batch of ${actualPortions} portions.`, 'Cooking Batch Logged');
      loadRegister();
    } catch (err: any) {
      toast.critical(`Failed to record batch: ${err.message}`, 'Batch Recording Failed');
    }
  };

  const handleRecordWaste = async () => {
    if (!wasteMenuId) {
      toast.warning('Please select a menu dish to log waste or staff meal.', 'Menu Dish Required');
      return;
    }
    try {
      let activeRegister = register;
      if (!activeRegister?.id) {
        activeRegister = await apiRequest('/kitchen/registers/today');
        if (activeRegister) setRegister(activeRegister);
      }

      if (!activeRegister?.id) {
        toast.critical('Active kitchen register could not be initialized.', 'Kitchen Register Error');
        return;
      }

      await apiRequest('/kitchen/waste', {
        method: 'POST',
        body: JSON.stringify({
          registerId: activeRegister.id,
          menuItemId: wasteMenuId,
          portionsWasted: Number(wastePortions),
          wasteReason,
          isStaffMeal: wasteType === 'STAFF',
          isComplimentary: wasteType === 'COMPLIMENTARY'
        })
      });
      setShowWasteModal(false);
      toast.info(`Logged ${wastePortions} portion(s) under ${wasteType} (${wasteReason}).`, 'Portion Deduction Logged');
      loadRegister();
    } catch (err: any) {
      toast.critical(`Failed to record waste: ${err.message}`, 'Waste Logging Error');
    }
  };

  const handleCloseRegister = async () => {
    try {
      let activeRegister = register;
      if (!activeRegister?.id) {
        activeRegister = await apiRequest('/kitchen/registers/today');
        if (activeRegister) setRegister(activeRegister);
      }

      if (!activeRegister?.id) {
        toast.warning('No active kitchen register found to close.', 'No Open Register');
        return;
      }

      await apiRequest('/kitchen/registers/close', {
        method: 'POST',
        body: JSON.stringify({
          registerId: activeRegister.id,
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
      toast.success('Daily kitchen register reconciled and closed successfully.', 'Kitchen Register Closed');
    } catch (err: any) {
      toast.critical(`Failed to close register: ${err.message}`, 'Register Close Error');
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
        <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30 font-mono font-bold text-xs shadow-sm">
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
              {register?.businessDate && (
                <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold bg-slate-800 text-amber-400 border border-slate-700">
                  Date: {String(register.businessDate).split('T')[0]}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Strict daily portion accounting: Prepared Today - POS Sales - Waste - Staff Meals = Remaining Portions (unsold day-end portions become waste)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setChimeEnabled(!chimeEnabled);
              if (!chimeEnabled) playKitchenChime();
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition border ${
              chimeEnabled
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {chimeEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
            <span>KDS Chimes: {chimeEnabled ? 'ON' : 'MUTED'}</span>
          </button>

          <button
            onClick={() => openBatchFor()}
            disabled={register?.status === 'CLOSED'}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-amber-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            Record Cooking Batch
          </button>

          <button
            onClick={() => openWasteFor()}
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

      {/* KDS Live Kitchen Order Tickets Screen with Waiting Time Color-Coding */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Flame className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-extrabold text-base text-white">Live Kitchen Display System (KDS)</h3>
              <p className="text-xs text-slate-400">Color-coded waiting times: &lt;10m Normal, 10–20m Warning, &gt;20m Delayed Overdue</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> &lt;10 min (Fresh)
            </span>
            <span className="flex items-center gap-1 text-amber-400 ml-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> 10–20 min (Attention)
            </span>
            <span className="flex items-center gap-1 text-rose-400 ml-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span> &gt;20 min (Urgent)
            </span>
          </div>
        </div>

        {kdsTickets.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-slate-800 text-slate-500 text-xs">
            No pending tickets. The kitchen line is clear!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {kdsTickets.map((ticket) => {
              const diffMs = Math.max(0, currentTime - new Date(ticket.createdAt).getTime());
              const diffSeconds = Math.floor(diffMs / 1000);
              const elapsedMinutes = Math.floor(diffSeconds / 60);
              const displayTime =
                elapsedMinutes < 1
                  ? `${Math.max(5, diffSeconds)}s ago`
                  : `${elapsedMinutes}m ago`;

              let timerColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
              let badgeColor = 'bg-emerald-500';
              let isDelayed = false;

              if (elapsedMinutes >= 20) {
                timerColor = 'bg-rose-500/20 text-rose-400 border-rose-500/50 animate-pulse';
                badgeColor = 'bg-rose-500';
                isDelayed = true;
              } else if (elapsedMinutes >= 10) {
                timerColor = 'bg-amber-500/15 text-amber-400 border-amber-500/40';
                badgeColor = 'bg-amber-500';
              }

              return (
                <div
                  key={ticket.id}
                  className={`bg-slate-950/80 border rounded-2xl p-4 flex flex-col justify-between transition-all ${
                    isDelayed ? 'border-rose-500 shadow-lg shadow-rose-950/50' : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-white text-base">{ticket.saleNumber}</span>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {ticket.orderType}
                          </span>
                        </div>
                        {ticket.tableNumber && (
                          <span className="text-xs font-semibold text-amber-400 block mt-0.5">{ticket.tableNumber}</span>
                        )}
                        <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
                          {new Date(ticket.createdAt).toLocaleString('en-GB', {
                            timeZone: 'Africa/Lusaka',
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </span>
                      </div>

                      <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-mono font-bold ${timerColor}`}>
                        <Timer className="w-3.5 h-3.5" />
                        <span>{displayTime}</span>
                      </div>
                    </div>

                    {/* Ticket Items */}
                    <div className="space-y-2">
                      {ticket.items.map((it, idx) => (
                        <div key={idx} className="flex items-start justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-100">{it.quantity}x {it.name}</span>
                            {it.notes && (
                              <p className="text-[11px] text-amber-400 italic mt-0.5 font-medium">↳ {it.notes}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions for Head Cook */}
                  <div className="pt-3 border-t border-slate-800 flex items-center gap-2 mt-4">
                    {ticket.status !== 'COOKING' ? (
                      <button
                        onClick={() => {
                          setKdsTickets((prev) =>
                            prev.map((t) => (t.id === ticket.id ? { ...t, status: 'COOKING' } : t))
                          );
                          apiRequest(`/pos/kds-tickets/${encodeURIComponent(ticket.id)}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ status: 'COOKING', ticketData: { ...ticket, status: 'COOKING' } })
                          }).catch(() => {});
                        }}
                        className="flex-1 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                      >
                        <Flame className="w-3.5 h-3.5" />
                        <span>Start Cooking</span>
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1 px-2 py-1 bg-amber-500/10 rounded">
                        <Flame className="w-3.5 h-3.5 animate-bounce" /> On The Grill
                      </span>
                    )}

                    <button
                      onClick={() => {
                        const bumped = JSON.parse(localStorage.getItem('lspot_bumped_kds_ids') || '[]');
                        bumped.push(ticket.id);
                        localStorage.setItem('lspot_bumped_kds_ids', JSON.stringify(bumped));
                        const localOrders = JSON.parse(localStorage.getItem('lspot_active_kds_orders') || '[]');
                        const filtered = localOrders.filter((t: any) => t.id !== ticket.id);
                        localStorage.setItem('lspot_active_kds_orders', JSON.stringify(filtered));
                        setKdsTickets((prev) => prev.filter((t) => t.id !== ticket.id));
                        apiRequest(`/pos/kds-tickets/${encodeURIComponent(ticket.id)}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ status: 'SERVED', ticketData: { ...ticket, status: 'SERVED' } })
                        }).catch(() => {});
                      }}
                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-md shadow-emerald-950"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Ready / Bump</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Enterprise Data Table */}
      <EnterpriseTable
        columns={columns}
        data={register?.items || []}
        title="Today's Meal Preparation & Sales Balance"
        searchPlaceholder="Search cooked dishes..."
        isLoading={isLoading}
        onRowClick={(row) => setSelectedItem(row)}
      />

      {/* Register Line Detail Drawer */}
      <DetailDrawer
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.menuItem?.name || 'Register Item'}
        subtitle={`${selectedItem?.menuItem?.portionSize || ''} • Business date ${register?.businessDate ? String(register.businessDate).split('T')[0] : ''}`}
        icon={<Utensils className="w-5 h-5" />}
        badge={
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${register?.status === 'CLOSED' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
            {register?.status || 'OPEN'}
          </span>
        }
        actions={
          register?.status !== 'CLOSED' && (
            <>
              <button id="kitchen-detail-waste" className={btn.secondary} onClick={() => openWasteFor(selectedItem?.menuItemId || selectedItem?.menuItem?.id)}>
                <AlertOctagon className="w-4 h-4 text-rose-400" /> Record Waste / Staff Meal
              </button>
              <button id="kitchen-detail-batch" className={btn.primary} onClick={() => openBatchFor(selectedItem?.menuItemId || selectedItem?.menuItem?.id)}>
                <PlusCircle className="w-4 h-4" /> Add Cooking Batch
              </button>
            </>
          )
        }
      >
        {selectedItem && (() => {
          const menuId = selectedItem.menuItemId || selectedItem.menuItem?.id;
          const batches = (register?.batches || []).filter((b: any) => b.menuItemId === menuId);
          const available = Number(selectedItem.openingPortions) + Number(selectedItem.preparedPortions);
          const consumed = Number(selectedItem.soldPortions) + Number(selectedItem.wastePortions) + Number(selectedItem.staffMealPortions) + Number(selectedItem.complimentaryPortions);
          const sellThrough = available > 0 ? Math.round((Number(selectedItem.soldPortions) / available) * 100) : 0;
          const price = Number(selectedItem.menuItem?.sellingPrice || 0);
          return (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <DetailStat label="Opening" value={selectedItem.openingPortions} />
                <DetailStat label="Prepared" value={`+${selectedItem.preparedPortions}`} tone="good" />
                <DetailStat label="Sold (POS)" value={`-${selectedItem.soldPortions}`} tone="warn" />
                <DetailStat label="Kitchen Waste" value={selectedItem.wastePortions} tone="bad" />
                <DetailStat label="Staff Meals" value={selectedItem.staffMealPortions} tone="accent" />
                <DetailStat label="Complimentary" value={selectedItem.complimentaryPortions} />
              </div>

              <DetailSection title="Portion Balance">
                <DetailRows
                  rows={[
                    ['Total available (opening + cooked)', `${available} portions`],
                    ['Total consumed', `${consumed} portions`],
                    ['Remaining for sale', <strong className="text-amber-300">{selectedItem.remainingPortions} portions</strong>],
                    ['Sell-through rate', `${sellThrough}%`],
                    ...(price > 0 ? [['Sales value (sold × price)', `K ${(price * Number(selectedItem.soldPortions)).toFixed(2)}`] as [string, React.ReactNode]] : []),
                    ['Notes', selectedItem.notes || '—']
                  ]}
                />
                <div className="mt-3 h-2 rounded-full bg-slate-800 overflow-hidden flex">
                  <div className="bg-amber-500" style={{ width: `${available ? (selectedItem.soldPortions / available) * 100 : 0}%` }} title="Sold" />
                  <div className="bg-rose-500" style={{ width: `${available ? (selectedItem.wastePortions / available) * 100 : 0}%` }} title="Waste" />
                  <div className="bg-sky-500" style={{ width: `${available ? (selectedItem.staffMealPortions / available) * 100 : 0}%` }} title="Staff meals" />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Amber = sold • Rose = waste • Blue = staff meals • Grey = remaining</p>
              </DetailSection>

              <DetailSection title={`Cooking Batches Today (${batches.length})`}>
                {batches.length === 0 ? (
                  <p className="text-sm text-slate-500 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl p-4 text-center">
                    No cooking batches recorded for this dish today.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {batches.map((b: any) => {
                      const batchTimestamp = b.preparedAt || b.createdAt;
                      const formattedDateTime = batchTimestamp
                        ? new Date(batchTimestamp).toLocaleString('en-GB', {
                            timeZone: 'Africa/Lusaka',
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })
                        : '—';
                      return (
                        <li key={b.id} className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 text-sm">
                          <div className="flex justify-between items-center gap-2">
                            <span className="font-mono text-xs text-slate-400">{formattedDateTime}</span>
                            <span className="font-mono text-emerald-400 font-bold">+{b.actualPreparedPortions} cooked</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">Planned {b.plannedPortions} • Yield {b.plannedPortions ? Math.round((b.actualPreparedPortions / b.plannedPortions) * 100) : 0}%</p>
                          {b.notes && <p className="text-xs text-slate-300 mt-1 break-words">{b.notes}</p>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </DetailSection>
            </>
          );
        })()}
      </DetailDrawer>

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
