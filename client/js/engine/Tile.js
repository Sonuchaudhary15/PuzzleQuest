/**
 * Tile - Crystal and Gem Representation
 * 
 * Represents individual crystal nodes within the MainBoard grid.
 */
class Tile {
  static TYPES = ['ruby', 'sapphire', 'emerald', 'amethyst', 'topaz'];

  static DEFINITIONS = {
    ruby: {
      name: 'Ruby Fire',
      color: '#ff3366',
      secondary: '#ff99aa',
      symbol: '◆',
      description: 'Fiery crimson crystal. High attack power.'
    },
    sapphire: {
      name: 'Sapphire Echo',
      color: '#00d2ff',
      secondary: '#99f0ff',
      symbol: '✦',
      description: 'Resonates with the Echo Board to channel ancient energy.'
    },
    emerald: {
      name: 'Emerald Fragment',
      color: '#00e676',
      secondary: '#88ffbb',
      symbol: '▲',
      description: 'Infused with nature essence. Yields bonus relic fragments.'
    },
    amethyst: {
      name: 'Amethyst Mystic',
      color: '#b388ff',
      secondary: '#e1bee7',
      symbol: '⬟',
      description: 'Arcane crystal that charges special combo amplifiers.'
    },
    topaz: {
      name: 'Topaz Solar',
      color: '#ffd600',
      secondary: '#fff59d',
      symbol: '★',
      description: 'Solar crystal illuminating dark corners of the dungeon.'
    },
    prism: {
      name: 'Celestial Prism',
      color: '#ffffff',
      secondary: '#ff00ff',
      symbol: '❋',
      description: 'Wild prism formed from 5-in-a-row match.'
    }
  };

  /**
   * @param {number} row - Grid row index
   * @param {number} col - Grid column index
   * @param {string} type - Crystal type (ruby, sapphire, etc.)
   * @param {string} [id] - Unique identifier
   */
  constructor(row, col, type, id = null) {
    this.row = row;
    this.col = col;
    this.type = type || Tile.randomType();
    this.id = id || `tile_${row}_${col}_${Math.random().toString(36).substring(2, 9)}`;
    this.isSpecial = false; // prism, bomb, row_blaster
    this.specialType = null;
    this.isMatched = false;
    this.isFalling = false;
  }

  static randomType(availableTypes = Tile.TYPES) {
    const index = Math.floor(Math.random() * availableTypes.length);
    return availableTypes[index];
  }

  getDefinition() {
    return Tile.DEFINITIONS[this.type] || Tile.DEFINITIONS.ruby;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Tile;
} else {
  window.Tile = Tile;
}
