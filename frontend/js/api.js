/**
 * Hotel Operations REST API Client
 * Interacts with FastAPI backend with automatic Bearer token injection
 * and graceful fallback to local operational simulation when offline.
 */

export class ApiClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl || (['8000', '5173'].includes(window.location.port) ? '' : 'http://localhost:8000');
    this.token = localStorage.getItem('hotel_ops_token') || null;
    this.isOnline = false;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('hotel_ops_token', token);
    } else {
      localStorage.removeItem('hotel_ops_token');
    }
  }

  async checkHealth() {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { method: 'GET', signal: AbortSignal.timeout(1500) });
      this.isOnline = res.ok;
      return res.ok;
    } catch {
      this.isOnline = false;
      return false;
    }
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers
      });

      if (res.status === 401) {
        this.setToken(null);
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: res.statusText }));
        const error = new Error(errData.detail || 'API request failed');
        error.status = res.status;
        error.data = errData;
        throw error;
      }

      return await res.json();
    } catch (err) {
      console.warn(`[API] Endpoint ${endpoint} failed or unreachable:`, err.message);
      throw err;
    }
  }

  async login(email, password) {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const res = await fetch(`${this.baseUrl}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Invalid credentials' }));
      throw new Error(err.detail || 'Authentication failed');
    }

    const data = await res.json();
    this.setToken(data.access_token);
    return data;
  }

  async bootstrap(email, password) {
    return this.request('/auth/bootstrap', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  async createReservation(data) {
    return this.request('/reservations', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async transitionTask(taskId, status) {
    return this.request(`/room-tasks/${taskId}/transition`, {
      method: 'POST',
      body: JSON.stringify({ status })
    });
  }

  async postJournal(entry) {
    return this.request('/finance/journals', {
      method: 'POST',
      body: JSON.stringify(entry)
    });
  }

  async getTrialBalance(asAtDate) {
    return this.request(`/finance/trial-balance?as_at=${asAtDate}`);
  }

  async getAnalyticsOverview(fromDate, toDate) {
    const params = new URLSearchParams({ from_date: fromDate, to_date: toDate });
    return this.request(`/analytics/overview?${params}`);
  }

  getTrialBalanceCsvUrl(asAtDate) {
    return `${this.baseUrl}/exports/trial-balance.csv?as_at=${asAtDate}`;
  }

  async downloadTrialBalanceCsv(asAtDate) {
    const headers = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await fetch(this.getTrialBalanceCsvUrl(asAtDate), { headers });
    if (response.status === 401) {
      this.setToken(null);
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorBody.detail || 'Trial balance export failed');
    }
    return response.blob();
  }
}

export const api = new ApiClient();
