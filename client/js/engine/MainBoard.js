/**
 * MainBoard - Match-Three Grid & Physics Engine
 * 
 * Handles board state, swap validation, match-3+ detection,
 * gravity cascades, replacement refills, and chain reactions.
 * Emits events to the central EventBus for audio, UI, and Echo Board reactivity.
 */
class MainBoard {
  /**
   * @param {Object} options
   * @param {number} [options.rows=8] - Grid height
   * @param {number} [options.cols=8] - Grid width
   * @param {Array<string>} [options.gemTypes] - Available gem types
   * @param {EventBus} [options.eventBus] - Event bus instance
   */
  constructor(options = {}) {
    this.rows = options.rows || 8;
    this.cols = options.cols || 8;
    this.gemTypes = options.gemTypes || ['ruby', 'sapphire', 'emerald', 'amethyst', 'topaz'];
    this.eventBus = options.eventBus || (typeof window !== 'undefined' ? window.gameEventBus : null);
    
    this.grid = []; // 2D array: grid[row][col]
    this.isProcessing = false;
    this.selectedTile = null;
    this.shuffleCount = 0;
    
    this.initialize();
  }

  /**
   * Initialize a fresh board without initial matches
   */
  initialize() {
    let attempts = 0;
    do {
      this.grid = [];
      for (let r = 0; r < this.rows; r++) {
        const row = [];
        for (let c = 0; c < this.cols; c++) {
          let available = [...this.gemTypes];
          
          // Prevent horizontal match of 3 during generation
          if (c >= 2) {
            const left1 = row[c - 1]?.type;
            const left2 = row[c - 2]?.type;
            if (left1 && left1 === left2) {
              available = available.filter(t => t !== left1);
            }
          }
          
          // Prevent vertical match of 3 during generation
          if (r >= 2) {
            const up1 = this.grid[r - 1]?.[c]?.type;
            const up2 = this.grid[r - 2]?.[c]?.type;
            if (up1 && up1 === up2) {
              available = available.filter(t => t !== up1);
            }
          }
          
          const chosen = available.length > 0 
            ? available[Math.floor(Math.random() * available.length)]
            : this.gemTypes[Math.floor(Math.random() * this.gemTypes.length)];
            
          row.push(new (typeof Tile !== 'undefined' ? Tile : require('./Tile'))(r, c, chosen));
        }
        this.grid.push(row);
      }
      attempts++;
    } while (this.hasPossibleMoves() === false && attempts < 10);

    if (this.eventBus) {
      this.eventBus.emit('board:initialized', { rows: this.rows, cols: this.cols });
    }
  }

