/**
 * Enterprise Offline Storage & Cache Manager for The LSpot POS
 * Designed for low-connectivity environments (Manyama, Northwestern Province, Zambia).
 * Caches live catalog, customer balances, active shift, and synchronizes offline orders.
 */

const STORAGE_KEYS = {
  CATALOG: 'lspot_offline_catalog',
  CATEGORIES: 'lspot_offline_categories',
  CUSTOMERS: 'lspot_offline_customers',
  ACTIVE_SHIFT: 'lspot_offline_active_shift',
  OUTBOX_QUEUE: 'lspot_offline_sales_queue'
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
      return {
        categories: catRaw ? JSON.parse(catRaw) : [],
        items: itemsRaw ? JSON.parse(itemsRaw) : []
      };
    } catch {
      return { categories: [], items: [] };
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
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
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
    } catch (e) {
      console.error('Failed to persist sale into offline queue:', e);
    }
    return item;
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
  }
};
