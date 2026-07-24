import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Hud } from './components/Hud'
import { GameCanvas } from './game/GameCanvas'
import { CAR_CATALOG, DEFAULT_CAR } from './game/carCatalog'
import type { CarTelemetry } from './game/carPhysics'
import type { CameraMode, CarLoadState } from './game/Car'
import { getRivalForEvent, isCareerEventUnlocked, reputationForFinish } from './game/careerSystem'
import type { NavigationTarget } from './game/navigation'
import { applyUpgrades, getCarUpgrades, getUpgradeCost, type UpgradeGarage, type UpgradePart } from './game/upgradeSystem'
import { setGameAudioLevels, setGameAudioMuted, unlockGameAudio, updateGameAudio } from './game/gameAudio'
import {
  getCarCustomization,
  isCustomizationGarage,
  type CarCustomization,
  type CustomizationGarage,
} from './game/customization'
import { getWeatherForTime } from './game/dynamicWorld'
import {
  DEFAULT_RELEASE_SETTINGS,
  isTrafficDensity,
  isWeatherMode,
  sanitizeBindings,
  type ReleaseSettings,
} from './game/gameSettings'
import { resetDestructibles } from './game/destructibleObjects'
import { REDEEM_CODES } from './game/redeemCodes'
import {
  getDefaultGraphicsQuality,
  getNextGraphicsQuality,
  isGraphicsQuality,
  type GraphicsQuality,
} from './game/graphicsSettings'
import {
  INITIAL_POLICE_TELEMETRY,
  INITIAL_POLICE_TACTICS,
  INITIAL_PURSUIT_STATE,
  SPEED_LIMIT_KMH,
  type PoliceTelemetry,
  type PursuitState,
  type PoliceTacticTelemetry,
} from './game/policeSystem'
import {
  CHECKPOINT_RADIUS,
  INITIAL_RACE_SESSION,
  RACE_EVENTS,
  RACE_TRIGGER_RADIUS,
  getRaceEvent,
  getPlayerRaceProgress,
  type OpponentProgress,
  type RaceSession,
} from './game/raceEvents'
import { ModeSelectScreen, MultiplayerHud, MultiplayerMenu } from './multiplayer/MultiplayerUI'
import { useMultiplayer } from './multiplayer/useMultiplayer'

const INITIAL_TELEMETRY: CarTelemetry = {
  speedKmh: 0,
  gear: 'N',
  drifting: false,
  nitro: 100,
  nitroActive: false,
  onRoad: true,
  position: [-40, -72],
  elevation: 0.08,
  heading: 0,
  steering: 0,
  rpm: 0.12,
  shiftKick: 0,
  impact: 0,
  damage: 0,
  tireSlip: 0,
  braking: false,
}

const STARTER_CAR_IDS = [DEFAULT_CAR.id, 'midnight-classic']

