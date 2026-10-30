# PuzzleQuest: A Strategy-Based Match-Three Adventure

[![Tests](https://img.shields.io/badge/Tests-25%2F25%20Passing-brightgreen.svg)]()
[![Platform](https://img.shields.io/badge/Platform-Browser%20%7C%20Node.js-blue.svg)]()
[![Database](https://img.shields.io/badge/Database-MongoDB%20%2B%20Mongoose-emerald.svg)]()
[![Auth](https://img.shields.io/badge/Auth-JWT%20%2B%20Bcrypt-orange.svg)]()
[![External%20API](https://img.shields.io/badge/External%20API-Banana%20API%20Proxied-yellow.svg)]()

> **University of Bedfordshire — Software for Enterprise Assignment**  
> An enterprise-grade, browser-based fantasy puzzle game demonstrating **Version Control**, **Interoperability**, **Event-Driven Programming**, and **Virtual Identity**.

---

## 1. System Architecture Diagram

```
+---------------------------------------------------------------------------------------+
|                                    BROWSER CLIENT                                     |
|  HTML5 Canvas & DOM Grid  *  Vanilla JavaScript ES6+  *  Web Audio Synth Oscillator   |
|                                                                                       |
|  +------------------------+  +--------------------------+  +-----------------------+  |
|  |       MainBoard        |  |        EchoBoard         |  |     RelicManager      |  |
|  |  (8x8 Match-3 Physics) |  | (Connected Conduits/Runes|  |  (4 Craftable Relics) |  |
|  +-----------+------------+  +------------+-------------+  +-----------+-----------+  |
|              ^                            ^                            ^              |
|              +--------------------+       |       +--------------------+              |
|                                   v       v       v                                   |
|                        +------------------------------------+                         |
|                        |       EventBus (Pub/Sub)           |                         |
|                        +-----------------+------------------+                         |
|                                          ^                                            |
|                                          |                                            |
|                        +-----------------+------------------+                         |
|                        |            GameEngine              |                         |
|                        |   (Moves, Objectives, Win/Loss)    |                         |
|                        +-----------------+------------------+                         |
+------------------------------------------|--------------------------------------------+
                                           | HTTP / REST (JSON + JWT Bearer)
                                           v
+---------------------------------------------------------------------------------------+
|                                  EXPRESS.JS BACKEND                                   |
|                                                                                       |
|  +-----------------------+  +-------------------------+  +-------------------------+  |
|  |     /api/auth         |  |       /api/game         |  |       /api/banana       |  |
|  |  (Register, Login,    |  | (Level Catalog, Server- |  |  (Secure Banana API     |  |
|  |   JWT Verification)   |  |  Side Anti-Tamper Check)|  |   Proxy & Solution Mask)|  |
|  +-----------+-----------+  +------------+------------+  +------------+------------+  |
|              |                           |                            |               |
|              v                           v                            v               |
|  +---------------------------------------------------------------------------------+  |
|  |                  Mongoose Models & Data Access Layer                            |  |
|  |         User  *  LevelProgress  *  RelicInventory  *  LeaderboardScore          |  |
|  +---------------------------------------+-----------------------------------------+  |
+------------------------------------------|--------------------------------------------+
                                           |
                    +----------------------+----------------------+
                    |                                             |
                    v                                             v
     +------------------------------+             +-------------------------------+
     |       MONGODB DATABASE       |             |     EXTERNAL BANANA API       |
     |   (Local or MongoDB Atlas)   |             | (University of Bedfordshire)  |
     |   * Resilient In-Memory Fallback           | marcconrad.com/uob/banana     |
     +------------------------------+             +-------------------------------+
```

---

## 2. Mapping of the Four Enterprise Themes to Code Modules

| Enterprise Theme | Theoretical Concept | Concrete Implementation in PuzzleQuest | Code Locations |
| :--- | :--- | :--- | :--- |
| **1. Version Control** | Atomic commits, branching models, configuration hygiene, secret protection, automated regression testing. | - Git repository initialized with atomic semantic commits.<br>- `.gitignore` protecting `.env`, `node_modules`, and test artifacts.<br>- Automated 25-test suite covering mechanics, proxy, auth, and validation.<br>- Non-destructive feature branching instructions. | [`.gitignore`](file:///.gitignore)<br>[`package.json`](file:///package.json)<br>[`tests/`](file:///tests/) |
| **2. Interoperability** | Standardized data exchange protocols, heterogeneous system integration, and fault-tolerant service bridging. | - RESTful HTTP APIs exchanging structured JSON.<br>- Backend proxy communicating with the external University of Bedfordshire Banana API.<br>- Resilient timeout handling (`AbortController`) and friendly fallback when external services experience downtime.<br>- Decoupled MongoDB database persistence. | [`server/services/bananaService.js`](file:///server/services/bananaService.js)<br>[`server/routes/bananaRoutes.js`](file:///server/routes/bananaRoutes.js)<br>[`client/js/api/ApiClient.js`](file:///client/js/api/ApiClient.js) |
| **3. Event-Driven Programming** | Publish/Subscribe decoupled event messaging, asynchronous state transitions, reactive visual feeds. | - Central `EventBus` module decoupling game mechanics from the UI, particle canvas, and audio synthesizer.<br>- Custom game events: `match:detected`, `echo:energy_generated`, `echo:barrier_broken`, `relic:used`, `game:win`.<br>- Dynamic Echo Beam canvas connecting board coordinates upon energy events. | [`client/js/events/EventBus.js`](file:///client/js/events/EventBus.js)<br>[`client/js/ui/BoardRenderer.js`](file:///client/js/ui/BoardRenderer.js)<br>[`client/js/audio/SoundManager.js`](file:///client/js/audio/SoundManager.js) |
| **4. Virtual Identity** | Cryptographic authentication, stateful identity records, authorization tiers, and competitive persistence. | - Salted password hashing with `bcryptjs` (10 salt rounds).<br>- Stateless JSON Web Token (`jsonwebtoken`) issuance and authorization header validation.<br>- Persistent player accounts with adventurer titles, unlocked regions, relic inventories, and online leaderboard rankings. | [`server/models/User.js`](file:///server/models/User.js)<br>[`server/middleware/auth.js`](file:///server/middleware/auth.js)<br>[`server/routes/authRoutes.js`](file:///server/routes/authRoutes.js)<br>[`server/models/LeaderboardScore.js`](file:///server/models/LeaderboardScore.js) |

---

## 3. Core Gameplay & Signature Mechanics

### A. The Match-Three Physics Engine (`MainBoard`)
- **8x8 Grid**: Contains 5 vibrant crystal types: Ruby (Fire), Sapphire (Echo Resonance), Emerald (Nature/Fragments), Amethyst (Mystic), and Topaz (Solar).
- **Valid Swap Validation**: Swapping two adjacent tiles is only permitted if a match of 3 or more is formed. If no match is created, the engine smoothly cancels and reverts the swap.
- **Gravity & Refill**: Matched crystals dissolve, surviving tiles fall smoothly under gravity, and new randomized crystals populate top vacancies.
- **Cascades & Combos**: Chain reactions increment combo multipliers (x2, x3, x4...), scaling score bonuses and awarding additional relic fragments.

### B. The Signature Feature: Connected Echo Board (`EchoBoard`)
- An adjacent secondary puzzle grid representing ancient dormant conduits and crystalline barriers.
- **Echo Energy Channel**: Matching **Sapphire crystals** on the Main Board harvests high-frequency Echo Energy.
- **Visual Connecting Beam**: When Sapphire crystals match, an animated, electric canvas beam connects the Main Board coordinates directly across to the Echo Board.
- **Barrier Shattering**: Once a locked cell's energy requirement threshold is satisfied (e.g. 50 energy), its barrier shatters, awakening the ancient glyph and advancing the stage objective.
- **Dual Objectives**: Victory requires completing both the Main Board objective (e.g., collect 12 Sapphires) and the Echo Board objective (e.g., awaken 2 Guardian Runes) within the move limit.

### C. Relic Fusion System (`RelicManager`)
Collect crystal fragments from high-combo cascades and mystery challenges to forge 4 tactical relics:
1. **Sunbeam Lance (`row_clear`)**: Pierces an entire row on the Main Board, triggering massive cascades (Cost: 30 fragments).
2. **Rune Breaker (`barrier_breaker`)**: Targets and instantly shatters a locked barrier on the Echo Board (Cost: 40 fragments).
3. **Resonance Chalice (`echo_amplifier`)**: Amplifies all Echo Energy transmission by 2.5x for 3 turns (Cost: 35 fragments).
4. **Astral Bomb (`crystal_burst`)**: Detonates a 3x3 crystalline area on the Main Board (Cost: 25 fragments).

### D. Adventure World Map Progression
- **3 Themed Regions**:
  1. *Whispering Crystal Woods* (Nature theme, emerald glow, tutorial & introductory stages).
  2. *The Sunken Citadel* (Oceanic abyssal theme, deep sapphire resonance).
  3. *Celestial Spire* (Astral starlight theme, high-energy cosmic seals).
- **Branching Routes**: Choice between Route A (Relic routes with bonus fragment rewards) and Route B (Arcana routes with high score challenges).

### E. University of Bedfordshire Banana API (Mystery Challenge)
- **External Contract**: `GET https://marcconrad.com/uob/banana/api.php?out=json`
- **Security & Privacy Architecture**: The backend acts as a proxy. When the client summons a challenge, the server generates a cryptographically secure `challengeId`, caches the answer server-side with an expiry timestamp, and returns **ONLY** the challenge image URL.
- **Anti-Cheat Verification**: Upon answer submission (`POST /api/banana/verify`), the server validates the user's answer against the cached solution. The challenge is **immediately invalidated** upon submission (single-use token) to prevent duplicate reward exploits.
- **Resilience**: If the university API times out or is unreachable, the system catches the error gracefully and presents an informative status message without crashing the game.

---

## 4. Folder & File Structure

```
PuzzleQuest/
├── .env                         # Local environment configuration (git-ignored)
├── .env.example                 # Template environment variables
├── .gitignore                   # Excludes node_modules, .env, and temp files
├── package.json                 # Project dependencies and test scripts
├── README.md                    # System documentation and assignment mappings
├── server/
│   ├── server.js                # Express web server & API router
│   ├── config/
│   │   └── db.js                # Mongoose connection with resilient In-Memory fallback
│   ├── data/
│   │   └── levelDefinitions.js  # Regions, levels, branching routes, and objectives
│   ├── middleware/
│   │   ├── auth.js              # JWT Bearer token authentication & optional auth
│   │   └── errorHandler.js      # Centralized HTTP status and exception handler
│   ├── models/
│   │   ├── User.js              # Player schema (hashed password, stats, fragments)
│   │   ├── LevelProgress.js     # Per-level high scores and star ratings (1-3)
│   │   ├── RelicInventory.js    # Player's crafted relic quantities
│   │   └── LeaderboardScore.js  # Fast ranked score leaderboard index
│   ├── routes/
│   │   ├── authRoutes.js        # POST /register, POST /login, GET /me
│   │   ├── gameRoutes.js        # GET /levels, POST /complete-level, GET /progress
│   │   ├── relicRoutes.js       # GET /inventory, POST /craft
│   │   ├── leaderboardRoutes.js # GET /leaderboard
│   │   └── bananaRoutes.js      # GET /challenge, POST /verify
│   └── services/
│       ├── bananaService.js     # Banana API proxy & secure verification
│       └── validationService.js # Server-side anti-tamper score & move validator
├── client/
│   ├── index.html               # Main SPA markup and 9 application screens
│   ├── data/
│   │   └── levelDefinitions.js  # Client-side level definition mirror
│   ├── css/
│   │   ├── style.css            # Fantasy color tokens, typography, and buttons
│   │   ├── game.css             # Match-3 crystal facets, connected echo board, HUD
│   │   ├── map.css              # Adventure world map, regions, and level nodes
│   │   └── components.css       # Modals, relics, banana challenge, and leaderboard
│   └── js/
│       ├── app.js               # Application lifecycle bootstrapper
│       ├── events/
│       │   └── EventBus.js      # Decoupled Publish/Subscribe event emitter
│       ├── engine/
│       │   ├── Tile.js          # Crystal representation, colors, and symbols
│       │   ├── MainBoard.js     # Match-3 mechanics, gravity, cascades, and combos
│       │   ├── EchoBoard.js     # Secondary connected grid, energy, and barriers
│       │   ├── RelicManager.js  # Relic fusion crafting and targeting powers
│       │   └── GameEngine.js    # Moves tracking, objectives, and win/loss logic
│       ├── audio/
│       │   └── SoundManager.js  # Web Audio API procedural sound synthesizer
│       ├── api/
│       │   └── ApiClient.js     # REST client for JWT auth and Banana proxy
│       └── ui/
│           ├── BoardRenderer.js # Grid DOM rendering, particles, and Echo Beam
│           ├── ScreenManager.js # Client routing between 9 application screens
│           └── UIManager.js     # HUD, map rendering, modals, and user forms
└── tests/
    ├── matchEngine.test.js      # Match-3 swaps, horizontal/vertical matches, gravity
    ├── echoBoard.test.js        # Echo energy accumulation, barrier shatter, buffs
    ├── relicCrafting.test.js    # Crafting recipes, costs, and inventory consumption
    ├── auth.test.js             # Bcrypt password hashing and JWT security
    ├── bananaProxy.test.js      # Banana API solution masking and anti-replay checks
    └── validation.test.js       # Score limits and mathematical ceiling validation
```

---

## 5. Prerequisites & Installation Guide (Visual Studio Code)

### Prerequisites
- **Node.js**: Version 18.0.0 or higher (Tested on Node.js v22.19.0).
- **npm**: Version 9.0.0 or higher.
- **MongoDB** *(Optional)*: Local MongoDB server or MongoDB Atlas URI.  
  *Note: If MongoDB is not running locally, PuzzleQuest automatically activates its built-in Resilient In-Memory Database Engine so you can evaluate all features immediately without installing or configuring external services!*

### Step 1: Open in Visual Studio Code
1. Launch **Visual Studio Code**.
2. Go to **File -> Open Folder...** and select the `PuzzleQuest` directory:
   ```
   c:\Users\kryst\OneDrive\Desktop\PuzzleQuest
   ```

### Step 2: Install Node Dependencies
Open the VS Code integrated terminal (`Ctrl + ~` or **Terminal -> New Terminal**) and execute:
```bash
npm install
```

### Step 3: Configure Environment Variables
A pre-configured development `.env` file is included. To review or customize configuration options, reference `.env.example`:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/puzzlequest
JWT_SECRET=puzzlequest_dev_secret_key_change_in_production_9988
BANANA_API_URL=https://marcconrad.com/uob/banana/api.php
BANANA_API_TIMEOUT_MS=6000
```

### Step 4: Run the Automated Test Suite
Execute the 25-test automated unit and integration suite:
```bash
npm test
```
All 6 test suites will run and report 25 passing assertions with 0 failures.

### Step 5: Start the Application Server
Run the Express development server:
```bash
npm run dev
# Or standard start:
npm start
```
The console will display:
```
====================================================
  PUZZLEQUEST: MATCH-THREE ADVENTURE SERVER ONLINE  
  Local URL: http://localhost:3000                
  Environment: development 
====================================================
[Database] Connected successfully to MongoDB via Mongoose: mongodb://localhost:27017/puzzlequest
```

### Step 6: Launch in Web Browser
Open your browser and navigate to:
```
http://localhost:3000
```

---

## 6. Version Control & Git History Guide

To demonstrate version control standards, use the following suggested Git commands to create a clean, professional commit trajectory:

```bash
# 1. Initialize Git and stage configuration
git init
git add .gitignore .env.example package.json README.md
git commit -m "chore(init): configure project architecture, dependencies, and environment templates"

# 2. Stage core Match-Three engine and EventBus
git checkout -b feature/match-engine
git add client/js/events/ client/js/engine/Tile.js client/js/engine/MainBoard.js tests/matchEngine.test.js
git commit -m "feat(engine): implement match-3 grid, swap validation, gravity cascade, and EventBus"

# 3. Stage connected Echo Board mechanics
git checkout -b feature/echo-board
git add client/js/engine/EchoBoard.js client/js/engine/GameEngine.js tests/echoBoard.test.js
git commit -m "feat(echo-board): add dual-board puzzle mechanics, energy thresholding, and glyph unlocking"

# 4. Stage relic fusion and inventory
git checkout -b feature/relic-fusion
git add client/js/engine/RelicManager.js tests/relicCrafting.test.js
git commit -m "feat(relics): implement relic fusion crafting system and battle targeting powers"

# 5. Stage Web Audio, Canvas rendering, and UI
git checkout -b feature/game-ui
git add client/index.html client/css/ client/js/audio/ client/js/ui/ client/js/app.js
git commit -m "feat(ui): build fantasy interface, audio synth, and dynamic Echo Beam canvas"

# 6. Stage backend REST API, MongoDB, and Virtual Identity
git checkout -b feature/backend-auth
git add server/config/ server/models/ server/middleware/ server/routes/ tests/auth.test.js tests/validation.test.js
git commit -m "feat(backend): implement Express REST APIs, Mongoose schemas, and JWT authentication"

# 7. Stage Banana API integration
git checkout -b feature/banana-api
git add server/services/bananaService.js server/routes/bananaRoutes.js tests/bananaProxy.test.js
git commit -m "feat(banana-api): integrate University Banana API proxy with solution masking and single-use verification"

# 8. Merge into main branch
git checkout master
git merge feature/banana-api
```

---

## 7. Tutor Demonstration Plan

Follow this structured 5-minute walkthrough to demonstrate all assignment criteria to an instructor or tutor:

### Demonstration Steps
1. **Show Architecture & Version Control (1 min)**:
   - Point to `package.json`, `.gitignore`, and the `.env.example` file.
   - Run `npm test` in the terminal to show 25/25 automated tests passing across engine mechanics, JWT security, score validation, and API proxying.
2. **Demonstrate Match-Three & Connected Echo Board (1.5 min)**:
   - Navigate to `http://localhost:3000`.
   - Click **"Tutorial: Echo Board"** to review the modal tutorial, then click **"Begin Trial"**.
   - Select and swap crystals on the Main Board. Point out that invalid swaps automatically revert.
   - Match **Sapphire crystals** and highlight the **glowing electric Echo Beam** shooting across to the Echo Board on the right.
   - Show how accumulated energy raises the progress bar of the locked barrier rune until the barrier shatters.
3. **Demonstrate Relic Fusion & Battle Power (1 min)**:
   - Navigate to the **"Relic Fusion"** screen. Show the 4 craftable relics and player's crystal fragment balance.
   - Craft a **Sunbeam Lance** or **Rune Breaker**.
   - Return to battle, select the relic in the bottom tray, and click a row or Echo barrier to demonstrate its immediate tactical effect.
4. **Demonstrate Banana API Interoperability (1 min)**:
   - Click **"Mystery Challenge"** in the top navigation bar.
   - Click **"Summon Mystery Challenge"** to demonstrate live HTTP communication with the University of Bedfordshire Banana API.
   - Open browser DevTools Network tab to prove that the server proxy masks the solution and never leaks it to client JavaScript.
   - Solve the equation, submit the answer, and demonstrate the verified reward notification (+500 points, +30 fragments).
5. **Demonstrate Virtual Identity & Online Leaderboard (0.5 min)**:
   - Click **"Sign In"** in the top right. Register a new account (`ArchMage_Test`, `password123`).
   - Show how the user's progress and stats are persisted to MongoDB.
   - Click **"Leaderboard"** to show the ranked **Hall of Glory** score table.

---

## 8. Known Limitations & Future Improvements

### Known Limitations
1. **External API Dependence**: The Mystery Challenge feature depends on the third-party uptime of `https://marcconrad.com/uob/banana/api.php`. When the external university host is under maintenance, the backend proxy catches the downtime gracefully, but new external puzzles cannot be fetched until the external server recovers.
2. **Move Auditing Depth**: The current server-side validation validates score boundaries and move allowances mathematically. Complete deterministic replay simulation on the server would further strengthen anti-cheat protection.

### Future Improvements
1. **PvP Asynchronous Ghost Battles**: Adding asynchronous ghost matches allowing two players to compete against the same Echo Board seed simultaneously.
2. **Guild Relic Synthesizer**: Enabling multiplayer adventuring parties where players pool relic fragments to unlock guild-wide passive energy bonuses.
3. **Audio Pack Selection**: Providing optional symphonic orchestral audio themes alongside the built-in procedural Web Audio synthesizer.

---

## 9. License

Developed for academic evaluation as part of the **University of Bedfordshire — Software for Enterprise** coursework. All rights reserved.
