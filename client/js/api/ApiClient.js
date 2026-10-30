/**
 * ApiClient - REST API Client for Interoperability & Virtual Identity
 * 
 * Handles JWT authentication, player profile sync, progress persistence,
 * relic crafting transactions, and proxy calls to the Banana API.
 */
class ApiClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
    this.tokenKey = 'puzzlequest_token';
    this.userKey = 'puzzlequest_user';
    this.token = typeof localStorage !== 'undefined' ? localStorage.getItem(this.tokenKey) : null;
    this.currentUser = typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem(this.userKey) || 'null') : null;
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  setSession(token, user) {
    this.token = token;
    this.currentUser = user;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.tokenKey, token);
      localStorage.setItem(this.userKey, JSON.stringify(user));
    }
  }

  clearSession() {
    this.token = null;
    this.currentUser = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.userKey);
    }
  }

  isAuthenticated() {
    return !!this.token;
  }

  /**
   * Register a new player account
   */
  async register(username, password, adventurerTitle = 'Crystal Seeker') {
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, adventurerTitle })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      this.setSession(data.token, data.user);
      return { success: true, user: data.user, token: data.token };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Log into existing account
   */
  async login(username, password) {
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      this.setSession(data.token, data.user);
      return { success: true, user: data.user, token: data.token };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Fetch current authenticated player profile
   */
  async getProfile() {
    if (!this.token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/me`, {
        headers: this.getHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch profile');
      this.currentUser = data.user;
      localStorage.setItem(this.userKey, JSON.stringify(data.user));
      return { success: true, user: data.user, progress: data.progress, inventory: data.inventory };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Get all adventure level definitions
   */
  async getLevels() {
    try {
      const res = await fetch(`${this.baseUrl}/api/game/levels`);
      if (!res.ok) throw new Error('Failed to load levels from server');
      return await res.json();
    } catch (err) {
      // Fallback to client-side levels if server call fails
      return { regions: window.REGIONS, levels: window.LEVELS };
    }
  }

  /**
   * Submit completed level results to server for anti-tamper verification & reward saving
   */
  async submitLevelComplete(levelData) {
    if (!this.token) {
      return { success: true, offline: true, message: 'Played as Guest. Progress not saved online.' };
    }
    try {
      const res = await fetch(`${this.baseUrl}/api/game/complete-level`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(levelData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save progress');
      return { success: true, ...data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Craft a relic via server validation
   */
  async craftRelic(relicType) {
    if (!this.token) {
      return { success: false, error: 'Log in to craft and preserve relics!' };
    }
    try {
      const res = await fetch(`${this.baseUrl}/api/relics/craft`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ relicType })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Relic crafting failed');
      return { success: true, ...data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Fetch online leaderboard
   */
  async getLeaderboard(limit = 20) {
    try {
      const res = await fetch(`${this.baseUrl}/api/leaderboard?limit=${limit}`);
      if (!res.ok) throw new Error('Failed to load leaderboard');
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message, entries: [] };
    }
  }

  /**
   * Request a Mystery Challenge from Banana API (proxied via backend)
   */
  async getBananaChallenge() {
    try {
      const res = await fetch(`${this.baseUrl}/api/banana/challenge`, {
        headers: this.getHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Banana API challenge unavailable');
      return { success: true, ...data };
    } catch (err) {
      return { 
        success: false, 
        error: err.message || 'External Banana API service is currently unreachable.' 
      };
    }
  }

  /**
   * Submit answer for Mystery Challenge
   */
  async submitBananaAnswer(challengeId, answer) {
    try {
      const res = await fetch(`${this.baseUrl}/api/banana/verify`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ challengeId, answer })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Answer verification failed');
      return { success: true, ...data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApiClient;
} else {
  window.ApiClient = ApiClient;
}