  /**
   * Get tile at coordinate
   */
  getTile(r, c) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return null;
    return this.grid[r][c];
  }

  /**
   * Check if two tiles are adjacent orthogonal neighbours
   */
  isAdjacent(r1, c1, r2, c2) {
    return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
  }

  /**
   * Attempt swapping two adjacent tiles
   * Returns a promise resolving with { success: boolean, matches: Array, cascadeSteps: Array }
   */
  async swapTiles(r1, c1, r2, c2) {
    if (this.isProcessing) {
      return { success: false, reason: 'BUSY' };
    }

    if (!this.isAdjacent(r1, c1, r2, c2)) {
      return { success: false, reason: 'NOT_ADJACENT' };
    }

    const tile1 = this.getTile(r1, c1);
    const tile2 = this.getTile(r2, c2);

    if (!tile1 || !tile2) {
      return { success: false, reason: 'INVALID_TILES' };
    }

    this.isProcessing = true;

    // Swap in grid
    this.executeSwap(r1, c1, r2, c2);

    if (this.eventBus) {
      this.eventBus.emit('tile:swapped', { 
        tileA: { row: r1, col: c1, type: this.grid[r1][c1]?.type }, 
        tileB: { row: r2, col: c2, type: this.grid[r2][c2]?.type } 
      });
    }

    // Allow physical slide animation to play out
    await new Promise(resolve => setTimeout(resolve, 220));

    // Check for matches
    const initialMatches = this.findMatches();

    if (initialMatches.length === 0) {
      // Revert swap
      this.executeSwap(r1, c1, r2, c2);

      if (this.eventBus) {
        this.eventBus.emit('tile:swap_reverted', { r1, c1, r2, c2 });
      }

      // Allow revert slide-back animation to finish before unlocking input
      await new Promise(resolve => setTimeout(resolve, 280));
      this.isProcessing = false;

      return { success: false, reason: 'NO_MATCH' };
    }

    // Valid swap! Resolve matches and cascade
    const cascadeSteps = await this.resolveBoardCascades(initialMatches);
    this.isProcessing = false;

    // Check for reshuffle if no moves remaining
    if (!this.hasPossibleMoves()) {
      this.reshuffle();
    }

    return {
      success: true,
      cascadeSteps
    };
  }

  /**
   * Swaps positions of two tiles in data grid and updates their coordinate properties
   */
  executeSwap(r1, c1, r2, c2) {
    const temp = this.grid[r1][c1];
    this.grid[r1][c1] = this.grid[r2][c2];
    this.grid[r2][c2] = temp;

    if (this.grid[r1][c1]) {
      this.grid[r1][c1].row = r1;
      this.grid[r1][c1].col = c1;
    }
    if (this.grid[r2][c2]) {
      this.grid[r2][c2].row = r2;
      this.grid[r2][c2].col = c2;
    }
  }

  /**
   * Find all horizontal and vertical matches (3 or more of same type)
   * @returns {Array<{type: string, tiles: Array<{row: number, col: number}>, orientation: string, length: number}>}
   */
  findMatches() {
    const matchedCoords = new Set();
    const matchGroups = [];

    // 1. Horizontal scans
    for (let r = 0; r < this.rows; r++) {
      let matchLength = 1;
      for (let c = 0; c < this.cols; c++) {
        const current = this.grid[r][c];
        const next = c + 1 < this.cols ? this.grid[r][c + 1] : null;

        if (current && next && current.type === next.type) {
          matchLength++;
        } else {
          if (matchLength >= 3 && current) {
            const groupTiles = [];
            for (let k = c - matchLength + 1; k <= c; k++) {
              groupTiles.push({ row: r, col: k, type: current.type });
              matchedCoords.add(`${r},${k}`);
            }
            matchGroups.push({
              type: current.type,
              tiles: groupTiles,
              orientation: 'horizontal',
              length: matchLength
            });
          }
          matchLength = 1;
        }
      }
    }

    // 2. Vertical scans
    for (let c = 0; c < this.cols; c++) {
      let matchLength = 1;
      for (let r = 0; r < this.rows; r++) {
        const current = this.grid[r][c];
        const next = r + 1 < this.rows ? this.grid[r + 1][c] : null;

        if (current && next && current.type === next.type) {
          matchLength++;
        } else {
          if (matchLength >= 3 && current) {
            const groupTiles = [];
            for (let k = r - matchLength + 1; k <= r; k++) {
              groupTiles.push({ row: k, col: c, type: current.type });
              matchedCoords.add(`${k},${c}`);
            }
            matchGroups.push({
              type: current.type,
              tiles: groupTiles,
              orientation: 'vertical',
              length: matchLength
            });
          }
          matchLength = 1;
        }
      }
    }

    return matchGroups;
  }

  /**
   * Resolves cascading matches, gravity drop, and tile refills until settled
   */
  async resolveBoardCascades(initialMatches) {
    let currentMatches = initialMatches;
    let combo = 1;
    const cascadeSteps = [];

    while (currentMatches.length > 0) {
      // Collect unique tiles to remove
      const removedCoordsMap = new Map();
      let sapphireCount = 0;
      let totalGemsMatched = 0;

      for (const group of currentMatches) {
        for (const t of group.tiles) {
          const key = `${t.row},${t.col}`;
          if (!removedCoordsMap.has(key)) {
            removedCoordsMap.set(key, t);
            totalGemsMatched++;
            if (t.type === 'sapphire') {
              sapphireCount++;
            }
          }
        }
      }

      const removedTiles = Array.from(removedCoordsMap.values());

      // Nullify matched cells
      for (const t of removedTiles) {
        this.grid[t.row][t.col] = null;
      }

      // Calculate score & Echo energy generated
      const stepScore = totalGemsMatched * 100 * combo;
      // Sapphire gives 15 Echo Energy per gem, others give 5 base energy
      const echoEnergy = (sapphireCount * 15) + ((totalGemsMatched - sapphireCount) * 5);

      const stepData = {
        combo,
        matches: currentMatches,
        removedTiles,
        scoreGained: stepScore,
        echoEnergyGained: echoEnergy,
        sapphireMatched: sapphireCount
      };

      cascadeSteps.push(stepData);

      if (this.eventBus) {
        this.eventBus.emit('match:detected', stepData);
        if (echoEnergy > 0) {
          this.eventBus.emit('echo:energy_generated', {
            amount: echoEnergy,
            sourceTiles: removedTiles.filter(t => t.type === 'sapphire'),
            combo
          });
        }
      }

      // Short delay for visual match animation
      await new Promise(resolve => setTimeout(resolve, 200));

      // Apply gravity and refill
      const { drops, refills } = this.applyGravityAndRefill();

      if (this.eventBus) {
        this.eventBus.emit('board:cascade', { drops, refills, combo });
      }

      // Short delay for drop animation
      await new Promise(resolve => setTimeout(resolve, 180));

      // Scan for chain-reaction matches
      currentMatches = this.findMatches();
      if (currentMatches.length > 0) {
        combo++;
      }
    }

    if (this.eventBus) {
      this.eventBus.emit('board:settled', { totalSteps: cascadeSteps.length, finalCombo: combo });
    }

    return cascadeSteps;
  }

  /**
   * Gravity: drops remaining tiles down to fill gaps, and spawns new tiles at the top
   */
  applyGravityAndRefill() {
    const drops = [];
    const refills = [];
    const TileClass = typeof Tile !== 'undefined' ? Tile : require('./Tile');

    for (let c = 0; c < this.cols; c++) {
      let emptyRow = this.rows - 1;

      // Drop existing tiles
      for (let r = this.rows - 1; r >= 0; r--) {
        if (this.grid[r][c] !== null) {
          if (r !== emptyRow) {
            const tile = this.grid[r][c];
            this.grid[emptyRow][c] = tile;
            this.grid[r][c] = null;
            
            drops.push({
              tileId: tile.id,
              type: tile.type,
              fromRow: r,
              toRow: emptyRow,
              col: c
            });

            tile.row = emptyRow;
          }
          emptyRow--;
        }
      }

      // Refill top empty cells
      for (let r = emptyRow; r >= 0; r--) {
        const randomType = this.gemTypes[Math.floor(Math.random() * this.gemTypes.length)];
        const newTile = new TileClass(r, c, randomType);
        this.grid[r][c] = newTile;

        refills.push({
          tileId: newTile.id,
          type: newTile.type,
          row: r,
          col: c
        });
      }
    }

    return { drops, refills };
  }

  /**
   * Clears an entire row (Relic effect: Row Clear)
   */
  async clearRow(rowIdx) {
    if (rowIdx < 0 || rowIdx >= this.rows || this.isProcessing) return false;
    this.isProcessing = true;

    const removedTiles = [];
    for (let c = 0; c < this.cols; c++) {
      const t = this.grid[rowIdx][c];
      if (t) {
        removedTiles.push({ row: rowIdx, col: c, type: t.type });
        this.grid[rowIdx][c] = null;
      }
    }

    if (this.eventBus) {
      this.eventBus.emit('relic:row_clear_executed', { row: rowIdx, removedTiles });
    }

    await new Promise(res => setTimeout(res, 200));
    this.applyGravityAndRefill();
    
    // Check if new matches trigger
    const followUp = this.findMatches();
    if (followUp.length > 0) {
      await this.resolveBoardCascades(followUp);
    }
    
    this.isProcessing = false;
    return true;
  }

  /**
   * Clears a 3x3 radius around (targetRow, targetCol) (Relic effect: Crystal Burst)
   */
  async clearArea(targetRow, targetCol) {
    if (this.isProcessing) return false;
    this.isProcessing = true;

    const removedTiles = [];
    for (let r = Math.max(0, targetRow - 1); r <= Math.min(this.rows - 1, targetRow + 1); r++) {
      for (let c = Math.max(0, targetCol - 1); c <= Math.min(this.cols - 1, targetCol + 1); c++) {
        const t = this.grid[r][c];
        if (t) {
          removedTiles.push({ row: r, col: c, type: t.type });
          this.grid[r][c] = null;
        }
      }
    }

    if (this.eventBus) {
      this.eventBus.emit('relic:crystal_burst_executed', { targetRow, targetCol, removedTiles });
    }

    await new Promise(res => setTimeout(res, 200));
    this.applyGravityAndRefill();

    const followUp = this.findMatches();
    if (followUp.length > 0) {
      await this.resolveBoardCascades(followUp);
    }

    this.isProcessing = false;
    return true;
  }

  /**
   * Check if there is at least one valid swap on the current board
   */
  hasPossibleMoves() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        // Test swap right
        if (c + 1 < this.cols) {
          this.executeSwap(r, c, r, c + 1);
          const matches = this.findMatches();
          this.executeSwap(r, c, r, c + 1); // restore
          if (matches.length > 0) return true;
        }
        // Test swap down
        if (r + 1 < this.rows) {
          this.executeSwap(r, c, r + 1, c);
          const matches = this.findMatches();
          this.executeSwap(r, c, r + 1, c); // restore
          if (matches.length > 0) return true;
        }
      }
    }
    return false;
  }

  /**
   * Reshuffle tiles if no legal moves remain, guaranteeing playable board
   */
  reshuffle() {
    this.shuffleCount++;
    const flat = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c]) flat.push(this.grid[r][c].type);
      }
    }

    let validSetup = false;
    let attempts = 0;
    while (!validSetup && attempts < 20) {
      attempts++;
      // Shuffle array
      for (let i = flat.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [flat[i], flat[j]] = [flat[j], flat[i]];
      }

      let idx = 0;
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (this.grid[r][c]) {
            this.grid[r][c].type = flat[idx++];
          }
        }
      }

      // Check if board has no immediate matches and at least one possible move
      const immediateMatches = this.findMatches();
      if (immediateMatches.length === 0 && this.hasPossibleMoves()) {
        validSetup = true;
      }
    }

    if (this.eventBus) {
      this.eventBus.emit('board:reshuffled', { shuffleCount: this.shuffleCount });
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MainBoard;
} else {
  window.MainBoard = MainBoard;
}
