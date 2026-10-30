/**
 * SoundManager - Procedural Web Audio API Sound Synthesizer
 * 
 * Generates rich fantasy sound effects purely with JavaScript Web Audio API oscillators.
 * Zero external audio files required, guaranteeing 100% offline and cross-platform reliability.
 */
class SoundManager {
  constructor(eventBus = null) {
    this.eventBus = eventBus;
    this.ctx = null;
    this.isMuted = false;
    this.volume = 0.3;

    this.bindEvents();
  }

  /**
   * Lazily initialize AudioContext on first user interaction
   */
  initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  bindEvents() {
    if (!this.eventBus) return;

    this.eventBus.on('tile:selected', () => this.playSelect());
    this.eventBus.on('tile:swapped', () => this.playSwap());
    this.eventBus.on('tile:swap_reverted', () => this.playInvalid());
    
    this.eventBus.on('match:detected', (data) => {
      this.playMatch(data.combo || 1, data.removedTiles?.length || 3);
    });

    this.eventBus.on('echo:energy_generated', (data) => {
      this.playEchoHum(data.amount);
    });

    this.eventBus.on('echo:energy_applied', (data) => {
      if (data.newlyUnlocked && data.newlyUnlocked.length > 0) {
        this.playGlyphUnlock();
      }
    });

    this.eventBus.on('relic:used', (data) => {
      this.playRelicBlast(data.relicType);
    });

    this.eventBus.on('game:win', () => this.playVictory());
    this.eventBus.on('game:lose', () => this.playDefeat());
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  /**
   * Crystal Selection Click
   */
  playSelect() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(this.volume * 0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }

  /**
   * Tile Swap Swoosh
   */
  playSwap() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(540, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(this.volume * 0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  /**
   * Invalid Swap Revert Sound
   */
  playInvalid() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.setValueAtTime(140, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(this.volume * 0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.18);
  }

  /**
   * Crystal Match Harmonic Chime (Scales in pitch as combo ascends)
   */
  playMatch(combo = 1, tileCount = 3) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const musicalPitches = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51];
    const pitchIndex = Math.min(musicalPitches.length - 1, (combo - 1) * 2);
    const baseFreq = musicalPitches[pitchIndex];

    [0, 0.05, 0.1].forEach((delay, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * (1 + (idx * 0.25)), this.ctx.currentTime + delay);

      const startTime = this.ctx.currentTime + delay;
      gain.gain.setValueAtTime(this.volume * 0.5, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  }

  /**
   * Echo Energy Surge Hum
   */
  playEchoHum(amount = 10) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(this.volume * 0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  /**
   * Ancient Glyph Unlock Shatter Sound
   */
  playGlyphUnlock() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const chords = [440, 554.37, 659.25, 880];
    chords.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + (idx * 0.04));

      const t = this.ctx.currentTime + (idx * 0.04);
      gain.gain.setValueAtTime(this.volume * 0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.42);
    });
  }

  /**
   * Relic Blast Effect
   */
  playRelicBlast(relicType) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(this.volume * 0.6, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.38);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  /**
   * Victory Fanfare
   */
  playVictory() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const victoryNotes = [523.25, 659.25, 783.99, 1046.50];
    victoryNotes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      const t = this.ctx.currentTime + (idx * 0.12);
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(this.volume * 0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.65);
    });
  }

  /**
   * Defeat Chime
   */
  playDefeat() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const defeatNotes = [440, 392, 349.23, 293.66];
    defeatNotes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      const t = this.ctx.currentTime + (idx * 0.18);
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(this.volume * 0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.55);
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SoundManager;
} else {
  window.SoundManager = SoundManager;
}
