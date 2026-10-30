/**
 * UIManager - Presentation & User Interaction Coordinator
 * 
 * Manages HUD, Adventure Map rendering, Relic Fusion UI,
 * Banana API Mystery Challenge, Leaderboard, and Victory/Defeat dialogs.
 */
class UIManager {
  /**
   * @param {Object} options
   * @param {EventBus} options.eventBus
   * @param {GameEngine} options.gameEngine
   * @param {ScreenManager} options.screenManager
   * @param {ApiClient} options.apiClient
   * @param {SoundManager} options.soundManager
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.gameEngine = options.gameEngine;
    this.screenManager = options.screenManager;
    this.apiClient = options.apiClient;
    this.soundManager = options.soundManager;

    this.unlockedLevels = [1];
    this.completedLevels = new Map(); // levelId -> { stars, score }
    this.activeBananaChallenge = null;

    this.initDOMElements();
    this.bindEvents();
    this.initAudioButton();
    this.initAuthForms();
    this.initBananaChallengeUI();
    this.initRelicScreenUI();
  }

  initDOMElements() {
    // HUD elements
    this.hudLevelName = document.getElementById('hud-level-name');
    this.hudMoves = document.getElementById('hud-moves');
    this.hudScore = document.getElementById('hud-score');
    this.hudMainGoal = document.getElementById('hud-main-goal');
    this.hudEchoGoal = document.getElementById('hud-echo-goal');
    this.hudCombo = document.getElementById('hud-combo-badge');
    this.hudEchoMultiplier = document.getElementById('hud-multiplier-badge');
    this.relicBar = document.getElementById('relic-battle-bar');

    // Modals
    this.victoryModal = document.getElementById('victory-modal');
    this.defeatModal = document.getElementById('defeat-modal');
    this.tutorialModal = document.getElementById('tutorial-modal');

    // Map container
    this.mapContainer = document.getElementById('adventure-map-container');

    // Leaderboard table body
    this.leaderboardBody = document.getElementById('leaderboard-rows');

    // User session badge
    this.userStatusBadge = document.getElementById('user-status-badge');
  }

  bindEvents() {
    if (!this.eventBus) return;

    // Game lifecycle events
    this.eventBus.on('game:started', (data) => this.updateHUDGameStart(data));
    this.eventBus.on('game:move_used', (data) => this.updateHUDMoves(data));
    this.eventBus.on('score:updated', (data) => this.updateHUDScore(data));
    this.eventBus.on('objective:updated', (data) => this.updateHUDObjectives(data));
    this.eventBus.on('echo:multiplier_updated', (data) => this.updateHUDMultiplier(data));
    this.eventBus.on('game:win', (data) => this.showVictoryModal(data));
    this.eventBus.on('game:lose', (data) => this.showDefeatModal(data));

    // Relic battle events
    this.eventBus.on('relic:targeting_started', (data) => this.showTargetingNotification(data));
    this.eventBus.on('relic:targeting_cancelled', () => this.hideTargetingNotification());
    this.eventBus.on('relic:used', () => this.updateBattleRelicBar());
    this.eventBus.on('fragments:updated', (data) => this.updateFragmentDisplays(data.fragments));

    // Keyboard accessibility shortcuts
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
        if (e.key === 'm' || e.key === 'M') {
          window.soundManager?.toggleMute();
        } else if (e.key === 'r' || e.key === 'R') {
          if (this.gameEngine?.currentLevel && this.gameEngine?.gameState === 'PLAYING') {
            this.handleReplayLevel();
          }
        }
      });
    }

    // Modal action buttons
    document.getElementById('btn-next-level')?.addEventListener('click', () => this.handleNextLevel());
    document.getElementById('btn-replay-level')?.addEventListener('click', () => this.handleReplayLevel());
    document.getElementById('btn-map-return')?.addEventListener('click', () => {
      this.victoryModal.classList.remove('modal-open');
      this.screenManager.showScreen('map');
      this.renderWorldMap();
    });
    document.getElementById('btn-defeat-retry')?.addEventListener('click', () => this.handleReplayLevel());
    document.getElementById('btn-defeat-map')?.addEventListener('click', () => {
      this.defeatModal.classList.remove('modal-open');
      this.screenManager.showScreen('map');
      this.renderWorldMap();
    });
    document.getElementById('btn-close-tutorial')?.addEventListener('click', () => {
      this.tutorialModal.classList.remove('modal-open');
    });

    // Home hero action button
    document.getElementById('btn-home-play')?.addEventListener('click', () => {
      if (this.apiClient.isAuthenticated()) {
        this.screenManager.showScreen('map');
        this.renderWorldMap();
      } else {
        this.screenManager.showToast('Please sign in or create an identity to play PuzzleQuest!', 'warning', 3500);
        this.screenManager.showScreen('auth');
      }
    });

    // In-game header buttons
    document.getElementById('btn-game-map')?.addEventListener('click', () => {
      this.screenManager.showScreen('map');
      this.renderWorldMap();
    });
    document.getElementById('btn-game-restart')?.addEventListener('click', () => this.handleReplayLevel());

    // Navigation triggers
    document.querySelectorAll('[data-nav-target="leaderboard"]').forEach(btn => {
      btn.addEventListener('click', () => this.loadLeaderboard());
    });
    document.querySelectorAll('[data-nav-target="map"]').forEach(btn => {
      btn.addEventListener('click', () => this.renderWorldMap());
    });
    document.querySelectorAll('[data-nav-target="profile"]').forEach(btn => {
      btn.addEventListener('click', () => this.loadProfileScreen());
    });
    document.querySelectorAll('[data-nav-target="relics"]').forEach(btn => {
      btn.addEventListener('click', () => this.updateRelicFusionScreen());
    });
  }

  initAudioButton() {
    const audioBtn = document.getElementById('btn-toggle-sound');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        const isMuted = this.soundManager.toggleMute();
        audioBtn.innerHTML = isMuted ? '🔇 <span class="sr-only">Unmute</span>' : '🔊 <span class="sr-only">Mute</span>';
        audioBtn.setAttribute('title', isMuted ? 'Sound Muted' : 'Sound Enabled');
      });
    }
  }

  updateHUDGameStart(data) {
    if (this.hudLevelName) this.hudLevelName.textContent = data.level.name;
    if (this.hudMoves) this.hudMoves.textContent = data.moves;
    if (this.hudScore) this.hudScore.textContent = data.score.toLocaleString();
    if (this.hudCombo) this.hudCombo.style.display = 'none';
    if (this.hudEchoMultiplier) this.hudEchoMultiplier.style.display = 'none';

    this.updateHUDObjectives({
      main: data.mainObjective,
      echo: data.echoObjective
    });

    this.updateBattleRelicBar();

    // Show tutorial popup if level is tutorial
    if (data.level.isTutorial && this.tutorialModal) {
      document.getElementById('tutorial-message').textContent = data.level.tutorialMessage;
      this.tutorialModal.classList.add('modal-open');
    }
  }

  updateHUDMoves(data) {
    if (this.hudMoves) {
      this.hudMoves.textContent = data.movesRemaining;
      if (data.movesRemaining <= 5) {
        this.hudMoves.classList.add('hud-critical');
      } else {
        this.hudMoves.classList.remove('hud-critical');
      }
    }
  }

  updateHUDScore(data) {
    if (this.hudScore) {
      this.hudScore.textContent = data.score.toLocaleString();
    }
    if (this.hudCombo) {
      if (data.combo > 1) {
        this.hudCombo.textContent = `COMBO x${data.combo}!`;
        this.hudCombo.style.display = 'inline-block';
        this.hudCombo.classList.add('pulse-anim');
        setTimeout(() => this.hudCombo.classList.remove('pulse-anim'), 400);
      } else {
        this.hudCombo.style.display = 'none';
      }
    }
  }

  updateHUDObjectives(data) {
    if (this.hudMainGoal && data.main) {
      let mainText = '';
      if (data.main.type === 'collect_gems') {
        const gemName = data.main.gemType.toUpperCase();
        mainText = `${gemName}: ${data.main.current} / ${data.main.required}`;
      } else if (data.main.type === 'score_and_gems') {
        mainText = `Score: ${this.gameEngine.score}/${data.main.targetScore} & ${data.main.gemType.toUpperCase()}: ${data.main.current}/${data.main.required}`;
      }
      this.hudMainGoal.innerHTML = `<span class="goal-icon">🎯</span> ${mainText}`;
    }

    if (this.hudEchoGoal && data.echo) {
      this.hudEchoGoal.innerHTML = `<span class="goal-icon">⚡</span> Echo Runes: ${data.echo.current} / ${data.echo.required}`;
    }
  }

  updateHUDMultiplier(data) {
    if (!this.hudEchoMultiplier) return;
    if (data.multiplier > 1.0 && data.turnsRemaining > 0) {
      this.hudEchoMultiplier.textContent = `Echo Amplified ${data.multiplier}x (${data.turnsRemaining} turns left)`;
      this.hudEchoMultiplier.style.display = 'inline-block';
    } else {
      this.hudEchoMultiplier.style.display = 'none';
    }
  }

  updateBattleRelicBar() {
    if (!this.relicBar) return;
    const relicMgr = this.gameEngine.relicManager;
    if (!relicMgr) return;

    this.relicBar.innerHTML = '';
    Object.keys(RelicManager.RELIC_DEFINITIONS).forEach(key => {
      const def = RelicManager.RELIC_DEFINITIONS[key];
      const count = relicMgr.battleCharges[key] || 0;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `relic-battle-btn ${count <= 0 ? 'relic-disabled' : ''}`;
      btn.setAttribute('aria-label', `Use relic ${def.name}, ${count} remaining`);
      btn.innerHTML = `
        <span class="relic-btn-icon">${def.icon}</span>
        <span class="relic-btn-name">${def.name}</span>
        <span class="relic-btn-count">${count}</span>
      `;

      if (count > 0) {
        btn.addEventListener('click', () => {
          if (relicMgr.activeTargetingRelic === key) {
            relicMgr.cancelTargeting();
          } else {
            relicMgr.selectRelicForUse(key);
          }
        });
      }

      this.relicBar.appendChild(btn);
    });
  }

  showTargetingNotification(data) {
    let notify = document.getElementById('targeting-notice');
    if (!notify) {
      notify = document.createElement('div');
      notify.id = 'targeting-notice';
      notify.className = 'targeting-notice-toast';
      document.body.appendChild(notify);
    }
    notify.innerHTML = `
      <span>Targeting: <strong>${data.name}</strong> - Click target on board to activate!</span>
      <button id="btn-cancel-target" class="btn-sm btn-ghost">Cancel</button>
    `;
    notify.style.display = 'flex';
    document.getElementById('btn-cancel-target')?.addEventListener('click', () => {
      this.gameEngine.relicManager.cancelTargeting();
    });
  }

  hideTargetingNotification() {
    const notify = document.getElementById('targeting-notice');
    if (notify) notify.style.display = 'none';
  }

  async showVictoryModal(data) {
    // Record completion
    this.completedLevels.set(data.levelId, { stars: data.stars, score: data.score });
    
    // Unlock next levels
    if (this.gameEngine.currentLevel?.nextLevels) {
      for (const nxt of this.gameEngine.currentLevel.nextLevels) {
        if (!this.unlockedLevels.includes(nxt)) {
          this.unlockedLevels.push(nxt);
        }
      }
    }

    // Submit to server
    const submitResult = await this.apiClient.submitLevelComplete(data);

    // Update modal UI
    const scoreVal = document.getElementById('victory-score');
    const movesBonusVal = document.getElementById('victory-moves-bonus');
    const starsContainer = document.getElementById('victory-stars');
    const saveNotice = document.getElementById('victory-save-notice');

    if (scoreVal) scoreVal.textContent = data.score.toLocaleString();
    if (movesBonusVal) movesBonusVal.textContent = `+${(data.movesRemaining * 250).toLocaleString()} (Moves Left: ${data.movesRemaining})`;
    if (starsContainer) {
      starsContainer.innerHTML = '';
      for (let s = 1; s <= 3; s++) {
        const star = document.createElement('span');
        star.className = `star-glyph ${s <= data.stars ? 'star-gold' : 'star-dim'}`;
        star.textContent = '★';
        starsContainer.appendChild(star);
      }
    }

    if (saveNotice) {
      if (this.apiClient.isAuthenticated()) {
        saveNotice.innerHTML = `<span class="badge badge-success">Saved Online! High score updated to cloud.</span>`;
      } else {
        saveNotice.innerHTML = `<span class="badge badge-warning">Guest Mode: Register or Log In to save your rank on the leaderboard!</span>`;
      }
    }

    this.victoryModal.classList.add('modal-open');
  }

  showDefeatModal(data) {
    const scoreVal = document.getElementById('defeat-score');
    if (scoreVal) scoreVal.textContent = data.score.toLocaleString();
    this.defeatModal.classList.add('modal-open');
  }

  handleNextLevel() {
    this.victoryModal.classList.remove('modal-open');
    const curLevelId = this.gameEngine.currentLevel.id;
    const nxtId = curLevelId + 1;
    const nextDef = window.LEVELS.find(l => l.id === nxtId);

    if (nextDef) {
      this.gameEngine.startLevel(nextDef);
      this.screenManager.showScreen('game');
    } else {
      // Reached end of current campaign
      alert('Congratulations, Arch-Mage! You have conquered all available realms of the current Adventure!');
      this.screenManager.showScreen('map');
      this.renderWorldMap();
    }
  }

  handleReplayLevel() {
    this.victoryModal.classList.remove('modal-open');
    this.defeatModal.classList.remove('modal-open');
    this.gameEngine.startLevel(this.gameEngine.currentLevel);
    this.screenManager.showScreen('game');
  }

  /**
   * Render the Adventure World Map with Regions & Branching Nodes
   */
  renderWorldMap() {
    if (!this.apiClient.isAuthenticated()) {
      this.screenManager.showToast('Please sign in or register to view the Adventure Map!', 'warning', 3500);
      this.screenManager.showScreen('auth');
      return;
    }
    if (!this.mapContainer) return;
    this.mapContainer.innerHTML = '';

    window.REGIONS.forEach(region => {
      const regionCard = document.createElement('div');
      regionCard.className = `region-section ${region.backgroundClass}`;
      
      const isLocked = region.unlockRequirement && !this.completedLevels.has(region.unlockRequirement.completedLevel);

      regionCard.innerHTML = `
        <div class="region-header">
          <div>
            <h2 class="region-title" style="color: ${region.accentColor}">${region.name}</h2>
            <p class="region-desc">${region.description}</p>
          </div>
          ${isLocked ? '<span class="badge badge-locked">🔒 Locked (Complete Previous Region)</span>' : '<span class="badge badge-unlocked">✨ Unlocked</span>'}
        </div>
        <div class="region-nodes-grid" id="nodes-region-${region.id}"></div>
      `;

      this.mapContainer.appendChild(regionCard);

      const nodesGrid = regionCard.querySelector(`#nodes-region-${region.id}`);
      const regionLevels = window.LEVELS.filter(l => l.regionId === region.id);

      regionLevels.forEach(lvl => {
        const isUnlocked = !isLocked && this.unlockedLevels.includes(lvl.id);
        const completion = this.completedLevels.get(lvl.id);

        const nodeBtn = document.createElement('div');
        nodeBtn.className = `level-node-card ${isUnlocked ? 'node-available' : 'node-locked'} ${completion ? 'node-cleared' : ''}`;
        
        let starsDisplay = '';
        if (completion) {
          starsDisplay = '★'.repeat(completion.stars) + '☆'.repeat(3 - completion.stars);
        }

        nodeBtn.innerHTML = `
          <div class="node-id-circle">${lvl.id}</div>
          <div class="node-info">
            <div class="node-name">${lvl.name}</div>
            <div class="node-objectives">${lvl.mainObjective.description} | ${lvl.echoObjective.description}</div>
            ${completion ? `<div class="node-stars">${starsDisplay} (${completion.score.toLocaleString()} pts)</div>` : ''}
            ${lvl.branch ? `<span class="branch-tag">Route ${lvl.branch}</span>` : ''}
          </div>
          <div class="node-action">
            ${isUnlocked ? '<button class="btn btn-primary btn-sm">Enter</button>' : '<span class="lock-icon">🔒</span>'}
          </div>
        `;

        if (isUnlocked) {
          const launch = () => {
            this.gameEngine.startLevel(lvl);
            this.screenManager.showScreen('game');
          };
          nodeBtn.addEventListener('click', launch);
          nodeBtn.querySelector('.btn-primary')?.addEventListener('click', (e) => {
            e.stopPropagation();
            launch();
          });
        }

        nodesGrid.appendChild(nodeBtn);
      });
    });
  }

