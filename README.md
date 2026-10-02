# Project // Street
# *You can go to v33 Hypercar Branch for the weblink to play the game*
First playable foundation for an open-world, arcade-style street racing game built with React, TypeScript, CSS, and Three.js.

## Included in this build

- The supplied GLB car model
- Free-roam neon city district
- Arcade acceleration, braking, reverse, steering, grip, and off-road slowdown
- Handbrake and power-slide drifting
- Rechargeable nitro boost
- Smooth speed-sensitive chase camera
- Building and world-boundary collisions
- Speedometer, gear indicator, nitro meter, minimap, and drift indicator
- Keyboard reset and responsive HUD

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

Install Node.js 22 or newer, open a terminal in this folder, and run:

```bash
npm install
npm run dev
```

Open the local address printed by Vite. For a production build:

```bash
npm run build
npm run preview
```

## Current model limitation

The supplied car is one combined mesh. The full car moves and steers correctly, but the four wheels cannot rotate or steer independently yet. A future car model should ideally provide separate body and wheel meshes.
