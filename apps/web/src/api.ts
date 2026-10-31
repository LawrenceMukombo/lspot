const DEFAULT_CLOUD_ORIGIN = 'https://lspot.lamtoninvestments.com';

export function getApiBase(): string {
  if (typeof window === 'undefined') return '/api/v1';
  const customServer = localStorage.getItem('lspot_server_url');
  if (customServer && customServer.startsWith('http')) {
    return `${customServer.replace(/\/+$/, '')}/api/v1`;
  }
  const proto = window.location.protocol;
  const host = window.location.hostname;
  const isCapacitorOrFile =
    proto === 'file:' ||
    proto === 'capacitor:' ||
    proto === 'ionic:' ||
    Boolean((window as any).Capacitor) ||
    Boolean((window as any).AndroidBridge);

  if (isCapacitorOrFile) {
    return `${DEFAULT_CLOUD_ORIGIN}/api/v1`;
  }

  // Standard web browser on production or local dev proxy
  if (host && host !== '' && (proto === 'http:' || proto === 'https:')) {
    return '/api/v1';
  }

  return `${DEFAULT_CLOUD_ORIGIN}/api/v1`;
}

const HTTP_CACHE_PREFIX = 'lspot_http_cache_v1:';
const MUTATION_OUTBOX_KEY = 'lspot_offline_mutation_outbox';
const SALES_OUTBOX_KEY = 'lspot_offline_sales_queue';

export function getAuthToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('lspot_auth_token') || localStorage.getItem('lspot_token');
}

export function setAuthSession(token: string, user?: any): void {
  localStorage.setItem('lspot_auth_token', token);
  localStorage.setItem('lspot_token', token);
  if (user) {
    localStorage.setItem('lspot_user_profile', JSON.stringify(user));
    localStorage.setItem('lspot_user', JSON.stringify(user));
  }
  window.dispatchEvent(new Event('authSuccess'));
}

export function logoutSession(): void {
  localStorage.removeItem('lspot_auth_token');
  localStorage.removeItem('lspot_token');
  localStorage.removeItem('lspot_user_profile');
  localStorage.removeItem('lspot_user');
  window.dispatchEvent(new Event('authRequired'));
}

export interface OfflineMutationRecord {
  id: string;
  endpoint: string;
  method: string;
  body?: string;
  queuedAt: string;
  retryCount: number;
}

function saveGetCache(endpoint: string, data: any) {
  try {
    localStorage.setItem(
      `${HTTP_CACHE_PREFIX}${endpoint}`,
      JSON.stringify({ timestamp: Date.now(), data })
    );
  } catch {
    // Ignore quota errors
  }
}

function readGetCache(endpoint: string): { found: boolean; data: any } {
  try {
    const raw = localStorage.getItem(`${HTTP_CACHE_PREFIX}${endpoint}`);
    if (!raw) return { found: false, data: null };
    const parsed = JSON.parse(raw);
    return { found: true, data: parsed.data };
  } catch {
    return { found: false, data: null };
  }
}

