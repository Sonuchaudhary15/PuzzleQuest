/**
 * Unit Tests for EventBus Pub/Sub Architecture
 * 
 * Validates the core event-driven programming theme:
 * - Decoupled publish/subscribe event flow
 * - Multiple listeners on identical event channel
 * - Cleanup via unsubscribe handler and off()
 * - Global bus listener teardown via clear()
 */
const { describe, test } = require('node:test');
const assert = require('node:assert');
const EventBus = require('../client/js/events/EventBus');

describe('Theme: Event-Driven Programming — EventBus Architecture', () => {
  test('Subscribes and receives emitted event payloads', () => {
    const bus = new EventBus();
    let received = null;

    bus.on('player:score', (data) => {
      received = data;
    });

    bus.emit('player:score', { points: 150 });
    assert.deepStrictEqual(received, { points: 150 });
  });

  test('Supports multiple listeners on a single event channel', () => {
    const bus = new EventBus();
    let callA = false;
    let callB = false;

    bus.on('game:start', () => { callA = true; });
    bus.on('game:start', () => { callB = true; });

    bus.emit('game:start');
    assert.strictEqual(callA, true);
    assert.strictEqual(callB, true);
  });

  test('Unsubscribes listener via returned unbind closure', () => {
    const bus = new EventBus();
    let count = 0;

    const unsubscribe = bus.on('tile:clicked', () => {
      count++;
    });

    bus.emit('tile:clicked');
    assert.strictEqual(count, 1);

    unsubscribe();
    bus.emit('tile:clicked');
    assert.strictEqual(count, 1, 'Callback should not fire after unsubscription');
  });

  test('clear() removes all active event listeners', () => {
    const bus = new EventBus();
    let fired = false;

    bus.on('alert:warning', () => { fired = true; });
    bus.clear();
    bus.emit('alert:warning');

    assert.strictEqual(fired, false, 'No callbacks should trigger after clear()');
  });
});
