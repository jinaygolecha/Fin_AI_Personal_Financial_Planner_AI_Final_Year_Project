/**
 * Jinay Finance AI — Centralized API Client
 * Owner: Jinay Golecha (jinay_golecha)
 * All API calls go to Node.js/Express backend at port 5000
 */

const API_BASE = 'http://127.0.0.1:5000/api/v1';

// ===== Token Management =====

export const getToken = () => localStorage.getItem('jf_access_token');
export const getRefreshToken = () => localStorage.getItem('jf_refresh_token');

export const setTokens = (accessToken, refreshToken) => {
  localStorage.setItem('jf_access_token', accessToken);
  if (refreshToken) localStorage.setItem('jf_refresh_token', refreshToken);
};

export const clearTokens = () => {
  localStorage.removeItem('jf_access_token');
  localStorage.removeItem('jf_refresh_token');
  localStorage.removeItem('jf_user');
};

export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem('jf_user') || 'null');
  } catch {
    return null;
  }
};

export const setUser = (user) => {
  localStorage.setItem('jf_user', JSON.stringify(user));
};

export const isAuthenticated = () => {
  return !!getToken();
};

// ===== Auto token refresh =====

let refreshPromise = null;

const refreshTokens = async () => {
  if (refreshPromise) return refreshPromise;
  const refresh = getRefreshToken();
  if (!refresh) return null;

  refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        setTokens(data.data.accessToken, data.data.refreshToken);
        return data.data.accessToken;
      }
      clearTokens();
      return null;
    })
    .catch(() => {
      clearTokens();
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

// ===== Core fetch wrapper =====

export const apiFetch = async (endpoint, options = {}) => {
  const url = `${API_BASE}${endpoint}`;
  const token = getToken();

  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const config = {
    ...options,
    headers: { ...defaultHeaders, ...(options.headers || {}) },
  };

  let response = await fetch(url, config);

  // Handle 401 — try to refresh token
  if (response.status === 401) {
    const newToken = await refreshTokens();
    if (newToken) {
      config.headers.Authorization = `Bearer ${newToken}`;
      response = await fetch(url, config);
    } else {
      clearTokens();
      window.location.href = '/login.html?session_expired=1';
      return null;
    }
  }

  const data = await response.json().catch(() => ({ success: false, error: { message: 'Invalid server response' } }));

  if (!response.ok && !data.success) {
    throw {
      message: data.error?.message || `Request failed (${response.status})`,
      code: data.error?.code || 'API_ERROR',
      status: response.status,
    };
  }

  return data;
};

// ===== Auth API =====

export const authAPI = {
  register: (data) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: (refreshToken) => apiFetch('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  getMe: () => apiFetch('/auth/me'),
  googleToken: (token) => apiFetch('/auth/google/token', { method: 'POST', body: JSON.stringify({ token }) }),
  googleRedirectUrl: () => `${API_BASE}/auth/google`,
};

// ===== Dashboard API =====

export const dashboardAPI = {
  get: () => apiFetch('/dashboard'),
};

// ===== Accounts API =====

export const accountsAPI = {
  list: () => apiFetch('/accounts'),
  create: (data) => apiFetch('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  get: (id) => apiFetch(`/accounts/${id}`),
  delete: (id) => apiFetch(`/accounts/${id}`, { method: 'DELETE' }),
  deposit: (id, data) => apiFetch(`/accounts/${id}/deposit`, { method: 'POST', body: JSON.stringify(data) }),
};

// ===== Transactions API =====

export const transactionsAPI = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/transactions${q ? '?' + q : ''}`);
  },
  create: (data) => apiFetch('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  get: (id) => apiFetch(`/transactions/${id}`),
  update: (id, data) => apiFetch(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id) => apiFetch(`/transactions/${id}`, { method: 'DELETE' }),
  parseVoice: (text) => apiFetch('/transactions/voice', { method: 'POST', body: JSON.stringify({ text }) }),
};

// ===== Budgets API =====

export const budgetsAPI = {
  list: (month, year) => apiFetch(`/budgets?month=${month}&year=${year}`),
  create: (data) => apiFetch('/budgets', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id) => apiFetch(`/budgets/${id}`, { method: 'DELETE' }),
};

// ===== Goals API =====

export const goalsAPI = {
  list: () => apiFetch('/goals'),
  create: (data) => apiFetch('/goals', { method: 'POST', body: JSON.stringify(data) }),
  contribute: (id, amount) => apiFetch(`/goals/${id}/contribute`, { method: 'PATCH', body: JSON.stringify({ amount }) }),
  delete: (id) => apiFetch(`/goals/${id}`, { method: 'DELETE' }),
};

// ===== Investments & Market API =====

export const investmentsAPI = {
  portfolio: () => apiFetch('/investments/portfolio'),
  buy: (data) => apiFetch('/investments/buy', { method: 'POST', body: JSON.stringify(data) }),
  quote: (symbol) => apiFetch(`/market/quote?symbol=${symbol}`),
  popularStocks: () => apiFetch('/market/popular'),
  watchlist: () => apiFetch('/market/watchlist'),
  addWatch: (data) => apiFetch('/market/watchlist', { method: 'POST', body: JSON.stringify(data) }),
  removeWatch: (symbol) => apiFetch(`/market/watchlist/${symbol}`, { method: 'DELETE' }),
};

// ===== Loans API =====

export const loansAPI = {
  list: () => apiFetch('/loans'),
  create: (data) => apiFetch('/loans', { method: 'POST', body: JSON.stringify(data) }),
  calculateEMI: (data) => apiFetch('/loans/calculate-emi', { method: 'POST', body: JSON.stringify(data) }),
  simulatePrepayment: (data) => apiFetch('/loans/prepayment-simulate', { method: 'POST', body: JSON.stringify(data) }),
};

// ===== Analytics API =====

export const analyticsAPI = {
  get: (period = 'month') => apiFetch(`/analytics?period=${period}`),
};

// ===== Calendar API =====

export const calendarAPI = {
  events: (month, year) => apiFetch(`/calendar/events?month=${month}&year=${year}`),
  create: (data) => apiFetch('/calendar/events', { method: 'POST', body: JSON.stringify(data) }),
};

// ===== Notifications API =====

export const notificationsAPI = {
  list: () => apiFetch('/notifications'),
  markRead: (id) => apiFetch(`/notifications/${id}/read`, { method: 'PATCH' }),
};

// ===== AI API =====

export const aiAPI = {
  chat: (message) => apiFetch('/ai/chat', { method: 'POST', body: JSON.stringify({ message }) }),
  history: () => apiFetch('/ai/history'),
  clearHistory: () => apiFetch('/ai/history', { method: 'DELETE' }),
  snapshot: () => apiFetch('/ai/snapshot'),
};

// ===== Export API =====

export const exportAPI = {
  transactions: () => window.open(`${API_BASE}/export/transactions.csv?token=${getToken()}`, '_blank'),
  accounts: () => window.open(`${API_BASE}/export/accounts.csv?token=${getToken()}`, '_blank'),
  summary: () => window.open(`${API_BASE}/export/summary.csv?token=${getToken()}`, '_blank'),
};

// ===== Utility Functions =====

export const formatINR = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(parseFloat(amount) || 0);
};

export const formatINRFull = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parseFloat(amount) || 0);
};

export const requireAuth = (redirectTo = '/login.html') => {
  if (!isAuthenticated()) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
};

export const redirectIfAuth = (redirectTo = '/dashboard.html') => {
  if (isAuthenticated()) {
    window.location.href = redirectTo;
    return true;
  }
  return false;
};

export const handleGoogleCallback = () => {
  const params = new URLSearchParams(window.location.search);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken) {
    setTokens(accessToken, refreshToken);
    window.history.replaceState({}, '', window.location.pathname);
    return true;
  }
  return false;
};

// Default export
export default {
  apiFetch,
  authAPI,
  dashboardAPI,
  accountsAPI,
  transactionsAPI,
  budgetsAPI,
  goalsAPI,
  investmentsAPI,
  loansAPI,
  analyticsAPI,
  calendarAPI,
  notificationsAPI,
  aiAPI,
  exportAPI,
  formatINR,
  formatINRFull,
  isAuthenticated,
  requireAuth,
  redirectIfAuth,
  getUser,
  setUser,
  setTokens,
  clearTokens,
  handleGoogleCallback,
};
