const API_BASE = "/api";

/** Get stored auth token */
export function getToken() {
  return localStorage.getItem("etc_token");
}

/** Get stored user info */
export function getUser() {
  const raw = localStorage.getItem("etc_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/** Save auth data after login */
export function saveAuth(token, user) {
  localStorage.setItem("etc_token", token);
  localStorage.setItem("etc_user", JSON.stringify(user));
}

/** Clear auth data */
export function clearAuth() {
  localStorage.removeItem("etc_token");
  localStorage.removeItem("etc_user");
}

/** Check if user is logged in */
export function isLoggedIn() {
  return !!getToken();
}

/** Make authenticated API request */
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearAuth();
    window.location.reload();
    throw new Error("Session expired");
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

/** POST /api/auth/login */
export async function login(employeeId, password) {
  const data = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ employeeId, password }),
  });
  saveAuth(data.token, data.user);
  return data.user;
}

/** GET /api/punches?date=YYYY-MM-DD */
export async function fetchPunches(date) {
  return apiFetch(`/punches?date=${date}`);
}

/** Logout */
export function logout() {
  clearAuth();
  window.location.reload();
}
