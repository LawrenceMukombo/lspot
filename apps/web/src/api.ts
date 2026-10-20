const API_BASE = '/api/v1';

let authPromise: Promise<string | null> | null = null;

async function getAuthToken(): Promise<string | null> {
  let token = localStorage.getItem('lspot_auth_token');
  if (token) return token;

  if (!authPromise) {
    authPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'manager', password: 'lspot1234' })
        });
        const data = await res.json();
        if (data.success && data.data?.token) {
          localStorage.setItem('lspot_auth_token', data.data.token);
          return data.data.token;
        }
      } catch (e) {
        console.warn('Auto-login initialization fallback unavailable:', e);
      } finally {
        authPromise = null;
      }
      return null;
    })();
  }
  return authPromise;
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  const url = `${API_BASE}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {})
  };

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }
    return data.data;
  } catch (err: any) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}
