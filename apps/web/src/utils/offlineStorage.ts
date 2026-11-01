/**
 * Enterprise Offline Storage & Cache Manager for The LSpot POS
 * Designed for low-connectivity environments (Manyama, Northwestern Province, Zambia).
 * Caches live catalog, customer balances, active shift, kitchen registers, and synchronizes offline orders.
 */

const STORAGE_KEYS = {
  CATALOG: 'lspot_offline_catalog',
  CATEGORIES: 'lspot_offline_categories',
  CUSTOMERS: 'lspot_offline_customers',
  ACTIVE_SHIFT: 'lspot_offline_active_shift',
  OUTBOX_QUEUE: 'lspot_offline_sales_queue',
  MUTATIONS_QUEUE: 'lspot_offline_mutation_outbox',
  INVENTORY: 'lspot_offline_inventory_items',
  EXPENSES: 'lspot_offline_expenses',
  INVOICES: 'lspot_offline_invoices',
  KITCHEN_REGISTER: 'lspot_offline_kitchen_register',
  KDS_ORDERS: 'lspot_active_kds_orders',
  RECENT_SALES: 'lspot_offline_recent_sales',
  STAFF_ROSTER: 'lspot_cached_staff_roster'
};

export interface CachedCatalog {
  categories: Array<{ id: string; name: string }>;
  items: any[];
  timestamp: number;
}

export interface CachedCustomer {
  id: string;
  name: string;
  phone?: string;
  availableCredit: number;
  creditLimit: number;
  currentBalance?: number;
}

export interface QueuedSale {
  id: string;
  createdAt: string;
  payload: any;
  retryCount: number;
}

export const DEFAULT_OFFLINE_CATEGORIES = [
  { id: 'cat-grills', name: 'Mains & Grills' },
  { id: 'cat-traditional', name: 'Traditional Stews' },
  { id: 'cat-breakfast', name: 'Breakfast & Quick Bites' },
  { id: 'cat-sides', name: 'Side Dishes & Starches' },
  { id: 'cat-drinks', name: 'Beverages & Cold Beers' }
];

export const DEFAULT_OFFLINE_ITEMS: any[] = [
  { id: 'm-tbone', name: 'Charcoal Grilled T-Bone Steak', categoryId: 'cat-grills', sellingPrice: 120, department: 'KITCHEN', description: '350g tender Zambian beef cut served with chips or nshima' },
  { id: 'm-qtrchk', name: 'Quarter Chicken & Chips', categoryId: 'cat-grills', sellingPrice: 65, department: 'KITCHEN', description: 'Flame grilled peri-peri or lemon herb quarter chicken' },
  { id: 'm-halfchk', name: 'Half Chicken & Chips', categoryId: 'cat-grills', sellingPrice: 110, department: 'KITCHEN', description: 'Slow cooked flame grilled half chicken' },
  { id: 'm-vilchk', name: 'Village Chicken & Nshima', categoryId: 'cat-traditional', sellingPrice: 85, department: 'KITCHEN', description: 'Traditional free-range chicken simmered in rich tomato gravy' },
  { id: 'm-beefstew', name: 'Beef Stew & Nshima', categoryId: 'cat-traditional', sellingPrice: 55, department: 'KITCHEN', description: 'Hearty slow-cooked beef stew with greens' },
  { id: 'm-bream', name: 'Fried Tilapia Bream & Nshima', categoryId: 'cat-traditional', sellingPrice: 95, department: 'KITCHEN', description: 'Crispy whole Kafue bream with relish' },
  { id: 'm-breakfast', name: 'Full English Breakfast', categoryId: 'cat-breakfast', sellingPrice: 60, department: 'KITCHEN', description: 'Eggs, beef sausage, baked beans, toast & grilled tomato' },
  { id: 'm-chips', name: 'Crispy Fried Potato Chips', categoryId: 'cat-sides', sellingPrice: 25, department: 'KITCHEN', description: 'Freshly cut seasoned Irish potato chips' },
  { id: 'm-nshima', name: 'Extra Plate of Nshima', categoryId: 'cat-sides', sellingPrice: 15, department: 'KITCHEN', description: 'Steaming hot Zambian breakfast mealie meal nshima' },
  { id: 'm-greens', name: 'Chibwabwa in Groundnut Sauce', categoryId: 'cat-sides', sellingPrice: 20, department: 'KITCHEN', description: 'Tender pumpkin leaves stewed in peanut sauce' },
  { id: 'm-mosi', name: 'Mosi Premium Lager 375ml', categoryId: 'cat-drinks', sellingPrice: 25, department: 'BAR', description: 'Truly Zambian golden lager, chilled' },
  { id: 'm-castlelite', name: 'Castle Lite 330ml Can', categoryId: 'cat-drinks', sellingPrice: 28, department: 'BAR', description: 'Extra cold lager' },
  { id: 'm-windhoek', name: 'Windhoek Draught 440ml', categoryId: 'cat-drinks', sellingPrice: 35, department: 'BAR', description: '100% pure malt beer' },
  { id: 'm-coke', name: 'Coca-Cola 330ml Can', categoryId: 'cat-drinks', sellingPrice: 15, department: 'BAR', description: 'Refreshing sparkling cola' },
  { id: 'm-fanta', name: 'Fanta Orange 330ml Can', categoryId: 'cat-drinks', sellingPrice: 15, department: 'BAR', description: 'Fruity orange soda' },
  { id: 'm-water', name: 'Mineral Water 500ml', categoryId: 'cat-drinks', sellingPrice: 10, department: 'BAR', description: 'Chilled pure spring drinking water' }
];

