import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { CAR_CATALOG } from '../game/carCatalog'
import { RACE_EVENTS } from '../game/raceEvents'
import type { MultiplayerController } from './useMultiplayer'
import { DEFAULT_ROOM_SETTINGS, type RoomSettings } from './types'

export function ModeSelectScreen({ onSinglePlayer, onMultiplayer }: { onSinglePlayer: () => void; onMultiplayer: () => void }) {
  return (
    <section className="mode-select">
      <div className="mode-select__brand">
        <small>WELCOME TO PORT MERIDIAN</small>
        <h1>PROJECT <span>//</span> STREET</h1>
        <p>Choose how you want to enter the city.</p>
      </div>
      <div className="mode-select__choices">
        <button className="mode-card mode-card--single" onClick={onSinglePlayer}>
          <i>01</i><span><small>CAREER // OFFLINE</small><strong>SINGLE PLAYER</strong><em>Free roam, rivals, police pursuits and progression.</em></span><b>›</b>
        </button>
        <button className="mode-card mode-card--multi" onClick={onMultiplayer}>
          <i>02</i><span><small>PRIVATE ROOMS // 2–6 PLAYERS</small><strong>MULTIPLAYER</strong><em>Drive, race and explore Port Meridian together.</em></span><b>›</b>
        </button>
      </div>
      <footer>PRIVATE MULTIPLAYER // SHARED CITY // REAL-TIME DRIVING</footer>
    </section>
  )
}

interface MultiplayerMenuProps {
  multiplayer: MultiplayerController
  selectedCarId: string
  unlockedCarIds: string[]
  selectedBodyColor: string
  onSelectCar: (carId: string) => void
  onBack: () => void
}

const classes = ['any', ...Array.from(new Set(CAR_CATALOG.map((car) => car.className)))]

