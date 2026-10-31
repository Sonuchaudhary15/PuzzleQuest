/**
 * BoardRenderer - DOM Grid & Canvas Particle FX Engine
 * 
 * Renders the Main Match-3 Board, the Connected Echo Board,
 * the Dynamic Energy Connection Beam, and Particle Burst Explosions.
 */
class BoardRenderer {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.mainBoardContainer - Main board DOM container
   * @param {HTMLElement} options.echoBoardContainer - Echo board DOM container
   * @param {HTMLCanvasElement} options.fxCanvas - Canvas overlay for energy beams & particles
   * @param {EventBus} options.eventBus
   * @param {GameEngine} options.gameEngine
   */
  constructor(options = {}) {
    this.mainContainer = options.mainBoardContainer;
    this.echoContainer = options.echoBoardContainer;
    this.fxCanvas = options.fxCanvas;
    this.eventBus = options.eventBus || (typeof window !== 'undefined' ? window.gameEventBus : null);
    this.gameEngine = options.gameEngine;

    this.ctx = this.fxCanvas ? this.fxCanvas.getContext('2d') : null;
    this.particles = [];
    this.beams = [];
    this.selectedCoord = null;
    this.hoverCoord = null;
    this.swipeState = null;
    this.swipeTriggered = false;

    this.initCanvas();
    this.initSwipeListeners();
    this.bindEvents();
    this.startRenderLoop();
  }

  initCanvas() {
    if (!this.fxCanvas) return;
    const resize = () => {
      const rect = this.fxCanvas.parentElement.getBoundingClientRect();
      this.fxCanvas.width = rect.width;
      this.fxCanvas.height = rect.height;
    };
    window.addEventListener('resize', resize);
    setTimeout(resize, 100);
  }

