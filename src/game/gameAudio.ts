import type { CarTelemetry } from './carPhysics'
import type { PoliceTelemetry, PursuitState } from './policeSystem'

interface AudioRig {
  context: AudioContext
  master: GainNode
  engineGain: GainNode
  engineFilter: BiquadFilterNode
  engineLow: OscillatorNode
  engineHigh: OscillatorNode
  engineWhine: OscillatorNode
  intakeGain: GainNode
  intakeFilter: BiquadFilterNode
  tireGain: GainNode
  sirenGainA: GainNode
  sirenGainB: GainNode
  sirenA: OscillatorNode
  sirenB: OscillatorNode
  sirenPanner: StereoPannerNode
  noiseBuffer: AudioBuffer
}

let rig: AudioRig | null = null
let muted = false
let masterVolume = 0.82
let engineVolume = 0.9
let effectsVolume = 0.78
let previousImpact = 0
let previousShiftKick = 0
let lastImpactAt = 0
let lastShiftAt = 0

function createNoiseBuffer(context: AudioContext) {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1
  return buffer
}

function createRig() {
  const context = new AudioContext()
  const master = context.createGain()
  master.gain.value = 0
  master.connect(context.destination)

  const engineGain = context.createGain()
  const engineFilter = context.createBiquadFilter()
  engineFilter.type = 'lowpass'
  engineFilter.Q.value = 0.82
  engineGain.gain.value = 0
  engineGain.connect(engineFilter).connect(master)

  const engineLow = context.createOscillator()
  const harmonicWave = context.createPeriodicWave(
    new Float32Array([0, 0, 0, 0, 0, 0, 0, 0]),
    new Float32Array([0, 1, 0.48, 0.29, 0.18, 0.11, 0.07, 0.04]),
  )
  engineLow.setPeriodicWave(harmonicWave)
  const lowGain = context.createGain()
  lowGain.gain.value = 0.42
  engineLow.connect(lowGain).connect(engineGain)
  engineLow.start()

  const engineHigh = context.createOscillator()
  engineHigh.type = 'sine'
  const highGain = context.createGain()
  highGain.gain.value = 0.24
  engineHigh.connect(highGain).connect(engineGain)
  engineHigh.start()

  const noiseBuffer = createNoiseBuffer(context)
  const engineWhine = context.createOscillator()
  const whineGain = context.createGain()
  engineWhine.type = 'triangle'
  whineGain.gain.value = 0.1
  engineWhine.connect(whineGain).connect(engineGain)
  engineWhine.start()

  const intakeSource = context.createBufferSource()
  const intakeFilter = context.createBiquadFilter()
  const intakeGain = context.createGain()
  intakeSource.buffer = noiseBuffer
  intakeSource.loop = true
  intakeFilter.type = 'bandpass'
  intakeFilter.frequency.value = 800
  intakeFilter.Q.value = 1.1
  intakeGain.gain.value = 0
  intakeSource.connect(intakeFilter).connect(intakeGain).connect(master)
  intakeSource.start()

  const tireSource = context.createBufferSource()
  const tireFilter = context.createBiquadFilter()
  const tireGain = context.createGain()
  tireSource.buffer = noiseBuffer
  tireSource.loop = true
  tireFilter.type = 'bandpass'
  tireFilter.frequency.value = 1550
  tireFilter.Q.value = 4.5
  tireGain.gain.value = 0
  tireSource.connect(tireFilter).connect(tireGain).connect(master)
  tireSource.start()

  const sirenPanner = context.createStereoPanner()
  const sirenBus = context.createGain()
  sirenBus.gain.value = 0.055
  sirenBus.connect(sirenPanner).connect(master)

  const sirenA = context.createOscillator()
  const sirenGainA = context.createGain()
  sirenA.type = 'sine'
  sirenA.frequency.value = 690
  sirenGainA.gain.value = 0
  sirenA.connect(sirenGainA).connect(sirenBus)
  sirenA.start()

  const sirenB = context.createOscillator()
  const sirenGainB = context.createGain()
  sirenB.type = 'sine'
  sirenB.frequency.value = 930
  sirenGainB.gain.value = 0
  sirenB.connect(sirenGainB).connect(sirenBus)
  sirenB.start()

  return {
    context,
    master,
    engineGain,
    engineFilter,
    engineLow,
    engineHigh,
    engineWhine,
    intakeGain,
    intakeFilter,
    tireGain,
    sirenGainA,
    sirenGainB,
    sirenA,
    sirenB,
    sirenPanner,
    noiseBuffer,
  }
}

export function unlockGameAudio() {
  if (!rig) rig = createRig()
  if (rig.context.state === 'suspended') void rig.context.resume()
}

export function setGameAudioMuted(value: boolean) {
  muted = value
  if (!rig) return
  rig.master.gain.setTargetAtTime(value ? 0 : 0.22 * masterVolume, rig.context.currentTime, 0.04)
}

export function setGameAudioLevels(levels: { master: number; engine: number; effects: number }) {
  masterVolume = Math.max(0, Math.min(1, levels.master))
  engineVolume = Math.max(0, Math.min(1, levels.engine))
  effectsVolume = Math.max(0, Math.min(1, levels.effects))
  if (rig) rig.master.gain.setTargetAtTime(muted ? 0 : 0.22 * masterVolume, rig.context.currentTime, 0.04)
}

