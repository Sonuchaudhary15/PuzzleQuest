/**
 * GameEngine - Central Coordinator for PuzzleQuest Game State
 * 
 * Orchestrates MainBoard, EchoBoard, RelicManager, Level Objectives,
 * move accounting, win/loss evaluation, and audit histories.
 */
class GameEngine {
  /**
   * @param {Object} options
   * @param {EventBus} options.eventBus
   * @param {MainBoard} options.mainBoard
   * @param {EchoBoard} options.echoBoard
   * @param {RelicManager} options.relicManager
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus || (typeof window !== 'undefined' ? window.gameEventBus : null);
    this.mainBoard = options.mainBoard;
    this.echoBoard = options.echoBoard;
    this.relicManager = options.relicManager;

    this.currentLevel = null;
    this.score = 0;
    this.movesRemaining = 0;
    this.initialMoves = 0;
    this.gameState = 'IDLE'; // 'IDLE', 'PLAYING', 'PROCESSING', 'WON', 'LOST'
    
    // Objectives tracker
    this.mainObjective = {
      type: 'collect_gems',
      required: 0,
      current: 0,
      targetScore: 0
    };

    // Audit logs for server-side validation
    this.moveHistory = [];
    this.startedAt = null;
    this.maxComboStreak = 0;

    this.bindEvents();
  }

  bindEvents() {
    if (!this.eventBus) return;

    // Listen to matches detected
    this.eventBus.on('match:detected', (data) => {
      // Calculate cascade streak bonus multiplier
      const comboMultiplier = Math.max(1, (data.combo || 1));
      const streakBonus = comboMultiplier > 1 ? (comboMultiplier - 1) * 25 : 0;
      const totalScoreGained = data.scoreGained + streakBonus;
      this.score += totalScoreGained;
      if (comboMultiplier > this.maxComboStreak) {
        this.maxComboStreak = comboMultiplier;
      }

      // Update gem collection objective
      if (this.currentLevel && this.mainObjective) {
        for (const t of data.removedTiles) {
          if (this.mainObjective.gemType && t.type === this.mainObjective.gemType) {
            this.mainObjective.current++;
          }
        }
      }

      this.eventBus.emit('score:updated', {
        score: this.score,
        gained: totalScoreGained,
        combo: data.combo,
        streakBonus: streakBonus
      });

      this.eventBus.emit('objective:updated', {
        main: { ...this.mainObjective },
        echo: {
          current: this.echoBoard.unlockedGlyphsCount,
          required: this.echoBoard.targetGlyphs
        }
      });
    });

    // Listen to Echo Board glyph unlocks
    this.eventBus.on('echo:energy_applied', () => {
      this.eventBus.emit('objective:updated', {
        main: { ...this.mainObjective },
        echo: {
          current: this.echoBoard.unlockedGlyphsCount,
          required: this.echoBoard.targetGlyphs
        }
      });
      this.checkGameStatus();
    });

    this.eventBus.on('echo:barrier_broken_by_relic', () => {
      this.eventBus.emit('objective:updated', {
        main: { ...this.mainObjective },
        echo: {
          current: this.echoBoard.unlockedGlyphsCount,
          required: this.echoBoard.targetGlyphs
        }
      });
      this.checkGameStatus();
    });
  }

  /**
   * Load and initialize a level
   * @param {Object} levelDefinition
   */
  startLevel(levelDefinition) {
    this.currentLevel = levelDefinition;
    this.score = 0;
    this.movesRemaining = levelDefinition.moves || 20;
    this.initialMoves = this.movesRemaining;
    this.gameState = 'PLAYING';
    this.moveHistory = [];
    this.startedAt = Date.now();
    this.maxComboStreak = 0;

    // Setup objectives
    this.mainObjective = {
      ...levelDefinition.mainObjective,
      current: 0
    };

    // Reconfigure boards
    this.mainBoard.rows = levelDefinition.rows || 8;
    this.mainBoard.cols = levelDefinition.cols || 8;
    this.mainBoard.initialize();

    this.echoBoard.reset(levelDefinition.echoConfig);
    this.echoBoard.targetGlyphs = levelDefinition.echoObjective.targetGlyphs;

    if (this.relicManager) {
      this.relicManager.resetForBattle();
    }

    if (this.eventBus) {
      this.eventBus.emit('game:started', {
        level: this.currentLevel,
        moves: this.movesRemaining,
        score: this.score,
        mainObjective: this.mainObjective,
        echoObjective: {
          targetGlyphs: this.echoBoard.targetGlyphs,
          current: 0
        }
      });
    }
  }

