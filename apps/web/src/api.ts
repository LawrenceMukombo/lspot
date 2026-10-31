const API_BASE = '/api/v1';

export async function getAuthToken(): Promise<string | null> {
  return localStorage.getItem('lspot_auth_token');
}

export function setAuthSession(token: string, user?: any) {
  localStorage.setItem('lspot_auth_token', token);
  if (user) {
    localStorage.setItem('lspot_user_profile', JSON.stringify(user));
  }
  window.dispatchEvent(new CustomEvent('authSuccess', { detail: { user } }));
}

export function logoutSession() {
  localStorage.removeItem('lspot_auth_token');
  localStorage.removeItem('lrm_auth_token');
  localStorage.removeItem('lspot_user_profile');
  window.dispatchEvent(new CustomEvent('authRequired'));
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  const url = `${API_BASE}${endpoint}`;

  const buildHeaders = (tok: string | null) => ({
    'Content-Type': 'application/json',
    ...(tok && tok !== 'offline-session-token' ? { Authorization: `Bearer ${tok}` } : {}),
    ...((options.headers as Record<string, string>) || {})
  });

  const executeFetch = async (targetUrl: string) => {
    const res = await fetch(targetUrl, { ...options, headers: buildHeaders(token) });

    if (
      res.status === 401 &&
      token !== 'offline-session-token' &&
      endpoint !== '/auth/login' &&
      endpoint !== '/auth/pin-login' &&
      endpoint !== '/auth/verify-pin' &&
      endpoint !== '/auth/supervisor-override'
    ) {
      logoutSession();
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Failed to fetch (${res.status})`);
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }
    return data.data;
  };

  try {
    return await executeFetch(url);
  } catch (err: any) {
    // If running on localhost and relative proxy fails, try direct API port 3001
    if (
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
      window.location.port !== '3001'
    ) {
      try {
        return await executeFetch(`http://localhost:3001${url}`);
      } catch {
        // Fall through to original error
      }
    }
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