function playNoiseBurst(volume: number, duration: number, frequency: number) {
  if (!rig || muted) return
  const { context, master, noiseBuffer } = rig
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  source.buffer = noiseBuffer
  filter.type = 'lowpass'
  filter.frequency.value = frequency
  gain.gain.setValueAtTime(volume * effectsVolume, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration)
  source.connect(filter).connect(gain).connect(master)
  source.start()
  source.stop(context.currentTime + duration)
}

function playImpact(strength: number) {
  if (!rig || muted) return
  const { context, master } = rig
  playNoiseBurst(0.18 + strength * 0.28, 0.2 + strength * 0.18, 950)
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'triangle'
  oscillator.frequency.setValueAtTime(105 - strength * 32, context.currentTime)
  oscillator.frequency.exponentialRampToValueAtTime(42, context.currentTime + 0.18)
  gain.gain.setValueAtTime((0.16 + strength * 0.16) * effectsVolume, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22)
  oscillator.connect(gain).connect(master)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.24)
}

function playShiftPop(intensity: number) {
  if (!rig || muted) return
  playNoiseBurst(0.035 + intensity * 0.04, 0.075, 2600)
}

export function updateGameAudio(
  telemetry: CarTelemetry,
  pursuit: PursuitState,
  police: PoliceTelemetry,
  playing: boolean,
) {
  if (!rig) return
  const { context } = rig
  const now = context.currentTime
  const audible = playing && !muted
  rig.master.gain.setTargetAtTime(audible ? 0.22 * masterVolume : 0, now, 0.08)

  const rpm = Math.max(0.08, telemetry.rpm)
  const baseFrequency = 65 + rpm * 155
  rig.engineLow.frequency.setTargetAtTime(baseFrequency, now, 0.035)
  rig.engineHigh.frequency.setTargetAtTime(baseFrequency * 2.18, now, 0.035)
  rig.engineWhine.frequency.setTargetAtTime(baseFrequency * 3.45, now, 0.04)
  rig.engineFilter.frequency.setTargetAtTime(1050 + rpm * 4200, now, 0.055)
  rig.intakeFilter.frequency.setTargetAtTime(620 + rpm * 1650, now, 0.06)
  rig.intakeGain.gain.setTargetAtTime(audible ? (0.004 + rpm * 0.025) * engineVolume : 0, now, 0.08)
  const load = telemetry.speedKmh > 2 ? 0.052 + rpm * 0.11 : 0.042
  rig.engineGain.gain.setTargetAtTime(audible ? load * engineVolume : 0, now, 0.055)

  const tireActive = telemetry.drifting || telemetry.braking
  const tireVolume = tireActive ? Math.min(0.18, 0.035 + telemetry.tireSlip * 0.13 + (telemetry.braking ? 0.045 : 0)) : 0
  rig.tireGain.gain.setTargetAtTime(audible ? tireVolume * effectsVolume : 0, now, 0.035)

  const pursuitActive = pursuit.phase === 'pursuit' || pursuit.phase === 'cooldown' || pursuit.phase === 'busted'
  const sirenDistance = Number.isFinite(police.nearestDistance) ? police.nearestDistance : 220
  const sirenVolume = pursuitActive && audible ? Math.max(0, Math.min(1, 1 - sirenDistance / 180)) * effectsVolume : 0
  const sirenSwitch = Math.floor(performance.now() / 480) % 2 === 0
  rig.sirenGainA.gain.setTargetAtTime(sirenSwitch ? sirenVolume : sirenVolume * 0.08, now, 0.045)
  rig.sirenGainB.gain.setTargetAtTime(sirenSwitch ? sirenVolume * 0.08 : sirenVolume, now, 0.045)

  const nearestUnit = police.unitPositions.reduce<{ position: [number, number] | null; distance: number }>((nearest, position) => {
    const distance = Math.hypot(position[0] - telemetry.position[0], position[1] - telemetry.position[1])
    return distance < nearest.distance ? { position, distance } : nearest
  }, { position: null, distance: Number.POSITIVE_INFINITY })
  if (nearestUnit.position) {
    const bearing = Math.atan2(nearestUnit.position[0] - telemetry.position[0], nearestUnit.position[1] - telemetry.position[1])
    rig.sirenPanner.pan.setTargetAtTime(Math.sin(bearing - telemetry.heading) * 0.8, now, 0.08)
  }

  const wallClock = performance.now()
  if (telemetry.impact > 0.22 && previousImpact <= 0.22 && wallClock - lastImpactAt > 180) {
    lastImpactAt = wallClock
    playImpact(telemetry.impact)
  }
  if (telemetry.shiftKick > 0.55 && previousShiftKick <= 0.55 && wallClock - lastShiftAt > 140) {
    lastShiftAt = wallClock
    playShiftPop(telemetry.shiftKick)
  }
  previousImpact = telemetry.impact
  previousShiftKick = telemetry.shiftKick
}