export const DEFAULT_OFFLINE_CUSTOMERS: CachedCustomer[] = [
  { id: 'cust-1', name: 'Kalumbila Mining Contractor A', phone: '+260971234567', creditLimit: 25000, currentBalance: 4200, availableCredit: 20800 },
  { id: 'cust-2', name: 'First Quantum Minerals Staff Club', phone: '+260962345678', creditLimit: 50000, currentBalance: 11500, availableCredit: 38500 },
  { id: 'cust-3', name: 'Lumwana Logistics Fleet Crew', phone: '+260953456789', creditLimit: 15000, currentBalance: 2400, availableCredit: 12600 },
  { id: 'cust-4', name: 'Manyama Commercial Transport', phone: '+260974567890', creditLimit: 20000, currentBalance: 5100, availableCredit: 14900 }
];

export const DEFAULT_OFFLINE_INVENTORY: any[] = [
  { id: 'inv-1', name: 'Fresh Beef / T-Bone Cut', unit: 'kg', currentStock: 45, unitCost: 75, minimumLevel: 10, reorderLevel: 15 },
  { id: 'inv-2', name: 'Dressed Broiler Chickens', unit: 'pcs', currentStock: 60, unitCost: 45, minimumLevel: 15, reorderLevel: 20 },
  { id: 'inv-3', name: 'Village Chickens (Live/Dressed)', unit: 'pcs', currentStock: 25, unitCost: 65, minimumLevel: 8, reorderLevel: 10 },
  { id: 'inv-4', name: 'Fresh Kafue Bream Tilapia', unit: 'kg', currentStock: 30, unitCost: 60, minimumLevel: 10, reorderLevel: 12 },
  { id: 'inv-5', name: 'Breakfast Mealie Meal 25kg', unit: 'bags', currentStock: 18, unitCost: 280, minimumLevel: 5, reorderLevel: 8 },
  { id: 'inv-6', name: 'Vegetable Cooking Oil 20L', unit: 'drums', currentStock: 6, unitCost: 650, minimumLevel: 2, reorderLevel: 3 },
  { id: 'inv-7', name: 'Fresh Irish Potatoes (10kg)', unit: 'pockets', currentStock: 15, unitCost: 90, minimumLevel: 4, reorderLevel: 6 },
  { id: 'inv-8', name: 'Mosi Premium Lager 375ml Crate', unit: 'crates (24s)', currentStock: 12, unitCost: 480, minimumLevel: 3, reorderLevel: 5 },
  { id: 'inv-9', name: 'Castle Lite Crate', unit: 'crates (24s)', currentStock: 8, unitCost: 520, minimumLevel: 2, reorderLevel: 4 },
  { id: 'inv-10', name: 'Coca-Cola & Soft Drinks Assorted', unit: 'crates (24s)', currentStock: 14, unitCost: 260, minimumLevel: 4, reorderLevel: 6 }
];

