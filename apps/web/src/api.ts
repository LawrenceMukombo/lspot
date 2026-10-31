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
    ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    ...((options.headers as Record<string, string>) || {})
  });

  try {
    const res = await fetch(url, { ...options, headers: buildHeaders(token) });

    if (
      res.status === 401 &&
      endpoint !== '/auth/login' &&
      endpoint !== '/auth/pin-login' &&
      endpoint !== '/auth/supervisor-override'
    ) {
      logoutSession();
    }

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

