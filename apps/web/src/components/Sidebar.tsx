import React, { useState } from 'react';
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
  ShieldCheck,
  Sliders,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Shield
} from 'lucide-react';
import { isTabAllowedForRole, getPersonaInfo } from '../utils/rbac.js';

export type NavTab =
  | 'dashboard'
  | 'pos'
  | 'sales'
  | 'kitchen'
  | 'inventory'
  | 'menu'
  | 'credit'
  | 'invoices'
  | 'shifts'
  | 'finance'
  | 'zra'
  | 'users'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  userRole?: string;
  onSelectTab: (tab: NavTab) => void;
}

interface NavGroup {
  id: string;
  title: string;
  items: Array<{ id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }>;
}

export function Sidebar({ currentTab, userRole, onSelectTab }: SidebarProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const persona = getPersonaInfo(userRole);

  const rawNavGroups: NavGroup[] = [
    {
      id: 'overview',
      title: 'Executive Overview',
      items: [
        { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard }
      ]
    },
    {
      id: 'front-of-house',
      title: 'Front of House & POS',
      items: [
        { id: 'pos', label: 'Touchscreen POS', icon: ShoppingCart },
        { id: 'sales', label: 'Daily Sales & Reversals', icon: Receipt },
        { id: 'shifts', label: 'Cashier Shifts & Cash', icon: DollarSign }
      ]
    },
    {
      id: 'back-of-house',
      title: 'Kitchen & Inventory',
      items: [
        { id: 'kitchen', label: 'Kitchen Daily Register', icon: ChefHat },
        { id: 'inventory', label: 'Inventory & Stock Ledgers', icon: Package },
        { id: 'menu', label: 'Menu & Recipe Scaler', icon: BookOpen }
      ]
    },
    {
      id: 'finance-compliance',
      title: 'Finance, Credit & Tax',
      items: [
        { id: 'credit', label: 'Customers & Credit Directory', icon: Users },
        { id: 'invoices', label: 'Invoicing & Consolidated', icon: FileText },
        { id: 'finance', label: 'Operating Expenses & P&L', icon: DollarSign },
        { id: 'zra', label: 'ZRA Smart Invoice Compliance', icon: FileCheck2 }
      ]
    },
    {
      id: 'administration',
      title: 'System Administration',
      items: [
        { id: 'users', label: 'Staff & User Management', icon: ShieldCheck },
        { id: 'settings', label: 'Master Reference & Settings', icon: Sliders }
      ]
    }
  ];

  // Role-Based Module Access Control: only show modules and categories assigned to this persona
  const navGroups = rawNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isTabAllowedForRole(item.id, userRole))
    }))
    .filter((group) => group.items.length > 0);

  const totalAllowedModules = navGroups.reduce((acc, g) => acc + g.items.length, 0);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleSelect = (tab: NavTab) => {
    onSelectTab(tab);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full">
      <div className="space-y-3 overflow-y-auto pr-1">
        {/* Active Persona Badge */}
        <div className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 text-amber-400 font-bold">
            <Shield className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">{persona.title}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {totalAllowedModules} assigned module{totalAllowedModules === 1 ? '' : 's'} • Landing: {persona.landingLabel}
          </p>
        </div>

        <nav aria-label="Main Navigation" className="space-y-3">
          {navGroups.map((group) => {
            const isCollapsed = Boolean(collapsedGroups[group.id]);
            return (
              <div key={group.id} className="space-y-1">
                <button
                  type="button"
                  aria-expanded={!isCollapsed}
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <span>{group.title}</span>
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </button>

                {!isCollapsed && (
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = currentTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelect(item.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                            isActive
                              ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20'
                              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                          }`}
                        >
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                          <span className="truncate text-left">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <div className="p-3 mt-4 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-400">
        <div className="flex items-center justify-between text-slate-300 font-semibold mb-1">
          <span>The LSpot Restaurant</span>
          <span className="text-amber-400">v1.0-prod</span>
        </div>
        <p className="text-[11px] text-slate-500">
          Manyama, Kalumbila District, Zambia
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer Toggle Floating Button */}
      <button
        type="button"
        aria-label="Toggle Navigation Menu"
        onClick={() => setMobileOpen((prev) => !prev)}
        className="lg:hidden fixed bottom-4 left-4 z-40 p-3 rounded-2xl bg-amber-500 text-slate-950 shadow-xl shadow-amber-500/30 font-bold flex items-center gap-1.5"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        <span className="text-xs">Menu</span>
      </button>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`w-64 bg-slate-900 border-r border-slate-800 p-3 select-none shrink-0 transition-transform duration-200 z-30 ${
          mobileOpen
            ? 'fixed inset-y-16 left-0 translate-x-0 shadow-2xl'
            : 'hidden lg:flex lg:flex-col'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
