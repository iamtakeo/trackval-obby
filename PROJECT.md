# Project Ledger

This document serves as the living ledger of development cycles, milestones, and technical audits for Trackval Obby.

## Milestones

| Milestone | Scope | Dependencies | Status |
| :--- | :--- | :--- | :--- |
| **M1: 3D Rendering Foundation** | Setup React Three Fiber, camera, and basic mesh rendering. | React, Three.js | **(Resolved)** |
| **M2: Track Generation** | Procedural bezier-curve track generation, 3D shape extrusion, and visual banking. | M1 | **(Resolved)** |
| **M3: Cartesian Physics** | Custom free-roaming physics engine, replacing kinematic models for realistic high-speed handling. | M2 | **(Resolved)** |
| **M4: Multiplayer Sync** | PartyKit integration for low-latency player state synchronization. | M1 | **(Resolved)** |
| **M5: UI & Tooling** | In-game parameter tuning menu, track generation toggles, and HUD. | M3 | **(Resolved)** |

## Development Cycles

### 1. Development Summary (June 10 Cycle)

- **Architecture & Foundation (Resolved)**: 
  - Initialized Vite + React Three Fiber stack.
  - Configured strict TypeScript and ESLint environments.
- **Physics & Memory Management (Resolved)**: 
  - Overhauled physics engine to a **Cartesian free-roaming model** to support advanced track shapes.
  - Fixed low-speed steering calculation loops by ensuring a minimum effective velocity.
  - Corrected Y-height intersection math and surface normal alignment for car pitch.
- **Graphics & Track Generation (Resolved)**:
  - Fixed 90-degree track rotation and frustum culling bugs on support pillars.
  - Solved track clipping by increasing track geometry sample resolution.
  - Added visual and physical banking to track meshes for improved ride dynamics.
  - Implemented handbrake mechanics and closed-loop track warping for seamless infinite tracks.
- **UI & Tools (Resolved)**: 
  - Refactored Esc menu to use a robust submenu navigation system.
  - Integrated dynamic Car Parameters adjustment, applying physics changes in real-time.
  - Added a headless 3D orientation validation script for continuous integration and structural integrity checks.