export function MultiplayerMenu({ multiplayer, selectedCarId, unlockedCarIds, selectedBodyColor, onSelectCar, onBack }: MultiplayerMenuProps) {
  const [screen, setScreen] = useState<'home' | 'create' | 'join'>('home')
  const [playerName, setPlayerName] = useState('Driver')
  const [roomName, setRoomName] = useState('Port Meridian Crew')
  const [roomCode, setRoomCode] = useState('')
  const [password, setPassword] = useState('')
  const [settings, setSettings] = useState<RoomSettings>({ ...DEFAULT_ROOM_SETTINGS })
  const [submitting, setSubmitting] = useState(false)
  const room = multiplayer.room
  const localPlayer = room?.players.find((player) => player.id === multiplayer.playerId) ?? null
  const connectedPlayers = room?.players.filter((player) => player.connected) ?? []
  const allReady = connectedPlayers.length >= 2 && connectedPlayers.every((player) => player.ready)
  const selectedCar = CAR_CATALOG.find((car) => car.id === selectedCarId) ?? CAR_CATALOG[0]!

  useEffect(() => {
    try {
      const savedName = window.localStorage.getItem('project-street-player-name')
      if (savedName) setPlayerName(savedName)
    } catch { /* Browser storage is optional. */ }
  }, [])

  const rememberName = () => {
    try { window.localStorage.setItem('project-street-player-name', playerName.trim()) } catch { /* ignored */ }
  }

  const createRoom = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    rememberName()
    await multiplayer.createRoom({
      playerName: playerName.trim(),
      roomName: roomName.trim(),
      password,
      vehicleId: selectedCar.id,
      bodyColor: selectedBodyColor,
      settings,
    })
    setSubmitting(false)
  }

  const joinRoom = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    rememberName()
    await multiplayer.joinRoom({
      playerName: playerName.trim(),
      roomCode: roomCode.trim().toUpperCase(),
      password,
      vehicleId: selectedCar.id,
      bodyColor: selectedBodyColor,
    })
    setSubmitting(false)
  }

  const copyRoomCode = async () => {
    if (!room) return
    await navigator.clipboard?.writeText(room.code)
  }

  const copyInvite = async () => {
    if (!room) return
    await navigator.clipboard?.writeText(`Join ${room.name} in Project Street. Room code: ${room.code}${room.hasPassword ? ' (password required)' : ''}`)
  }

  const chooseLobbyCar = (carId: string) => {
    const car = CAR_CATALOG.find((candidate) => candidate.id === carId)
    if (!car) return
    onSelectCar(carId)
    void multiplayer.updateProfile(car.id, car.accent)
  }

  const patchRoomSettings = (patch: Partial<RoomSettings>) => {
    if (!room || !localPlayer?.host) return
    void multiplayer.updateSettings({ ...room.settings, ...patch })
  }

  if (room && localPlayer) {
    const allowedCars = CAR_CATALOG.filter((car) => room.settings.allowedCarClass === 'any' || car.className === room.settings.allowedCarClass)
    return (
      <section className="multiplayer-screen multiplayer-screen--lobby">
        <header className="multiplayer-header">
          <div><small>PRIVATE MULTIPLAYER LOBBY</small><h1>{room.name}</h1></div>
          <div className="room-code"><span>ROOM CODE</span><strong>{room.code}</strong><button onClick={copyRoomCode}>COPY</button><button onClick={copyInvite}>INVITE</button></div>
          <div className={`connection-pill connection-pill--${multiplayer.connection}`}><i /><span>{multiplayer.connection.toUpperCase()}</span><b>{multiplayer.latency ? `${multiplayer.latency} MS` : '-- MS'}</b></div>
        </header>

        <div className="lobby-layout">
          <aside className="lobby-players">
            <div className="lobby-section-title"><span>CREW</span><b>{connectedPlayers.length}/{room.settings.maxPlayers}</b></div>
            {room.players.map((player, index) => {
              const car = CAR_CATALOG.find((candidate) => candidate.id === player.vehicleId)
              return (
                <div className={`lobby-player${player.id === multiplayer.playerId ? ' lobby-player--you' : ''}${!player.connected ? ' lobby-player--offline' : ''}`} key={player.id} style={{ '--player-color': player.bodyColor } as CSSProperties}>
                  <i>{String(index + 1).padStart(2, '0')}</i>
                  <span><strong>{player.name}{player.id === multiplayer.playerId ? ' // YOU' : ''}</strong><small>{car?.name ?? 'Unknown car'}{player.host ? ' // HOST' : ''}</small></span>
                  <b>{!player.connected ? 'RECONNECTING' : player.ready ? 'READY' : 'NOT READY'}</b>
                  {localPlayer.host && !player.host && <button onClick={() => multiplayer.removePlayer(player.id)}>REMOVE</button>}
                </div>
              )
            })}
            <button className={localPlayer.ready ? 'ready-button ready-button--active' : 'ready-button'} onClick={() => multiplayer.setReady(!localPlayer.ready)}>
              {localPlayer.ready ? 'READY // CLICK TO CANCEL' : 'MARK YOURSELF READY'}
            </button>
          </aside>

          <main className="lobby-garage">
            <div className="lobby-section-title"><span>SELECT YOUR CAR</span><b>{selectedCar.name}</b></div>
            <div className="lobby-car-grid">
              {allowedCars.map((car) => {
                const owned = unlockedCarIds.includes(car.id)
                return (
                  <button
                    key={car.id}
                    disabled={!owned}
                    className={car.id === localPlayer.vehicleId ? 'lobby-car lobby-car--selected' : 'lobby-car'}
                    style={{ '--car-accent': car.accent } as CSSProperties}
                    onClick={() => chooseLobbyCar(car.id)}
                  >
                    <span>{car.className}</span><strong>{car.name}</strong><small>{owned ? 'AVAILABLE' : 'LOCKED IN CAREER'}</small>
                  </button>
                )
              })}
            </div>
            <small className="lobby-garage__hint">Vehicle models load locally. Only the car ID and cosmetic colour cross the network.</small>
          </main>

          <aside className="lobby-settings">
            <div className="lobby-section-title"><span>SESSION</span><b>{localPlayer.host ? 'HOST CONTROLS' : 'HOST LOCKED'}</b></div>
            <label><span>MODE</span><select disabled={!localPlayer.host} value={room.settings.mode} onChange={(event) => patchRoomSettings({ mode: event.target.value as RoomSettings['mode'] })}><option value="free-roam">FREE ROAM</option><option value="race">PRIVATE RACE</option></select></label>
            {room.settings.mode === 'race' && <>
              <label><span>ROUTE</span><select disabled={!localPlayer.host} value={room.settings.raceRouteId} onChange={(event) => patchRoomSettings({ raceRouteId: event.target.value })}>{RACE_EVENTS.slice(0, 3).map((race) => <option value={race.id} key={race.id}>{race.name.toUpperCase()}</option>)}</select></label>
              <label><span>LAPS</span><select disabled={!localPlayer.host} value={room.settings.laps} onChange={(event) => patchRoomSettings({ laps: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map((laps) => <option value={laps} key={laps}>{laps}</option>)}</select></label>
            </>}
            <label><span>MAX PLAYERS</span><select disabled={!localPlayer.host} value={room.settings.maxPlayers} onChange={(event) => patchRoomSettings({ maxPlayers: Number(event.target.value) })}>{[2, 3, 4, 5, 6].map((count) => <option value={count} key={count}>{count}</option>)}</select></label>
            <label><span>CAR CLASS</span><select disabled={!localPlayer.host} value={room.settings.allowedCarClass} onChange={(event) => patchRoomSettings({ allowedCarClass: event.target.value })}>{classes.map((category) => <option value={category} key={category}>{category.toUpperCase()}</option>)}</select></label>
            <label><span>TIME</span><select disabled={!localPlayer.host} value={room.settings.timeOfDay} onChange={(event) => patchRoomSettings({ timeOfDay: event.target.value as RoomSettings['timeOfDay'] })}><option value="day">DAY</option><option value="sunset">SUNSET</option><option value="night">NIGHT</option><option value="dawn">DAWN</option></select></label>
            {(['collisions', 'traffic', 'police'] as const).map((setting) => <button key={setting} disabled={!localPlayer.host} className={room.settings[setting] ? 'lobby-toggle lobby-toggle--on' : 'lobby-toggle'} onClick={() => patchRoomSettings({ [setting]: !room.settings[setting] })}><span>{setting.toUpperCase()}</span><b>{room.settings[setting] ? 'ON' : 'OFF'}</b></button>)}
          </aside>
        </div>

        {(multiplayer.error || multiplayer.notice) && <div className={multiplayer.error ? 'multiplayer-message multiplayer-message--error' : 'multiplayer-message'}>{multiplayer.error ?? multiplayer.notice}</div>}
        <footer className="lobby-actions">
          <button className="secondary" onClick={() => multiplayer.leaveRoom()}>LEAVE ROOM</button>
          {localPlayer.host && <button className="danger" onClick={() => multiplayer.closeRoom()}>CLOSE ROOM</button>}
          {localPlayer.host && !allReady && connectedPlayers.length >= 2 && <button className="force" onClick={() => multiplayer.startSession(true)}>FORCE START</button>}
          {localPlayer.host && <button className="primary" disabled={!allReady} onClick={() => multiplayer.startSession(false)}>START {room.settings.mode === 'race' ? 'RACE' : 'SESSION'} <b>›</b></button>}
          {!localPlayer.host && <span>WAITING FOR THE HOST TO START</span>}
        </footer>
      </section>
    )
  }

  return (
    <section className="multiplayer-screen multiplayer-screen--menu">
      <header className="multiplayer-header">
        <div><small>PROJECT // STREET</small><h1>PRIVATE MULTIPLAYER</h1></div>
        <div className={`connection-pill connection-pill--${multiplayer.connection}`}><i /><span>{multiplayer.connection.toUpperCase()}</span></div>
        <button className="multiplayer-back" onClick={screen === 'home' ? onBack : () => { multiplayer.clearMessage(); setScreen('home') }}>‹ BACK</button>
      </header>

      {screen === 'home' && <div className="multiplayer-home">
        <div><small>DRIVE TOGETHER</small><h2>YOUR CITY.<br />YOUR CREW.</h2><p>Create a private room or join your friends with a room code.</p></div>
        <div className="multiplayer-home__actions">
          <button onClick={() => setScreen('create')}><i>＋</i><span><strong>CREATE ROOM</strong><small>HOST A PRIVATE SESSION</small></span><b>›</b></button>
          <button onClick={() => setScreen('join')}><i>→</i><span><strong>JOIN ROOM</strong><small>ENTER A ROOM CODE</small></span><b>›</b></button>
        </div>
        <footer>2–6 PLAYERS // OPTIONAL PASSWORD // FREE ROAM & PRIVATE RACES</footer>
      </div>}

      {screen === 'create' && <form className="multiplayer-form" onSubmit={createRoom}>
        <div className="multiplayer-form__title"><small>HOST SESSION</small><h2>CREATE PRIVATE ROOM</h2></div>
        <div className="multiplayer-form__grid">
          <label><span>YOUR NAME</span><input required minLength={1} maxLength={18} value={playerName} onChange={(event) => setPlayerName(event.target.value)} /></label>
          <label><span>ROOM NAME</span><input required minLength={1} maxLength={28} value={roomName} onChange={(event) => setRoomName(event.target.value)} /></label>
          <label><span>PASSWORD <small>OPTIONAL</small></span><input type="password" maxLength={48} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <label><span>MAX PLAYERS</span><select value={settings.maxPlayers} onChange={(event) => setSettings((current) => ({ ...current, maxPlayers: Number(event.target.value) }))}>{[2, 3, 4, 5, 6].map((count) => <option key={count}>{count}</option>)}</select></label>
          <label><span>MODE</span><select value={settings.mode} onChange={(event) => setSettings((current) => ({ ...current, mode: event.target.value as RoomSettings['mode'] }))}><option value="free-roam">FREE ROAM</option><option value="race">PRIVATE RACE</option></select></label>
          <label><span>TIME OF DAY</span><select value={settings.timeOfDay} onChange={(event) => setSettings((current) => ({ ...current, timeOfDay: event.target.value as RoomSettings['timeOfDay'] }))}><option value="day">DAY</option><option value="sunset">SUNSET</option><option value="night">NIGHT</option><option value="dawn">DAWN</option></select></label>
        </div>
        <div className="multiplayer-form__toggles">{(['collisions', 'traffic', 'police'] as const).map((key) => <button type="button" className={settings[key] ? 'active' : ''} key={key} onClick={() => setSettings((current) => ({ ...current, [key]: !current[key] }))}><span>{key.toUpperCase()}</span><b>{settings[key] ? 'ON' : 'OFF'}</b></button>)}</div>
        <div className="multiplayer-form__car"><span>ENTERING WITH</span><strong>{selectedCar.name}</strong><small>Car can be changed inside the lobby.</small></div>
        {multiplayer.error && <div className="multiplayer-message multiplayer-message--error">{multiplayer.error}</div>}
        <button className="multiplayer-submit" disabled={submitting}>{submitting ? 'CREATING ROOM…' : 'CREATE ROOM'} <b>›</b></button>
      </form>}

      {screen === 'join' && <form className="multiplayer-form multiplayer-form--join" onSubmit={joinRoom}>
        <div className="multiplayer-form__title"><small>PRIVATE SESSION</small><h2>JOIN YOUR CREW</h2></div>
        <label><span>YOUR NAME</span><input required minLength={1} maxLength={18} value={playerName} onChange={(event) => setPlayerName(event.target.value)} /></label>
        <label><span>ROOM CODE</span><input className="room-code-input" required placeholder="PS-7K4M2" maxLength={8} value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} /></label>
        <label><span>PASSWORD <small>WHEN REQUIRED</small></span><input type="password" maxLength={48} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {multiplayer.error && <div className="multiplayer-message multiplayer-message--error">{multiplayer.error}</div>}
        {multiplayer.notice && <div className="multiplayer-message">{multiplayer.notice}</div>}
        <button className="multiplayer-submit" disabled={submitting}>{submitting ? 'JOINING ROOM…' : 'JOIN ROOM'} <b>›</b></button>
      </form>}
    </section>
  )
}

