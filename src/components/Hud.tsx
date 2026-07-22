import { useState, type CSSProperties } from 'react'
import { CAR_CATALOG, DEFAULT_CAR } from '../game/carCatalog'
import type { CarTelemetry } from '../game/carPhysics'
import { formatPursuitTime, type PoliceTacticTelemetry, type PoliceTelemetry, type PursuitState } from '../game/policeSystem'
import { RACE_EVENTS, RACE_OPPONENTS, formatRaceTime, getRaceEvent, type RaceSession } from '../game/raceEvents'
import { ROAD_SEGMENTS, WORLD_BOUNDS, WORLD_DEPTH, WORLD_WIDTH, getDistrictAt } from '../game/worldLayout'
import { GRAPHICS_PROFILES, type GraphicsQuality } from '../game/graphicsSettings'
import type { CameraMode, CarLoadState } from '../game/Car'
import { CAREER_RIVALS, getActiveRival, isCareerEventUnlocked } from '../game/careerSystem'
import { NAV_LOCATIONS, type NavigationTarget } from '../game/navigation'
import type { CarPerformance } from '../game/carCatalog'
import { UPGRADE_PARTS, getUpgradeCost, type CarUpgrades, type UpgradePart } from '../game/upgradeSystem'
import {
  PAINT_PRESETS,
  RIM_COLORS,
  UNDERGLOW_PRESETS,
  type CarCustomization,
  type PaintFinish,
  type RideHeight,
  type WheelStyle,
  type WindowTint,
} from '../game/customization'
import { formatWorldTime, type WeatherState } from '../game/dynamicWorld'
import {
  DEFAULT_CONTROL_BINDINGS,
  KEY_BINDING_OPTIONS,
  type DriveAction,
  type ReleaseSettings,
  type TrafficDensity,
  type WeatherMode,
} from '../game/gameSettings'
import type { RemoteMapPlayer } from '../multiplayer/useMultiplayer'

interface HudProps {
  graphicsQuality: GraphicsQuality
  telemetry: CarTelemetry
  started: boolean
  cash: number
  unlockedCarIds: string[]
  selectedCarId: string
  race: RaceSession
  nearEventId: string | null
  opponentsReady: boolean
  pursuit: PursuitState
  policeTelemetry: PoliceTelemetry
  policeTactics: PoliceTacticTelemetry
  audioMuted: boolean
  manualTransmission: boolean
  carLoadState: CarLoadState
  careerRep: number
  defeatedRivalIds: string[]
  careerWins: number
  mapOpen: boolean
  navigationTarget: NavigationTarget | null
  selectedUpgrades: CarUpgrades
  selectedPerformance: CarPerformance
  selectedCustomization: CarCustomization
  worldTime: number
  weather: WeatherState
  cameraMode: CameraMode
  photoMode: boolean
  replayActive: boolean
  paused: boolean
  settingsOpen: boolean
  releaseSettings: ReleaseSettings
  controllerConnected: boolean
  fps: number
  multiplayerActive: boolean
  multiplayerMapPlayers: RemoteMapPlayer[]
  onSelectCar: (carId: string) => void
  onStart: () => void
  onStartRace: (eventId: string) => void
  onDismissResults: () => void
  onUnlockCar: (carId: string) => void
  onBackToMenu: () => void
  onTogglePause: () => void
  onOpenSettings: () => void
  onCloseSettings: () => void
  onUpdateReleaseSettings: (patch: Partial<ReleaseSettings>) => void
  onToggleAudio: () => void
  onToggleTransmission: () => void
  onToggleGraphics: () => void
  onToggleMap: () => void
  onSetNavigationTarget: (target: NavigationTarget) => void
  onClearNavigation: () => void
  onBuyUpgrade: (part: UpgradePart) => void
  onUpdateCustomization: (patch: Partial<CarCustomization>) => void
  onCycleCamera: () => void
  onTogglePhotoMode: () => void
  onCapturePhoto: () => void
  onStartReplay: () => void
}

const mapPercentX = (value: number) => ((value - WORLD_BOUNDS.minX) / WORLD_WIDTH) * 100
const mapPercentZ = (value: number) => ((value - WORLD_BOUNDS.minZ) / WORLD_DEPTH) * 100

const formatCash = (value: number) => `$${value.toLocaleString('en-US')}`