  /**
   * Banana API Mystery Challenge View
   */
  initBananaChallengeUI() {
    const btnLoad = document.getElementById('btn-load-banana-challenge');
    const formVerify = document.getElementById('banana-verify-form');
    const imgElement = document.getElementById('banana-puzzle-image');
    const loadingSpinner = document.getElementById('banana-loading');
    const challengeArea = document.getElementById('banana-challenge-area');
    const errorNotice = document.getElementById('banana-error-notice');
    const rewardNotice = document.getElementById('banana-reward-notice');

    if (btnLoad) {
      btnLoad.addEventListener('click', async () => {
        errorNotice.style.display = 'none';
        rewardNotice.style.display = 'none';
        loadingSpinner.style.display = 'block';
        challengeArea.style.display = 'none';
        btnLoad.disabled = true;

        const result = await this.apiClient.getBananaChallenge();
        loadingSpinner.style.display = 'none';
        btnLoad.disabled = false;

        if (result.success && result.challenge) {
          this.activeBananaChallenge = result.challenge;
          imgElement.src = result.challenge.question;
          challengeArea.style.display = 'block';
          document.getElementById('banana-answer-input').value = '';
          document.getElementById('banana-answer-input').focus();
        } else {
          errorNotice.textContent = result.error || 'The external University Banana API is currently experiencing downtime. Please retry in a moment!';
          errorNotice.style.display = 'block';
        }
      });
    }

    if (formVerify) {
      formVerify.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!this.activeBananaChallenge) return;

        const inputVal = document.getElementById('banana-answer-input').value.trim();
        if (!inputVal) return;

        const submitBtn = document.getElementById('btn-submit-banana-answer');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Verifying...';

        const result = await this.apiClient.submitBananaAnswer(this.activeBananaChallenge.challengeId, inputVal);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Answer';

        if (result.success && result.isCorrect) {
          rewardNotice.className = 'alert alert-success';
          rewardNotice.innerHTML = `
            <strong>🎉 Correct Solution!</strong> You unlocked <strong>+${result.pointsAwarded || 500} Points</strong> 
            and <strong>+${result.fragmentsAwarded || 30} Relic Fragments</strong>!
          `;
          rewardNotice.style.display = 'block';
          challengeArea.style.display = 'none';
          this.activeBananaChallenge = null;

          // Dispatch reward
          this.eventBus.emit('banana:reward_earned', result);
        } else {
          rewardNotice.className = 'alert alert-danger';
          rewardNotice.innerHTML = `
            <strong>❌ Incorrect or Expired.</strong> The magic seal remains unbroken. Try loading a new mystery puzzle!
          `;
          rewardNotice.style.display = 'block';
        }
      });
    }
  }

  /**
   * Relic Fusion & Inventory View
   */
  initRelicScreenUI() {
    this.updateRelicFusionScreen();
  }

  updateRelicFusionScreen() {
    const grid = document.getElementById('relic-crafting-grid');
    const balanceEl = document.getElementById('relic-fragment-balance');
    const relicMgr = this.gameEngine.relicManager;

    if (balanceEl && relicMgr) {
      balanceEl.textContent = relicMgr.fragments;
    }

    if (!grid || !relicMgr) return;
    grid.innerHTML = '';

    Object.keys(RelicManager.RELIC_DEFINITIONS).forEach(key => {
      const def = RelicManager.RELIC_DEFINITIONS[key];
      const count = relicMgr.inventory[key] || 0;
      const canAfford = relicMgr.fragments >= def.cost;

      const card = document.createElement('div');
      card.className = 'relic-craft-card';
      card.innerHTML = `
        <div class="relic-card-icon">${def.icon}</div>
        <h3 class="relic-card-title">${def.name}</h3>
        <p class="relic-card-desc">${def.description}</p>
        <div class="relic-card-meta">
          <span>In Inventory: <strong>${count}</strong></span>
          <span class="cost-tag">Cost: <strong>${def.cost} 💎</strong></span>
        </div>
        <button class="btn btn-primary btn-craft ${!canAfford ? 'btn-disabled' : ''}" data-relic="${def.id}">
          Fuse Relic
        </button>
      `;

      card.querySelector('.btn-craft').addEventListener('click', async () => {
        if (!canAfford) {
          alert(`You need ${def.cost} relic fragments to craft ${def.name}. Earn more by completing levels and solving Banana challenges!`);
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
      });

      grid.appendChild(card);
    });
  }

  updateFragmentDisplays(fragments) {
    const els = document.querySelectorAll('.dynamic-fragment-count');
    els.forEach(el => el.textContent = fragments);
    const balanceEl = document.getElementById('relic-fragment-balance');
    if (balanceEl) balanceEl.textContent = fragments;
  }

  /**
   * Online Leaderboard
   */
  async loadLeaderboard() {
    if (!this.apiClient.isAuthenticated()) {
      this.screenManager.showToast('Please sign in or register to view the Global Leaderboard!', 'warning', 3500);
      this.screenManager.showScreen('auth');
      return;
    }
    if (!this.leaderboardBody) return;
    this.leaderboardBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading realm champions...</td></tr>';

    const result = await this.apiClient.getLeaderboard(20);
    if (!result.success || !result.entries || result.entries.length === 0) {
      this.leaderboardBody.innerHTML = '<tr><td colspan="5" class="text-center">No champions recorded yet. Play a level to claim rank #1!</td></tr>';
      return;
    }

    this.leaderboardBody.innerHTML = '';
    result.entries.forEach((entry, idx) => {
      const row = document.createElement('tr');
      const isTop3 = idx < 3;
      const rankBadge = isTop3 ? ['🥇', '🥈', '🥉'][idx] : `#${idx + 1}`;

      row.innerHTML = `
        <td class="font-bold">${rankBadge}</td>
        <td>
          <div class="player-entry-name">${entry.username}</div>
          <div class="player-entry-title text-muted">${entry.title || 'Crystal Seeker'}</div>
        </td>
        <td class="text-right font-bold text-accent">${entry.totalScore.toLocaleString()}</td>
        <td class="text-center">★ ${entry.totalStars || 0}</td>
        <td class="text-center">${entry.levelsCleared || 0}</td>
      `;
      this.leaderboardBody.appendChild(row);
    });
  }

  /**
   * Player Profile View
   */
  async loadProfileScreen() {
    const unauthedSection = document.getElementById('profile-unauthenticated');
    const authedSection = document.getElementById('profile-authenticated');

    if (!this.apiClient.isAuthenticated()) {
      if (unauthedSection) unauthedSection.style.display = 'block';
      if (authedSection) authedSection.style.display = 'none';
      return;
    }

    if (unauthedSection) unauthedSection.style.display = 'none';
    if (authedSection) authedSection.style.display = 'block';

    const profileRes = await this.apiClient.getProfile();
    if (profileRes.success && profileRes.user) {
      const u = profileRes.user;
      document.getElementById('profile-username').textContent = u.username;
      document.getElementById('profile-title').textContent = u.adventurerTitle || 'Grand Arch-Mage';
      document.getElementById('profile-total-score').textContent = (u.totalScore || 0).toLocaleString();
      document.getElementById('profile-total-stars').textContent = u.totalStars || 0;
      document.getElementById('profile-cleared-levels').textContent = u.levelsCleared || 0;
      document.getElementById('profile-created-date').textContent = new Date(u.createdAt).toLocaleDateString();

      if (profileRes.inventory && this.gameEngine.relicManager) {
        this.gameEngine.relicManager.syncFromServer({
          fragments: u.relicFragments,
          inventory: profileRes.inventory
        });
      }
    }
  }

  /**
   * Authentication Forms (Login / Register / Logout)
   */
  initAuthForms() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const logoutBtn = document.getElementById('btn-logout');

    const updateHeaderBadge = () => {
      const isAuthed = this.apiClient.isAuthenticated();

      // Update nav link lock badges for protected areas
      const protectedNavs = [
        { id: 'map', name: 'Adventure Map' },
        { id: 'game', name: 'Battle Board' },
        { id: 'leaderboard', name: 'Leaderboard' }
      ];
      protectedNavs.forEach(nav => {
        const link = document.querySelector(`.app-nav [data-nav-target="${nav.id}"]`);
        if (link) {
          link.innerHTML = isAuthed ? nav.name : `${nav.name} <span class="nav-lock-badge" title="Sign In Required">🔒</span>`;
        }
      });

      if (!this.userStatusBadge) return;
      if (isAuthed) {
        const user = this.apiClient.currentUser;
        this.userStatusBadge.innerHTML = `
          <span class="user-badge-name">🛡️ ${user?.username || 'Adventurer'}</span>
          <button id="btn-quick-logout" class="btn btn-ghost btn-xs">Logout</button>
        `;
        document.getElementById('btn-quick-logout')?.addEventListener('click', () => {
          this.apiClient.clearSession();
          updateHeaderBadge();
          this.screenManager.showToast('Logged out successfully.', 'info', 2500);
          this.screenManager.showScreen('home');
        });
      } else {
        this.userStatusBadge.innerHTML = `
          <button class="btn btn-outline btn-xs" data-nav-target="auth">Sign In / Register</button>
        `;
        this.userStatusBadge.querySelector('button')?.addEventListener('click', () => {
          this.screenManager.showScreen('auth');
        });
      }
    };

    updateHeaderBadge();

    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const errEl = document.getElementById('login-error');
        errEl.style.display = 'none';

        const res = await this.apiClient.login(username, password);
        if (res.success) {
          updateHeaderBadge();
          this.screenManager.showScreen('map');
          this.renderWorldMap();
        } else {
          errEl.textContent = res.error;
          errEl.style.display = 'block';
        }
      });
    }

    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('reg-username').value.trim();
        const password = document.getElementById('reg-password').value;
        const adventurerTitle = document.getElementById('reg-title').value;
        const errEl = document.getElementById('register-error');
        errEl.style.display = 'none';

        const res = await this.apiClient.register(username, password, adventurerTitle);
        if (res.success) {
          updateHeaderBadge();
          this.screenManager.showScreen('map');
          this.renderWorldMap();
        } else {
          errEl.textContent = res.error;
          errEl.style.display = 'block';
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.apiClient.clearSession();
        updateHeaderBadge();
        this.screenManager.showToast('Logged out successfully.', 'info', 2500);
        this.screenManager.showScreen('home');
      });
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIManager;
} else {
  window.UIManager = UIManager;
}
