import { UserRole } from '@lspot/shared';
import { NavTab } from '../components/Sidebar.js';

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  role: string;
  tenantId?: string;
  branchId?: string;
}

export function getCurrentUserProfile(): UserProfile | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('lspot_user_profile') || localStorage.getItem('lspot_user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Returns the default landing module tailored to each persona's primary operational focus.
 */
export function getDefaultLandingTab(role?: string): NavTab {
  const normalized = (role || '').toUpperCase();

  switch (normalized) {
    case UserRole.CASHIER:
      // Cashiers immediately land on the Touchscreen POS
      return 'pos';

    case UserRole.CHEF:
    case UserRole.KITCHEN_ASSISTANT:
      // Kitchen personnel immediately land on the Kitchen Daily Register / KDS
      return 'kitchen';

    case UserRole.STOREKEEPER:
      // Inventory storekeepers immediately land on Perpetual Inventory & Stock Ledgers
      return 'inventory';

    case UserRole.ACCOUNTANT:
      // Accountants land on Operating Expenses & Financials (or Invoicing)
      return 'finance';

    case UserRole.AUDITOR:
      return 'dashboard';

    case UserRole.MANAGER:
    case UserRole.OWNER:
    case UserRole.SUPER_ADMIN:
    default:
      // Management & Administration personas land on the Executive Dashboard
      return 'dashboard';
  }
}

/**
 * Role-Based Access Control matrix defining allowed modules for each staff persona.
 */
const ROLE_PERMISSIONS_MAP: Record<string, NavTab[]> = {
  [UserRole.SUPER_ADMIN]: [
    'dashboard',
    'pos',
    'sales',
    'shifts',
    'kitchen',
    'inventory',
    'menu',
    'credit',
    'invoices',
    'finance',
    'zra',
    'users',
    'settings'
  ],
  [UserRole.OWNER]: [
    'dashboard',
    'pos',
    'sales',
    'shifts',
    'kitchen',
    'inventory',
    'menu',
    'credit',
    'invoices',
    'finance',
    'zra',
    'users',
    'settings'
  ],
  [UserRole.MANAGER]: [
    'dashboard',
    'pos',
    'sales',
    'shifts',
    'kitchen',
    'inventory',
    'menu',
    'credit',
    'invoices',
    'finance',
    'zra',
    'users',
    'settings'
  ],
  [UserRole.ACCOUNTANT]: [
    'dashboard',
    'sales',
    'shifts',
    'credit',
    'invoices',
    'finance',
    'zra',
    'inventory',
    'menu'
  ],
  [UserRole.CASHIER]: [
    'pos',
    'sales',
    'shifts',
    'credit',
    'menu'
  ],
  [UserRole.CHEF]: [
    'kitchen',
    'menu',
    'inventory'
  ],
  [UserRole.KITCHEN_ASSISTANT]: [
    'kitchen',
    'menu',
    'inventory'
  ],
  [UserRole.STOREKEEPER]: [
    'inventory',
    'kitchen',
    'menu'
  ],
  [UserRole.AUDITOR]: [
    'dashboard',
    'sales',
    'shifts',
    'credit',
    'invoices',
    'finance',
    'zra',
    'inventory'
  ]
};

/**
 * Determines whether a given module/tab is allowed for a user role.
 */
export function isTabAllowedForRole(tab: NavTab, role?: string): boolean {
  if (!role) return true;
  const normalized = role.toUpperCase();
  const allowedTabs = ROLE_PERMISSIONS_MAP[normalized];
  if (!allowedTabs) {
    // Fallback: if role is unknown or manager/admin variant, permit access
    return true;
  }
  return allowedTabs.includes(tab);
}

/**
 * Returns user-friendly persona title and landing description.
 */
export function getPersonaInfo(role?: string): { title: string; landingTab: NavTab; landingLabel: string } {
  const landingTab = getDefaultLandingTab(role);
  const normalized = (role || '').toUpperCase();

  switch (normalized) {
    case UserRole.CASHIER:
      return { title: 'POS Cashier & Till', landingTab, landingLabel: 'Touchscreen POS' };
    case UserRole.CHEF:
      return { title: 'Head Chef / Cook', landingTab, landingLabel: 'Kitchen Daily Register' };
    case UserRole.KITCHEN_ASSISTANT:
      return { title: 'Kitchen Assistant', landingTab, landingLabel: 'Kitchen Daily Register' };
    case UserRole.STOREKEEPER:
      return { title: 'Inventory Storekeeper', landingTab, landingLabel: 'Perpetual Inventory & Stock' };
    case UserRole.ACCOUNTANT:
      return { title: 'Finance Accountant', landingTab, landingLabel: 'Operating Expenses & Financials' };
    case UserRole.AUDITOR:
      return { title: 'Internal Auditor', landingTab, landingLabel: 'Executive Overview' };
    case UserRole.MANAGER:
      return { title: 'Restaurant Manager', landingTab, landingLabel: 'Executive Dashboard' };
    case UserRole.OWNER:
      return { title: 'Owner / Executive Director', landingTab, landingLabel: 'Executive Dashboard' };
    case UserRole.SUPER_ADMIN:
    default:
      return { title: 'System Administrator', landingTab, landingLabel: 'Executive Dashboard' };
  }
}