function formatTime(milliseconds: number) {
  const seconds = Math.max(0, milliseconds) / 1000
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}.${String(Math.floor((seconds % 1) * 100)).padStart(2, '0')}`
}

export function MultiplayerHud({ multiplayer, paused, onLeave }: { multiplayer: MultiplayerController; paused: boolean; onLeave: () => void }) {
  const [clock, setClock] = useState(Date.now())
  const room = multiplayer.room
  const session = multiplayer.session
  const localPlayer = room?.players.find((player) => player.id === multiplayer.playerId)
  const localProgress = multiplayer.playerId ? multiplayer.raceProgress[multiplayer.playerId] : null

  useEffect(() => {
    if (!session) return
    const timer = window.setInterval(() => setClock(Date.now()), 100)
    return () => window.clearInterval(timer)
  }, [session])

  const countdown = session ? Math.ceil((session.countdownEndsAt - clock) / 1000) : 0
  if (!room || !session || !localPlayer) return null

  return (
    <div className="multiplayer-hud">
      <aside className="multiplayer-session-card">
        <div><i className={`status-${multiplayer.connection}`} /><span>{room.code}</span><b>{multiplayer.latency || '--'} MS</b></div>
        <strong>{session.mode === 'race' ? RACE_EVENTS.find((race) => race.id === session.settings.raceRouteId)?.name ?? 'PRIVATE RACE' : 'CREW FREE ROAM'}</strong>
        <small>{room.players.filter((player) => player.connected).length} PLAYERS // {session.settings.collisions ? 'COLLISION ON' : 'GHOST COLLISION'}</small>
        <div className="multiplayer-session-card__players">{room.players.map((player) => <span key={player.id} style={{ '--player-color': player.bodyColor } as CSSProperties}>{player.name}{player.host ? ' ★' : ''}</span>)}</div>
      </aside>

      {countdown > 0 && <div className="multiplayer-countdown"><small>{session.mode === 'race' ? 'RACE STARTS IN' : 'SESSION STARTING'}</small><strong>{countdown}</strong></div>}
      {countdown === 0 && clock - session.countdownEndsAt < 900 && <div className="multiplayer-countdown multiplayer-countdown--go"><strong>GO!</strong></div>}

      {session.mode === 'race' && localProgress && <aside className="multiplayer-race-progress">
        <span>LAP <strong>{Math.min(localProgress.lap, localProgress.laps)}/{localProgress.laps}</strong></span>
        <span>CHECKPOINT <strong>{Math.min(localProgress.checkpointIndex + 1, localProgress.checkpointCount)}/{localProgress.checkpointCount}</strong></span>
        {localProgress.finished && <b>FINISHED // P{localProgress.finishPosition}</b>}
      </aside>}

      {multiplayer.connection !== 'online' && <div className="multiplayer-disconnected">CONNECTION LOST // ATTEMPTING TO REJOIN THE ROOM</div>}

      {paused && <div className="multiplayer-pause-actions">
        {localPlayer.host && <button onClick={() => multiplayer.returnToLobby()}>RETURN EVERYONE TO LOBBY</button>}
        <button className="danger" onClick={onLeave}>LEAVE MULTIPLAYER ROOM</button>
      </div>}

      {session.mode === 'race' && multiplayer.raceResults.length > 0 && localProgress?.finished && (
        <section className="multiplayer-results">
          <div><small>PRIVATE RACE COMPLETE</small><h2>FINAL CLASSIFICATION</h2>
            {multiplayer.raceResults.map((result) => <div className={result.playerId === multiplayer.playerId ? 'multiplayer-result multiplayer-result--you' : 'multiplayer-result'} key={result.playerId}><b>P{result.position}</b><span><strong>{result.name}</strong><small>{CAR_CATALOG.find((car) => car.id === result.vehicleId)?.name}</small></span><time>{formatTime(result.elapsedMs)}</time></div>)}
            <footer>{localPlayer.host ? <button onClick={() => multiplayer.returnToLobby()}>RETURN TO LOBBY <b>›</b></button> : <span>WAITING FOR HOST</span>}</footer>
          </div>
        </section>
      )}
    </div>
  )
}

