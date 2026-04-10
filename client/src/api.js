const API_BASE = normalizeBase(import.meta.env.VITE_API_BASE || '');
const WS_BASE = normalizeBase(import.meta.env.VITE_WS_BASE || '');

export function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function websocketUrl(path, token) {
  const base = WS_BASE || window.location.origin.replace('http', 'ws');
  const slashPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${slashPath}`);

  if (token) {
    url.searchParams.set('token', token);
  }

  return url.toString();
}

export async function api(path, { token, method = 'GET', body } = {}) {
  const hasBody = body !== undefined;
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(token)
    },
    body: hasBody ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }

  return payload;
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
