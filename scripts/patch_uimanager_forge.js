/**
 * Patch UIManager.js to add Relic Forge Trial bindings & methods
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../client/js/ui/UIManager.js');
let content = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');

// ─── 1. BINDINGS – inject after in-game mystery answer keydown block ──────────
const BINDING_ANCHOR = `    document.getElementById('in-game-mystery-answer')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleCastInGameMysteryAnswer();
      }
    });`;

const FORGE_BINDINGS = `
    // ─── Arcane Relic Forge Trial Modal Controls ───────────────────────────
    document.getElementById('btn-close-forge-modal')?.addEventListener('click', () => this.closeForgeTrialModal());
    document.getElementById('btn-cancel-forge-modal')?.addEventListener('click', () => this.closeForgeTrialModal());
    document.querySelectorAll('#forge-trial-modal .btn-forge-key').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const val = e.currentTarget.getAttribute('data-val');
        const input = document.getElementById('forge-answer-input');
        if (input) {
          input.value = val;
          document.querySelectorAll('#forge-trial-modal .btn-forge-key').forEach(b => b.classList.remove('active'));
          e.currentTarget.classList.add('active');
        }
      });
    });
    document.getElementById('btn-submit-forge-answer')?.addEventListener('click', () => this.handleForgeTrialAnswer());
    document.getElementById('forge-answer-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.handleForgeTrialAnswer(); }
    });`;

if (!content.includes('btn-close-forge-modal')) {
  if (!content.includes(BINDING_ANCHOR)) {
    console.error('❌ Binding anchor not found!');
    process.exit(1);
  }
  content = content.replace(BINDING_ANCHOR, BINDING_ANCHOR + '\n' + FORGE_BINDINGS);
  console.log('✅ Forge trial bindings injected.');
} else {
  console.log('ℹ️  Forge bindings already present – skipping.');
}

// ─── 2. METHODS – inject after updateRelicFusionScreen closing brace ─────────
const METHODS_ANCHOR = `  updateFragmentDisplays(fragments) {`;

const FORGE_METHODS = `
  // ═══════════════════════════════════════════════════════════════
  //  DAILY FORGE HELPERS (localStorage for guest users)
  // ═══════════════════════════════════════════════════════════════
  getDailyForgeCount() {
    try {
      const raw = localStorage.getItem('pq_daily_forge');
      if (!raw) return 0;
      const { date, count } = JSON.parse(raw);
      const today = new Date().toISOString().split('T')[0];
      return date === today ? (count || 0) : 0;
    } catch { return 0; }
  }

  setDailyForgeCount(count) {
    try {
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem('pq_daily_forge', JSON.stringify({ date: today, count }));
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════
  //  RELIC FORGE TRIAL – OPEN / CLOSE / SUBMIT
  // ═══════════════════════════════════════════════════════════════
  async openForgeTrialModal(def) {
    if (!this.forgeTrialModal) return;

    // Reset modal UI
    const iconEl  = document.getElementById('forge-relic-target-icon');
    const titleEl = document.getElementById('forge-modal-title');
    const descEl  = document.getElementById('forge-modal-desc');
    const limitEl = document.getElementById('forge-daily-limit-indicator');
    const loadingEl = document.getElementById('forge-modal-loading');
    const bodyEl  = document.getElementById('forge-modal-body');
    const noticeEl = document.getElementById('forge-modal-notice');
    const imgEl   = document.getElementById('forge-modal-img');
    const inputEl = document.getElementById('forge-answer-input');

    if (iconEl)  iconEl.textContent  = def.icon  || '⚡';
    if (titleEl) titleEl.textContent = `FUSING ${(def.name || 'RELIC').toUpperCase()}`;
    if (noticeEl) { noticeEl.style.display = 'none'; noticeEl.innerHTML = ''; }
    if (inputEl) { inputEl.value = ''; inputEl.disabled = false; }
    document.querySelectorAll('#forge-trial-modal .btn-forge-key').forEach(b => b.classList.remove('active'));

    // Check daily forge limit
    let usedToday = 0;
    if (this.apiClient.isAuthenticated()) {
      // Will be refreshed after API call; use server count if available
      usedToday = this._serverDailyForgeCount ?? this.getDailyForgeCount();
    } else {
      usedToday = this.getDailyForgeCount();
    }

    const remaining = Math.max(0, 2 - usedToday);
    if (limitEl) limitEl.textContent = \`Daily Allowance: \${remaining}/2 Available\`;
    if (descEl) descEl.textContent = \`Solve this University Banana fruit rune equation to awaken and forge \${def.name} into your battle inventory!\`;

    if (remaining <= 0) {
      if (noticeEl) {
        noticeEl.className = 'mystery-notice alert-warning';
        noticeEl.innerHTML = '<strong>🔒 Daily Forge Limit Reached (2/2 Used Today).</strong><br/>The Arcane Forge cools until tomorrow. Come back then!';
        noticeEl.style.display = 'block';
      }
      if (bodyEl) bodyEl.style.display = 'none';
      if (loadingEl) loadingEl.style.display = 'none';
      this.activeForgeTrial = null;
      this.forgeTrialModal.classList.add('modal-open');
      return;
    }

    // Show loading state, open modal
    if (loadingEl) loadingEl.style.display = 'block';
    if (bodyEl) bodyEl.style.display = 'none';
    this.forgeTrialModal.classList.add('modal-open');

    // Fetch a fresh Banana API equation
    const result = await this.apiClient.getBananaChallenge();
    if (loadingEl) loadingEl.style.display = 'none';

    if (result.success && result.challenge) {
      this.activeForgeTrial = { ...result.challenge, relicType: def.id, relicDef: def };
      if (imgEl) imgEl.src = result.challenge.question;
      if (bodyEl) bodyEl.style.display = 'block';
      if (inputEl) { inputEl.value = ''; inputEl.focus(); }
    } else {
      if (noticeEl) {
        noticeEl.className = 'mystery-notice alert-warning';
        noticeEl.innerHTML = \`<strong>⚠️ Forge Sealed:</strong> \${result.error || 'Banana API unavailable. Try again shortly!'}\`;
        noticeEl.style.display = 'block';
      }
      this.activeForgeTrial = null;
    }
  }

  closeForgeTrialModal() {
    if (this.forgeTrialModal) {
      this.forgeTrialModal.classList.remove('modal-open');
    }
    this.activeForgeTrial = null;
  }

  async handleForgeTrialAnswer() {
    if (!this.activeForgeTrial) return;

    const inputEl  = document.getElementById('forge-answer-input');
    const noticeEl = document.getElementById('forge-modal-notice');
    const submitBtn = document.getElementById('btn-submit-forge-answer');
    const bodyEl   = document.getElementById('forge-modal-body');

    const rawAnswer = inputEl ? inputEl.value.trim() : '';
    if (rawAnswer === '') {
      this.screenManager?.showToast('Enter a digit (0–9) first!', 'warning', 2000);
      return;
    }

    const answer  = parseInt(rawAnswer, 10);
    const { challengeId, relicType, relicDef } = this.activeForgeTrial;

    // Disable submit while processing
    if (submitBtn) submitBtn.disabled = true;
    if (noticeEl) { noticeEl.style.display = 'none'; noticeEl.innerHTML = ''; }

    // ── Authenticated path: call server API ──
    if (this.apiClient.isAuthenticated()) {
      const res = await this.apiClient.forgeRelicWithTrial(relicType, challengeId, answer);

      if (submitBtn) submitBtn.disabled = false;

      if (res && res.success) {
        // Update server daily count cache
        this._serverDailyForgeCount = res.dailyForgeCount ?? (this._serverDailyForgeCount ?? 0) + 1;
        const remaining = Math.max(0, 2 - (this._serverDailyForgeCount));

        // Sync relic manager from server
        if (this.gameEngine?.relicManager?.syncFromServer) {
          this.gameEngine.relicManager.syncFromServer(res);
        }

        // Update global daily badge
        const globalBadge = document.getElementById('daily-forge-count-display');
        if (globalBadge) globalBadge.textContent = \`\${remaining} / 2 Available\`;

        if (noticeEl) {
          noticeEl.className = 'mystery-notice alert-success';
          noticeEl.innerHTML = \`
            <strong>🔥 Forge Successful!</strong><br/>
            <strong>\${relicDef.icon} \${relicDef.name}</strong> has been fused into your inventory!<br/>
            <span style="font-size:0.8rem; opacity:0.85;">Daily fusions remaining today: <strong>\${remaining}/2</strong></span>
          \`;
          noticeEl.style.display = 'block';
        }
        if (bodyEl) bodyEl.style.display = 'none';

        // Refresh the relic screen
        setTimeout(() => {
          this.closeForgeTrialModal();
          this.updateRelicFusionScreen();
        }, 2200);

      } else {
        // Error from server
        if (noticeEl) {
          noticeEl.className = 'mystery-notice alert-danger';
          noticeEl.innerHTML = \`<strong>❌ Forge Failed!</strong><br/>\${res?.error || 'Incorrect arcane equation. Try again!'}\`;
          noticeEl.style.display = 'block';
        }
        // Re-enable for retry (unless daily limit)
        const isLimit = res?.dailyFusesRemaining === 0;
        if (isLimit && bodyEl) bodyEl.style.display = 'none';
      }

    } else {
      // ── Guest path: local-only, still limit enforced ──
      const usedToday = this.getDailyForgeCount();
      if (submitBtn) submitBtn.disabled = false;

      if (usedToday >= 2) {
        if (noticeEl) {
          noticeEl.className = 'mystery-notice alert-warning';
          noticeEl.innerHTML = '<strong>🔒 Daily Forge Limit Reached (2/2).</strong><br/>Come back tomorrow!';
          noticeEl.style.display = 'block';
        }
        if (bodyEl) bodyEl.style.display = 'none';
        return;
      }

      // For guest, just verify locally (honour system) and grant
      const correctAnswer = this.activeForgeTrial.answer;
      if (answer === correctAnswer) {
        this.setDailyForgeCount(usedToday + 1);
        const remaining = Math.max(0, 2 - (usedToday + 1));

        // Grant relic locally
        if (this.gameEngine?.relicManager) {
          this.gameEngine.relicManager.inventory[relicType] =
            (this.gameEngine.relicManager.inventory[relicType] || 0) + 1;
          this.gameEngine.relicManager.saveToLocal();
        }

        const globalBadge = document.getElementById('daily-forge-count-display');
        if (globalBadge) globalBadge.textContent = \`\${remaining} / 2 Available\`;

        if (noticeEl) {
          noticeEl.className = 'mystery-notice alert-success';
          noticeEl.innerHTML = \`
            <strong>🔥 Forge Successful!</strong><br/>
            <strong>\${relicDef.icon} \${relicDef.name}</strong> forged into local inventory!<br/>
            <span style="font-size:0.8rem; opacity:0.85;">Sign in to persist your collection across devices. Remaining today: <strong>\${remaining}/2</strong></span>
          \`;
          noticeEl.style.display = 'block';
        }
        if (bodyEl) bodyEl.style.display = 'none';
        setTimeout(() => { this.closeForgeTrialModal(); this.updateRelicFusionScreen(); }, 2200);
      } else {
        if (noticeEl) {
          noticeEl.className = 'mystery-notice alert-danger';
          noticeEl.innerHTML = '<strong>❌ Incorrect Equation.</strong><br/>The forge magic fizzled. Try a different digit!';
          noticeEl.style.display = 'block';
        }
      }
    }
  }

`;

if (!content.includes('getDailyForgeCount()')) {
  if (!content.includes(METHODS_ANCHOR)) {
    console.error('❌ Methods anchor not found!');
    process.exit(1);
  }
  content = content.replace(METHODS_ANCHOR, FORGE_METHODS + '  ' + METHODS_ANCHOR.trimStart());
  console.log('✅ Forge trial methods injected.');
} else {
  console.log('ℹ️  Forge methods already present – skipping.');
}

// ─── 3. UPDATE updateRelicFusionScreen to wire Fuse Relic -> openForgeTrialModal ─
// Replace the old click handler inside the relic card loop
const OLD_CLICK = `      card.querySelector('.btn-craft').addEventListener('click', async () => {
        if (!canAfford) {
          alert(\`You need \${def.cost} relic fragments to craft \${def.name}. Earn more by completing levels and solving Banana challenges!\`);
          return;
        }

        if (this.apiClient.isAuthenticated()) {
          const res = await this.apiClient.craftRelic(def.id);
          if (res.success) {
            relicMgr.syncFromServer(res);
            this.updateRelicFusionScreen();
          } else {
            alert(res.error);
          }
        } else {
          // Local guest crafting
          relicMgr.craftRelic(def.id);
          this.updateRelicFusionScreen();
        }
      });`;

const NEW_CLICK = `      card.querySelector('.btn-craft').addEventListener('click', () => {
        // Fuse Relic now requires solving the Arcane Banana Equation
        this.openForgeTrialModal(def);
      });`;

if (content.includes(OLD_CLICK)) {
  content = content.replace(OLD_CLICK, NEW_CLICK);
  console.log('✅ Fuse Relic button wired to openForgeTrialModal.');
} else if (content.includes('openForgeTrialModal(def)')) {
  console.log('ℹ️  Fuse Relic already wired – skipping.');
} else {
  console.warn('⚠️  Could not find old click handler for Fuse Relic – manual check needed.');
}

// ─── 4. Update the daily forge badge display in updateRelicFusionScreen ───────
// After building the grid, show current daily count
const SCREEN_REFRESH_ANCHOR = `    if (!grid || !relicMgr) return;
    grid.innerHTML = '';`;

const SCREEN_REFRESH_WITH_BADGE = `    if (!grid || !relicMgr) return;
    grid.innerHTML = '';

    // Refresh daily forge badge
    const forgeBadgeEl = document.getElementById('daily-forge-count-display');
    if (forgeBadgeEl) {
      let usedCount = 0;
      if (this.apiClient.isAuthenticated() && typeof this._serverDailyForgeCount === 'number') {
        usedCount = this._serverDailyForgeCount;
      } else {
        usedCount = this.getDailyForgeCount?.() ?? 0;
      }
      const avail = Math.max(0, 2 - usedCount);
      forgeBadgeEl.textContent = avail > 0 ? \`\${avail} / 2 Available\` : '0 / 2 — Limit Reached Today';
      forgeBadgeEl.style.color = avail > 0 ? '#b45309' : '#dc2626';
    }`;

if (content.includes(SCREEN_REFRESH_ANCHOR) && !content.includes('daily-forge-count-display')) {
  content = content.replace(SCREEN_REFRESH_ANCHOR, SCREEN_REFRESH_WITH_BADGE);
  console.log('✅ Daily forge badge refresh injected into updateRelicFusionScreen.');
} else {
  console.log('ℹ️  Daily forge badge refresh already present or anchor missing – skipping.');
}

fs.writeFileSync(FILE, content, 'utf8');
console.log('\n✅ UIManager.js patched successfully!');