export function getOfflineMutationOutbox(): OfflineMutationRecord[] {
  try {
    const raw = localStorage.getItem(MUTATION_OUTBOX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function enqueueOfflineMutation(endpoint: string, method: string, body?: string): OfflineMutationRecord {
  const queue = getOfflineMutationOutbox();
  const item: OfflineMutationRecord = {
    id: `MUT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    endpoint,
    method,
    body,
    queuedAt: new Date().toISOString(),
    retryCount: 0
  };
  queue.push(item);
  try {
    localStorage.setItem(MUTATION_OUTBOX_KEY, JSON.stringify(queue));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offlineQueueUpdated'));
    }
  } catch {
    // Ignore storage error
  }
  return item;
}

export function getOfflinePendingCount(): number {
  try {
    const salesQueue = JSON.parse(localStorage.getItem(SALES_OUTBOX_KEY) || '[]');
    const mutationQueue = getOfflineMutationOutbox();
    return (Array.isArray(salesQueue) ? salesQueue.length : 0) + mutationQueue.length;
  } catch {
    return 0;
  }
}

let isSyncInProgress = false;

export async function syncAllOfflineData(): Promise<{
  syncedSales: number;
  syncedMutations: number;
  remaining: number;
  online: boolean;
}> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { syncedSales: 0, syncedMutations: 0, remaining: getOfflinePendingCount(), online: false };
  }
  if (isSyncInProgress) {
    return { syncedSales: 0, syncedMutations: 0, remaining: getOfflinePendingCount(), online: true };
  }

  isSyncInProgress = true;
  let syncedSales = 0;
  let syncedMutations = 0;
  const apiBase = getApiBase();
  const token = getAuthToken();

  try {
    // 1. Check server reachability with a fast health ping
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const healthRes = await fetch(`${apiBase}/health`, {
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!healthRes.ok) {
      return { syncedSales: 0, syncedMutations: 0, remaining: getOfflinePendingCount(), online: false };
    }

    const authHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    // 2. Flush queued offline POS sales
    const salesRaw = localStorage.getItem(SALES_OUTBOX_KEY);
    if (salesRaw) {
      const salesQueue: any[] = JSON.parse(salesRaw);
      if (Array.isArray(salesQueue) && salesQueue.length > 0) {
        const remainingSales: any[] = [];
        for (const sale of salesQueue) {
          try {
            const payload = sale.payload || sale;
            const res = await fetch(`${apiBase}/pos/checkout`, {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify(payload)
            });
            if (res.ok || res.status === 409) {
              syncedSales++;
            } else if (res.status >= 400 && res.status < 500 && res.status !== 401) {
              // Drop permanently invalid payload after 5 attempts
              sale.retryCount = (sale.retryCount || 0) + 1;
              if (sale.retryCount < 5) remainingSales.push(sale);
            } else {
              remainingSales.push(sale);
            }
          } catch {
            remainingSales.push(sale);
          }
        }
        localStorage.setItem(SALES_OUTBOX_KEY, JSON.stringify(remainingSales));
      }
    }

    // 3. Flush queued general offline mutations
    const mutationQueue = getOfflineMutationOutbox();
    if (mutationQueue.length > 0) {
      const remainingMutations: OfflineMutationRecord[] = [];
      for (const mut of mutationQueue) {
        try {
          const res = await fetch(`${apiBase}${mut.endpoint}`, {
            method: mut.method,
            headers: authHeaders,
            body: mut.body
          });
          if (res.ok || res.status === 409) {
            syncedMutations++;
          } else if (res.status >= 400 && res.status < 500 && res.status !== 401) {
            mut.retryCount = (mut.retryCount || 0) + 1;
            if (mut.retryCount < 5) remainingMutations.push(mut);
          } else {
            remainingMutations.push(mut);
          }
        } catch {
          remainingMutations.push(mut);
        }
      }
      localStorage.setItem(MUTATION_OUTBOX_KEY, JSON.stringify(remainingMutations));
    }

    // 4. Warm critical offline caches in background so offline mode always has the latest data
    if (token) {
      const warmEndpoints = [
        '/pos/catalog',
        '/kitchen/register/today',
        '/credit/customers',
        '/shifts/current',
        '/auth/biometrics'
      ];
      await Promise.allSettled(
        warmEndpoints.map(async (ep) => {
          const res = await fetch(`${apiBase}${ep}`, { headers: authHeaders, cache: 'no-store' });
          if (res.ok) {
            const json = await res.json();
            if (json && json.success !== false) {
              saveGetCache(ep, json.data);
            }
          }
        })
      );
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offlineQueueUpdated'));
      if (syncedSales > 0 || syncedMutations > 0) {
        window.dispatchEvent(new CustomEvent('lspotDataSynced', { detail: { syncedSales, syncedMutations } }));
        window.dispatchEvent(new CustomEvent('kitchenRegisterUpdated'));
      }
    }

    return {
      syncedSales,
      syncedMutations,
      remaining: getOfflinePendingCount(),
      online: true
    };
  } catch {
    return {
      syncedSales,
      syncedMutations,
      remaining: getOfflinePendingCount(),
      online: false
    };
  } finally {
    isSyncInProgress = false;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const method = (options.method || 'GET').toUpperCase();
  const apiBase = getApiBase();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {})
  };

  const isAuthEndpoint =
    endpoint.startsWith('/auth/login') ||
    endpoint.startsWith('/auth/pin-login') ||
    endpoint.startsWith('/auth/biometric-login');

  // Fast offline path for GET requests
  if (method === 'GET' && typeof navigator !== 'undefined' && !navigator.onLine) {
    const cached = readGetCache(endpoint);
    if (cached.found) {
      return cached.data as T;
    }
  }

  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    response = await fetch(`${apiBase}${endpoint}`, {
      ...options,
      method,
      headers,
      signal: options.signal || controller.signal
    });
    clearTimeout(timeoutId);
  } catch (networkErr: any) {
    // 1. If GET request failed due to network/offline, return cached response seamlessly
    if (method === 'GET') {
      const cached = readGetCache(endpoint);
      if (cached.found) {
        return cached.data as T;
      }
    }

    // 2. If a non-auth, non-POS-checkout mutation failed while offline, queue it in outbox
    if (
      method !== 'GET' &&
      !isAuthEndpoint &&
      endpoint !== '/pos/checkout' &&
      !endpoint.startsWith('/pos/momo-initiate')
    ) {
      const bodyStr = typeof options.body === 'string' ? options.body : undefined;
      const queued = enqueueOfflineMutation(endpoint, method, bodyStr);
      let parsedBody: any = {};
      try {
        if (bodyStr) parsedBody = JSON.parse(bodyStr);
      } catch {
        // Ignore parse error
      }
      return {
        ...parsedBody,
        id: parsedBody.id || queued.id,
        _offlineQueued: true,
        _queuedAt: queued.queuedAt
      } as unknown as T;
    }

    throw new Error(
      typeof navigator !== 'undefined' && !navigator.onLine
        ? 'Terminal is currently in Offline Mode. Changes are queued locally.'
        : 'Unable to reach server. Working from local offline cache.'
    );
  }

  // Safely handle non-JSON responses (such as Nginx 502/504 HTML pages during server restarts)
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (method === 'GET') {
      const cached = readGetCache(endpoint);
      if (cached.found) return cached.data as T;
    }
    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}. Please retry in a moment.`);
    }
    return null as unknown as T;
  }

  let json: any;
  try {
    json = await response.json();
  } catch {
    if (method === 'GET') {
      const cached = readGetCache(endpoint);
      if (cached.found) return cached.data as T;
    }
    throw new Error('Received an invalid response from the server.');
  }

  // Global rule: expired sessions return 401 -> safely log out only for authenticated session calls
  if (response.status === 401 && !isAuthEndpoint) {
    logoutSession();
    throw new Error('Session expired. Logging out safely.');
  }

  if (!response.ok || json.success === false) {
    throw new Error(json.message || 'API request failed');
  }

  // Save successful GET responses into local offline cache
  if (method === 'GET') {
    saveGetCache(endpoint, json.data);
  }

  return json.data as T;
}
