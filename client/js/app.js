/**
 * app.js - Main Client Application Bootstrapper
 * 
 * Instantiates the engine modules, hooks up event-driven communication,
 * and sets up the user interface.
 */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize EventBus
  const eventBus = new EventBus();
  window.gameEventBus = eventBus;

  // 2. Initialize Game Engine components
  const mainBoard = new MainBoard({ rows: 8, cols: 8, eventBus });
  const echoBoard = new EchoBoard({ rows: 4, cols: 4, eventBus });
  const relicManager = new RelicManager({ eventBus });

  const gameEngine = new GameEngine({
    eventBus,
    mainBoard,
    echoBoard,
    relicManager
  });
  window.puzzleQuestEngine = gameEngine;

  // 3. Audio Synthesizer
  const soundManager = new SoundManager(eventBus);

  // 4. REST API Client
  const apiClient = new ApiClient();

  // 5. Screen Manager (Routing)
  const screens = {
    home: document.getElementById('screen-home'),
    auth: document.getElementById('screen-auth'),
    map: document.getElementById('screen-map'),
    game: document.getElementById('screen-game'),
    relics: document.getElementById('screen-relics'),
    banana: document.getElementById('screen-banana'),
    profile: document.getElementById('screen-profile'),
    leaderboard: document.getElementById('screen-leaderboard'),
    help: document.getElementById('screen-help')
  };
  const screenManager = new ScreenManager(screens, eventBus);

  // 6. Board Visual & Particle Renderer
  const boardRenderer = new BoardRenderer({
    mainBoardContainer: document.getElementById('main-board-grid'),
    echoBoardContainer: document.getElementById('echo-board-grid'),
    fxCanvas: document.getElementById('fx-overlay-canvas'),
    eventBus,
    gameEngine
  });

  // 7. UI & Interaction Manager
  const uiManager = new UIManager({
    eventBus,
    gameEngine,
    screenManager,
    apiClient,
    soundManager
  });

  // Ensure level 1 is pre-initialized on boot
  gameEngine.startLevel(window.LEVELS[0]);

  // Hook Battle Board nav to ensure level is active
  document.querySelectorAll('[data-nav-target="game"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!gameEngine.currentLevel) {
        gameEngine.startLevel(window.LEVELS[0]);
      }
    });
  });

  // Home screen Play button
  document.getElementById('btn-home-play')?.addEventListener('click', () => {
    screenManager.showScreen('map');
    uiManager.renderWorldMap();
  });

  // Home screen Tutorial button (Launches Level 1 directly)
  document.getElementById('btn-home-tutorial')?.addEventListener('click', () => {
    const tutorialLvl = window.LEVELS[0];
    gameEngine.startLevel(tutorialLvl);
    screenManager.showScreen('game');
  });

  // Check URL hash or show home by default
  screenManager.showScreen('home');

  console.log('[PuzzleQuest] System successfully bootstrapped with Event-Driven Architecture.');
});
