/**
 * EventBus - Central Event-Driven Architecture Bus
 * 
 * Demonstrates the Software for Enterprise theme: Event-Driven Programming.
 * Provides decoupled communication between the match engine, echo board,
 * UI components, sound synthesizer, and network API layers.
 */
class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe to an event
   * @param {string} event - Name of the event
   * @param {Function} callback - Handler function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    return () => this.off(event, callback);
  }

  /**
   * Subscribe to an event for exactly one execution
   * @param {string} event - Name of the event
   * @param {Function} callback - Handler function
   * @returns {Function} Unsubscribe function
   */
  once(event, callback) {
    const wrapper = (data) => {
      this.off(event, wrapper);
      callback(data);
    };
    return this.on(event, wrapper);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Name of the event
   * @param {Function} callback - Handler function to remove
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
      if (this.listeners.get(event).size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit an event to all registered listeners
   * @param {string} event - Name of the event
   * @param {*} data - Payload passed to handlers
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`[EventBus Error] Exception in handler for "${event}":`, err);
        }
      });
    }
  }

  /**
   * Clear all listeners (useful for test resets and level teardowns)
   */
  clear() {
    this.listeners.clear();
  }
}

// Export singleton for shared global usage or instantiate per game session
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EventBus;
} else {
  window.EventBus = EventBus;
}