export function Hud({
  graphicsQuality,
  telemetry,
  started,
  cash,
  unlockedCarIds,
  selectedCarId,
  race,
  nearEventId,
  opponentsReady,
  pursuit,
  policeTelemetry,
  policeTactics,
  audioMuted,
  manualTransmission,
  carLoadState,
  careerRep,
  defeatedRivalIds,
  careerWins,
  mapOpen,
  navigationTarget,
  selectedUpgrades,
  selectedPerformance,
  selectedCustomization,
  worldTime,
  weather,
  cameraMode,
  photoMode,
  replayActive,
  paused,
  settingsOpen,
  releaseSettings,
  controllerConnected,
  fps,
  multiplayerActive,
  multiplayerMapPlayers,
  onSelectCar,
  onStart,
  onStartRace,
  onDismissResults,
  onUnlockCar,
  onBackToMenu,
  onTogglePause,
  onOpenSettings,
  onCloseSettings,
  onUpdateReleaseSettings,
  onToggleAudio,
  onToggleTransmission,
  onToggleGraphics,
  onToggleMap,
  onSetNavigationTarget,
  onClearNavigation,
  onBuyUpgrade,
  onUpdateCustomization,
  onCycleCamera,
  onTogglePhotoMode,
  onCapturePhoto,
  onStartReplay,
}: HudProps) {
  const [mapFilter, setMapFilter] = useState<'all' | 'events' | 'places'>('all')
  const [tuningOpen, setTuningOpen] = useState(false)
  const [customizationOpen, setCustomizationOpen] = useState(false)
  const selectedCar = CAR_CATALOG.find((car) => car.id === selectedCarId) ?? DEFAULT_CAR
  const selectedCarUnlocked = unlockedCarIds.includes(selectedCar.id)
  const activeRace = getRaceEvent(race.eventId)
  const nearbyRace = getRaceEvent(nearEventId)
  const nearbyRaceUnlocked = nearbyRace ? isCareerEventUnlocked(nearbyRace.id, careerRep, defeatedRivalIds) : false
  const mapX = Math.max(2, Math.min(98, mapPercentX(telemetry.position[0])))
  const mapY = Math.max(2, Math.min(98, mapPercentZ(telemetry.position[1])))
  const blipStyle = {
    left: `${mapX}%`,
    top: `${mapY}%`,
    transform: `translate(-50%, -50%) rotate(${telemetry.heading}rad)`,
  }
  const nitroStyle = { '--nitro': `${telemetry.nitro}%` } as CSSProperties
  const districtName = getDistrictAt(telemetry.position[0], telemetry.position[1])
  const pursuitActive = pursuit.phase === 'pursuit' || pursuit.phase === 'cooldown'
  const gpsDistance = navigationTarget ? Math.round(Math.hypot(telemetry.position[0] - navigationTarget.x, telemetry.position[1] - navigationTarget.z)) : 0
  const activeRival = getActiveRival(careerRep, defeatedRivalIds)
  const policeObjective = pursuit.phase === 'pursuit'
    ? ['ESCAPE THE POLICE', policeTactics.roadblockActive ? 'ROADBLOCKS DEPLOYED // WATCH FOR SPIKES' : `${policeTelemetry.activeUnits} UNITS IN PURSUIT // KEEP MOVING`]
    : pursuit.phase === 'cooldown'
      ? ['STAY OUT OF SIGHT', `COOLDOWN ${Math.round(pursuit.escapeProgress)}% // DO NOT GET SPOTTED`]
      : navigationTarget
        ? [`GPS // ${navigationTarget.name.toUpperCase()}`, `${gpsDistance.toLocaleString()} M // FOLLOW CYAN ROUTE`]
        : activeRival && careerRep < activeRival.requiredRep
        ? [`BUILD REP FOR ${activeRival.name}`, `${careerRep.toLocaleString()} / ${activeRival.requiredRep.toLocaleString()} REP`]
        : activeRival
          ? [`CHALLENGE #${activeRival.rank} ${activeRival.name}`, `${activeRival.crew} // FIND THE RIVAL EVENT`]
          : ['PORT MERIDIAN CHAMPION', 'All ranked rivals defeated']
  const resultLeaderboard = activeRace
    ? [
        {
          id: 'player',
          name: 'YOU',
          carName: selectedCar.name,
          timeMs: race.didNotFinish ? Number.POSITIVE_INFINITY : race.elapsedMs,
          accent: selectedCar.accent,
        },
        ...RACE_OPPONENTS.map((opponent, index) => ({
          id: opponent.id,
          name: opponent.name,
          carName: CAR_CATALOG.find((car) => car.id === opponent.carId)?.name ?? 'Unknown',
          timeMs: activeRace.rivalTimes[index] * 1000,
          accent: opponent.accent,
        })),
      ].sort((left, right) => left.timeMs - right.timeMs)
    : []

  return (
    <div className={`hud${pursuitActive ? ' hud--pursuit' : ''}${photoMode ? ' hud--photo' : ''}${replayActive ? ' hud--replay' : ''}${paused ? ' hud--paused' : ''}`}>
      <div className="scanlines" />

      {started && !paused && (
        <>
          <button type="button" className="menu-button glass-panel" onClick={onTogglePause}>
            <kbd>ESC</kbd>
            <span>PAUSE MENU</span>
          </button>
          <button type="button" className={audioMuted ? 'sound-button sound-button--muted glass-panel' : 'sound-button glass-panel'} onClick={onToggleAudio}>
            <kbd>M</kbd>
            <span>{audioMuted ? 'AUDIO OFF' : 'AUDIO ON'}</span>
          </button>
          <button type="button" className="map-button glass-panel" onClick={onToggleMap}>
            <kbd>TAB</kbd>
            <span>WORLD MAP</span>
          </button>
          <button type="button" className="camera-button glass-panel" onClick={onCycleCamera}><kbd>C</kbd><span>{cameraMode.toUpperCase()} CAM</span></button>
        </>
      )}

      {started && releaseSettings.showFps && <div className="fps-counter">{fps || '--'} FPS</div>}
      {started && !paused && controllerConnected && <div className="controller-chip">XBOX CONTROLLER CONNECTED</div>}

      {started && paused && (
        <section className="pause-menu" aria-label="Pause menu">
          <div className={settingsOpen ? 'pause-card pause-card--settings' : 'pause-card'}>
            {!settingsOpen ? (
              <>
                <div className="pause-card__brand"><small>PROJECT // STREET</small><h2>PAUSED</h2><span>PORT MERIDIAN // SESSION HELD</span></div>
                <div className="pause-card__status"><i className={controllerConnected ? 'online' : ''} /><span>{controllerConnected ? 'XBOX CONTROLLER READY' : 'KEYBOARD ACTIVE'}</span><b>{graphicsQuality.toUpperCase()} // {releaseSettings.trafficDensity.toUpperCase()} TRAFFIC</b></div>
                <div className="pause-card__actions">
                  <button className="primary" onClick={onTogglePause}><span>RESUME DRIVE</span><kbd>ESC</kbd></button>
                  <button onClick={onOpenSettings}><span>SETTINGS & CONTROLS</span><b>›</b></button>
                  <button className="danger" onClick={onBackToMenu}><span>{multiplayerActive ? 'LEAVE MULTIPLAYER' : 'RETURN TO GARAGE'}</span><b>›</b></button>
                </div>
                <div className="pause-card__footer"><span>GAMEPLAY IS FULLY FROZEN</span><b>PROGRESS SAVES AUTOMATICALLY</b></div>
              </>
            ) : (
              <>
                <div className="settings-header"><div><small>PAUSE MENU</small><h2>SETTINGS</h2></div><button onClick={onCloseSettings}>BACK <kbd>ESC</kbd></button></div>
                <div className="settings-scroll">
                  <section className="settings-panel">
                    <div className="settings-panel__title"><span>AUDIO</span><small>LIVE MIX</small></div>
                    {([
                      ['masterVolume', 'MASTER'],
                      ['engineVolume', 'ENGINE'],
                      ['effectsVolume', 'EFFECTS / POLICE'],
                    ] as const).map(([key, label]) => (
                      <label className="settings-slider" key={key}><span>{label}</span><input type="range" min="0" max="1" step="0.05" value={releaseSettings[key]} onChange={(event) => onUpdateReleaseSettings({ [key]: Number(event.target.value) })} /><b>{Math.round(releaseSettings[key] * 100)}%</b></label>
                    ))}
                  </section>

                  <section className="settings-panel">
                    <div className="settings-panel__title"><span>DISPLAY</span><small>FPS SAFE</small></div>
                    <div className="settings-choice"><span>GRAPHICS</span><button onClick={onToggleGraphics}>{graphicsQuality.toUpperCase()}<small>{GRAPHICS_PROFILES[graphicsQuality].label}</small></button></div>
                    <div className="settings-button-row"><span>RENDER SCALE</span>{[0.72, 0.85, 1].map((scale) => <button className={releaseSettings.resolutionScale === scale ? 'active' : ''} key={scale} onClick={() => onUpdateReleaseSettings({ resolutionScale: scale })}>{Math.round(scale * 100)}%</button>)}</div>
                    <div className="settings-choice"><span>FPS COUNTER</span><button className={releaseSettings.showFps ? 'active' : ''} onClick={() => onUpdateReleaseSettings({ showFps: !releaseSettings.showFps })}>{releaseSettings.showFps ? 'ON' : 'OFF'}</button></div>
                  </section>

                  <section className="settings-panel">
                    <div className="settings-panel__title"><span>WORLD</span><small>DYNAMIC LOAD</small></div>
                    <div className="settings-button-row"><span>TRAFFIC</span>{(['low', 'medium', 'high'] as TrafficDensity[]).map((density) => <button className={releaseSettings.trafficDensity === density ? 'active' : ''} key={density} onClick={() => onUpdateReleaseSettings({ trafficDensity: density })}>{density.toUpperCase()}</button>)}</div>
                    <div className="settings-button-row"><span>WEATHER</span>{(['dynamic', 'clear', 'rain'] as WeatherMode[]).map((mode) => <button className={releaseSettings.weatherMode === mode ? 'active' : ''} key={mode} onClick={() => onUpdateReleaseSettings({ weatherMode: mode })}>{mode.toUpperCase()}</button>)}</div>
                  </section>

                  <section className="settings-panel settings-panel--controller">
                    <div className="settings-panel__title"><span>XBOX CONTROLLER</span><small>{controllerConnected ? 'CONNECTED' : 'CONNECT & PRESS ANY BUTTON'}</small></div>
                    <div className="controller-map">
                      <span><kbd>LS</kbd> STEER</span><span><kbd>RT</kbd> ACCELERATE</span><span><kbd>LT</kbd> BRAKE / REVERSE</span><span><kbd>A</kbd> HANDBRAKE</span><span><kbd>RB</kbd> NITRO</span><span><kbd>B</kbd> REAR VIEW</span><span><kbd>LB</kbd> CAMERA</span><span><kbd>Y / X</kbd> SHIFT</span><span><kbd>☰</kbd> PAUSE</span>
                    </div>
                    <label className="settings-slider"><span>STEERING</span><input type="range" min="0.65" max="1.35" step="0.05" value={releaseSettings.controllerSensitivity} onChange={(event) => onUpdateReleaseSettings({ controllerSensitivity: Number(event.target.value) })} /><b>{releaseSettings.controllerSensitivity.toFixed(2)}×</b></label>
                    <label className="settings-slider"><span>DEADZONE</span><input type="range" min="0.05" max="0.3" step="0.01" value={releaseSettings.controllerDeadzone} onChange={(event) => onUpdateReleaseSettings({ controllerDeadzone: Number(event.target.value) })} /><b>{Math.round(releaseSettings.controllerDeadzone * 100)}%</b></label>
                  </section>

                  <section className="settings-panel settings-panel--bindings">
                    <div className="settings-panel__title"><span>KEYBOARD REMAPPING</span><button onClick={() => onUpdateReleaseSettings({ bindings: { ...DEFAULT_CONTROL_BINDINGS } })}>RESET DEFAULTS</button></div>
                    <div className="binding-grid">
                      {([
                        ['forward', 'ACCELERATE'], ['backward', 'BRAKE / REVERSE'], ['left', 'STEER LEFT'], ['right', 'STEER RIGHT'],
                        ['handbrake', 'HANDBRAKE'], ['nitro', 'NITRO'], ['reset', 'RESET CAR'], ['shiftUp', 'SHIFT UP'], ['shiftDown', 'SHIFT DOWN'],
                      ] as Array<[DriveAction, string]>).map(([action, label]) => (
                        <label key={action}><span>{label}</span><select value={releaseSettings.bindings[action]} onChange={(event) => onUpdateReleaseSettings({ bindings: { ...releaseSettings.bindings, [action]: event.target.value } })}>{KEY_BINDING_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
                      ))}
                    </div>
                  </section>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {started && photoMode && (
        <section className="photo-mode">
          <div><small>PROJECT STREET</small><strong>PHOTO MODE</strong></div>
          <span>AUTOMATIC ORBIT CAMERA // CLEAN FRAME</span>
          <button onClick={onCapturePhoto}>CAPTURE PNG</button>
          <button onClick={onTogglePhotoMode}>EXIT <kbd>P</kbd></button>
        </section>
      )}

      {started && replayActive && <div className="replay-banner"><span>●</span> INSTANT REPLAY <small>LAST 15 SECONDS</small></div>}

      {!started && (
        <section className="start-screen">
          <div className="start-screen__title">
            <div className="start-screen__eyebrow">OPEN-WORLD STREET RACING PROTOTYPE</div>
            <h1>
              PROJECT <span>//</span> STREET
            </h1>
            <p>Choose your build. Take over Port Meridian.</p>
            <div className="garage-wallet">CAREER CASH <strong>{formatCash(cash)}</strong></div>
          </div>

          <aside className="career-board glass-panel">
            <div className="career-board__header">
              <span>PORT MERIDIAN RIVALS</span>
              <strong>{careerRep.toLocaleString()} REP</strong>
              <small>{careerWins} WINS // {defeatedRivalIds.length}/5 DEFEATED</small>
            </div>
            {CAREER_RIVALS.map((rival) => {
              const defeated = defeatedRivalIds.includes(rival.id)
              const unlocked = isCareerEventUnlocked(rival.eventId, careerRep, defeatedRivalIds)
              return (
                <div className={`career-rival ${defeated ? 'career-rival--defeated' : unlocked ? 'career-rival--active' : 'career-rival--locked'}`} key={rival.id} style={{ '--rival-color': rival.accent } as CSSProperties}>
                  <b>#{rival.rank}</b>
                  <span><strong>{rival.name}</strong><small>{defeated ? 'DEFEATED' : unlocked ? rival.crew : `${rival.requiredRep.toLocaleString()} REP REQUIRED`}</small></span>
                  <i>{defeated ? '✓' : unlocked ? 'RACE' : 'LOCK'}</i>
                </div>
              )
            })}
          </aside>

          <div className="garage-dock" style={{ '--car-accent': selectedCar.accent } as CSSProperties}>
            <div className="garage-dock__info">
              <span className="garage-dock__label">CURRENT BUILD // {selectedCar.className}</span>
              <strong>{selectedCar.name}</strong>
              <div className="garage-stats">
                <span>
                  <b>TOP SPEED</b>
                  <i><em style={{ width: `${Math.min(100, (selectedPerformance.topSpeed / 80) * 100)}%` }} /></i>
                </span>
                <span>
                  <b>ACCELERATION</b>
                  <i><em style={{ width: `${Math.min(100, (selectedPerformance.acceleration / 38) * 100)}%` }} /></i>
                </span>
                <span>
                  <b>HANDLING</b>
                  <i><em style={{ width: `${Math.min(100, (selectedPerformance.handling / 1.35) * 100)}%` }} /></i>
                </span>
              </div>
              <button type="button" className={manualTransmission ? 'transmission-toggle transmission-toggle--manual' : 'transmission-toggle'} onClick={onToggleTransmission}>
                <span>TRANSMISSION</span>
                <strong>{manualTransmission ? 'MANUAL' : 'AUTOMATIC'}</strong>
                <small>{manualTransmission ? 'Z DOWNSHIFT // X UPSHIFT' : 'FULLY AUTOMATIC SHIFTING'}</small>
              </button>
              <button type="button" className={`graphics-toggle graphics-toggle--${graphicsQuality}`} onClick={onToggleGraphics}>
                <span>GRAPHICS</span>
                <strong>{graphicsQuality.toUpperCase()}</strong>
                <small>{GRAPHICS_PROFILES[graphicsQuality].label} // CLICK TO CHANGE</small>
              </button>
              <button type="button" className="tuning-toggle" onClick={() => setTuningOpen(true)}>
                <span>PERFORMANCE</span><strong>UPGRADE SHOP</strong><small>{Object.values(selectedUpgrades).reduce((total, level) => total + level, 0)} / 15 INSTALLED</small>
              </button>
              <button type="button" className="customize-toggle" disabled={!selectedCarUnlocked} onClick={() => setCustomizationOpen(true)}>
                <span>VISUALS</span><strong>CUSTOMIZE CAR</strong><small>PAINT // WHEELS // STANCE // GLOW</small>
              </button>
            </div>

            <div className="garage-picker" role="listbox" aria-label="Choose a car">
              {CAR_CATALOG.map((car, index) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={car.id === selectedCar.id}
                  className={[
                    'garage-car',
                    car.id === selectedCar.id ? 'garage-car--selected' : '',
                    unlockedCarIds.includes(car.id) ? '' : 'garage-car--locked',
                  ].filter(Boolean).join(' ')}
                  key={car.id}
                  style={{ '--car-accent': car.accent } as CSSProperties}
                  onClick={() => onSelectCar(car.id)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{car.name}</strong>
                  <small>{unlockedCarIds.includes(car.id) ? car.className : `LOCKED // ${formatCash(car.price)}`}</small>
                </button>
              ))}
            </div>

            {carLoadState !== 'ready' && carLoadState !== 'idle' && (
              <div className={`garage-model-status garage-model-status--${carLoadState}`} role="status">
                <i />
                <span>{carLoadState === 'loading' ? `LOADING ${selectedCar.name} MODEL` : `${selectedCar.name} MODEL RETRY FAILED`}</span>
                <small>{carLoadState === 'loading' ? 'Keeping the previous car visible' : 'Choose another car, then select this one to retry'}</small>
              </div>
            )}

            {selectedCarUnlocked ? (
              <button type="button" className="start-screen__launch" onClick={onStart}>
                <span>ENTER FREE ROAM</span>
                <b>›</b>
              </button>
            ) : (
              <button
                type="button"
                className="start-screen__launch start-screen__launch--purchase"
                disabled={cash < selectedCar.price}
                onClick={() => onUnlockCar(selectedCar.id)}
              >
                <span>{cash >= selectedCar.price ? `BUY // ${formatCash(selectedCar.price)}` : `NEED ${formatCash(selectedCar.price - cash)}`}</span>
                <b>＋</b>
              </button>
            )}
          </div>
          {tuningOpen && (
            <section className="tuning-shop">
              <div className="tuning-shop__header"><span>PERFORMANCE SHOP</span><h2>{selectedCar.name}</h2><b>{formatCash(cash)}</b><button onClick={() => setTuningOpen(false)}>CLOSE</button></div>
              <div className="tuning-shop__parts">
                {UPGRADE_PARTS.map((part) => {
                  const level = selectedUpgrades[part.id]
                  const cost = getUpgradeCost(part.id, level)
                  return <button disabled={!selectedCarUnlocked || level >= 3 || cash < cost} key={part.id} onClick={() => onBuyUpgrade(part.id)}><span><strong>{part.name}</strong><small>{part.description}</small></span><i>{[1, 2, 3].map((step) => <b className={step <= level ? 'active' : ''} key={step} />)}</i><em>{level >= 3 ? 'MAXED' : formatCash(cost)}</em></button>
                })}
              </div>
              <small>UPGRADES ARE SAVED SEPARATELY FOR EACH OWNED CAR</small>
            </section>
          )}
          {customizationOpen && (
            <section className="customization-shop" style={{ '--car-accent': selectedCustomization.paint === 'factory' ? selectedCar.accent : selectedCustomization.paint } as CSSProperties}>
              <div className="customization-shop__header">
                <span>VISUAL CUSTOMIZATION</span>
                <h2>{selectedCar.name}</h2>
                <small>CHANGES SAVE AUTOMATICALLY FOR THIS CAR</small>
                <button onClick={() => setCustomizationOpen(false)}>CLOSE</button>
              </div>

              <div className="customization-shop__grid">
                <div className="customization-group customization-group--wide">
                  <span>BODY PAINT</span>
                  <div className="customization-swatches">
                    {PAINT_PRESETS.map((paint) => (
                      <button
                        aria-label={paint.name}
                        className={selectedCustomization.paint === paint.value ? 'active' : ''}
                        key={paint.value}
                        onClick={() => onUpdateCustomization({ paint: paint.value })}
                        style={{ '--swatch': paint.value === 'factory' ? selectedCar.accent : paint.value } as CSSProperties}
                      ><i /><small>{paint.name}</small></button>
                    ))}
                  </div>
                </div>

                <div className="customization-group">
                  <span>PAINT FINISH</span>
                  <div className="customization-options">
                    {(['gloss', 'metallic', 'satin'] as PaintFinish[]).map((finish) => <button className={selectedCustomization.finish === finish ? 'active' : ''} key={finish} onClick={() => onUpdateCustomization({ finish })}>{finish.toUpperCase()}</button>)}
                  </div>
                </div>

                <div className="customization-group">
                  <span>WHEEL STYLE</span>
                  <div className="customization-options">
                    {(['stock', 'sport', 'mesh'] as WheelStyle[]).map((wheelStyle) => <button className={selectedCustomization.wheelStyle === wheelStyle ? 'active' : ''} key={wheelStyle} onClick={() => onUpdateCustomization({ wheelStyle })}>{wheelStyle.toUpperCase()}</button>)}
                  </div>
                </div>

                <div className="customization-group">
                  <span>RIM COLOR</span>
                  <div className="customization-color-row">
                    {RIM_COLORS.map((rimColor) => <button aria-label={`Rim color ${rimColor}`} className={selectedCustomization.rimColor === rimColor ? 'active' : ''} key={rimColor} onClick={() => onUpdateCustomization({ rimColor })} style={{ background: rimColor }} />)}
                  </div>
                </div>

                <div className="customization-group">
                  <span>RIDE HEIGHT</span>
                  <div className="customization-options">
                    {(['stock', 'street', 'low'] as RideHeight[]).map((rideHeight) => <button className={selectedCustomization.rideHeight === rideHeight ? 'active' : ''} key={rideHeight} onClick={() => onUpdateCustomization({ rideHeight })}>{rideHeight.toUpperCase()}</button>)}
                  </div>
                </div>

                <div className="customization-group">
                  <span>WINDOW TINT</span>
                  <div className="customization-options">
                    {(['light', 'smoke', 'black'] as WindowTint[]).map((tint) => <button className={selectedCustomization.tint === tint ? 'active' : ''} key={tint} onClick={() => onUpdateCustomization({ tint })}>{tint.toUpperCase()}</button>)}
                  </div>
                </div>

                <div className="customization-group customization-group--wide">
                  <span>UNDERGLOW</span>
                  <div className="customization-underglow">
                    {UNDERGLOW_PRESETS.map((glow) => <button className={selectedCustomization.underglow === glow.value ? 'active' : ''} key={glow.value} onClick={() => onUpdateCustomization({ underglow: glow.value })} style={{ '--glow': glow.value === 'off' ? '#566171' : glow.value } as CSSProperties}><i />{glow.name.toUpperCase()}</button>)}
                  </div>
                </div>
              </div>
            </section>
          )}
        </section>
      )}

      {started && race.phase === 'free-roam' && nearbyRace && (
        <button type="button" className={nearbyRaceUnlocked ? 'race-prompt glass-panel' : 'race-prompt race-prompt--locked glass-panel'} disabled={!nearbyRaceUnlocked} onClick={() => onStartRace(nearbyRace.id)}>
          <kbd>{nearbyRaceUnlocked ? 'E' : '×'}</kbd>
          <span>
            <small>{nearbyRace.category}</small>
            <strong>{nearbyRaceUnlocked ? `ENTER ${nearbyRace.name}` : `${(nearbyRace.requiredRep ?? 0).toLocaleString()} REP REQUIRED`}</strong>
          </span>
          <b>{nearbyRaceUnlocked ? `${formatCash(nearbyRace.baseReward)}+` : 'LOCKED'}</b>
        </button>
      )}

      {started && mapOpen && (
        <section className="world-map">
          <div className="world-map__top">
            <div><small>PORT MERIDIAN NAVIGATION</small><h2>WORLD MAP</h2></div>
            <div className="world-map__filters">
              {(['all', 'events', 'places'] as const).map((filter) => (
                <button className={mapFilter === filter ? 'active' : ''} key={filter} onClick={() => setMapFilter(filter)}>{filter.toUpperCase()}</button>
              ))}
            </div>
            <button className="world-map__close" onClick={onToggleMap}>CLOSE <kbd>TAB</kbd></button>
          </div>
          <div className="world-map__body">
            <div className="world-map__canvas">
              <svg viewBox={`${WORLD_BOUNDS.minX} ${WORLD_BOUNDS.minZ} ${WORLD_WIDTH} ${WORLD_DEPTH}`} preserveAspectRatio="xMidYMid meet">
                {ROAD_SEGMENTS.map((road) => (
                  <line className={`world-map__road world-map__road--${road.kind}`} key={road.id} x1={road.start[0]} y1={road.start[1]} x2={road.end[0]} y2={road.end[1]} strokeWidth={road.width * 0.42} />
                ))}
                {navigationTarget && <line className="world-map__gps" x1={telemetry.position[0]} y1={telemetry.position[1]} x2={navigationTarget.x} y2={navigationTarget.z} />}
                {(mapFilter === 'all' || mapFilter === 'events') && RACE_EVENTS.map((event) => {
                  const unlocked = isCareerEventUnlocked(event.id, careerRep, defeatedRivalIds)
                  return <circle className={unlocked ? 'world-map__marker world-map__marker--event' : 'world-map__marker world-map__marker--locked'} key={event.id} cx={event.start.x} cy={event.start.z} r="15" fill={event.color} onClick={() => unlocked && onSetNavigationTarget({ id: event.id, name: event.name, category: 'event', x: event.start.x, z: event.start.z, color: event.color })} />
                })}
                {(mapFilter === 'all' || mapFilter === 'places') && NAV_LOCATIONS.map((location) => (
                  <rect className="world-map__marker world-map__marker--place" key={location.id} x={location.x - 13} y={location.z - 13} width="26" height="26" fill={location.color} onClick={() => onSetNavigationTarget(location)} />
                ))}
                <circle className="world-map__player" cx={telemetry.position[0]} cy={telemetry.position[1]} r="13" />
              </svg>
            </div>
            <aside className="world-map__list">
              <span>SELECT DESTINATION</span>
              {(mapFilter === 'all' || mapFilter === 'events') && RACE_EVENTS.map((event) => {
                const unlocked = isCareerEventUnlocked(event.id, careerRep, defeatedRivalIds)
                return <button disabled={!unlocked} key={event.id} onClick={() => onSetNavigationTarget({ id: event.id, name: event.name, category: 'event', x: event.start.x, z: event.start.z, color: event.color })}><i style={{ background: event.color }} /><span><strong>{event.name}</strong><small>{unlocked ? event.category : `${event.requiredRep ?? 0} REP // LOCKED`}</small></span><b>EVENT</b></button>
              })}
              {(mapFilter === 'all' || mapFilter === 'places') && NAV_LOCATIONS.map((location) => (
                <button key={location.id} onClick={() => onSetNavigationTarget(location)}><i style={{ background: location.color }} /><span><strong>{location.name}</strong><small>{location.category.toUpperCase()}</small></span><b>GPS</b></button>
              ))}
            </aside>
          </div>
          {navigationTarget && <button className="world-map__clear" onClick={onClearNavigation}>CLEAR ROUTE // {navigationTarget.name.toUpperCase()}</button>}
        </section>
      )}

      {started && activeRace && (race.phase === 'countdown' || race.phase === 'racing') && (
        <aside className="race-progress glass-panel" style={{ '--race-color': activeRace.color } as CSSProperties}>
          <span>{activeRace.name} // LIVE POSITION</span>
          <div className="race-progress__timing">
            <strong>{formatRaceTime(race.elapsedMs)}</strong>
            <b>P{race.livePosition}<small>/4</small></b>
          </div>
          <small>CHECKPOINT {Math.min(race.checkpointIndex + 1, activeRace.checkpoints.length)} / {activeRace.checkpoints.length}</small>
          <div className="race-progress__grid">
            {RACE_OPPONENTS.map((opponent) => (
              <i key={opponent.id} style={{ '--opponent-color': opponent.accent } as CSSProperties}>
                {opponent.name}
              </i>
            ))}
          </div>
        </aside>
      )}

      {started && race.phase === 'countdown' && (
        opponentsReady
          ? <div className="race-countdown" key={race.countdown}>{race.countdown}</div>
          : <div className="race-countdown race-countdown--loading"><span>LOADING GRID</span><i /></div>
      )}
      {started && race.phase === 'racing' && race.elapsedMs < 850 && (
        <div className="race-countdown race-countdown--go">GO!</div>
      )}

      {started && race.phase === 'free-roam' && pursuit.phase === 'patrol' && pursuit.detection > 1 && (
        <aside className="police-detection glass-panel">
          <div>
            <span>POLICE SCANNER</span>
            <strong>{telemetry.nitroActive ? 'RECKLESS DRIVING' : 'SPEEDING DETECTED'}</strong>
          </div>
          <b>{Math.round(pursuit.detection)}%</b>
          <i><em style={{ width: `${pursuit.detection}%` }} /></i>
        </aside>
      )}

      {started && pursuitActive && (
        <aside className={pursuit.phase === 'cooldown' ? 'pursuit-card pursuit-card--cooldown glass-panel' : 'pursuit-card glass-panel'}>
          <div className="pursuit-card__heading">
            <span>{pursuit.phase === 'cooldown' ? 'COOLDOWN' : 'POLICE PURSUIT'}</span>
            <strong>{formatPursuitTime(pursuit.durationMs)}</strong>
          </div>
          <div className="pursuit-card__heat" aria-label={`Heat level ${pursuit.heat}`}>
            <small>HEAT</small>
            {Array.from({ length: 5 }, (_, index) => (
              <i className={index < pursuit.heat ? 'pursuit-card__heat-level pursuit-card__heat-level--active' : 'pursuit-card__heat-level'} key={index}>◆</i>
            ))}
          </div>
          <div className="pursuit-card__details">
            <span><small>UNITS</small><b>{policeTelemetry.activeUnits}</b></span>
            <span><small>NEAREST</small><b>{Number.isFinite(policeTelemetry.nearestDistance) ? `${Math.round(policeTelemetry.nearestDistance)} M` : '--'}</b></span>
            <span><small>TACTIC</small><b>{pursuit.heat >= 5 ? 'AIR UNIT' : policeTactics.roadblockActive ? 'ROADBLOCK' : 'INTERCEPT'}</b></span>
          </div>
          {policeTactics.inHidingSpot && <div className="pursuit-card__hiding">HIDING SPOT // RAPID COOLDOWN</div>}
          {pursuit.phase === 'cooldown' && (
            <div className="pursuit-card__meter pursuit-card__meter--escape">
              <span><b>ESCAPING</b><small>{Math.round(pursuit.escapeProgress)}%</small></span>
              <i><em style={{ width: `${pursuit.escapeProgress}%` }} /></i>
            </div>
          )}
          {pursuit.bustProgress > 1 && (
            <div className="pursuit-card__meter pursuit-card__meter--bust">
              <span><b>BOXED IN</b><small>{Math.round(pursuit.bustProgress)}%</small></span>
              <i><em style={{ width: `${pursuit.bustProgress}%` }} /></i>
            </div>
          )}
        </aside>
      )}

      {started && (pursuit.phase === 'escaped' || pursuit.phase === 'busted') && (
        <div className={pursuit.phase === 'escaped' ? 'pursuit-outcome pursuit-outcome--escaped' : 'pursuit-outcome pursuit-outcome--busted'}>
          <span>{pursuit.phase === 'escaped' ? 'PURSUIT EVADED' : 'BUSTED'}</span>
          <strong>{pursuit.phase === 'escaped' ? `+${formatCash(pursuit.outcomeCash)}` : `-${formatCash(pursuit.outcomeCash)}`}</strong>
          <small>HEAT {pursuit.heat} // {formatPursuitTime(pursuit.durationMs)}</small>
        </div>
      )}

      {started && race.phase === 'results' && activeRace && (
        <section className="race-results">
          <div className="race-results__card glass-panel" style={{ '--race-color': activeRace.color } as CSSProperties}>
            <span>{race.didNotFinish ? 'EVENT TIME EXPIRED' : 'EVENT COMPLETE'}</span>
            <h2>{activeRace.name}</h2>
            <div className={race.didNotFinish ? 'race-results__position race-results__position--dnf' : 'race-results__position'}>
              {race.didNotFinish ? 'DNF' : <>P{race.finishPosition}<small>/4</small></>}
            </div>
            <div className="race-results__stats">
              <span><small>FINAL TIME</small><strong>{race.didNotFinish ? 'DNF' : formatRaceTime(race.elapsedMs)}</strong></span>
              <span><small>CASH EARNED</small><strong>+{formatCash(race.reward)}</strong></span>
              <span><small>REPUTATION</small><strong>+{race.repReward.toLocaleString()} REP</strong></span>
            </div>
            {race.rivalDefeated && <div className="race-results__rival">RIVAL DEFEATED // {CAREER_RIVALS.find((rival) => rival.id === race.rivalDefeated)?.name}</div>}
            <div className="race-results__leaderboard">
              <div className="race-results__leaderboard-title">FINAL CLASSIFICATION</div>
              {resultLeaderboard.map((entry, index) => (
                <div className={entry.id === 'player' ? 'race-results__row race-results__row--player' : 'race-results__row'} key={entry.id}>
                  <b>P{index + 1}</b>
                  <i style={{ '--opponent-color': entry.accent } as CSSProperties} />
                  <span><strong>{entry.name}</strong><small>{entry.carName}</small></span>
                  <time>{Number.isFinite(entry.timeMs) ? formatRaceTime(entry.timeMs) : 'DNF'}</time>
                </div>
              ))}
            </div>
            <button type="button" onClick={onDismissResults}>CONTINUE FREE ROAM <b>›</b></button>
          </div>
        </section>
      )}

      <header className="hud__top">
        <div className="location-card glass-panel">
          <span>{pursuitActive ? 'ACTIVE PURSUIT' : 'FREE ROAM'}</span>
          <strong>PORT MERIDIAN</strong>
          <small>{pursuitActive ? `POLICE HEAT ${pursuit.heat} // ${districtName}` : `${districtName} // ${formatWorldTime(worldTime)} // ${weather.toUpperCase()}`}</small>
        </div>
        <div className="objective-card glass-panel">
          <span>ACTIVE OBJECTIVE</span>
          <strong>{policeObjective[0]}</strong>
          <small>{policeObjective[1]}</small>
        </div>
      </header>

      <aside className="minimap glass-panel">
        <div className="minimap__grid">
          <svg
            className="minimap__roads"
            viewBox={`${WORLD_BOUNDS.minX} ${WORLD_BOUNDS.minZ} ${WORLD_WIDTH} ${WORLD_DEPTH}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {ROAD_SEGMENTS.map((road) => (
              <line
                key={road.id}
                x1={road.start[0]}
                y1={road.start[1]}
                x2={road.end[0]}
                y2={road.end[1]}
                strokeWidth={road.width * 0.62}
              />
            ))}
            {RACE_EVENTS.map((event) => (
              <circle
                className={isCareerEventUnlocked(event.id, careerRep, defeatedRivalIds) ? 'minimap__event' : 'minimap__event minimap__event--locked'}
                key={event.id}
                cx={event.start.x}
                cy={event.start.z}
                r="8"
                fill={event.color}
              />
            ))}
            {navigationTarget && (
              <>
                <line className="minimap__gps" x1={telemetry.position[0]} y1={telemetry.position[1]} x2={navigationTarget.x} y2={navigationTarget.z} />
                <circle className="minimap__destination" cx={navigationTarget.x} cy={navigationTarget.z} r="9" />
              </>
            )}
            {policeTelemetry.unitPositions.map((position, index) => (
              <circle className="minimap__police" key={`police-${index}`} cx={position[0]} cy={position[1]} r="6" />
            ))}
            {multiplayerMapPlayers.map((player) => (
              <circle className="minimap__multiplayer" key={player.id} cx={player.x} cy={player.z} r="8" fill={player.color} />
            ))}
          </svg>
          <div className="minimap__car" style={blipStyle}>
            ▲
          </div>
        </div>
        <div className="minimap__label">
          <span>METRO AREA</span>
          <b>{telemetry.onRoad ? 'ASPHALT' : 'OFF-ROAD'}</b>
        </div>
      </aside>

      <aside className="speed-cluster">
        <div className={telemetry.drifting ? 'drift-tag drift-tag--active' : 'drift-tag'}>DRIFT</div>
        <div className={manualTransmission && telemetry.rpm > 0.91 ? 'speed-ring speed-ring--redline glass-panel' : 'speed-ring glass-panel'}>
          <span className="speed-ring__gear">{telemetry.gear}</span>
          <i className={manualTransmission ? 'speed-ring__mode speed-ring__mode--manual' : 'speed-ring__mode'}>{manualTransmission ? 'MT' : 'AT'}</i>
          {manualTransmission && telemetry.rpm > 0.91 && <em className="speed-ring__shift">SHIFT</em>}
          <strong>{String(telemetry.speedKmh).padStart(3, '0')}</strong>
          <small>KM/H</small>
        </div>
        {manualTransmission && <div className="manual-shift-hint"><kbd>Z</kbd> DOWN <span>//</span> <kbd>X</kbd> UP</div>}
        <div className={telemetry.nitroActive ? 'nitro nitro--active' : 'nitro'} style={nitroStyle}>
          <div className="nitro__label">
            <span>N₂O</span>
            <b>{Math.round(telemetry.nitro)}%</b>
          </div>
          <div className="nitro__track">
            <i />
          </div>
        </div>
        <div className={telemetry.damage > 55 ? 'damage-meter damage-meter--critical' : 'damage-meter'}>
          <div className="damage-meter__label">
            <span>VEHICLE</span>
            <b>{Math.round(telemetry.damage)}%</b>
          </div>
          <div className="damage-meter__track">
            <i style={{ width: `${telemetry.damage}%` }} />
          </div>
        </div>
      </aside>

      <footer className="controls glass-panel">
        <span><kbd>WASD</kbd> DRIVE</span>
        <span><kbd>SPACE</kbd> HANDBRAKE</span>
        <span><kbd>SHIFT</kbd> NITRO</span>
        <span><kbd>R</kbd> RESET</span>
        <span><kbd>E</kbd> EVENTS</span>
        <span><kbd>M</kbd> AUDIO</span>
        <span><kbd>T</kbd> TRANSMISSION</span>
        <span><kbd>ESC</kbd> PAUSE</span>
        <span><kbd>TAB</kbd> MAP</span>
        <span><kbd>C</kbd> CAMERA</span>
        <span><kbd>B</kbd> REAR VIEW</span>
        <button type="button" disabled={race.phase !== 'free-roam' || pursuit.phase !== 'patrol' || replayActive} onClick={onTogglePhotoMode}><kbd>P</kbd> PHOTO</button>
        <button type="button" disabled={race.phase !== 'free-roam' || pursuit.phase !== 'patrol' || photoMode || replayActive} onClick={onStartReplay}><kbd>V</kbd> REPLAY</button>
      </footer>
    </div>
  )
}
