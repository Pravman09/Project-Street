# Project // Street

Project Street is a browser-based, open-world street-racing game built with React, TypeScript, CSS and Three.js. This version preserves the complete single-player career and adds private real-time multiplayer for 2–6 players.

## Included

- The supplied GLB car model
- Large open-world Port Meridian city
- Arcade acceleration, braking, reverse, steering, grip, and off-road slowdown
- Handbrake and power-slide drifting
- Rechargeable nitro boost
- Smooth speed-sensitive chase camera
- Building and world-boundary collisions
- Speedometer, gear indicator, nitro meter, minimap, and drift indicator
- Keyboard reset and responsive HUD
- Single Player / Multiplayer entry screen
- Private rooms with short room codes and optional passwords
- Multiplayer lobby, host controls, ready states and scalable car selection
- Shared Free Roam with smoothed remote vehicles and player nameplates
- Optional player collision, traffic, police and time-of-day room settings
- Private races with synchronized countdown, checkpoints, laps and results
- Reconnection window, host transfer and basic server-side movement validation

## Controls

| Input | Action |
| --- | --- |
| W / Up Arrow | Accelerate |
| S / Down Arrow | Brake / Reverse |
| A / D or Left / Right Arrow | Steer |
| Space | Handbrake / drift |
| Shift | Nitro |
| R | Reset the car |

## Run locally

Install Node.js 22 or newer. Copy `.env.example` to `.env`, then install the frontend and backend packages:

```bash
npm install
npm --prefix server install
```

Start the multiplayer server in the first terminal:

```bash
npm run dev:multiplayer
```

Start the game in a second terminal:

```bash
npm run dev
```

Open the local address printed by the game. Test multiplayer using two browser tabs or two browsers.

For production builds:

```bash
npm run build
npm run build:multiplayer
```

## Multiplayer configuration

Frontend `.env`:

```env
VITE_MULTIPLAYER_SERVER_URL=http://localhost:3001
```

Backend `server/.env`:

```env
PORT=3001
CLIENT_ORIGIN=http://localhost:3000
ROOM_RECONNECT_SECONDS=20
```

`CLIENT_ORIGIN` accepts comma-separated origins. In production, set it to the exact public frontend address. Rooms are stored in memory and disappear when the multiplayer server restarts.

## Render deployment

1. Push the complete project to GitHub.
2. Create the multiplayer web service from `render.yaml`, or create a Node service with `server` as its root directory.
3. Set `CLIENT_ORIGIN` to the public game URL.
4. Copy the Render backend URL.
5. Set `VITE_MULTIPLAYER_SERVER_URL` to that backend URL in the frontend build environment and rebuild the frontend.
6. Confirm `https://YOUR-SERVER/health` returns `"ok": true`.

The backend uses WebSockets with polling fallback. Do not deploy it as a static site.

## Adding cars

Add the GLB file under `public/models`, then add one entry to `shared/vehicleRegistry.ts`. Multiplayer sends only the vehicle ID and colour; every player loads the matching model locally. The frontend garage and multiplayer server both read this same registry, so multiplayer code does not need to be changed for each new car.

## Multiplayer architecture

- `src/multiplayer`: connection manager, menus, lobby, HUD, remote vehicle interpolation and network state store.
- `server/src`: Express health API, Socket.IO transport, secure room store, validation, reconnection, host controls and race authority.
- Local driving stays client-responsive. The server validates room membership, session starts, update ownership, movement limits and race checkpoint order.
- Vehicle updates are throttled by the car telemetry loop instead of being sent every rendered frame.
- Remote traffic and police remain client-side in this release. Shared pursuits and co-op missions can be added without replacing the room protocol.

## Multiplayer testing checklist

- Two tabs and two separate browsers
- Room with and without password
- Incorrect password, invalid code and room-full errors
- Ready requirement and non-host start rejection
- Host leaving and host transfer
- Disconnect and reconnect within 20 seconds
- Different car models and colours
- Free Roam with 2–6 players
- Player collision on and off
- Private race countdown, checkpoint order, laps and results
- Mobile-width menu layout
- Slow-network throttling and remote-car smoothing

## Known limitations

The supplied car is one combined mesh. The full car moves and steers correctly, but the four wheels cannot rotate or steer independently yet. A future car model should ideally provide separate body and wheel meshes.

Traffic and police are local to each player in Free Roam. Player collision is disabled by default because internet latency can make physical contact less stable. Multiplayer rooms are temporary and are deleted when empty or when the server restarts.
