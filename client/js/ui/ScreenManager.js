/**
 * ScreenManager - Multi-Screen Single Page Application View Router
 * 
 * Manages view switching between:
 * 1. Home
 * 2. Auth (Login/Register)
 * 3. Adventure Map
 * 4. Game Screen (Main & Echo Boards)
 * 5. Relic Fusion & Inventory
 * 6. Banana API Mystery Challenge
 * 7. Online Leaderboard
 * 8. Player Profile
 * 9. Help & Enterprise Architecture
 */
class ScreenManager {
  constructor(screens = {}, eventBus = null) {
    this.screens = screens;
    this.eventBus = eventBus;
    this.currentScreen = 'home';
    this.history = [];

    this.navButtons = document.querySelectorAll('[data-nav-target]');
    this.bindNav();
  }

  bindNav() {
    this.navButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = btn.dataset.navTarget;
        if (target) {
          this.showScreen(target);
        }
      });
    });
  }

  showScreen(screenId, pushHistory = true) {
    if (!this.screens[screenId]) {
      console.warn(`[ScreenManager] Screen "${screenId}" not registered.`);
      return;
    }

    if (pushHistory && this.currentScreen !== screenId) {
      this.history.push(this.currentScreen);
    }

    // Hide all screens
    Object.keys(this.screens).forEach(id => {
      const el = this.screens[id];
      if (el) {
        el.classList.remove('active');
        el.setAttribute('aria-hidden', 'true');
      }
    });

    // Show target screen
    const targetEl = this.screens[screenId];
    targetEl.classList.add('active');
    targetEl.setAttribute('aria-hidden', 'false');
    this.currentScreen = screenId;

    // Update active nav highlights
    document.querySelectorAll('[data-nav-target]').forEach(btn => {
      if (btn.dataset.navTarget === screenId) {
        btn.classList.add('nav-active');
      } else {
        btn.classList.remove('nav-active');
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (this.eventBus) {
      this.eventBus.emit('screen:changed', { screenId });
    }

    // Trigger lifecycle hook if defined
    if (typeof this.screens[screenId].onScreenActive === 'function') {
      this.screens[screenId].onScreenActive();
    }
  }

  goBack() {
    if (this.history.length > 0) {
      const prev = this.history.pop();
      this.showScreen(prev, false);
    } else {
      this.showScreen('home', false);
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScreenManager;
} else {
  window.ScreenManager = ScreenManager;
}
