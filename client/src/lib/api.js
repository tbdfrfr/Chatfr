import {
  clearStoredCsrfToken,
  getStoredCsrfToken,
  saveStoredCsrfToken
} from './storage.js';

const API_BASE = normalizeBase(import.meta.env.VITE_API_BASE || '');
const WS_BASE = normalizeBase(import.meta.env.VITE_WS_BASE || '');
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const UNSAFE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export function websocketUrl(path) {
  const base = WS_BASE || window.location.origin.replace('http', 'ws');
  const slashPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(`${base}${slashPath}`).toString();
}

export async function api(path, { method = 'GET', body } = {}) {
  const hasBody = body !== undefined;
  const normalizedMethod = String(method || 'GET').toUpperCase();

  async function sendRequest(refreshCsrf = false) {
    const headers = {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {})
    };

    if (UNSAFE_METHODS.has(normalizedMethod)) {
      headers[CSRF_HEADER_NAME] = await ensureCsrfToken(refreshCsrf);
    }

    return fetch(`${API_BASE}${path}`, {
      method: normalizedMethod,
      credentials: 'include',
      headers,
      body: hasBody ? JSON.stringify(body) : undefined
    });
  }

  let response = await sendRequest(false);
  let payload = await response.json().catch(() => ({}));

  if (UNSAFE_METHODS.has(normalizedMethod) && response.status === 403 && /csrf/i.test(String(payload.error || ''))) {
    clearStoredCsrfToken();
    response = await sendRequest(true);
    payload = await response.json().catch(() => ({}));
  }

  if (payload && typeof payload.csrfToken === 'string') {
    saveStoredCsrfToken(payload.csrfToken);
  }

  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }

  return payload;
}

async function ensureCsrfToken(forceRefresh = false) {
  if (!forceRefresh) {
    const storedToken = getStoredCsrfToken();
    if (storedToken) {
      return storedToken;
    }
  }

  const response = await fetch(`${API_BASE}/api/csrf`, {
    method: 'GET',
    credentials: 'include'
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || typeof payload.csrfToken !== 'string') {
    throw new Error(payload.error || 'Failed to initialize CSRF token');
  }

  saveStoredCsrfToken(payload.csrfToken);
  return payload.csrfToken;
}

function normalizeBase(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}
