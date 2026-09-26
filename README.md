# Project // Street

Project Street v32 is a browser-based, open-world street-racing game built with React, TypeScript, CSS and Three.js. It includes the complete single-player career and private real-time multiplayer for 2–6 players.

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
- Five v32 garage additions: Dodge Challenger SRT, Nissan Skyline GT-R R34, Mercedes-AMG GT, Ferrari Race Edition and Rolls-Royce Wraith

## Controls

| Input | Action |
| --- | --- |
| W / Up Arrow | Accelerate |
| S / Down Arrow | Brake / Reverse |
| A / D or Left / Right Arrow | Steer |
| Space | Handbrake / drift |
| Shift | Nitro |
| R | Reset the car |

# 🏎️ Project Street

> **An open-world street racing experience built for the browser.**

**Project Street** is a browser-based driving and racing game featuring free roam, competitive races, police pursuits, vehicle customization, multiplayer, and a growing collection of cars. This Game is **Explicitly in an alpha version**, so lag might interfere. Still working hard to **OPTIMISE IT**

## 🎮 Play Project Street

### 🚀 [▶️ PLAY THE GAME](https://project-street.onrender.com/)

Open the game in a new tab and hit the streets.

---

## 🏁 Features

* 🌆 **Open-world free roam**
* 🏎️ **Street races**
* 👮 **Police pursuits**
* 🌐 **Online multiplayer**
* 🚗 **Multiple vehicles**
* 🔧 **Garage & upgrades**
* 🎨 **Vehicle customization**
* 🌦️ **Dynamic weather**
* 🚦 **Traffic system**
* ⚙️ **Manual transmission**
* 🗺️ **Minimap**
* 📸 **Photo & replay features**
* 🎮 **Xbox controller support**
* ⚙️ **Game settings**

---

## 🌐 Multiplayer

Project Street supports online multiplayer with private rooms.

Players can:

* Create private rooms
* Join rooms using passwords
* Race together
* See synchronized vehicles
* Compete through checkpoints and laps
* View race results
* Reconnect to sessions
* Continue playing when the host changes

The multiplayer system is powered by **Socket.IO**.

---

## 🚘 Cars

The game has grown through several vehicle updates.

### 🏎️ Hypercar Update — v33

The latest major vehicle update introduced a collection of high-performance cars:

* **McLaren P1**
* **Lamborghini Aventador Ultimae**
* **Lamborghini Centenario**
* **Aston Martin Vulcan**
* **Ferrari F40**

### Previous Vehicles

The garage also includes cars such as:

* Dodge Challenger SRT
* Nissan Skyline GT-R R34
* Mercedes-AMG GT
* Ferrari Race Edition
* Rolls-Royce Wraith

---

## 📈 Development

Project Street has gone through multiple iterations, continuously expanding its gameplay systems and vehicle lineup.

```text
v31
└── Multiplayer Update

v32
└── Supercar Update

v33
└── Hypercar Update 🏎️
```

### Current Version

**v33 — Hypercar Update**

---

## 🛠️ Technology

Project Street is built as a web-based game using technologies including:

* JavaScript
* HTML
* CSS
* 3D GLB assets
* Socket.IO
* Web-based multiplayer architecture

The project uses a separate frontend and multiplayer backend, allowing players to connect to online sessions directly from the browser.

---

## 🎮 Controls

Controls may vary depending on the current game configuration.

**Keyboard:**
Use the on-screen/control instructions provided in-game.

**Controller:**
 Controllers are supported.

---

## 🚀 Run Locally

Clone the repository:

```bash
git clone https://github.com/Pravman09/Project-Street.git
cd Project-Street
```

Then follow the project's setup instructions to start the game and multiplayer server locally.

---

---

## 🗺️ Roadmap

Project Street is an evolving project.

Future updates may expand:

* 🚗 Vehicle selection
* 🏁 Racing
* 🌆 World
* 🌐 Multiplayer
* 🔧 Customization
* 🎮 Gameplay systems

---

## 👨‍💻 Developer

**Prav**

Built as an independent game development project.

---

# 🏎️ Ready to Drive?

## 👉 [PLAY PROJECT STREET](https://project-street.onrender.com/)

**Start your engine. Hit the streets.**


## Multiplayer testing checklist

- Two tabs and two separate browsers
- Room with and without password
- Incorrect password, invalid code, and room-full errors
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

## Feedback
We are open to opinions and suggestions.
You can give feedback on GitHub, 
