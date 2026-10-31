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
    this.inGameMysteryModal = document.getElementById('in-game-mystery-modal');
    this.btnSummonRift = document.getElementById('btn-summon-rift');
    this.inGameMysteryTimer = null;
    this.activeInGameChallenge = null;

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
    this.eventBus.on('game:mystery_rift_triggered', (data) => this.openInGameMysteryModal(data));

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
    document.getElementById('btn-summon-rift')?.addEventListener('click', () => {
      if (this.gameEngine.mysteryRiftCompleted) {
        this.screenManager?.showToast('Arcane Rift power already claimed in this battle!', 'info');
      } else {
        this.openInGameMysteryModal({ level: this.gameEngine.currentLevel, manual: true });
      }
    });

    // In-Game Mystery Rift Modal Controls
    document.getElementById('btn-close-mystery-top')?.addEventListener('click', () => {
      this.closeInGameMysteryModal();
    });
    document.getElementById('btn-skip-mystery')?.addEventListener('click', () => {
      this.closeInGameMysteryModal();
    });
    document.querySelectorAll('#in-game-mystery-modal .btn-num-key').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const val = e.currentTarget.getAttribute('data-val');
        const input = document.getElementById('in-game-mystery-answer');
        if (input) {
          input.value = val;
          document.querySelectorAll('#in-game-mystery-modal .btn-num-key').forEach(b => b.classList.remove('active'));
          e.currentTarget.classList.add('active');
        }
      });
    });
    document.getElementById('btn-cast-mystery-answer')?.addEventListener('click', () => {
      this.handleCastInGameMysteryAnswer();
    });
    document.getElementById('in-game-mystery-answer')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleCastInGameMysteryAnswer();
      }
    });

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

    const riftBtn = document.getElementById('btn-summon-rift');
    if (riftBtn) {
      riftBtn.textContent = '🌌 Arcane Rift';
      riftBtn.style.animation = 'riftPulse 2.5s infinite ease-in-out';
      riftBtn.style.opacity = '1';
    }

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
   * In-Game Arcane Mystery Rift Controller
   * Appears during gameplay: provides bonus score, bonus moves & relic fragments
   * Scales in difficulty and timer countdown per level!
   */
  async openInGameMysteryModal(data = {}) {
    if (!this.inGameMysteryModal) return;

    // Determine level difficulty
    const currentLvl = data.level || this.gameEngine.currentLevel || { id: 1 };
    const levelId = Math.max(1, parseInt(currentLvl.id, 10) || 1);

    // Dynamic Level Difficulty Scaling:
    // Level 1 starts with 45s, decreasing by 3s per level down to 12s on Level 12 Boss!
    const timeLimit = Math.max(12, 45 - (levelId - 1) * 3);
    const bonusScore = 500 + Math.max(0, (levelId - 1) * 50);
    const bonusFragments = 30 + Math.max(0, (levelId - 1) * 5);

    // Update Difficulty Badges & Header
    const badgeEl = document.getElementById('mystery-difficulty-badge');
    const timerLabel = document.getElementById('mystery-timer-label');
    const timerBar = document.getElementById('mystery-timer-bar');
    const descEl = document.getElementById('mystery-rift-desc');
    const loadingEl = document.getElementById('in-game-mystery-loading');
    const bodyEl = document.getElementById('in-game-mystery-body');
    const noticeEl = document.getElementById('in-game-mystery-notice');
    const inputEl = document.getElementById('in-game-mystery-answer');
    const castBtn = document.getElementById('btn-cast-mystery-answer');
    const imgEl = document.getElementById('in-game-mystery-img');

    if (badgeEl) {
      let badgeClass = 'badge-success';
      let title = `Level ${levelId}: Novice Rift (${timeLimit}s)`;
      if (levelId >= 4 && levelId <= 7) {
        badgeClass = 'badge-warning';
        title = `Level ${levelId}: Adept Trial (${timeLimit}s)`;
      } else if (levelId >= 8 && levelId <= 11) {
        badgeClass = 'badge-danger';
        title = `Level ${levelId}: Scholar Crucible (${timeLimit}s)`;
      } else if (levelId >= 12) {
        badgeClass = 'badge-danger';
        title = `Level 12: Apex Boss Rift (${timeLimit}s - Extreme)`;
      }
      badgeEl.className = `badge ${badgeClass}`;
      badgeEl.textContent = title;
    }

    if (descEl) {
      descEl.textContent = `Decipher the equation within ${timeLimit}s to unlock +${bonusScore} Battle Score, +2 Extra Moves & +${bonusFragments} Relic Fragments!`;
    }

    if (timerLabel) timerLabel.textContent = `⏳ ${timeLimit}s`;
    if (timerBar) {
      timerBar.style.width = '100%';
      timerBar.style.background = '#10b981';
    }

    if (noticeEl) noticeEl.style.display = 'none';
    if (inputEl) {
      inputEl.value = '';
      inputEl.disabled = false;
    }
    if (castBtn) {
      castBtn.disabled = false;
      castBtn.textContent = 'Cast Answer ⚡';
    }
    document.querySelectorAll('#in-game-mystery-modal .btn-num-key').forEach(b => b.classList.remove('active'));

    // Display loading spinner while fetching puzzle
    if (loadingEl) loadingEl.style.display = 'block';
    if (bodyEl) bodyEl.style.display = 'none';

    // Show modal overlay
    this.inGameMysteryModal.classList.add('modal-open');

    // Fetch challenge from Banana API
    const result = await this.apiClient.getBananaChallenge();

    if (loadingEl) loadingEl.style.display = 'none';

    if (result.success && result.challenge) {
      this.activeInGameChallenge = {
        ...result.challenge,
        levelId,
        bonusScore,
        bonusFragments,
        timeLimit
      };

      if (imgEl) imgEl.src = result.challenge.question;
      if (bodyEl) bodyEl.style.display = 'block';
      if (inputEl) inputEl.focus();

      // Start Countdown Timer
      this.startInGameMysteryCountdown(timeLimit);
    } else {
      // Graceful notice if external service unreachable
      if (noticeEl) {
        noticeEl.className = 'mystery-notice alert-warning';
        noticeEl.innerHTML = `<strong>⚠️ Rift Sealed:</strong> ${result.error || 'The external Banana API is momentarily unavailable. Continue your battle!'}`;
        noticeEl.style.display = 'block';
      }
    }
  }

  /**
   * Start countdown timer for in-game mystery challenge
   */
  startInGameMysteryCountdown(totalSeconds) {
    if (this.inGameMysteryTimer) {
      clearInterval(this.inGameMysteryTimer);
      this.inGameMysteryTimer = null;
    }

    let remaining = totalSeconds;
    const timerLabel = document.getElementById('mystery-timer-label');
    const timerBar = document.getElementById('mystery-timer-bar');

    this.inGameMysteryTimer = setInterval(() => {
      remaining--;

      if (timerLabel) timerLabel.textContent = `⏳ ${remaining}s`;
      if (timerBar) {
        const pct = Math.max(0, (remaining / totalSeconds) * 100);
        timerBar.style.width = `${pct}%`;
        if (pct < 30) {
          timerBar.style.background = '#ef4444';
        } else if (pct < 60) {
          timerBar.style.background = '#f59e0b';
        }
      }

      if (remaining <= 0) {
        clearInterval(this.inGameMysteryTimer);
        this.inGameMysteryTimer = null;
        this.handleInGameMysteryTimeout();
      }
    }, 1000);
  }

  /**
   * Handle timer expiration
   */
  handleInGameMysteryTimeout() {
    const noticeEl = document.getElementById('in-game-mystery-notice');
    const castBtn = document.getElementById('btn-cast-mystery-answer');
    const inputEl = document.getElementById('in-game-mystery-answer');

    if (castBtn) castBtn.disabled = true;
    if (inputEl) inputEl.disabled = true;

    if (noticeEl) {
      noticeEl.className = 'mystery-notice alert-warning';
      noticeEl.innerHTML = `<strong>⌛ Time's Up!</strong> The arcane rift collapsed before it could be deciphered. Resuming battle...`;
      noticeEl.style.display = 'block';
    }

    // Auto close after 1.5 seconds so player resumes game seamlessly
    setTimeout(() => {
      this.closeInGameMysteryModal();
    }, 1500);
  }

  /**
   * Close in-game mystery rift modal and resume gameplay seamlessly
   */
  closeInGameMysteryModal() {
    if (this.inGameMysteryTimer) {
      clearInterval(this.inGameMysteryTimer);
      this.inGameMysteryTimer = null;
    }

    if (this.inGameMysteryModal) {
      this.inGameMysteryModal.classList.remove('modal-open');
    }

    this.activeInGameChallenge = null;
  }

  /**
   * Cast player answer for in-game mystery rift
   */
  async handleCastInGameMysteryAnswer() {
    if (!this.activeInGameChallenge) return;

    const inputEl = document.getElementById('in-game-mystery-answer');
    const castBtn = document.getElementById('btn-cast-mystery-answer');
    const noticeEl = document.getElementById('in-game-mystery-notice');
    const answer = inputEl ? inputEl.value.trim() : '';

    if (answer === '') {
      if (inputEl) inputEl.focus();
      return;
    }

    // Stop timer while verifying
    if (this.inGameMysteryTimer) {
      clearInterval(this.inGameMysteryTimer);
      this.inGameMysteryTimer = null;
    }

    if (castBtn) {
      castBtn.disabled = true;
      castBtn.textContent = 'Channeling...';
    }

    const { challengeId, levelId } = this.activeInGameChallenge;
    const result = await this.apiClient.verifyBananaAnswer(challengeId, answer, levelId);

    if (result.success && result.isCorrect) {
      // Award rewards in active battle
      this.gameEngine.applyMysteryRiftReward(result);
      if (this.relicManager) {
        this.relicManager.addFragments(result.fragmentsAwarded || 30, 'In-Game Mystery Rift');
      }

      // Mark rift button in HUD as completed
      const riftBtn = document.getElementById('btn-summon-rift');
      if (riftBtn) {
        riftBtn.textContent = 'Rift Mastered ✨';
        riftBtn.style.animation = 'none';
        riftBtn.style.opacity = '0.7';
      }

      if (noticeEl) {
        noticeEl.className = 'mystery-notice alert-success';
        noticeEl.innerHTML = `
          <strong>🎉 Arcane Mystery Solved!</strong><br/>
          +${result.pointsAwarded || 500} Battle Score, +${result.movesAwarded || 2} Extra Moves & +${result.fragmentsAwarded || 30} Relic Fragments granted!
        `;
        noticeEl.style.display = 'block';
      }

      // Close modal after 1.8 seconds so player can enjoy their bonus moves
      setTimeout(() => {
        this.closeInGameMysteryModal();
      }, 1800);
    } else {
      if (noticeEl) {
        noticeEl.className = 'mystery-notice alert-danger';
        noticeEl.innerHTML = `
          <strong>❌ The magic seal rejected the solution.</strong><br/>
          The rift closed safely. Continuing your battle...
        `;
        noticeEl.style.display = 'block';
      }

      if (castBtn) castBtn.disabled = true;
      if (inputEl) inputEl.disabled = true;

      // Close modal after 1.5 seconds and continue playing!
      setTimeout(() => {
        this.closeInGameMysteryModal();
      }, 1500);
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
   * Online Advanced Leaderboard & Dossier System
   */
  async loadLeaderboard(sortBy = 'score') {
    if (!this.apiClient.isAuthenticated()) {
      this.screenManager.showToast('Please sign in or register to view the Global Leaderboard!', 'warning', 3500);
      this.screenManager.showScreen('auth');
      return;
    }
    if (!this.leaderboardBody) return;

    // Update active tab buttons
    document.querySelectorAll('.filter-tab-btn').forEach(btn => {
      if (btn.dataset.sort === sortBy) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    this.leaderboardBody.innerHTML = '<tr><td colspan="9" class="text-center" style="padding: 30px;">Loading realm champions...</td></tr>';

    const result = await this.apiClient.getLeaderboard(25, sortBy);
    if (!result.success || !result.entries || result.entries.length === 0) {
      this.leaderboardBody.innerHTML = '<tr><td colspan="9" class="text-center" style="padding: 30px;">No champions recorded yet. Play a level to claim rank #1!</td></tr>';
      return;
    }

    const entries = result.entries;
    const currentUsername = this.apiClient.currentUser?.username?.toLowerCase();

    // 1. Render Top 3 Champions Podium
    const podiumEl = document.getElementById('leaderboard-podium');
    if (podiumEl) {
      podiumEl.innerHTML = '';
      const top3 = entries.slice(0, 3);
      // Order podium visually: 2nd (left), 1st (center, tallest), 3rd (right)
      const podiumOrder = [];
      if (top3[1]) podiumOrder.push({ ...top3[1], place: 2, badge: '🥈 2nd', class: 'second' });
      if (top3[0]) podiumOrder.push({ ...top3[0], place: 1, badge: '👑 1st Champion', class: 'first' });
      if (top3[2]) podiumOrder.push({ ...top3[2], place: 3, badge: '🥉 3rd', class: 'third' });

      podiumOrder.forEach(champ => {
        const card = document.createElement('div');
        card.className = `podium-card ${champ.class}`;
        card.innerHTML = `
          <div class="podium-crown">${champ.place === 1 ? '👑' : champ.place === 2 ? '🥈' : '🥉'}</div>
          <div class="podium-avatar">${champ.avatar || '🧙‍♂️'}</div>
          <div class="podium-name">${champ.username}</div>
          <div class="podium-title">${champ.title || 'Crystal Seeker'}</div>
          <span class="badge ${champ.tier === 'Grand Master' ? 'badge-gold' : 'badge-success'}">${champ.tier || 'Novice'}</span>
          <div class="podium-score">${champ.totalScore.toLocaleString()} <small>pts</small></div>
          <div class="podium-stats">
            <span>⭐ ${champ.totalStars}</span> • <span>🗺️ Lvl ${champ.levelsCleared}</span> • <span>🍌 ${champ.bananaSolved || 0}</span>
          </div>
          <button class="btn btn-outline btn-xs" style="margin-top: 10px;">Inspect Dossier</button>
        `;
        card.querySelector('button').addEventListener('click', () => this.openAdventurerDossier(champ));
        podiumEl.appendChild(card);
      });
    }

    // 2. Render Logged-in Adventurer's Standing Banner
    const myStandingEl = document.getElementById('leaderboard-my-standing');
    if (myStandingEl) {
      const myIndex = entries.findIndex(e => e.username.toLowerCase() === currentUsername);
      if (myIndex !== -1) {
        const me = entries[myIndex];
        const ahead = myIndex > 0 ? entries[myIndex - 1] : null;
        const gapText = ahead ? `(${(ahead.totalScore - me.totalScore).toLocaleString()} pts behind #${ahead.rank} ${ahead.username})` : '🏆 Realm Champion #1!';
        myStandingEl.innerHTML = `
          <div class="standing-content">
            <div class="standing-left">
              <span class="standing-rank-badge">Your Rank: #${me.rank}</span>
              <span class="standing-user">🛡️ ${me.username}</span>
              <span class="badge badge-success">${me.tier}</span>
            </div>
            <div class="standing-stats">
              <span><strong>${me.totalScore.toLocaleString()}</strong> pts</span>
              <span>⭐ <strong>${me.totalStars}</strong> stars</span>
              <span>🗺️ <strong>${me.levelsCleared}</strong> realms</span>
              <span class="standing-gap text-muted">${gapText}</span>
            </div>
          </div>
        `;
        myStandingEl.style.display = 'block';
      } else {
        myStandingEl.innerHTML = `
          <div class="standing-content" style="justify-content: center;">
            <span>Complete levels on the Adventure Map to claim your verified rank on the leaderboard!</span>
          </div>
        `;
        myStandingEl.style.display = 'block';
      }
    }

    // 3. Render Table Rows
    this.leaderboardBody.innerHTML = '';
    entries.forEach((entry, idx) => {
      const row = document.createElement('tr');
      const isMe = entry.username.toLowerCase() === currentUsername;
      if (isMe) row.classList.add('table-row-active-user');

      const rankBadge = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${entry.rank}`;
      const tierClass = entry.tier === 'Grand Master' ? 'tier-grand-master' : entry.tier === 'Adept Conjurer' ? 'tier-adept' : 'tier-scholar';

      row.innerHTML = `
        <td class="font-bold text-center">${rankBadge}</td>
        <td>
          <div class="adventurer-cell">
            <span class="adventurer-avatar">${entry.avatar || '🧙‍♂️'}</span>
            <div>
              <div class="player-entry-name ${isMe ? 'text-primary font-bold' : ''}">
                ${entry.username} ${isMe ? '<span class="badge badge-xs badge-primary">You</span>' : ''}
              </div>
              <div class="player-entry-title text-muted">${entry.title || 'Crystal Seeker'}</div>
            </div>
          </div>
        </td>
        <td><span class="badge ${tierClass}">${entry.tier || 'Novice'}</span></td>
        <td class="text-right font-bold text-accent">${entry.totalScore.toLocaleString()} <small>pts</small></td>
        <td class="text-center font-bold">⭐ ${entry.totalStars || 0}</td>
        <td class="text-center">🗺️ ${entry.levelsCleared || 0}</td>
        <td class="text-center">🍌 ${entry.bananaSolved || 0}</td>
        <td class="text-center text-muted">⚡ x${entry.highestCombo || 4}</td>
        <td class="text-center">
          <button class="btn btn-outline btn-xs btn-inspect-dossier" data-user="${entry.username}">Inspect</button>
        </td>
      `;

      row.querySelector('.btn-inspect-dossier').addEventListener('click', () => {
        this.openAdventurerDossier(entry);
      });

      this.leaderboardBody.appendChild(row);
    });

    // Wire filter tabs
    document.querySelectorAll('.filter-tab-btn').forEach(btn => {
      btn.onclick = (e) => {
        const sort = e.target.dataset.sort;
        this.loadLeaderboard(sort);
      };
    });
  }

  /**
   * Open Adventurer Dossier Inspector Modal
   */
  openAdventurerDossier(adventurer) {
    const modal = document.getElementById('modal-dossier');
    const body = document.getElementById('dossier-body');
    const closeBtn = document.getElementById('btn-close-dossier');
    if (!modal || !body) return;

    body.innerHTML = `
      <div class="dossier-top">
        <div class="dossier-avatar-hero">${adventurer.avatar || '🧙‍♂️'}</div>
        <div class="dossier-hero-info">
          <h2 class="dossier-name">${adventurer.username}</h2>
          <div class="dossier-subtitle">${adventurer.title || 'Crystal Seeker'} • <span class="badge badge-gold">${adventurer.tier || 'Novice'}</span></div>
          <div class="dossier-enlisted text-muted">Enlisted in Realm: ${adventurer.joinedAt || '2026-10-28'} • Verified Rank: #${adventurer.rank || 1}</div>
        </div>
      </div>

      <div class="dossier-stats-grid">
        <div class="dossier-stat-card">
          <div class="dossier-stat-icon">🏆</div>
          <div class="dossier-stat-val">${adventurer.totalScore.toLocaleString()}</div>
          <div class="dossier-stat-lbl">Campaign Score</div>
        </div>
        <div class="dossier-stat-card">
          <div class="dossier-stat-icon">⭐</div>
          <div class="dossier-stat-val">${adventurer.totalStars}</div>
          <div class="dossier-stat-lbl">Stars Mastered</div>
        </div>
        <div class="dossier-stat-card">
          <div class="dossier-stat-icon">🗺️</div>
          <div class="dossier-stat-val">${adventurer.levelsCleared}</div>
          <div class="dossier-stat-lbl">Realms Conquered</div>
        </div>
        <div class="dossier-stat-card">
          <div class="dossier-stat-icon">🍌</div>
          <div class="dossier-stat-val">${adventurer.bananaSolved || 0}</div>
          <div class="dossier-stat-lbl">Banana Puzzles Solved</div>
        </div>
        <div class="dossier-stat-card">
          <div class="dossier-stat-icon">⚡</div>
          <div class="dossier-stat-val">x${adventurer.highestCombo || 4}</div>
          <div class="dossier-stat-lbl">Max Cascade Combo</div>
        </div>
        <div class="dossier-stat-card">
          <div class="dossier-stat-icon">💎</div>
          <div class="dossier-stat-val">${adventurer.relicFragments || 50}</div>
          <div class="dossier-stat-lbl">Relic Fragments</div>
        </div>
      </div>

      <div class="dossier-section-title">Arcane Masteries & Achievements</div>
      <div class="dossier-achievements-row">
        <div class="achievement-pill ${adventurer.totalStars >= 10 ? 'achieved' : 'locked'}">
          <span class="ach-icon">⭐</span>
          <div>
            <div class="ach-name">Starlight Adept</div>
            <div class="ach-sub">Earned 10+ Adventure Stars</div>
          </div>
        </div>
        <div class="achievement-pill ${(adventurer.bananaSolved || 0) >= 3 ? 'achieved' : 'locked'}">
          <span class="ach-icon">🍌</span>
          <div>
            <div class="ach-name">Banana API Scholar</div>
            <div class="ach-sub">Solved external mystery equations</div>
          </div>
        </div>
        <div class="achievement-pill ${(adventurer.highestCombo || 0) >= 4 ? 'achieved' : 'locked'}">
          <span class="ach-icon">⚡</span>
          <div>
            <div class="ach-name">Cascade Weaver</div>
            <div class="ach-sub">Triggered 4x combo reaction</div>
          </div>
        </div>
        <div class="achievement-pill achieved">
          <span class="ach-icon">🛡️</span>
          <div>
            <div class="ach-name">Verified Identity</div>
            <div class="ach-sub">Secured via Bcrypt + JWT token</div>
          </div>
        </div>
      </div>

      <div style="margin-top: 20px; text-align: center;">
        <button id="btn-close-dossier-action" class="btn btn-secondary">Close Dossier</button>
      </div>
    `;

    modal.classList.add('modal-open');

    const closeModal = () => modal.classList.remove('modal-open');
    closeBtn.onclick = closeModal;
    document.getElementById('btn-close-dossier-action').onclick = closeModal;
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };
  }

  /**
   * Player Profile View
   */
  async loadProfileScreen() {
    const unauthedSection = document.getElementById('profile-unauthenticated');
    const authedSection   = document.getElementById('profile-authenticated');

    if (!this.apiClient.isAuthenticated()) {
      if (unauthedSection) unauthedSection.style.display = 'block';
      if (authedSection)   authedSection.style.display   = 'none';
      return;
    }

    if (unauthedSection) unauthedSection.style.display = 'none';
    if (authedSection)   authedSection.style.display   = 'block';

    const profileRes = await this.apiClient.getProfile();
    if (profileRes.success && profileRes.user) {
      const u = profileRes.user;

      // Core identity
      const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

      setEl('profile-username',       u.username || 'Adventurer');
      setEl('profile-title',          u.adventurerTitle || 'Crystal Seeker');
      setEl('profile-total-score',    (u.totalScore || 0).toLocaleString());
      setEl('profile-total-stars',    u.totalStars || 0);
      setEl('profile-cleared-levels', u.levelsCleared || 0);
      setEl('profile-banana-solved',  u.bananaSolved || 0);
      setEl('profile-relic-fragments', (u.relicFragments || 0).toLocaleString());
      setEl('profile-created-date',   u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB', { year:'numeric', month:'long', day:'numeric' }) : 'Recently');

      // Adventurer Tier badge
      const tierEl = document.getElementById('profile-tier-badge');
      if (tierEl) {
        const stars = u.totalStars || 0;
        let tier = 'Apprentice Novice', tierClass = 'tier-novice';
        if (stars >= 12) { tier = '👑 Grand Master';      tierClass = 'tier-grandmaster'; }
        else if (stars >= 8)  { tier = '⚡ Adept Conjurer';  tierClass = 'tier-adept'; }
        else if (stars >= 4)  { tier = '📜 Rune Scholar';    tierClass = 'tier-scholar'; }
        tierEl.textContent = tier;
        tierEl.className = `profile-tier-badge ${tierClass}`;
      }

      // Avatar: pick based on tier
      const avatarEl = document.getElementById('profile-avatar');
      if (avatarEl) {
        const stars = u.totalStars || 0;
        avatarEl.textContent = stars >= 12 ? '🧙‍♀️' : stars >= 8 ? '⚔️' : stars >= 4 ? '🔮' : '🧙‍♂️';
      }

      // Realm Progress bar (based on levels cleared / 12 total levels)
      const totalLevels = 12;
      const cleared = Math.min(u.levelsCleared || 0, totalLevels);
      const pct = Math.round((cleared / totalLevels) * 100);
      const barEl  = document.getElementById('profile-progress-bar');
      const pctEl  = document.getElementById('profile-progress-pct');
      const noteEl = document.getElementById('profile-progress-note');
      if (barEl)  barEl.style.width = `${pct}%`;
      if (pctEl)  pctEl.textContent = `${pct}%`;
      if (noteEl) {
        noteEl.textContent = cleared >= totalLevels
          ? '🎉 All 12 Realm Stages Conquered — Grand Apex Achieved!'
          : `${cleared} / ${totalLevels} Stages cleared — ${totalLevels - cleared} remain to reach Grand Apex!`;
      }

      // Sync relic inventory if present
      if (profileRes.inventory && this.gameEngine?.relicManager) {
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
