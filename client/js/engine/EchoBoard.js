/**
 * EchoBoard - Secondary Connected Dual-Puzzle Engine
 * 
 * Signature mechanic of PuzzleQuest:
 * Reacts to MainBoard matches, collects Echo Energy,
 * charges ancient conduits, and shatters crystalline barriers.
 */
class EchoBoard {
  /**
   * @param {Object} options
   * @param {number} [options.rows=4] - Grid height
   * @param {number} [options.cols=4] - Grid width
   * @param {Array<Object>} [options.initialCells] - Custom cell definitions
   * @param {number} [options.targetGlyphs=3] - Target glyphs needed for victory
   * @param {EventBus} [options.eventBus] - Central event bus
   */
  constructor(options = {}) {
    this.rows = options.rows || 4;
    this.cols = options.cols || 4;
    this.targetGlyphs = options.targetGlyphs || 3;
    this.unlockedGlyphsCount = 0;
    this.totalEnergyAccumulated = 0;
    this.energyMultiplier = 1.0;
    this.multiplierTurnsRemaining = 0;
    this.eventBus = options.eventBus || (typeof window !== 'undefined' ? window.gameEventBus : null);

    this.grid = [];
    this.setupCells(options.initialCells);
    this.bindEvents();
  }

  /**
   * Initialize Echo Board cells
   */
  setupCells(customCells = null) {
    this.grid = [];
    this.unlockedGlyphsCount = 0;
    this.totalEnergyAccumulated = 0;

    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.cols; c++) {
        // Default layout: some normal conduits, some locked barrier runes
        const isCenterOrCorner = (r === 1 || r === 2) && (c === 1 || c === 2);
        const cell = {
          row: r,
          col: c,
          id: `echo_${r}_${c}`,
          type: isCenterOrCorner ? 'barrier' : 'conduit',
          state: isCenterOrCorner ? 'locked' : 'idle',
          runeGlyph: ['᚛', '᚜', 'ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ'][((r * this.cols) + c) % 8],
          energyRequired: isCenterOrCorner ? 50 + (r * 25) : 30,
          currentEnergy: 0,
          isCompleted: false
        };
        row.push(cell);
      }
      this.grid.push(row);
    }

    // Apply custom cell configs if provided by level definition
    if (customCells && Array.isArray(customCells)) {
      for (const custom of customCells) {
        if (this.grid[custom.row] && this.grid[custom.row][custom.col]) {
          Object.assign(this.grid[custom.row][custom.col], custom);
        }
      }
    }
  }

  /**
   * Listen to energy generation events from the main game engine
   */
  bindEvents() {
    if (!this.eventBus) return;

    this.eventBus.on('echo:energy_generated', (data) => {
      this.receiveEnergy(data.amount, data.sourceTiles);
    });

    this.eventBus.on('relic:echo_amplifier_activated', (data) => {
      this.energyMultiplier = data.multiplier || 2.5;
      this.multiplierTurnsRemaining = data.durationMoves || 3;
      if (this.eventBus) {
        this.eventBus.emit('echo:multiplier_updated', {
          multiplier: this.energyMultiplier,
          turnsRemaining: this.multiplierTurnsRemaining
        });
      }
    });

    this.eventBus.on('game:turn_ended', () => {
      if (this.multiplierTurnsRemaining > 0) {
        this.multiplierTurnsRemaining--;
        if (this.multiplierTurnsRemaining === 0) {
          this.energyMultiplier = 1.0;
        }
        if (this.eventBus) {
          this.eventBus.emit('echo:multiplier_updated', {
            multiplier: this.energyMultiplier,
            turnsRemaining: this.multiplierTurnsRemaining
          });
        }
      }
    });
  }

  /**
   * Apply incoming Echo Energy to locked barriers and conduits
   */
  receiveEnergy(baseAmount, sourceTiles = []) {
    const finalAmount = Math.round(baseAmount * this.energyMultiplier);
    this.totalEnergyAccumulated += finalAmount;

    // Prioritize locked cells to break barriers first, otherwise charge conduits
    let targetCells = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (!cell.isCompleted && cell.state === 'locked') {
          targetCells.push(cell);
        }
      }
    }

    // If no locked cells, target idle conduits
    if (targetCells.length === 0) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const cell = this.grid[r][c];
          if (!cell.isCompleted) {
            targetCells.push(cell);
          }
        }
      }
    }

    const newlyUnlocked = [];

    if (targetCells.length > 0) {
      // Allocate energy across remaining cells
      const sharePerCell = Math.max(1, Math.ceil(finalAmount / targetCells.length));

      for (const cell of targetCells) {
        cell.currentEnergy = Math.min(cell.energyRequired, cell.currentEnergy + sharePerCell);
        
        if (cell.currentEnergy >= cell.energyRequired && !cell.isCompleted) {
          cell.isCompleted = true;
          cell.state = 'unlocked';
          this.unlockedGlyphsCount++;
          newlyUnlocked.push(cell);
        }
      }
    }

    if (this.eventBus) {
      this.eventBus.emit('echo:energy_applied', {
        amountAdded: finalAmount,
        totalEnergy: this.totalEnergyAccumulated,
        multiplier: this.energyMultiplier,
        newlyUnlocked,
        unlockedGlyphsCount: this.unlockedGlyphsCount,
        targetGlyphs: this.targetGlyphs,
        sourceTiles
      });

      if (this.isObjectiveComplete()) {
        this.eventBus.emit('echo:objective_completed', {
          unlockedGlyphsCount: this.unlockedGlyphsCount,
          totalEnergy: this.totalEnergyAccumulated
        });
      }
    }

    return {
      finalAmount,
      newlyUnlocked,
      objectiveMet: this.isObjectiveComplete()
    };
  }

  /**
   * Destroy a barrier instantly (Relic effect: Barrier Breaker)
   */
  breakBarrier(row, col) {
    const cell = this.getCell(row, col);
    if (!cell || cell.isCompleted) return false;

    cell.currentEnergy = cell.energyRequired;
    cell.state = 'unlocked';
    cell.isCompleted = true;
    this.unlockedGlyphsCount++;

    if (this.eventBus) {
      this.eventBus.emit('echo:barrier_broken_by_relic', {
        cell,
        unlockedGlyphsCount: this.unlockedGlyphsCount,
        targetGlyphs: this.targetGlyphs
      });

      if (this.isObjectiveComplete()) {
        this.eventBus.emit('echo:objective_completed', {
          unlockedGlyphsCount: this.unlockedGlyphsCount
        });
      }
    }

    return true;
  }

  /**
   * Get cell at row and col
   */
  getCell(r, c) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return null;
    return this.grid[r][c];
  }

  /**
   * Check if Echo Board objective has been met
   */
  isObjectiveComplete() {
    return this.unlockedGlyphsCount >= this.targetGlyphs;
  }

  /**
   * Reset the board for a new level/restart
   */
  reset(levelEchoConfig = null) {
    this.setupCells(levelEchoConfig?.cells);
    if (levelEchoConfig?.targetGlyphs) {
      this.targetGlyphs = levelEchoConfig.targetGlyphs;
    }
    this.energyMultiplier = 1.0;
    this.multiplierTurnsRemaining = 0;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EchoBoard;
} else {
  window.EchoBoard = EchoBoard;
}
