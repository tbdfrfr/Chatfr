const tokenKey = 'chatfr.token';
const userKey = 'chatfr.user';

export function getStoredSession() {
  return {
    token: localStorage.getItem(tokenKey),
    user: readStoredUser()
  };
}

export function saveStoredSession(token, user) {
  localStorage.setItem(tokenKey, token);
  saveStoredUser(user);
}

export function saveStoredUser(user) {
  localStorage.setItem(userKey, JSON.stringify(user));
}

export function clearStoredSession() {
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(userKey);
}

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(userKey) || 'null');
  } catch {
    return null;
  }
}