const csrfKey = 'chatfr.csrf';
const userKey = 'chatfr.user';

export function getStoredUser() {
  return readStoredUser();
}

export function saveStoredUser(user) {
  sessionStorage.setItem(userKey, JSON.stringify(user));
}

export function getStoredCsrfToken() {
  return readStoredValue(csrfKey);
}

export function saveStoredCsrfToken(token) {
  sessionStorage.setItem(csrfKey, token);
}

export function clearStoredCsrfToken() {
  sessionStorage.removeItem(csrfKey);
}

export function clearStoredSession() {
  sessionStorage.removeItem(userKey);
  sessionStorage.removeItem(csrfKey);
}

function readStoredUser() {
  return readStoredValue(userKey, true);
}

function readStoredValue(key, parseJson = false) {
  try {
    const value = sessionStorage.getItem(key);
    return parseJson ? JSON.parse(value || 'null') : value;
  } catch {
    return null;
  }
}
