// Android API Client supporting JWT Auth, 30-min inactivity, version enforcement, and retry
const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';
const CLIENT_VERSION = '1.2.0';

class AndroidApiClient {
  constructor() {
    this.token = null;
    this.lastActivityTime = Date.now();
    this.inactivityTimeoutMs = 30 * 60 * 1000;
  }

  setToken(token) {
    this.token = token;
    this.lastActivityTime = Date.now();
  }

  recordUserActivity() {
    this.lastActivityTime = Date.now();
  }

  isSessionExpired() {
    return Date.now() - this.lastActivityTime >= this.inactivityTimeoutMs;
  }

  async request(endpoint, options = {}) {
    if (this.token && this.isSessionExpired()) {
      this.token = null;
      throw new Error('Your session expired due to inactivity. Please sign in again.');
    }

    const headers = {
      'Content-Type': 'application/json',
      'x-client-version': CLIENT_VERSION,
      ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
      ...(options.headers || {})
    };

    const config = {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    };

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, config);
      
      if (response.status === 426) {
        throw new Error('Update Required: Obsolete mobile client version.');
      }

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.message || `HTTP ${response.status} Request Failed`);
      }
      return json;
    } catch (err) {
      console.error(`[Android API Error] ${endpoint}:`, err.message);
      throw err;
    }
  }
}

export const androidApi = new AndroidApiClient();
