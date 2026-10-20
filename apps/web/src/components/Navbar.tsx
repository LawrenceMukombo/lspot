import React, { useState, useEffect } from 'react';
import {
  UtensilsCrossed,
  Wifi,
  Clock,
  MapPin,
  Coins,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { RESTAURANT_NAME, RESTAURANT_LOCATION } from '@lspot/shared';

interface NavbarProps {
  activeShift?: any;
}

export function Navbar({ activeShift }: NavbarProps) {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-GB', {
          timeZone: 'Africa/Lusaka',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between z-20 sticky top-0 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950">
          <UtensilsCrossed className="w-5 h-5 font-bold" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white tracking-wide">
              {RESTAURANT_NAME}
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Enterprise POS & ERP
            </span>
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-amber-500" />
            {RESTAURANT_LOCATION}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Active Shift Indicator */}
        {activeShift ? (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-950/60 border border-emerald-800/80 rounded-lg text-xs text-emerald-400">
            <Coins className="w-3.5 h-3.5" />
            <span>Shift Active: <strong>{activeShift.cashier?.fullName || 'Cashier'}</strong></span>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-amber-950/60 border border-amber-800/80 rounded-lg text-xs text-amber-400">
            <Coins className="w-3.5 h-3.5" />
            <span>No Shift Open</span>
          </div>
        )}

        {/* Africa/Lusaka Clock */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300">
          <Clock className="w-3.5 h-3.5 text-amber-500" />
          <span>{timeStr} (Lusaka)</span>
        </div>

        {/* Online Status */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/40 border border-emerald-900 rounded-lg text-xs text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-medium">Online</span>
        </div>

        {/* User Badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 font-semibold text-xs">
            MB
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-semibold text-slate-200">Mulenga Banda</p>
            <p className="text-[10px] text-slate-400">Restaurant Manager</p>
          </div>
        </div>
      </div>
    </header>
  );
}
