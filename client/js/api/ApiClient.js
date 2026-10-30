/**
 * ApiClient.js - REST API Client for Backend Services
 * 
 * Handles client-side HTTP communication for:
 * - Authentication (JWT login & register)
 * - Game progress & validation submission
 * - Relic crafting & inventory persistence
 * - Online leaderboard rankings
 * - Banana API challenge proxy requests
 */
class ApiClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
    this.token = null;
    this.currentUser = null;

    this.restoreSession();
  }

  restoreSession() {
    try {
      const storedToken = localStorage.getItem('pq_jwt_token');
      const storedUser = localStorage.getItem('pq_user_profile');
      if (storedToken && storedUser) {
        this.token = storedToken;
        this.currentUser = JSON.parse(storedUser);
      }
    } catch (err) {
      console.warn('[ApiClient] Failed to restore session from localStorage:', err);
    }
  }

  setSession(token, user) {
    this.token = token;
    this.currentUser = user;
    try {
      localStorage.setItem('pq_jwt_token', token);
      localStorage.setItem('pq_user_profile', JSON.stringify(user));
    } catch (err) {
      console.warn('[ApiClient] Failed to persist session:', err);
    }
  }

  clearSession() {
    this.token = null;
    this.currentUser = null;
    try {
      localStorage.removeItem('pq_jwt_token');
      localStorage.removeItem('pq_user_profile');
    } catch (err) {
      console.warn('[ApiClient] Failed to clear session:', err);
    }
  }

  isAuthenticated() {
    return !!this.token;
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  /**
   * User Registration
   */
  async register(username, password, adventurerTitle) {
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
   * User Login
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
   * Fetch user profile
   */
  async getProfile() {
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/profile`, {
        headers: this.getHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch profile');
      if (data.user) {
        this.currentUser = data.user;
        localStorage.setItem('pq_user_profile', JSON.stringify(data.user));
      }
      return { success: true, ...data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Submit completed level with anti-cheat validation token
   */
  async submitLevelComplete(levelPayload) {
    try {
      const res = await fetch(`${this.baseUrl}/api/game/complete-level`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(levelPayload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Validation submission failed');
      return { success: true, ...data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Fetch player's saved campaign progress
   */
  async getProgress() {
    try {
      const res = await fetch(`${this.baseUrl}/api/game/progress`, {
        headers: this.getHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load progress');
      return { success: true, ...data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Fetch player's saved relic inventory & fragments
   */
  async getRelics() {
    try {
      const res = await fetch(`${this.baseUrl}/api/relics`, {
        headers: this.getHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load relics');
      return { success: true, ...data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Craft a relic via server-persisted inventory
   */
  async craftRelic(relicType) {
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
   * Fetch online leaderboard with sorting support
   */
  async getLeaderboard(limit = 25, sortBy = 'score') {
    try {
      const res = await fetch(`${this.baseUrl}/api/leaderboard?limit=${limit}&sortBy=${sortBy}`, {
        headers: this.getHeaders()
      });
      if (!res.ok) throw new Error('Failed to load leaderboard');
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message, entries: [] };
    }
  }

  /**
   * Inspect detailed adventurer dossier
   */
  async getAdventurerDossier(username) {
    try {
      const res = await fetch(`${this.baseUrl}/api/leaderboard/dossier/${encodeURIComponent(username)}`, {
        headers: this.getHeaders()
      });
      if (!res.ok) throw new Error('Failed to load adventurer dossier');
      return await res.json();
    } catch (err) {
      return { success: false, error: err.message };
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
      if (!res.ok) throw new Error(data.error || 'Failed to summon Banana API puzzle');
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Verify solution for external Banana challenge
   */
  async verifyBananaAnswer(challengeId, answer) {
    try {
      const res = await fetch(`${this.baseUrl}/api/banana/verify`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ challengeId, answer })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      return data;
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
