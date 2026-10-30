/**
 * RelicManager - Relic Fusion, Inventory & Battle Powers
 * 
 * Handles relic crafting recipes, in-match usage, targeting states,
 * and inventory balances.
 */
class RelicManager {
  static RELIC_DEFINITIONS = {
    row_clear: {
      id: 'row_clear',
      name: 'Sunbeam Lance',
      type: 'row_clear',
      description: 'Pierces through an entire row on the Main Board, triggering massive cascades.',
      cost: 30,
      icon: '⚡',
      targetType: 'row' // user selects a row on MainBoard
    },
    barrier_breaker: {
      id: 'barrier_breaker',
      name: 'Rune Breaker',
      type: 'barrier_breaker',
      description: 'Directly strikes and shatters a locked barrier on the Echo Board.',
      cost: 40,
      icon: '🔨',
      targetType: 'echo_cell' // user selects locked cell on EchoBoard
    },
    echo_amplifier: {
      id: 'echo_amplifier',
      name: 'Resonance Chalice',
      type: 'echo_amplifier',
      description: 'Amplifies all Echo Energy transfer by 2.5x for 3 turns.',
      cost: 35,
      icon: '🔮',
      targetType: 'instant' // activates immediately
    },
    crystal_burst: {
      id: 'crystal_burst',
      name: 'Astral Bomb',
      type: 'crystal_burst',
      description: 'Detonates a 3x3 crystalline area on the Main Board.',
      cost: 25,
      icon: '💥',
      targetType: 'tile' // user selects center tile on MainBoard
    }
  };

  /**
   * @param {Object} options
   * @param {EventBus} options.eventBus - Event bus instance
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus || (typeof window !== 'undefined' ? window.gameEventBus : null);
    this.fragments = 50; // Starting bonus for new adventurer
    this.inventory = {
      row_clear: 1,
      barrier_breaker: 1,
      echo_amplifier: 1,
      crystal_burst: 1
    };

    // Active battle state (per level usage limit)
    this.battleCharges = { ...this.inventory };
    this.activeTargetingRelic = null;
    this.totalCrafted = 0;

    this.bindEvents();
  }

  bindEvents() {
    if (!this.eventBus) return;

    // Award bonus fragments on combos
    this.eventBus.on('match:detected', (data) => {
      if (data.combo >= 2) {
        const bonus = data.combo * 2;
        this.addFragments(bonus, `Combo x${data.combo}`);
      }
    });

    this.eventBus.on('level:completed', (data) => {
      const award = 15 + (data.stars * 10);
      this.addFragments(award, 'Level Victory');
    });

    this.eventBus.on('banana:reward_earned', (data) => {
      if (data.fragmentsAwarded) {
        this.addFragments(data.fragmentsAwarded, 'Mystery Challenge');
      }
    });
  }

  /**
   * Award fragments to player
   */
  addFragments(amount, source = 'Gameplay') {
    this.fragments += amount;
    if (this.eventBus) {
      this.eventBus.emit('fragments:updated', {
        fragments: this.fragments,
        amountAdded: amount,
        source
      });
    }
  }

  /**
   * Craft a relic using fragments
   * @param {string} relicType
   * @returns {{success: boolean, error?: string, relic?: Object}}
   */
  craftRelic(relicType) {
    const def = RelicManager.RELIC_DEFINITIONS[relicType];
    if (!def) {
      return { success: false, error: 'Unknown relic blueprint.' };
    }

    if (this.fragments < def.cost) {
      return { 
        success: false, 
        error: `Insufficient fragments. Need ${def.cost}, you have ${this.fragments}.` 
      };
    }

    this.fragments -= def.cost;
    this.inventory[relicType] = (this.inventory[relicType] || 0) + 1;
    this.battleCharges[relicType] = (this.battleCharges[relicType] || 0) + 1;
    this.totalCrafted++;

    if (this.eventBus) {
      this.eventBus.emit('relic:crafted', {
        relicType,
        relicName: def.name,
        remainingFragments: this.fragments,
        newCount: this.inventory[relicType],
        totalCrafted: this.totalCrafted
      });
      this.eventBus.emit('fragments:updated', { fragments: this.fragments });
    }

    return {
      success: true,
      relic: def,
      remainingFragments: this.fragments,
      count: this.inventory[relicType],
      totalCrafted: this.totalCrafted
    };
  }

  /**
   * Return a snapshot of current relic inventory and crafting achievements
   */
  getCraftingSummary() {
    return {
      fragments: this.fragments,
      inventory: { ...this.inventory },
      totalCrafted: this.totalCrafted
    };
  }

  /**
   * Select a relic to prepare for use in match
   */
  selectRelicForUse(relicType) {
    const def = RelicManager.RELIC_DEFINITIONS[relicType];
    if (!def) return { success: false, error: 'Invalid relic.' };

    const available = this.battleCharges[relicType] || 0;
    if (available <= 0) {
      return { success: false, error: `No ${def.name} charges remaining in this stage!` };
    }

    if (def.targetType === 'instant') {
      return this.useInstantRelic(relicType);
    }

    // Set targeting state
    this.activeTargetingRelic = relicType;
    if (this.eventBus) {
      this.eventBus.emit('relic:targeting_started', {
        relicType,
        targetType: def.targetType,
        name: def.name
      });
    }

    return { success: true, targeting: def.targetType };
  }

  /**
   * Cancel targeting state
   */
  cancelTargeting() {
    const prev = this.activeTargetingRelic;
    this.activeTargetingRelic = null;
    if (this.eventBus && prev) {
      this.eventBus.emit('relic:targeting_cancelled', { relicType: prev });
    }
  }

  /**
   * Execute instantaneous relic (e.g. Echo Amplifier)
   */
  useInstantRelic(relicType) {
    if (relicType === 'echo_amplifier') {
      this.battleCharges[relicType]--;
      this.inventory[relicType] = Math.max(0, this.inventory[relicType] - 1);

      if (this.eventBus) {
        this.eventBus.emit('relic:echo_amplifier_activated', {
          multiplier: 2.5,
          durationMoves: 3
        });
        this.eventBus.emit('relic:used', {
          relicType,
          remaining: this.battleCharges[relicType]
        });
      }
      return { success: true, activated: true };
    }
    return { success: false };
  }

  /**
   * Consume targeting relic on target execution
   */
  consumeRelic(relicType) {
    if (this.battleCharges[relicType] > 0) {
      this.battleCharges[relicType]--;
      this.inventory[relicType] = Math.max(0, this.inventory[relicType] - 1);
    }
    this.activeTargetingRelic = null;

    if (this.eventBus) {
      this.eventBus.emit('relic:used', {
        relicType,
        remaining: this.battleCharges[relicType]
      });
    }
  }

  /**
   * Reset battle charges for new level
   */
  resetForBattle() {
    this.battleCharges = { ...this.inventory };
    this.activeTargetingRelic = null;
  }

  /**
   * Sync inventory from server load
   */
  syncFromServer(data) {
    if (typeof data.fragments === 'number') this.fragments = data.fragments;
    if (data.inventory) {
      this.inventory = {
        row_clear: data.inventory.row_clear || 0,
        barrier_breaker: data.inventory.barrier_breaker || 0,
        echo_amplifier: data.inventory.echo_amplifier || 0,
        crystal_burst: data.inventory.crystal_burst || 0
      };
    }
    this.resetForBattle();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RelicManager;
} else {
  window.RelicManager = RelicManager;
}