export const offlineStorage = {
  // --- Catalog Cache ---
  saveCatalog(categories: Array<{ id: string; name: string }>, items: any[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
      localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(items));
    } catch (e) {
      console.warn('Failed to cache catalog locally:', e);
    }
  },

  getCachedCatalog(): { categories: any[]; items: any[] } {
    try {
      const catRaw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      const itemsRaw = localStorage.getItem(STORAGE_KEYS.CATALOG);
      const categories = catRaw ? JSON.parse(catRaw) : DEFAULT_OFFLINE_CATEGORIES;
      const items = itemsRaw ? JSON.parse(itemsRaw) : DEFAULT_OFFLINE_ITEMS;
      return {
        categories: Array.isArray(categories) && categories.length > 0 ? categories : DEFAULT_OFFLINE_CATEGORIES,
        items: Array.isArray(items) && items.length > 0 ? items : DEFAULT_OFFLINE_ITEMS
      };
    } catch {
      return { categories: DEFAULT_OFFLINE_CATEGORIES, items: DEFAULT_OFFLINE_ITEMS };
    }
  },

  // --- Customer Cache ---
  saveCustomers(customers: CachedCustomer[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
    } catch (e) {
      console.warn('Failed to cache customers locally:', e);
    }
  },

  getCachedCustomers(): CachedCustomer[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      const parsed = raw ? JSON.parse(raw) : DEFAULT_OFFLINE_CUSTOMERS;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_OFFLINE_CUSTOMERS;
    } catch {
      return DEFAULT_OFFLINE_CUSTOMERS;
    }
  },

  // --- Outbox / Queue ---
  getQueue(): QueuedSale[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.OUTBOX_QUEUE);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  enqueueSale(payload: any): QueuedSale {
    const queue = this.getQueue();
    const item: QueuedSale = {
      id: `OFFLINE-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      payload,
      retryCount: 0
    };
    queue.push(item);
    try {
      localStorage.setItem(STORAGE_KEYS.OUTBOX_QUEUE, JSON.stringify(queue));
      // Save into recent offline sales so SalesRegisterView can view and print receipts
      const recent = this.getRecentSales();
      recent.unshift({
        id: item.id,
        saleNumber: payload.saleNumber || item.id,
        totalAmount: payload.totalAmount || 0,
        paymentMethod: payload.paymentMethod || 'CASH',
        cashierName: payload.cashierName || 'Offline Cashier',
        createdAt: item.createdAt,
        items: payload.items || [],
        offlineStatus: 'QUEUED'
      });
      localStorage.setItem(STORAGE_KEYS.RECENT_SALES, JSON.stringify(recent.slice(0, 100)));
    } catch (e) {
      console.error('Failed to persist sale into offline queue:', e);
    }
    return item;
  },

  getRecentSales(): any[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.RECENT_SALES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  removeSaleFromQueue(id: string) {
    const queue = this.getQueue().filter((q) => q.id !== id);
    try {
      localStorage.setItem(STORAGE_KEYS.OUTBOX_QUEUE, JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to update offline queue:', e);
    }
  },

  clearQueue() {
    localStorage.removeItem(STORAGE_KEYS.OUTBOX_QUEUE);
  },

  // --- Inventory Cache ---
  saveInventory(items: any[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(items));
    } catch {}
  },

  getCachedInventory(): any[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.INVENTORY);
      const parsed = raw ? JSON.parse(raw) : DEFAULT_OFFLINE_INVENTORY;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_OFFLINE_INVENTORY;
    } catch {
      return DEFAULT_OFFLINE_INVENTORY;
    }
  },

  // --- Expenses Cache ---
  saveExpenses(expenses: any[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    } catch {}
  },

  getCachedExpenses(): any[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.EXPENSES);
      return raw ? JSON.parse(raw) : [
        { id: 'exp-1', title: 'Kitchen Charcoal Bags', category: 'Operations', amount: 450, date: new Date().toISOString() },
        { id: 'exp-2', title: 'Daily Vegetable Market Relish', category: 'Ingredients', amount: 320, date: new Date().toISOString() },
        { id: 'exp-3', title: 'Clean Water & Sanitation', category: 'Utilities', amount: 200, date: new Date().toISOString() }
      ];
    } catch {
      return [];
    }
  }
};