export default function App() {
  const multiplayer = useMultiplayer()
  const [entryMode, setEntryMode] = useState<'choose' | 'single' | 'multiplayer'>('choose')
  const [started, setStarted] = useState(false)
  const [paused, setPaused] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedCarId, setSelectedCarId] = useState(DEFAULT_CAR.id)
  const [telemetry, setTelemetry] = useState<CarTelemetry>(INITIAL_TELEMETRY)
  const [race, setRace] = useState<RaceSession>(INITIAL_RACE_SESSION)
  const [nearEventId, setNearEventId] = useState<string | null>(null)
  const [opponentsReady, setOpponentsReady] = useState(false)
  const [opponentProgress, setOpponentProgress] = useState<OpponentProgress[]>([])
  const [pursuit, setPursuit] = useState<PursuitState>(INITIAL_PURSUIT_STATE)
  const [policeTelemetry, setPoliceTelemetry] = useState<PoliceTelemetry>(INITIAL_POLICE_TELEMETRY)
  const [policeTactics, setPoliceTactics] = useState<PoliceTacticTelemetry>(INITIAL_POLICE_TACTICS)
  const [audioMuted, setAudioMuted] = useState(false)
  const [manualTransmission, setManualTransmission] = useState(false)
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>(getDefaultGraphicsQuality)
  const [carLoadState, setCarLoadState] = useState<CarLoadState>('idle')
  const [cash, setCash] = useState(0)
  const [unlockedCarIds, setUnlockedCarIds] = useState<string[]>(STARTER_CAR_IDS)
  const [redeemedCodeIds, setRedeemedCodeIds] = useState<string[]>([])
  const [careerRep, setCareerRep] = useState(0)
  const [defeatedRivalIds, setDefeatedRivalIds] = useState<string[]>([])
  const [careerWins, setCareerWins] = useState(0)
  const [mapOpen, setMapOpen] = useState(false)
  const [navigationTarget, setNavigationTarget] = useState<NavigationTarget | null>(null)
  const [upgradeGarage, setUpgradeGarage] = useState<UpgradeGarage>({})
  const [customizationGarage, setCustomizationGarage] = useState<CustomizationGarage>({})
  const [worldTime, setWorldTime] = useState(1050)
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase')
  const [lookBehind, setLookBehind] = useState(false)
  const [photoMode, setPhotoMode] = useState(false)
  const [replayTrigger, setReplayTrigger] = useState(0)
  const [replayActive, setReplayActive] = useState(false)
  const [progressReady, setProgressReady] = useState(false)
  const [releaseSettings, setReleaseSettings] = useState<ReleaseSettings>(DEFAULT_RELEASE_SETTINGS)
  const [controllerConnected, setControllerConnected] = useState(false)
  const [fps, setFps] = useState(0)
  const raceStartTime = useRef(0)
  const racePauseStarted = useRef(0)
  const controllerButtons = useRef<boolean[]>([])
  const telemetryRef = useRef(telemetry)
  const policeTelemetryRef = useRef(policeTelemetry)
  const handledPursuitOutcome = useRef(0)
  const handledBreakerEvent = useRef(0)
  const multiplayerSequence = useRef(0)
  const multiplayerLastSentAt = useRef(0)
  const selectedCar = CAR_CATALOG.find((car) => car.id === selectedCarId) ?? DEFAULT_CAR
  const selectedCarUnlocked = unlockedCarIds.includes(selectedCar.id)
  const selectedUpgrades = getCarUpgrades(upgradeGarage, selectedCar.id)
  const selectedCustomization = useMemo(() => getCarCustomization(customizationGarage, selectedCar.id), [customizationGarage, selectedCar.id])
  const weather = releaseSettings.weatherMode === 'dynamic' ? getWeatherForTime(worldTime) : releaseSettings.weatherMode
  const selectedPerformance = useMemo(() => applyUpgrades(selectedCar.performance, selectedUpgrades), [selectedCar, selectedUpgrades.engine, selectedUpgrades.transmission, selectedUpgrades.handling, selectedUpgrades.brakes, selectedUpgrades.nitrous])
  const multiplayerActive = entryMode === 'multiplayer' && Boolean(multiplayer.session)
  const multiplayerLocalPlayer = multiplayer.room?.players.find((player) => player.id === multiplayer.playerId) ?? null
  const multiplayerSpawn = multiplayer.session && multiplayer.playerId ? multiplayer.session.spawns[multiplayer.playerId] : undefined
  const multiplayerRaceProgress = multiplayer.playerId ? multiplayer.raceProgress[multiplayer.playerId] ?? null : null
  const multiplayerBodyColor = selectedCustomization.paint === 'factory' ? selectedCar.accent : selectedCustomization.paint

  telemetryRef.current = telemetry
  policeTelemetryRef.current = policeTelemetry

  useEffect(() => {
    setGameAudioMuted(audioMuted)
    setGameAudioLevels({ master: releaseSettings.masterVolume, engine: releaseSettings.engineVolume, effects: releaseSettings.effectsVolume })
    updateGameAudio(telemetry, pursuit, policeTelemetry, started && !paused)
  }, [audioMuted, paused, policeTelemetry, pursuit, releaseSettings.effectsVolume, releaseSettings.engineVolume, releaseSettings.masterVolume, started, telemetry])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('project-street-progress-v1')
      if (saved) {
        const parsed = JSON.parse(saved) as {
          cash?: number
          unlockedCarIds?: string[]
          manualTransmission?: boolean
          graphicsQuality?: unknown
          careerRep?: number
          defeatedRivalIds?: string[]
          careerWins?: number
          upgradeGarage?: UpgradeGarage
          customizationGarage?: CustomizationGarage
          releaseSettings?: Partial<ReleaseSettings>
          redeemedCodeIds?: string[]
        }
        const validIds = new Set(CAR_CATALOG.map((car) => car.id))
        const savedIds = (parsed.unlockedCarIds ?? []).filter((id) => validIds.has(id))
        setCash(Math.max(0, Math.floor(parsed.cash ?? 0)))
        setUnlockedCarIds(Array.from(new Set([...STARTER_CAR_IDS, ...savedIds])))
        setManualTransmission(parsed.manualTransmission === true)
        if (isGraphicsQuality(parsed.graphicsQuality)) setGraphicsQuality(parsed.graphicsQuality)
        setCareerRep(Math.max(0, Math.floor(parsed.careerRep ?? 0)))
        setDefeatedRivalIds((parsed.defeatedRivalIds ?? []).filter((id) => typeof id === 'string'))
        setCareerWins(Math.max(0, Math.floor(parsed.careerWins ?? 0)))
        setRedeemedCodeIds((parsed.redeemedCodeIds ?? []).filter((id) => typeof id === 'string'))
        if (parsed.upgradeGarage && typeof parsed.upgradeGarage === 'object') setUpgradeGarage(parsed.upgradeGarage)
        if (isCustomizationGarage(parsed.customizationGarage)) setCustomizationGarage(parsed.customizationGarage)
        if (parsed.releaseSettings && typeof parsed.releaseSettings === 'object') {
          setReleaseSettings((current) => ({
            ...current,
            masterVolume: typeof parsed.releaseSettings?.masterVolume === 'number' ? Math.max(0, Math.min(1, parsed.releaseSettings.masterVolume)) : current.masterVolume,
            engineVolume: typeof parsed.releaseSettings?.engineVolume === 'number' ? Math.max(0, Math.min(1, parsed.releaseSettings.engineVolume)) : current.engineVolume,
            effectsVolume: typeof parsed.releaseSettings?.effectsVolume === 'number' ? Math.max(0, Math.min(1, parsed.releaseSettings.effectsVolume)) : current.effectsVolume,
            resolutionScale: typeof parsed.releaseSettings?.resolutionScale === 'number' ? Math.max(0.65, Math.min(1, parsed.releaseSettings.resolutionScale)) : current.resolutionScale,
            trafficDensity: isTrafficDensity(parsed.releaseSettings?.trafficDensity) ? parsed.releaseSettings.trafficDensity : current.trafficDensity,
            weatherMode: isWeatherMode(parsed.releaseSettings?.weatherMode) ? parsed.releaseSettings.weatherMode : current.weatherMode,
            showFps: parsed.releaseSettings?.showFps === true,
            controllerSensitivity: typeof parsed.releaseSettings?.controllerSensitivity === 'number' ? Math.max(0.65, Math.min(1.35, parsed.releaseSettings.controllerSensitivity)) : current.controllerSensitivity,
            controllerDeadzone: typeof parsed.releaseSettings?.controllerDeadzone === 'number' ? Math.max(0.05, Math.min(0.3, parsed.releaseSettings.controllerDeadzone)) : current.controllerDeadzone,
            bindings: sanitizeBindings(parsed.releaseSettings?.bindings),
          }))
        }
      }
    } catch {
      // Invalid local progress falls back to a fresh career.
    } finally {
      setProgressReady(true)
    }
  }, [])

  useEffect(() => {
    if (!progressReady) return
    window.localStorage.setItem('project-street-progress-v1', JSON.stringify({ cash, unlockedCarIds, manualTransmission, graphicsQuality, careerRep, defeatedRivalIds, careerWins, upgradeGarage, customizationGarage, releaseSettings, redeemedCodeIds }))
  }, [careerRep, careerWins, cash, customizationGarage, defeatedRivalIds, graphicsQuality, manualTransmission, progressReady, redeemedCodeIds, releaseSettings, unlockedCarIds, upgradeGarage])

  useEffect(() => {
    if (!started || paused) return
    const timer = window.setInterval(() => setWorldTime((current) => (current + 10) % 1440), 5000)
    return () => window.clearInterval(timer)
  }, [paused, started])

  useEffect(() => {
    if (entryMode !== 'multiplayer' || !multiplayer.session || !multiplayerLocalPlayer) return
    setSelectedCarId(multiplayerLocalPlayer.vehicleId)
    const sessionTimes = { day: 820, sunset: 1110, night: 1320, dawn: 350 } as const
    setWorldTime(sessionTimes[multiplayer.session.settings.timeOfDay])
    unlockGameAudio()
    resetDestructibles()
    setPaused(false)
    setStarted(true)
  }, [entryMode, multiplayer.session, multiplayerLocalPlayer])

  useEffect(() => {
    if (entryMode !== 'multiplayer' || !started || multiplayer.session) return
    setStarted(false)
    setPaused(false)
    setSettingsOpen(false)
    setMapOpen(false)
    setPhotoMode(false)
    setReplayActive(false)
    setLookBehind(false)
    setTelemetry({ ...INITIAL_TELEMETRY })
    setRace({ ...INITIAL_RACE_SESSION })
    setPursuit((current) => ({ ...INITIAL_PURSUIT_STATE, outcomeId: current.outcomeId }))
  }, [entryMode, multiplayer.session, started])

  useEffect(() => {
    if (!started || !multiplayer.session || !multiplayer.playerId || multiplayer.connection !== 'online') return
    const now = performance.now()
    const minimumInterval = telemetry.speedKmh < 2 ? 450 : 65
    if (now - multiplayerLastSentAt.current < minimumInterval) return
    multiplayerLastSentAt.current = now
    multiplayerSequence.current += 1
    const signedSpeed = telemetry.gear === 'R' ? -telemetry.speedKmh / 3.6 : telemetry.speedKmh / 3.6
    multiplayer.sendVehicleState({
      sequence: multiplayerSequence.current,
      x: telemetry.position[0],
      y: telemetry.elevation,
      z: telemetry.position[1],
      heading: telemetry.heading,
      velocityX: Math.sin(telemetry.heading) * signedSpeed,
      velocityZ: Math.cos(telemetry.heading) * signedSpeed,
      steering: telemetry.steering,
      speedKmh: telemetry.speedKmh,
      braking: telemetry.braking,
      reverse: telemetry.gear === 'R',
      gear: telemetry.gear,
      nitroActive: telemetry.nitroActive,
    })
  }, [multiplayer, started, telemetry])

  const returnToGarage = useCallback(() => {
    setStarted(false)
    setPaused(false)
    setSettingsOpen(false)
    setTelemetry({ ...INITIAL_TELEMETRY })
    setRace({ ...INITIAL_RACE_SESSION })
    setNearEventId(null)
    setOpponentsReady(false)
    setOpponentProgress([])
    setPursuit((current) => ({ ...INITIAL_PURSUIT_STATE, outcomeId: current.outcomeId }))
    setPoliceTelemetry(INITIAL_POLICE_TELEMETRY)
    setPoliceTactics(INITIAL_POLICE_TACTICS)
    setMapOpen(false)
    setPhotoMode(false)
    setReplayActive(false)
    setLookBehind(false)
    resetDestructibles()
  }, [])

  const togglePause = useCallback(() => {
    if (!started) return
    setMapOpen(false)
    setPhotoMode(false)
    setLookBehind(false)
    setPaused((current) => {
      const next = !current
      if (!next) setSettingsOpen(false)
      return next
    })
  }, [started])

  const updateReleaseSettings = useCallback((patch: Partial<ReleaseSettings>) => {
    setReleaseSettings((current) => ({ ...current, ...patch, bindings: patch.bindings ? sanitizeBindings(patch.bindings) : current.bindings }))
  }, [])

  useEffect(() => {
    if (paused && race.phase === 'racing') {
      racePauseStarted.current = performance.now()
      return
    }
    if (!paused && racePauseStarted.current > 0 && race.phase === 'racing') {
      raceStartTime.current += performance.now() - racePauseStarted.current
    }
    racePauseStarted.current = 0
  }, [paused, race.phase])

  const startRace = useCallback((eventId: string) => {
    if (multiplayerActive) return
    if (pursuit.phase !== 'patrol') return
    if (!isCareerEventUnlocked(eventId, careerRep, defeatedRivalIds)) return
    const event = getRaceEvent(eventId)
    if (!event) return
    setRace({
      phase: 'countdown',
      eventId,
      checkpointIndex: 0,
      countdown: 3,
      elapsedMs: 0,
      livePosition: 1,
      finishPosition: 0,
      reward: 0,
      didNotFinish: false,
      repReward: 0,
      rivalDefeated: null,
    })
    setNearEventId(null)
    setOpponentsReady(false)
    setOpponentProgress([])
    setPursuit((current) => ({ ...INITIAL_PURSUIT_STATE, outcomeId: current.outcomeId }))
  }, [careerRep, defeatedRivalIds, multiplayerActive, pursuit.phase])

  const dismissResults = useCallback(() => {
    setRace({ ...INITIAL_RACE_SESSION })
    setOpponentsReady(false)
    setOpponentProgress([])
  }, [])

  const markOpponentsReady = useCallback(() => setOpponentsReady(true), [])
  const updateOpponentProgress = useCallback((progress: OpponentProgress[]) => setOpponentProgress(progress), [])
  const updatePoliceTelemetry = useCallback((nextTelemetry: PoliceTelemetry) => setPoliceTelemetry(nextTelemetry), [])
  const toggleAudio = useCallback(() => {
    unlockGameAudio()
    setAudioMuted((current) => !current)
  }, [])
  const toggleTransmission = useCallback(() => setManualTransmission((current) => !current), [])
  const toggleGraphicsQuality = useCallback(() => setGraphicsQuality((current) => getNextGraphicsQuality(current)), [])
  const cycleCamera = useCallback(() => setCameraMode((current) => current === 'chase' ? 'hood' : current === 'hood' ? 'cinematic' : 'chase'), [])
  const togglePhotoMode = useCallback(() => {
    if (race.phase !== 'free-roam' || pursuit.phase !== 'patrol' || replayActive) return
    setPhotoMode((current) => !current)
    setMapOpen(false)
  }, [pursuit.phase, race.phase, replayActive])
  const startReplay = useCallback(() => {
    if (race.phase !== 'free-roam' || pursuit.phase !== 'patrol' || mapOpen || photoMode || replayActive) return
    setReplayTrigger((current) => current + 1)
  }, [mapOpen, photoMode, pursuit.phase, race.phase, replayActive])
  const capturePhoto = useCallback(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.game-shell canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `project-street-${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [])

  const unlockCar = useCallback((carId: string) => {
    const car = CAR_CATALOG.find((candidate) => candidate.id === carId)
    if (!car || unlockedCarIds.includes(carId) || cash < car.price) return
    setCash((current) => current - car.price)
    setUnlockedCarIds((current) => [...current, carId])
  }, [cash, unlockedCarIds])

  const redeemCode = useCallback((rawCode: string) => {
    const code = rawCode.trim()
    const redeemCodeDefinition = REDEEM_CODES.find((candidate) => candidate.code === code)
    if (!redeemCodeDefinition) return { ok: false, message: 'Invalid code' }
    if (!redeemCodeDefinition.reusable && redeemedCodeIds.includes(redeemCodeDefinition.code)) {
      return { ok: false, message: 'Code already used' }
    }

    const reward = redeemCodeDefinition.reward
    const rewardMessages: string[] = []
    if (reward.cash && reward.cash > 0) {
      setCash((current) => current + reward.cash!)
      rewardMessages.push(`$${reward.cash.toLocaleString('en-US')} added`)
    }

    if (reward.carIds?.length) {
      const validCarIds = new Set(CAR_CATALOG.map((car) => car.id))
      const rewardCarIds = reward.carIds.filter((carId) => validCarIds.has(carId))
      if (rewardCarIds.length) {
        const rewardCarNames = rewardCarIds.map((carId) => CAR_CATALOG.find((car) => car.id === carId)?.name ?? carId)
        setUnlockedCarIds((current) => Array.from(new Set([...current, ...rewardCarIds])))
        rewardMessages.push(`${rewardCarNames.join(', ')} unlocked`)
      }
    }

    if (!redeemCodeDefinition.reusable) {
      setRedeemedCodeIds((current) => current.includes(redeemCodeDefinition.code) ? current : [...current, redeemCodeDefinition.code])
    }

    return { ok: true, message: rewardMessages.length ? `Code redeemed: ${rewardMessages.join(' // ')}` : 'Code redeemed' }
  }, [redeemedCodeIds])

  const buyUpgrade = useCallback((part: UpgradePart) => {
    if (!selectedCarUnlocked) return
    const current = getCarUpgrades(upgradeGarage, selectedCar.id)
    if (current[part] >= 3) return
    const cost = getUpgradeCost(part, current[part])
    if (cash < cost) return
    setCash((value) => value - cost)
    setUpgradeGarage((garage) => ({ ...garage, [selectedCar.id]: { ...current, [part]: current[part] + 1 } }))
  }, [cash, selectedCar.id, selectedCarUnlocked, upgradeGarage])

  const updateCustomization = useCallback((patch: Partial<CarCustomization>) => {
    if (!selectedCarUnlocked) return
    setCustomizationGarage((garage) => ({
      ...garage,
      [selectedCar.id]: { ...getCarCustomization(garage, selectedCar.id), ...patch },
    }))
  }, [selectedCar.id, selectedCarUnlocked])

  useEffect(() => {
    if (!started || paused || multiplayerActive || race.phase !== 'free-roam' || pursuit.phase !== 'patrol') {
      setNearEventId(null)
      return
    }
    let nearestId: string | null = null
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const event of RACE_EVENTS) {
      const distance = Math.hypot(telemetry.position[0] - event.start.x, telemetry.position[1] - event.start.z)
      if (distance <= RACE_TRIGGER_RADIUS && distance < nearestDistance) {
        nearestId = event.id
        nearestDistance = distance
      }
    }
    setNearEventId(nearestId)
  }, [multiplayerActive, paused, pursuit.phase, race.phase, started, telemetry.position])

  useEffect(() => {
    if (!started || paused || (multiplayerActive && !multiplayer.session?.settings.police)) return
    if (race.phase !== 'free-roam') return

    const timer = window.setInterval(() => {
      const player = telemetryRef.current
      const police = policeTelemetryRef.current
      const stepMs = 100
      const stepSeconds = stepMs / 1000

      setPursuit((current) => {
        if (current.phase === 'patrol') {
          const speeding = player.onRoad && player.speedKmh >= SPEED_LIMIT_KMH
          const observedMultiplier = police.nearestDistance < 95 ? 1.85 : 1
          const speedRate = speeding ? (10 + Math.max(0, player.speedKmh - SPEED_LIMIT_KMH) * 0.16) * observedMultiplier : 0
          const nitroRate = player.nitroActive ? 24 : 0
          const detection = Math.max(0, Math.min(100, current.detection + (speedRate + nitroRate - (speeding || player.nitroActive ? 0 : 18)) * stepSeconds))
          if (detection < 100) return { ...current, detection }
          return {
            ...INITIAL_PURSUIT_STATE,
            phase: 'pursuit',
            heat: 1,
            detection: 100,
            outcomeId: current.outcomeId,
          }
        }

        if (current.phase === 'escaped' || current.phase === 'busted') {
          const statusMs = current.statusMs + stepMs
          if (statusMs < 4000) return { ...current, statusMs }
          return { ...INITIAL_PURSUIT_STATE, outcomeId: current.outcomeId }
        }

        const durationMs = current.durationMs + stepMs
        const heat = Math.min(5, 1 + Math.floor(durationMs / 26000))
        const boxedIn = player.speedKmh < 14 && police.nearestDistance < 6.5
        const bustProgress = Math.max(0, Math.min(100, current.bustProgress + (boxedIn ? 36 : -24) * stepSeconds))

        if (bustProgress >= 100) {
          return {
            ...current,
            phase: 'busted',
            heat,
            durationMs,
            bustProgress: 100,
            outcomeCash: heat * 2000,
            outcomeId: current.outcomeId + 1,
            statusMs: 0,
          }
        }

        if (current.phase === 'pursuit') {
          const lostContactMs = police.nearestDistance > 92
            ? current.lostContactMs + stepMs
            : Math.max(0, current.lostContactMs - stepMs * 2)
          if (lostContactMs >= 2800) {
            return {
              ...current,
              phase: 'cooldown',
              heat,
              durationMs,
              lostContactMs,
              escapeProgress: 0,
              bustProgress,
            }
          }
          return { ...current, heat, durationMs, lostContactMs, bustProgress }
        }

        if (police.nearestDistance < 48) {
          return {
            ...current,
            phase: 'pursuit',
            heat,
            durationMs,
            lostContactMs: 0,
            escapeProgress: 0,
            bustProgress,
          }
        }

        const escapeSeconds = policeTactics.inHidingSpot ? 2.8 : 9
        const escapeProgress = Math.min(100, current.escapeProgress + (100 / escapeSeconds) * stepSeconds)
        if (escapeProgress >= 100) {
          return {
            ...current,
            phase: 'escaped',
            heat,
            durationMs,
            escapeProgress: 100,
            bustProgress: 0,
            outcomeCash: heat * 1500,
            outcomeId: current.outcomeId + 1,
            statusMs: 0,
          }
        }
        return { ...current, heat, durationMs, escapeProgress, bustProgress }
      })
    }, 100)

    return () => window.clearInterval(timer)
  }, [multiplayer.session?.settings.police, multiplayerActive, paused, policeTactics.inHidingSpot, race.phase, started])

  useEffect(() => {
    if (policeTactics.breakerEventId <= handledBreakerEvent.current) return
    handledBreakerEvent.current = policeTactics.breakerEventId
    setPursuit((current) => current.phase === 'pursuit' ? {
      ...current,
      phase: 'cooldown',
      lostContactMs: 3200,
      escapeProgress: Math.max(current.escapeProgress, 48),
    } : current)
  }, [policeTactics.breakerEventId])

  useEffect(() => {
    if (pursuit.outcomeId <= handledPursuitOutcome.current) return
    handledPursuitOutcome.current = pursuit.outcomeId
    if (pursuit.phase === 'escaped') setCash((current) => current + pursuit.outcomeCash)
    if (pursuit.phase === 'busted') setCash((current) => Math.max(0, current - pursuit.outcomeCash))
  }, [pursuit.outcomeCash, pursuit.outcomeId, pursuit.phase])

  useEffect(() => {
    if (paused || race.phase !== 'countdown' || !opponentsReady) return
    const timer = window.setTimeout(() => {
      if (race.countdown > 1) {
        setRace((current) => ({ ...current, countdown: current.countdown - 1 }))
      } else {
        raceStartTime.current = performance.now()
        setRace((current) => ({ ...current, phase: 'racing', countdown: 0, elapsedMs: 0 }))
      }
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [opponentsReady, paused, race.countdown, race.phase])

  useEffect(() => {
    if (paused || race.phase !== 'racing') return
    const timer = window.setInterval(() => {
      setRace((current) => {
        if (current.phase !== 'racing') return current
        const elapsedMs = performance.now() - raceStartTime.current
        const event = getRaceEvent(current.eventId)
        if (event && elapsedMs >= event.timeLimit * 1000) {
          return {
            ...current,
            phase: 'results',
            elapsedMs,
            livePosition: 4,
            finishPosition: 4,
            reward: 0,
            didNotFinish: true,
            repReward: 0,
            rivalDefeated: null,
          }
        }
        return { ...current, elapsedMs }
      })
    }, 50)
    return () => window.clearInterval(timer)
  }, [paused, race.phase])

  useEffect(() => {
    if (race.phase !== 'racing') return
    const event = getRaceEvent(race.eventId)
    if (!event) return
    const playerProgress = getPlayerRaceProgress(event, race.checkpointIndex, telemetry.position)
    const livePosition = 1 + opponentProgress.filter((opponent) => opponent.progress > playerProgress).length
    if (livePosition !== race.livePosition) setRace((current) => ({ ...current, livePosition }))
  }, [opponentProgress, race.checkpointIndex, race.eventId, race.livePosition, race.phase, telemetry.position])

  useEffect(() => {
    if (race.phase !== 'racing') return
    const event = getRaceEvent(race.eventId)
    const checkpoint = event?.checkpoints[race.checkpointIndex]
    if (!event || !checkpoint) return
    const distance = Math.hypot(telemetry.position[0] - checkpoint.x, telemetry.position[1] - checkpoint.z)
    if (distance > CHECKPOINT_RADIUS) return

    if (race.checkpointIndex < event.checkpoints.length - 1) {
      setRace((current) => ({ ...current, checkpointIndex: current.checkpointIndex + 1 }))
      return
    }

    const finishMs = performance.now() - raceStartTime.current
    const finishSeconds = finishMs / 1000
    const position = 1 + event.rivalTimes.filter((rivalTime) => rivalTime < finishSeconds).length
    const reward = event.baseReward + Math.max(0, 4 - position) * 1500
    const repReward = reputationForFinish(position, event.boss === true)
    const rival = getRivalForEvent(event.id)
    const rivalDefeated = position === 1 && rival && !defeatedRivalIds.includes(rival.id) ? rival : null
    setCash((current) => current + reward)
    setCareerRep((current) => current + repReward)
    if (position === 1) setCareerWins((current) => current + 1)
    if (rivalDefeated) {
      setDefeatedRivalIds((current) => [...current, rivalDefeated.id])
      if (rivalDefeated.rewardCarId) setUnlockedCarIds((current) => current.includes(rivalDefeated.rewardCarId!) ? current : [...current, rivalDefeated.rewardCarId!])
    }
    setRace((current) => ({
      ...current,
      phase: 'results',
      elapsedMs: finishMs,
      livePosition: position,
      finishPosition: position,
      reward,
      didNotFinish: false,
      repReward,
      rivalDefeated: rivalDefeated?.id ?? null,
    }))
  }, [defeatedRivalIds, race.checkpointIndex, race.eventId, race.phase, telemetry.position])

  useEffect(() => {
    if (!started) return
    let animationFrame = 0
    const pollController = () => {
      const pad = navigator.getGamepads?.().find((candidate) => candidate?.connected) ?? null
      setControllerConnected(Boolean(pad))
      if (pad) {
        const pressed = pad.buttons.map((button) => button.pressed)
        const edge = (index: number) => pressed[index] && !controllerButtons.current[index]
        if (edge(9)) togglePause()
        if (!paused && edge(8) && !photoMode && !replayActive) setMapOpen((current) => !current)
        if (!paused && edge(4) && !mapOpen && !photoMode) cycleCamera()
        setLookBehind(!paused && Boolean(pressed[1]))
        controllerButtons.current = pressed
      } else {
        controllerButtons.current = []
        setLookBehind(false)
      }
      animationFrame = window.requestAnimationFrame(pollController)
    }
    animationFrame = window.requestAnimationFrame(pollController)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [cycleCamera, mapOpen, paused, photoMode, replayActive, started, togglePause])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 't' && !event.repeat) toggleTransmission()
      if (!started) return
      if (event.key === 'Escape') {
        if (mapOpen) {
          setMapOpen(false)
          return
        }
        if (photoMode) {
          setPhotoMode(false)
          return
        }
        if (paused && settingsOpen) {
          setSettingsOpen(false)
          return
        }
        togglePause()
        return
      }
      if (paused) return
      if (event.key === 'Tab' && !event.repeat && !photoMode && !replayActive) {
        event.preventDefault()
        setMapOpen((current) => !current)
      }
      if (event.key.toLowerCase() === 'm' && !event.repeat) toggleAudio()
      if (event.key.toLowerCase() === 'c' && !event.repeat && !mapOpen && !photoMode) cycleCamera()
      if (event.key.toLowerCase() === 'p' && !event.repeat) togglePhotoMode()
      if (event.key.toLowerCase() === 'v' && !event.repeat) startReplay()
      if (event.key.toLowerCase() === 'e' && nearEventId && race.phase === 'free-roam') startRace(nearEventId)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [cycleCamera, mapOpen, nearEventId, paused, photoMode, replayActive, settingsOpen, startRace, startReplay, started, toggleAudio, togglePause, togglePhotoMode, toggleTransmission])

  useEffect(() => {
    if (!started) return
    const handleRearView = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'b') setLookBehind(!paused && event.type === 'keydown')
    }
    const clearRearView = () => setLookBehind(false)
    window.addEventListener('keydown', handleRearView)
    window.addEventListener('keyup', handleRearView)
    window.addEventListener('blur', clearRearView)
    return () => {
      window.removeEventListener('keydown', handleRearView)
      window.removeEventListener('keyup', handleRearView)
      window.removeEventListener('blur', clearRearView)
    }
  }, [paused, started])

  useEffect(() => {
    if (!multiplayerActive) return
    const authorizeMultiplayerRespawn = (event: KeyboardEvent) => {
      if (!event.repeat && event.key.toLowerCase() === releaseSettings.bindings.reset.toLowerCase()) multiplayer.authorizeRespawn()
    }
    window.addEventListener('keydown', authorizeMultiplayerRespawn)
    return () => window.removeEventListener('keydown', authorizeMultiplayerRespawn)
  }, [multiplayer, multiplayerActive, releaseSettings.bindings.reset])

  const leaveMultiplayer = useCallback(async () => {
    await multiplayer.leaveRoom()
    setStarted(false)
    setPaused(false)
    setSettingsOpen(false)
    setMapOpen(false)
    setEntryMode('multiplayer')
  }, [multiplayer])

  return (
    <main className={started ? 'game-shell game-shell--running' : 'game-shell'}>
      <GameCanvas
        graphicsQuality={graphicsQuality}
        car={selectedCar}
        customization={selectedCustomization}
        performance={selectedPerformance}
        paused={!started}
        gamePaused={paused}
        race={race}
        pursuit={pursuit}
        playerTelemetry={telemetry}
        manualTransmission={manualTransmission}
        mapOpen={mapOpen}
        cameraMode={cameraMode}
        lookBehind={lookBehind}
        photoMode={photoMode}
        replayTrigger={replayTrigger}
        replayActive={replayActive}
        playerPosition={telemetry.position}
        worldTime={worldTime}
        weather={weather}
        resolutionScale={releaseSettings.resolutionScale}
        trafficDensity={releaseSettings.trafficDensity}
        bindings={releaseSettings.bindings}
        controllerSensitivity={releaseSettings.controllerSensitivity}
        controllerDeadzone={releaseSettings.controllerDeadzone}
        onOpponentsReady={markOpponentsReady}
        onOpponentProgress={updateOpponentProgress}
        onPoliceTelemetry={updatePoliceTelemetry}
        policeTactics={policeTactics}
        onPoliceTactics={setPoliceTactics}
        onCarLoadState={setCarLoadState}
        onTelemetry={setTelemetry}
        onReplayState={setReplayActive}
        onControllerStatus={setControllerConnected}
        onFpsUpdate={setFps}
        multiplayerSession={multiplayer.session}
        multiplayerPlayers={multiplayer.room?.players}
        multiplayerPlayerId={multiplayer.playerId}
        multiplayerRaceProgress={multiplayerRaceProgress}
        multiplayerSpawn={multiplayerSpawn}
        trafficEnabled={!multiplayerActive || multiplayer.session?.settings.traffic !== false}
        policeEnabled={!multiplayerActive || multiplayer.session?.settings.police !== false}
      />
      <Hud
        graphicsQuality={graphicsQuality}
        telemetry={telemetry}
        started={started}
        cash={cash}
        unlockedCarIds={unlockedCarIds}
        selectedCarId={selectedCarId}
        race={race}
        nearEventId={nearEventId}
        opponentsReady={opponentsReady}
        pursuit={pursuit}
        policeTelemetry={policeTelemetry}
        policeTactics={policeTactics}
        audioMuted={audioMuted}
        manualTransmission={manualTransmission}
        carLoadState={carLoadState}
        careerRep={careerRep}
        defeatedRivalIds={defeatedRivalIds}
        careerWins={careerWins}
        mapOpen={mapOpen}
        navigationTarget={navigationTarget}
        selectedUpgrades={selectedUpgrades}
        selectedPerformance={selectedPerformance}
        selectedCustomization={selectedCustomization}
        worldTime={worldTime}
        weather={weather}
        cameraMode={cameraMode}
        photoMode={photoMode}
        replayActive={replayActive}
        paused={paused}
        settingsOpen={settingsOpen}
        releaseSettings={releaseSettings}
        controllerConnected={controllerConnected}
        fps={fps}
        multiplayerActive={multiplayerActive}
        multiplayerMapPlayers={multiplayer.remoteMapPlayers}
        onSelectCar={setSelectedCarId}
        onStart={() => {
          if (selectedCarUnlocked) {
            unlockGameAudio()
            resetDestructibles()
            setPaused(false)
            setStarted(true)
          }
        }}
        onStartRace={startRace}
        onDismissResults={dismissResults}
        onUnlockCar={unlockCar}
        onRedeemCode={redeemCode}
        onBackToMenu={multiplayerActive ? () => { void leaveMultiplayer() } : returnToGarage}
        onTogglePause={togglePause}
        onOpenSettings={() => setSettingsOpen(true)}
        onCloseSettings={() => setSettingsOpen(false)}
        onUpdateReleaseSettings={updateReleaseSettings}
        onToggleAudio={toggleAudio}
        onToggleTransmission={toggleTransmission}
        onToggleGraphics={toggleGraphicsQuality}
        onToggleMap={() => setMapOpen((current) => !current)}
        onSetNavigationTarget={(target) => {
          setNavigationTarget(target)
          setMapOpen(false)
        }}
        onClearNavigation={() => setNavigationTarget(null)}
        onBuyUpgrade={buyUpgrade}
        onUpdateCustomization={updateCustomization}
        onCycleCamera={cycleCamera}
        onTogglePhotoMode={togglePhotoMode}
        onCapturePhoto={capturePhoto}
        onStartReplay={startReplay}
      />
      {!started && entryMode === 'choose' && <ModeSelectScreen onSinglePlayer={() => setEntryMode('single')} onMultiplayer={() => setEntryMode('multiplayer')} />}
      {!started && entryMode === 'single' && <button className="mode-switch-button" onClick={() => setEntryMode('choose')}>‹ GAME MODES</button>}
      {!started && entryMode === 'multiplayer' && (
        <MultiplayerMenu
          multiplayer={multiplayer}
          selectedCarId={selectedCarId}
          unlockedCarIds={unlockedCarIds}
          selectedBodyColor={multiplayerBodyColor}
          onSelectCar={setSelectedCarId}
          onBack={() => setEntryMode('choose')}
        />
      )}
      {multiplayerActive && <MultiplayerHud multiplayer={multiplayer} paused={paused} onLeave={() => { void leaveMultiplayer() }} />}
    </main>
  )
}
