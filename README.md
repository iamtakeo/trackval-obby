# Trackval Obby

A high-performance, real-time multiplayer 3D racing and obstacle course (Obby) game built on a modern web stack. Featuring custom Cartesian physics, dynamic track generation, and seamless state synchronization.

## Features
- **Real-Time Multiplayer**: Low-latency state synchronization using PartyKit WebSockets.
- **Custom Cartesian Physics**: A free-roaming physics engine optimized for high-speed 3D movement and complex track geometries.
- **Dynamic Track Generation**: Procedurally generated 3D tracks with custom spline evaluation and physical banking.
- **High-Performance Rendering**: Built on React Three Fiber and Three.js, achieving native-like 60+ FPS on the web.
- **Rapid Iteration Cycle**: Architected for extremely fast development velocity with hot-reloadable physics parameters and headless validation.

## Development Statistics

**Total Commits**: 37
**Lines of Code**: 7,310
**Development Time**: ~1 Day (Intensive Sprint)

**Commit Velocity (Last 7 Days)**
```text
June  4:  (0)
June  5:  (0)
June  6:  (0)
June  7:  (0)
June  8:  (0)
June  9:  (0)
June 10: █████████████████████████████████████ (37)
```

## Project Status & Milestones
The project is organized into iterative development cycles focusing on rapid prototyping and high-performance physics.
- **Current Milestone**: UI & Tooling (M5) **(Resolved)**
- **Key Achievements**: Implemented a custom Cartesian physics engine, dynamic track generation with physical banking, and real-time multiplayer synchronization via PartyKit.
- For a detailed breakdown of cycles and tasks, see [PROJECT.md](file:///c:/Software/Dashboard/Obby/PROJECT.md).

## Architecture Overview
- **Data Flow**: The React/Vite client manages global state, driving both the Cartesian Physics Engine and the Procedural Track Generator, which feed the React Three Fiber Canvas.
- **State Synchronization**: Low-latency WebSocket connections via Edge-optimized PartyKit servers ensure seamless player state replication.
- **Memory Management**: To ensure 60+ FPS without micro-stutters, the engine uses aggressive Object Pooling for math structures and explicit lifecycle management for procedurally generated 3D geometries.
- **Custom Physics**: Built from the ground up for free-roaming 3D navigation, utilizing Frenet Frames and precise surface normal intersection math to handle non-planar track shapes (like loops and 90-degree banks).
- For an in-depth dive, including our Mermaid diagrams and validation strategies, see [docs/ARCHITECTURE.md](file:///c:/Software/Dashboard/Obby/docs/ARCHITECTURE.md).

## Tech Stack
- **Frontend**: React 19, Vite, TypeScript
- **3D Engine**: Three.js, `@react-three/fiber`, `@react-three/drei`
- **Networking**: `partykit`, `partysocket`
- **Linting & Code Quality**: ESLint, TypeScript Strict Mode

## Getting Started

### Installation
```bash
npm install
```

### Development Server
```bash
# Start Vite development server
npm run dev

# Start PartyKit multiplayer server
npx partykit dev
```

### Build & Testing
```bash
# Verify TypeScript types and build production bundle
npm run build

# Run linting
npm run lint

# Headless Physics/Track Validation
node test_frames.cjs
```
