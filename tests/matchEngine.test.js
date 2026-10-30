/**
 * matchEngine.test.js - Unit Tests for Match-Three Physics Engine
 * 
 * Tests:
 * 1. Valid vs Invalid tile swaps
 * 2. Horizontal and vertical match detection
 * 3. Gravity drop and refill
 * 4. Chain reactions
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const MainBoard = require('../client/js/engine/MainBoard');
const Tile = require('../client/js/engine/Tile');

describe('MainBoard Match-Three Mechanics', () => {
  test('Initializes an 8x8 grid without pre-existing 3-matches', () => {
    const board = new MainBoard({ rows: 8, cols: 8 });
    assert.strictEqual(board.grid.length, 8);
    assert.strictEqual(board.grid[0].length, 8);

    const matches = board.findMatches();
    assert.strictEqual(matches.length, 0, 'Fresh board must not contain initial matches');
  });

  test('Detects horizontal match of 3 identical gems', () => {
    const board = new MainBoard({ rows: 8, cols: 8 });
    
    // Artificially place 3 rubies flanked by distinct gems
    board.grid[2][0] = new Tile(2, 0, 'emerald');
    board.grid[2][1] = new Tile(2, 1, 'ruby');
    board.grid[2][2] = new Tile(2, 2, 'ruby');
    board.grid[2][3] = new Tile(2, 3, 'ruby');
    board.grid[2][4] = new Tile(2, 4, 'sapphire');

    const matches = board.findMatches();
    const rubyMatch = matches.find(m => m.type === 'ruby' && m.orientation === 'horizontal' && m.tiles.some(t => t.row === 2 && t.col === 1));

    assert.ok(rubyMatch, 'Should detect horizontal ruby match');
    assert.strictEqual(rubyMatch.tiles.length, 3);
  });

  test('Detects vertical match of 4 identical gems', () => {
    const board = new MainBoard({ rows: 8, cols: 8 });
    
    // Artificially place 4 sapphires vertically flanked by distinct gems
    board.grid[0][4] = new Tile(0, 4, 'emerald');
    board.grid[1][4] = new Tile(1, 4, 'sapphire');
    board.grid[2][4] = new Tile(2, 4, 'sapphire');
    board.grid[3][4] = new Tile(3, 4, 'sapphire');
    board.grid[4][4] = new Tile(4, 4, 'sapphire');
    board.grid[5][4] = new Tile(5, 4, 'ruby');

    const matches = board.findMatches();
    const sapphireMatch = matches.find(m => m.type === 'sapphire' && m.orientation === 'vertical' && m.tiles.some(t => t.row === 1 && t.col === 4));

    assert.ok(sapphireMatch, 'Should detect vertical sapphire match');
    assert.strictEqual(sapphireMatch.tiles.length, 4);
  });

  test('Rejects invalid swap that results in no match and restores positions', async () => {
    const board = new MainBoard({ rows: 4, cols: 4 });
    
    // Fill with a non-matching alternating pattern
    const pattern = ['ruby', 'sapphire', 'emerald', 'topaz'];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        board.grid[r][c] = new Tile(r, c, pattern[(r + c) % 4]);
      }
    }

    const res = await board.swapTiles(0, 0, 0, 1);
    assert.strictEqual(res.success, false, 'Swap must fail when no match is formed');
    assert.strictEqual(res.reason, 'NO_MATCH');

    // Verify tiles were restored
    assert.strictEqual(board.grid[0][0].type, 'ruby');
    assert.strictEqual(board.grid[0][1].type, 'sapphire');
  });

  test('Performs valid swap, removes matched gems, applies gravity and refills', async () => {
    const board = new MainBoard({ rows: 8, cols: 8 });

    // Set up a board where swapping (1,1) [ruby] with (0,1) [sapphire] forms 3 rubies at (0,0), (0,1), (0,2)
    board.grid[0][0] = new Tile(0, 0, 'ruby');
    board.grid[0][1] = new Tile(0, 1, 'sapphire');
    board.grid[0][2] = new Tile(0, 2, 'ruby');

    board.grid[1][0] = new Tile(1, 0, 'emerald');
    board.grid[1][1] = new Tile(1, 1, 'ruby');
    board.grid[1][2] = new Tile(1, 2, 'topaz');

    const res = await board.swapTiles(0, 1, 1, 1);
    assert.strictEqual(res.success, true, 'Swap should succeed on matching 3 rubies');
    assert.ok(res.cascadeSteps.length >= 1, 'Cascade steps should be executed');

    // Ensure all grid cells are filled with non-null tiles after cascade
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        assert.ok(board.grid[r][c] !== null, `Cell at (${r},${c}) must not be null after refill`);
      }
    }
  });

  test('Correctly determines orthogonal adjacency', () => {
    const board = new MainBoard({ rows: 8, cols: 8 });
    assert.strictEqual(board.isAdjacent(2, 3, 2, 4), true, 'Horizontal neighbor is adjacent');
    assert.strictEqual(board.isAdjacent(2, 3, 3, 3), true, 'Vertical neighbor is adjacent');
    assert.strictEqual(board.isAdjacent(2, 3, 3, 4), false, 'Diagonal neighbor is NOT adjacent');
    assert.strictEqual(board.isAdjacent(2, 3, 2, 5), false, 'Two steps away is NOT adjacent');
  });
});