  /**
   * Handle player attempt to swap two tiles
   */
  async handlePlayerSwap(r1, c1, r2, c2) {
    if (this.gameState !== 'PLAYING' || this.movesRemaining <= 0 || this.mainBoard.isProcessing) {
      return { success: false, reason: 'INVALID_STATE' };
    }

    // Attempt swap in match-three engine
    const result = await this.mainBoard.swapTiles(r1, c1, r2, c2);

    if (result.success) {
      this.movesRemaining--;
      
      this.moveHistory.push({
        type: 'swap',
        from: { r: r1, c: c1 },
        to: { r: r2, c: c2 },
        movesRemaining: this.movesRemaining,
        scoreAfter: this.score,
        timestamp: Date.now()
      });

      if (this.eventBus) {
        this.eventBus.emit('game:move_used', {
          movesRemaining: this.movesRemaining,
          initialMoves: this.initialMoves
        });
        this.eventBus.emit('game:turn_ended');
      }

      // Check if win or lose
      this.checkGameStatus();
    }

    return result;
  }

  /**
   * Check if main board objective is fulfilled
   */
  isMainObjectiveMet() {
    if (!this.mainObjective) return true;

    if (this.mainObjective.type === 'collect_gems') {
      return this.mainObjective.current >= this.mainObjective.required;
    }

    if (this.mainObjective.type === 'score_and_gems') {
      const scoreOk = this.score >= (this.mainObjective.targetScore || 0);
      const gemsOk = this.mainObjective.current >= this.mainObjective.required;
      return scoreOk && gemsOk;
    }

    return true;
  }

  /**
   * Check if echo board objective is fulfilled
   */
  isEchoObjectiveMet() {
    return this.echoBoard.isObjectiveComplete();
  }

  /**
   * Check win / lose game status
   */
  checkGameStatus() {
    if (this.gameState !== 'PLAYING') return;

    const mainWon = this.isMainObjectiveMet();
    const echoWon = this.isEchoObjectiveMet();

    // Both objectives complete -> WIN!
    if (mainWon && echoWon) {
      this.gameState = 'WON';
      const stars = this.calculateStars();

      // Bonus points for leftover moves
      const moveBonus = this.movesRemaining * 250;
      this.score += moveBonus;

      const completionData = {
        levelId: this.currentLevel.id,
        levelName: this.currentLevel.name,
        score: this.score,
        stars,
        movesRemaining: this.movesRemaining,
        movesUsed: this.initialMoves - this.movesRemaining,
        durationSeconds: Math.round((Date.now() - this.startedAt) / 1000),
        validationToken: this.generateValidationToken(),
        moveHistory: this.moveHistory
      };

      if (this.eventBus) {
        this.eventBus.emit('game:win', completionData);
        this.eventBus.emit('level:completed', completionData);
      }

      return;
    }

    // Moves exhausted without completing both objectives -> LOSE!
    if (this.movesRemaining <= 0) {
      this.gameState = 'LOST';
      const defeatData = {
        levelId: this.currentLevel.id,
        score: this.score,
        mainObjective: { ...this.mainObjective },
        echoObjective: {
          current: this.echoBoard.unlockedGlyphsCount,
          required: this.echoBoard.targetGlyphs
        }
      };

      if (this.eventBus) {
        this.eventBus.emit('game:lose', defeatData);
      }
    }
  }

  /**
   * Calculate 1-3 stars based on thresholds
   */
  calculateStars() {
    if (!this.currentLevel?.starThresholds) return 1;
    const [star1, star2, star3] = this.currentLevel.starThresholds;

    if (this.score >= star3) return 3;
    if (this.score >= star2) return 2;
    if (this.score >= star1) return 1;
    return 1;
  }

  /**
   * Generates a lightweight checksum/validation token to verify legitimate play
   */
  generateValidationToken() {
    const raw = `${this.currentLevel?.id}:${this.score}:${this.movesRemaining}:${this.moveHistory.length}:${this.startedAt}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return `val_${Math.abs(hash).toString(16)}`;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameEngine;
} else {
  window.GameEngine = GameEngine;
}