  bindEvents() {
    if (!this.eventBus) return;

    this.eventBus.on('board:initialized', () => {
      this.renderMainBoard();
      this.renderEchoBoard();
    });

    this.eventBus.on('screen:changed', (data) => {
      if (data.screenId === 'game') {
        setTimeout(() => {
          this.initCanvas();
          this.renderMainBoard();
          this.renderEchoBoard();
        }, 50);
      }
    });

    this.eventBus.on('tile:selected', (coord) => {
      this.selectedCoord = coord;
      this.highlightSelected();
    });

    this.eventBus.on('tile:deselected', () => {
      this.selectedCoord = null;
      this.clearHighlights();
    });

    this.eventBus.on('tile:swapped', (data) => {
      // Visually slide the two adjacent tiles into each other's cells
      const cellA = this.mainContainer?.querySelector(`[data-row="${data.tileA.row}"][data-col="${data.tileA.col}"]`);
      const cellB = this.mainContainer?.querySelector(`[data-row="${data.tileB.row}"][data-col="${data.tileB.col}"]`);
      const tileAEl = cellA?.querySelector('.crystal-tile');
      const tileBEl = cellB?.querySelector('.crystal-tile');

      if (cellA && cellB && tileAEl && tileBEl) {
        const rectA = cellA.getBoundingClientRect();
        const rectB = cellB.getBoundingClientRect();
        const dx = rectB.left - rectA.left;
        const dy = rectB.top - rectA.top;

        tileAEl.style.transition = 'transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)';
        tileAEl.style.transform = `translate(${dx}px, ${dy}px)`;
        tileAEl.style.zIndex = '20';

        tileBEl.style.transition = 'transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)';
        tileBEl.style.transform = `translate(${-dx}px, ${-dy}px)`;
        tileBEl.style.zIndex = '19';
      }

      this.selectedCoord = null;
      this.clearHighlights();
    });

    this.eventBus.on('tile:swap_reverted', (data) => {
      // Revert slide back smoothly and shake
      const cellA = this.mainContainer?.querySelector(`[data-row="${data.r1}"][data-col="${data.c1}"]`);
      const cellB = this.mainContainer?.querySelector(`[data-row="${data.r2}"][data-col="${data.c2}"]`);
      const tileAEl = cellA?.querySelector('.crystal-tile');
      const tileBEl = cellB?.querySelector('.crystal-tile');

      if (tileAEl) {
        tileAEl.style.transition = 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)';
        tileAEl.style.transform = 'translate(0px, 0px)';
      }
      if (tileBEl) {
        tileBEl.style.transition = 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)';
        tileBEl.style.transform = 'translate(0px, 0px)';
      }

      setTimeout(() => {
        if (tileAEl) {
          tileAEl.classList.add('tile-invalid-swap');
          setTimeout(() => tileAEl.classList.remove('tile-invalid-swap'), 350);
        }
        if (tileBEl) {
          tileBEl.classList.add('tile-invalid-swap');
          setTimeout(() => tileBEl.classList.remove('tile-invalid-swap'), 350);
        }
        setTimeout(() => this.renderMainBoard(), 250);
      }, 200);

      this.selectedCoord = null;
      this.clearHighlights();
    });

    this.eventBus.on('match:detected', (data) => {
      // Establish tiles in their newly swapped positions before pop animation
      this.renderMainBoard();
      // Animate matched tiles with pop-and-vanish before removing from DOM
      data.removedTiles.forEach(tile => {
        const tileEl = this.mainContainer?.querySelector(`[data-row="${tile.row}"][data-col="${tile.col}"] .crystal-tile`);
        if (tileEl) {
          tileEl.classList.add('tile-matched');
          // Echo-glow for sapphire
          if (tile.type === 'sapphire') {
            tileEl.classList.add('echo-triggered');
          }
          // Combo glow for chain reactions
          if (data.combo > 1) {
            tileEl.classList.add('combo-glow');
          }
        }
      });
      this.spawnMatchParticles(data.removedTiles);
      if (data.combo > 1 && data.removedTiles[0]) {
        this.spawnComboText(data.combo, data.removedTiles[0]);
      }
      setTimeout(() => this.renderMainBoard(), 200);
    });

    this.eventBus.on('board:cascade', (data) => {
      // After gravity settles, render with drop-in animation
      setTimeout(() => {
        this.renderMainBoard('cascade');
        this.renderEchoBoard();
      }, 40);
    });

    this.eventBus.on('board:settled', () => {
      this.renderMainBoard();
      this.renderEchoBoard();
    });

    this.eventBus.on('echo:energy_generated', (data) => {
      this.triggerEchoBeam(data.sourceTiles);
    });

    this.eventBus.on('echo:energy_applied', (data) => {
      this.renderEchoBoard();
      if (data.newlyUnlocked && data.newlyUnlocked.length > 0) {
        this.spawnEchoUnlockParticles(data.newlyUnlocked);
      }
    });

    this.eventBus.on('echo:barrier_broken_by_relic', (data) => {
      this.renderEchoBoard();
      this.spawnEchoUnlockParticles([data.cell]);
    });

    this.eventBus.on('relic:row_clear_executed', (data) => {
      this.spawnRowLaser(data.row);
    });

    this.eventBus.on('relic:crystal_burst_executed', (data) => {
      this.spawnBombExplosion(data.targetRow, data.targetCol);
    });
  }

  /**
   * Render the Main Match-Three Board DOM
   * @param {string} [animMode] - 'cascade' triggers drop-in animations on new/moved tiles
   */
  renderMainBoard(animMode) {
    if (!this.mainContainer || !this.gameEngine?.mainBoard) return;
    const board = this.gameEngine.mainBoard;

    this.mainContainer.innerHTML = '';
    this.mainContainer.style.gridTemplateRows = `repeat(${board.rows}, 1fr)`;
    this.mainContainer.style.gridTemplateColumns = `repeat(${board.cols}, 1fr)`;

    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        const tile = board.getTile(r, c);
        const cellEl = document.createElement('div');
        cellEl.className = 'game-tile-cell';
        cellEl.dataset.row = r;
        cellEl.dataset.col = c;

        if (tile) {
          const tileEl = document.createElement('div');
          tileEl.className = `crystal-tile crystal-${tile.type}`;
          tileEl.id = tile.id;
          tileEl.dataset.type = tile.type;
          tileEl.setAttribute('role', 'button');
          tileEl.setAttribute('aria-label', `${tile.type} crystal at row ${r + 1}, column ${c + 1}`);

          // Visual crystal rune glyph
          const def = tile.getDefinition();
          tileEl.innerHTML = `
            <div class="crystal-inner" style="--crystal-color: ${def.color}; --crystal-secondary: ${def.secondary};">
              <span class="crystal-symbol">${def.symbol}</span>
            </div>
          `;

          // Cascade drop-in animation: stagger by column offset for natural feel
          if (animMode === 'cascade') {
            const delay = (c * 18 + r * 8) % 100;
            tileEl.style.animationDelay = `${delay}ms`;
            tileEl.classList.add('tile-cascade-drop');
          } else if (animMode === 'refill') {
            const delay = c * 22;
            tileEl.style.animationDelay = `${delay}ms`;
            tileEl.classList.add('tile-drop-in');
          }

          // Selected state
          if (this.selectedCoord && this.selectedCoord.row === r && this.selectedCoord.col === c) {
            tileEl.classList.add('selected');
          }

          // Targeting hover highlights
          const relicMgr = this.gameEngine.relicManager;
          if (relicMgr?.activeTargetingRelic) {
            tileEl.classList.add('cursor-target');
          }

          // Interaction listeners (Click + Touch/Mouse Swipe)
          tileEl.addEventListener('pointerdown', (e) => this.handleTilePointerDown(r, c, e));
          tileEl.addEventListener('click', (e) => this.handleTileClick(r, c, e));
          tileEl.addEventListener('mouseenter', () => this.handleTileMouseEnter(r, c));
          tileEl.addEventListener('mouseleave', () => this.handleTileMouseLeave(r, c));

          cellEl.appendChild(tileEl);
        } else {
          cellEl.classList.add('tile-empty');
        }

        this.mainContainer.appendChild(cellEl);
      }
    }
  }

  /**
   * Render the Connected Echo Board DOM
   */
  renderEchoBoard() {
    if (!this.echoContainer || !this.gameEngine?.echoBoard) return;
    const echo = this.gameEngine.echoBoard;

    this.echoContainer.innerHTML = '';
    this.echoContainer.style.gridTemplateRows = `repeat(${echo.rows}, 1fr)`;
    this.echoContainer.style.gridTemplateColumns = `repeat(${echo.cols}, 1fr)`;

    for (let r = 0; r < echo.rows; r++) {
      for (let c = 0; c < echo.cols; c++) {
        const cell = echo.getCell(r, c);
        const cellEl = document.createElement('div');
        cellEl.className = `echo-cell echo-state-${cell.state} ${cell.isCompleted ? 'echo-completed' : ''}`;
        cellEl.dataset.row = r;
        cellEl.dataset.col = c;
        cellEl.id = cell.id;

        const percent = Math.min(100, Math.round((cell.currentEnergy / cell.energyRequired) * 100));

        cellEl.innerHTML = `
          <div class="echo-conduit-ring" style="--charge-percent: ${percent}%;">
            <div class="echo-rune-glyph">${cell.runeGlyph}</div>
            ${cell.state === 'locked' ? '<div class="echo-barrier-overlay">🔒</div>' : ''}
          </div>
          <div class="echo-energy-bar-wrap">
            <div class="echo-energy-fill" style="width: ${percent}%;"></div>
          </div>
          <div class="echo-energy-label">${cell.currentEnergy}/${cell.energyRequired}</div>
        `;

        // Check for Barrier Breaker relic targeting
        const relicMgr = this.gameEngine.relicManager;
        if (relicMgr?.activeTargetingRelic === 'barrier_breaker' && cell.state === 'locked') {
          cellEl.classList.add('targeting-breaker');
        }

        cellEl.addEventListener('click', () => this.handleEchoCellClick(r, c, cell));

        this.echoContainer.appendChild(cellEl);
      }
    }
  }

    /**
   * Global pointer gesture listeners for drag & touch swiping
   */
  initSwipeListeners() {
    if (typeof window === 'undefined') return;
    window.addEventListener('pointermove', (e) => this.handlePointerMove(e), { passive: true });
    window.addEventListener('pointerup', (e) => this.handlePointerUp(e));
    window.addEventListener('pointercancel', (e) => this.handlePointerCancel(e));
  }

  /**
   * Pointer down on a crystal tile to initiate swipe or click
   */
  handleTilePointerDown(r, c, event) {
    if (!this.gameEngine || this.gameEngine.gameState !== 'PLAYING') return;
    if (this.gameEngine.mainBoard?.isProcessing) return;

    // Relic targeting uses direct click targeting
    if (this.gameEngine.relicManager?.activeTargetingRelic) return;

    this.swipeState = {
      startX: event.clientX,
      startY: event.clientY,
      row: r,
      col: c,
      pointerId: event.pointerId
    };
    this.swipeTriggered = false;
  }

  /**
   * Pointer move across board detecting directional swipe gestures
   */
  async handlePointerMove(event) {
    if (!this.swipeState || this.swipeTriggered) return;
    if (this.swipeState.pointerId !== undefined && event.pointerId !== this.swipeState.pointerId) return;
    if (this.gameEngine?.mainBoard?.isProcessing) {
      this.swipeState = null;
      return;
    }

    const dx = event.clientX - this.swipeState.startX;
    const dy = event.clientY - this.swipeState.startY;
    const distance = Math.hypot(dx, dy);

    // Minimum distance threshold to qualify as an intentional swipe gesture
    const SWIPE_THRESHOLD = 24;

    if (distance >= SWIPE_THRESHOLD) {
      const fromR = this.swipeState.row;
      const fromC = this.swipeState.col;
      let toR = fromR;
      let toC = fromC;

      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal swipe (Left / Right)
        toC += dx > 0 ? 1 : -1;
      } else {
        // Vertical swipe (Up / Down)
        toR += dy > 0 ? 1 : -1;
      }

      const board = this.gameEngine?.mainBoard;
      if (board && toR >= 0 && toR < board.rows && toC >= 0 && toC < board.cols) {
        this.swipeTriggered = true;
        this.selectedCoord = null;
        this.clearHighlights();

        // Perform adjacent swap via GameEngine
        await this.gameEngine.handlePlayerSwap(fromR, fromC, toR, toC);
      }

      this.swipeState = null;
    }
  }

  handlePointerUp(event) {
    this.swipeState = null;
  }

  handlePointerCancel(event) {
    this.swipeState = null;
  }

  /**
   * Handle Main Board Tile Clicks (Selection, Swapping, Relic Target)
   */
  async handleTileClick(r, c, event) {
    // If this click was part of a completed swipe gesture, suppress click handler
    if (this.swipeTriggered) {
      this.swipeTriggered = false;
      return;
    }
    if (this.gameEngine.gameState !== 'PLAYING') return;

    const relicMgr = this.gameEngine.relicManager;

    // 1. Relic targeting active?
    if (relicMgr?.activeTargetingRelic) {
      const relicType = relicMgr.activeTargetingRelic;
      if (relicType === 'row_clear') {
        relicMgr.consumeRelic('row_clear');
        await this.gameEngine.mainBoard.clearRow(r);
        this.clearTargetingHighlights();
        this.gameEngine.checkGameStatus();
        return;
      }
      if (relicType === 'crystal_burst') {
        relicMgr.consumeRelic('crystal_burst');
        await this.gameEngine.mainBoard.clearArea(r, c);
        this.clearTargetingHighlights();
        this.gameEngine.checkGameStatus();
        return;
      }
    }

    // 2. Normal Match-3 Swap Logic
    if (!this.selectedCoord) {
      // First tile selected
      this.selectedCoord = { row: r, col: c };
      if (this.eventBus) {
        this.eventBus.emit('tile:selected', this.selectedCoord);
      }
      this.highlightSelected();
    } else {
      // Second tile selected -> Check if adjacent
      const r1 = this.selectedCoord.row;
      const c1 = this.selectedCoord.col;
      const isAdj = this.gameEngine.mainBoard.isAdjacent(r1, c1, r, c);

      if (isAdj) {
        const fromCoord = { row: r1, col: c1 };
        const toCoord = { row: r, col: c };
        this.selectedCoord = null;
        this.clearHighlights();

        // Perform swap via GameEngine
        await this.gameEngine.handlePlayerSwap(fromCoord.row, fromCoord.col, toCoord.row, toCoord.col);
      } else {
        // Change selection to new tile or deselect
        if (r1 === r && c1 === c) {
          this.selectedCoord = null;
          if (this.eventBus) this.eventBus.emit('tile:deselected');
          this.clearHighlights();
        } else {
          this.selectedCoord = { row: r, col: c };
          if (this.eventBus) this.eventBus.emit('tile:selected', this.selectedCoord);
          this.highlightSelected();
        }
      }
    }
  }

  /**
   * Handle Echo Board Cell Click (Targeting for Barrier Breaker relic)
   */
  handleEchoCellClick(r, c, cell) {
    const relicMgr = this.gameEngine.relicManager;
    if (relicMgr?.activeTargetingRelic === 'barrier_breaker' && cell.state === 'locked') {
      relicMgr.consumeRelic('barrier_breaker');
      this.gameEngine.echoBoard.breakBarrier(r, c);
      this.clearTargetingHighlights();
      this.renderEchoBoard();
    }
  }

  handleTileMouseEnter(r, c) {
    this.hoverCoord = { row: r, col: c };
    const relicMgr = this.gameEngine.relicManager;
    if (relicMgr?.activeTargetingRelic === 'row_clear') {
      this.highlightRowTarget(r);
    } else if (relicMgr?.activeTargetingRelic === 'crystal_burst') {
      this.highlightAreaTarget(r, c);
    }
  }

  handleTileMouseLeave(r, c) {
    this.hoverCoord = null;
    this.clearTargetingHighlights();
  }

  highlightSelected() {
    this.clearHighlights();
    if (!this.selectedCoord) return;
    const cell = this.mainContainer.querySelector(`[data-row="${this.selectedCoord.row}"][data-col="${this.selectedCoord.col}"] .crystal-tile`);
    if (cell) cell.classList.add('selected');
  }

  clearHighlights() {
    const all = this.mainContainer.querySelectorAll('.crystal-tile.selected');
    all.forEach(el => el.classList.remove('selected'));
  }

  highlightRowTarget(rowIdx) {
    this.clearTargetingHighlights();
    const rowCells = this.mainContainer.querySelectorAll(`[data-row="${rowIdx}"] .crystal-tile`);
    rowCells.forEach(el => el.classList.add('target-highlight-row'));
  }

  highlightAreaTarget(row, col) {
    this.clearTargetingHighlights();
    for (let r = row - 1; r <= row + 1; r++) {
      for (let c = col - 1; c <= col + 1; c++) {
        const el = this.mainContainer.querySelector(`[data-row="${r}"][data-col="${c}"] .crystal-tile`);
        if (el) el.classList.add('target-highlight-area');
      }
    }
  }

  clearTargetingHighlights() {
    this.mainContainer.querySelectorAll('.target-highlight-row, .target-highlight-area').forEach(el => {
      el.classList.remove('target-highlight-row', 'target-highlight-area');
    });
  }

  // --- SIGNATURE FEATURE: STAR-BURST ECHO ENERGY TRANSFER ANIMATION ---
  /**
   * Fires a constellation of star-burst orbs that burst out of the matched sapphire tile,
   * travel across to the Echo Board in a sparkling arc, and explode into star shards on arrival.
   * No line is drawn — instead spinning ★ and ✦ emoji/glyphs fly and burst like fireworks!
   */
  triggerEchoBeam(sourceTiles = []) {
    if (!this.fxCanvas || !this.mainContainer || !this.echoContainer) return;
    const canvasRect = this.fxCanvas.getBoundingClientRect();
    const echoRect   = this.echoContainer.getBoundingClientRect();

    const targetX = (echoRect.left + echoRect.width  / 2) - canvasRect.left;
    const targetY = (echoRect.top  + echoRect.height / 2) - canvasRect.top;

    const STAR_GLYPHS = ['★', '✦', '✧', '⭐', '✨', '💎', '🌟'];
    const TRAIL_COLORS = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#00e5ff', '#7c3aed', '#c4b5fd'];

    sourceTiles.forEach(tile => {
      const tileEl = this.mainContainer.querySelector(`[data-row="${tile.row}"][data-col="${tile.col}"]`);
      if (!tileEl) return;

      const tileRect = tileEl.getBoundingClientRect();
      const startX = (tileRect.left + tileRect.width  / 2) - canvasRect.left;
      const startY = (tileRect.top  + tileRect.height / 2) - canvasRect.top;

      // 1. INITIAL BURST — stars explode outward from the tile then converge toward echo board
      const burstCount = 8 + Math.floor(Math.random() * 5); // 8-12 stars per tile
      for (let i = 0; i < burstCount; i++) {
        const angle   = (Math.PI * 2 / burstCount) * i + Math.random() * 0.3;
        const speed   = 2.5 + Math.random() * 2.5;
        const delay   = i * 18; // stagger launch for wave-burst feel
        const glyph   = STAR_GLYPHS[Math.floor(Math.random() * STAR_GLYPHS.length)];
        const color   = TRAIL_COLORS[Math.floor(Math.random() * TRAIL_COLORS.length)];
        const size    = 13 + Math.floor(Math.random() * 9); // 13–21px

        this.particles.push({
          x: startX,
          y: startY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          targetX,
          targetY,
          phase: 'burst',       // burst → travel → arrive
          delayFrames: Math.floor(delay / 16),
          text: glyph,
          color,
          fontSize: size,
          alpha: 0,             // fade-in during burst
          decay: 0,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.18,
          life: 0,
          burstDuration: 8,     // frames of outburst before homing
          homingSpeed: 4.5 + Math.random() * 2.5,
          trailParticles: []
        });
      }

      // 2. ORIGIN PULSE — ring of small sparkles at the source tile
      for (let j = 0; j < 10; j++) {
        const angle = (Math.PI * 2 / 10) * j;
        this.particles.push({
          x: startX + Math.cos(angle) * 6,
          y: startY + Math.sin(angle) * 6,
          vx: Math.cos(angle) * (1.5 + Math.random()),
          vy: Math.sin(angle) * (1.5 + Math.random()),
          text: null,
          color: '#6ee7b7',
          radius: 2.5 + Math.random() * 1.5,
          alpha: 0.9,
          decay: 0.04,
          phase: 'sparkle'
        });
      }
    });

    // 3. ECHO BOARD ARRIVAL BURST — fires after the stars arrive (~650ms travel)
    const echoArrivalDelay = 650;
    setTimeout(() => {
      if (!this.ctx) return;
      const ARRIVAL_GLYPHS = ['★', '✨', '🌟', '💥', '✦'];
      for (let k = 0; k < 18; k++) {
        const angle = (Math.PI * 2 / 18) * k;
        const speed = 3 + Math.random() * 4;
        this.particles.push({
          x: targetX,
          y: targetY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          text: ARRIVAL_GLYPHS[Math.floor(Math.random() * ARRIVAL_GLYPHS.length)],
          color: ['#fbbf24', '#f59e0b', '#34d399', '#7c3aed', '#00e5ff'][Math.floor(Math.random() * 5)],
          fontSize: 16 + Math.floor(Math.random() * 10),
          alpha: 1,
          decay: 0.025,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.2,
          phase: 'arrival'
        });
      }
    }, echoArrivalDelay);
  }

  /**
   * Spawns sparkling particle burst on crystal match
   */
  spawnMatchParticles(removedTiles) {
    if (!this.fxCanvas || !this.mainContainer) return;
    const canvasRect = this.fxCanvas.getBoundingClientRect();

    removedTiles.forEach(tile => {
      const el = this.mainContainer.querySelector(`[data-row="${tile.row}"][data-col="${tile.col}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        const cx = (rect.left + rect.width / 2) - canvasRect.left;
        const cy = (rect.top + rect.height / 2) - canvasRect.top;
        const color = Tile.DEFINITIONS[tile.type]?.color || '#ffffff';

        for (let i = 0; i < 8; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 2 + Math.random() * 5;
          this.particles.push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color,
            radius: 2.5 + Math.random() * 3,
            alpha: 1,
            decay: 0.035
          });
        }
      }
    });
  }

  /**
   * Shatter particle explosion when Echo barrier unlocks
   */
  spawnEchoUnlockParticles(cells) {
    if (!this.fxCanvas || !this.echoContainer) return;
    const canvasRect = this.fxCanvas.getBoundingClientRect();

    cells.forEach(cell => {
      const el = this.echoContainer.querySelector(`[data-row="${cell.row}"][data-col="${cell.col}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        const cx = (rect.left + rect.width / 2) - canvasRect.left;
        const cy = (rect.top + rect.height / 2) - canvasRect.top;

        for (let i = 0; i < 16; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 3 + Math.random() * 6;
          this.particles.push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: '#00f0ff',
            radius: 3 + Math.random() * 3,
            alpha: 1,
            decay: 0.025
          });
        }
      }
    });
  }

  spawnRowLaser(rowIdx) {
    if (!this.fxCanvas || !this.mainContainer) return;
    const canvasRect = this.fxCanvas.getBoundingClientRect();
    const rowEl = this.mainContainer.querySelector(`[data-row="${rowIdx}"][data-col="0"]`);
    if (rowEl) {
      const rect = rowEl.getBoundingClientRect();
      const cy = (rect.top + rect.height / 2) - canvasRect.left;
      for (let i = 0; i < 30; i++) {
        this.particles.push({
          x: Math.random() * canvasRect.width,
          y: cy + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 2,
          color: '#ffd600',
          radius: 3 + Math.random() * 3,
          alpha: 1,
          decay: 0.03
        });
      }
    }
  }

  spawnBombExplosion(targetRow, targetCol) {
    if (!this.fxCanvas || !this.mainContainer) return;
    const canvasRect = this.fxCanvas.getBoundingClientRect();
    const el = this.mainContainer.querySelector(`[data-row="${targetRow}"][data-col="${targetCol}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      const cx = (rect.left + rect.width / 2) - canvasRect.left;
      const cy = (rect.top + rect.height / 2) - canvasRect.top;

      for (let i = 0; i < 28; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 8;
        this.particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: '#ff3366',
          radius: 4 + Math.random() * 3,
          alpha: 1,
          decay: 0.025
        });
      }
    }
  }

  /**
   * Spawn floating combo badge indicator
   */
  spawnComboText(combo, tile) {
    if (!this.fxCanvas || !this.mainContainer) return;
    const canvasRect = this.fxCanvas.getBoundingClientRect();
    const el = this.mainContainer.querySelector(`[data-row="${tile.row}"][data-col="${tile.col}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      const cx = (rect.left + rect.width / 2) - canvasRect.left;
      const cy = (rect.top + rect.height / 2) - canvasRect.top;

      this.particles.push({
        x: cx,
        y: cy,
        vx: 0,
        vy: -1.2,
        text: `Combo x${combo}!`,
        color: '#15803d',
        alpha: 1,
        decay: 0.02
      });
    }
  }

  /**
   * Continuous 60fps render loop for canvas FX
   */
  startRenderLoop() {
    const loop = () => {
      this.updateAndDrawFX();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  updateAndDrawFX() {
    if (!this.ctx || !this.fxCanvas) return;
    this.ctx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);

    // 1. Legacy beam list (kept for safety, now unused but harmless)
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life++;
      if (b.life >= b.maxLife) { this.beams.splice(i, 1); }
    }

    // 2. Star-Burst Echo Particles (multi-phase: burst → homing → arrival)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // --- Delay Gate ---
      if (p.delayFrames && p.delayFrames > 0) {
        p.delayFrames--;
        continue;
      }

      p.life = (p.life || 0) + 1;

      // ── Phase: burst (explode outward from tile for burstDuration frames) ──
      if (p.phase === 'burst') {
        p.alpha = Math.min(1, p.alpha + 0.18);
        p.x += p.vx;
        p.y += p.vy;
        if (p.rotation !== undefined) p.rotation += p.rotSpeed || 0;

        // Leave a sparkling trail
        if (p.life % 2 === 0 && p.text) {
          this.particles.push({
            x: p.x,
            y: p.y,
            text: '·',
            color: p.color,
            fontSize: 8,
            alpha: 0.6,
            decay: 0.07,
            phase: 'sparkle'
          });
        }

        if (p.life >= (p.burstDuration || 8)) {
          p.phase = 'travel';
          p.life = 0;
        }
      }

      // ── Phase: travel (home toward echo board center) ──
      else if (p.phase === 'travel') {
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 6) {
          // Arrived — remove and let arrival burst take over
          this.particles.splice(i, 1);
          continue;
        }

        const speed = p.homingSpeed || 5;
        p.x += (dx / dist) * speed;
        p.y += (dy / dist) * speed;
        if (p.rotation !== undefined) p.rotation += (p.rotSpeed || 0) * 1.5;

        // Occasional sparkle trail during travel
        if (p.life % 3 === 0 && p.text) {
          this.particles.push({
            x: p.x + (Math.random() - 0.5) * 4,
            y: p.y + (Math.random() - 0.5) * 4,
            text: ['·', '✦', '∘'][Math.floor(Math.random() * 3)],
            color: p.color,
            fontSize: 7 + Math.random() * 4,
            alpha: 0.55,
            decay: 0.06,
            phase: 'sparkle'
          });
        }
      }

      // ── Phase: arrival / sparkle — simple fade-out ──
      else {
        p.x += p.vx || 0;
        p.y += p.vy || 0;
        if (p.vx) p.vx *= 0.93;
        if (p.vy) p.vy *= 0.93;
        p.alpha -= (p.decay || 0.03);
        if (p.rotation !== undefined) p.rotation += (p.rotSpeed || 0);

        if (p.alpha <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
      }

      // ── Draw ──
      if (p.alpha <= 0) { this.particles.splice(i, 1); continue; }

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));

      if (p.text) {
        // Star glyph with glow
        this.ctx.font = `bold ${p.fontSize || 16}px "Segoe UI Emoji", sans-serif`;
        this.ctx.textAlign    = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.shadowBlur   = 18;
        this.ctx.shadowColor  = p.color;
        this.ctx.fillStyle    = p.color;

        if (p.rotation !== undefined) {
          this.ctx.translate(p.x, p.y);
          this.ctx.rotate(p.rotation);
          this.ctx.fillText(p.text, 0, 0);
        } else {
          this.ctx.fillText(p.text, p.x, p.y);
        }
      } else {
        // Classic dot particle
        this.ctx.fillStyle  = p.color;
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = p.color;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.radius || 2, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.restore();
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BoardRenderer;
} else {
  window.BoardRenderer = BoardRenderer;
}
