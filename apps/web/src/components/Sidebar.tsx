import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  ChefHat,
  Package,
  BookOpen,
  Users,
  FileText,
  DollarSign,
  Receipt,
  FileCheck2,
  Sliders
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'pos'
  | 'kitchen'
  | 'inventory'
  | 'menu'
  | 'credit'
  | 'invoices'
  | 'shifts'
  | 'finance'
  | 'zra';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export function Sidebar({ currentTab, onSelectTab }: SidebarProps) {
  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Executive Dashboard', icon: LayoutDashboard },
    { id: 'pos' as NavTab, label: 'Touchscreen POS', icon: ShoppingCart },
    { id: 'kitchen' as NavTab, label: 'Kitchen Daily Register', icon: ChefHat },
    { id: 'inventory' as NavTab, label: 'Inventory & Stock Ledgers', icon: Package },
    { id: 'menu' as NavTab, label: 'Menu & Recipe Scaler', icon: BookOpen },
    { id: 'credit' as NavTab, label: 'Customer Credit & AR', icon: Users },
    { id: 'invoices' as NavTab, label: 'Invoicing & Consolidated', icon: FileText },
    { id: 'shifts' as NavTab, label: 'Cashier Shifts & Cash', icon: DollarSign },
    { id: 'finance' as NavTab, label: 'Operating Expenses & P&L', icon: Receipt },
    { id: 'zra' as NavTab, label: 'ZRA Smart Invoice Compliance', icon: FileCheck2 }
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-3 select-none">
      <div className="space-y-1">
        <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Core Operations
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                isActive
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-400">
        <div className="flex items-center justify-between text-slate-300 font-semibold mb-1">
          <span>The LSpot Restaurant</span>
          <span className="text-amber-400">v1.0-prod</span>
        </div>
        <p className="text-[11px] text-slate-500">
          Manyama, Kalumbila District, Zambia
        </p>
      </div>
    </aside>
  );
}
