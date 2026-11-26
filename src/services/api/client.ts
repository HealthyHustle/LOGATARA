const TOKEN_STORAGE_KEY = 'logatara_auth_token';

export function isStaticHostingMode(): boolean {
  if (import.meta.env.VITE_GH_PAGES === 'true') return true;
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
    return true;
  }
  return false;
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage errors in restricted environments
  }
}

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // On static hosts without Node.js backend (e.g., GitHub Pages), seamlessly use the
  // browser-persisted engine backed by the exact same verified 38-province & 78-language datasets.
  if (isStaticHostingMode()) {
    const { handleStaticApiRequest } = await import('./staticDemoBackend');
    try {
      return await handleStaticApiRequest<T>(endpoint, options);
    } catch (err: any) {
      throw new ApiError(err?.message || 'Permintaan gagal.', err?.status || 400, err?.data);
    }
  }

  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      (typeof data === 'object' && data?.error) ||
      `Permintaan gagal (kode ${response.status}).`;
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}
