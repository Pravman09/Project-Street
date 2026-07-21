import { MathUtils, Vector3 } from 'three'
import type { DriveInput } from './useKeyboard'
import { BUILDINGS, FLYOVER_BARRIERS, UNDERPASS_BARRIERS, WORLD_BOUNDS, getPlayerRoadElevation, isOnRoad } from './worldLayout'
import type { CarPerformance } from './carCatalog'
import { getDynamicVehicles } from './dynamicVehicles'
import { breakDestructible, getDestructibles } from './destructibleObjects'

const SPAWN_X = -40
const SPAWN_Z = -72
const CAR_RADIUS = 1.2
const MANUAL_GEAR_SPEED = [0.28, 0.45, 0.62, 0.77, 0.9, 1] as const
const MANUAL_GEAR_TORQUE = [1.38, 1.2, 1.04, 0.9, 0.78, 0.69] as const

export interface CarTelemetry {
  speedKmh: number
  gear: string
  drifting: boolean
  nitro: number
  nitroActive: boolean
  onRoad: boolean
  position: [number, number]
  heading: number
  rpm: number
  shiftKick: number
  impact: number
  damage: number
  tireSlip: number
  braking: boolean
}

export class ArcadeCarPhysics {
  readonly position = new Vector3(SPAWN_X, 0.08, SPAWN_Z)
  readonly velocity = new Vector3()
  heading = 0
  nitro = 100
  drifting = false
  nitroActive = false
  onRoad = true
  steering = 0
  throttle = 0
  rpm = 0.12
  shiftKick = 0
  impact = 0
  damage = 0
  tireSlip = 0
  braking = false
  private performance: CarPerformance = { topSpeed: 52, acceleration: 22, handling: 0.9 }
  private currentGear = 0
  private manualTransmission = false
  private manualGear = 1
  private shiftCutTimer = 0
  private impactCooldown = 0

  private readonly forward = new Vector3(0, 0, 1)
  private readonly right = new Vector3(1, 0, 0)
  private readonly collisionNormal = new Vector3()
  private readonly obstacleVelocity = new Vector3()

  setPerformance(performance: CarPerformance) {
    this.performance = performance
  }

  setTransmissionMode(manual: boolean) {
    if (manual === this.manualTransmission) return
    this.manualTransmission = manual
    if (manual) {
      this.manualGear = MathUtils.clamp(this.currentGear || 1, 1, 6)
      this.currentGear = this.manualGear
    }
  }

  stop() {
    this.velocity.set(0, 0, 0)
    this.steering = 0
    this.throttle = 0
    this.nitroActive = false
    this.shiftKick = 0
    this.braking = false
    this.shiftCutTimer = 0
  }

  hitSpikeStrip() {
    this.velocity.multiplyScalar(0.46)
    this.damage = Math.min(100, this.damage + 16)
    this.impact = Math.max(this.impact, 0.72)
    this.tireSlip = 1
  }

  reset() {
    this.position.set(SPAWN_X, 0.08, SPAWN_Z)
    this.velocity.set(0, 0, 0)
    this.heading = 0
    this.nitro = 100
    this.drifting = false
    this.nitroActive = false
    this.rpm = 0.12
    this.shiftKick = 0
    this.impact = 0
    this.damage = 0
    this.tireSlip = 0
    this.braking = false
    this.manualGear = 1
    this.currentGear = this.manualTransmission ? 1 : 0
    this.shiftCutTimer = 0
    this.impactCooldown = 0
  }

  update(rawDelta: number, input: DriveInput) {
    const delta = Math.min(rawDelta, 0.04)
    this.shiftKick = Math.max(0, this.shiftKick - delta * 4.8)
    this.impact = Math.max(0, this.impact - delta * 3.4)
    this.shiftCutTimer = Math.max(0, this.shiftCutTimer - delta)
    this.impactCooldown = Math.max(0, this.impactCooldown - delta)

    if (input.reset) {
      this.reset()
      input.reset = false
    }

    if (this.manualTransmission) {
      if (input.shiftUp) this.requestManualGear(this.manualGear + 1)
      if (input.shiftDown) this.requestManualGear(this.manualGear - 1)
    }
    input.shiftUp = false
    input.shiftDown = false

    this.onRoad = isOnRoad(this.position.x, this.position.z)
    const steeringTarget = input.steer
    this.steering = MathUtils.damp(this.steering, steeringTarget, steeringTarget === 0 ? 7.5 : 11, delta)
    this.throttle = input.throttle - input.brake

    this.updateAxes()
    const currentLongitudinal = this.velocity.dot(this.forward)
    const speed = this.velocity.length()
    const speedRatio = MathUtils.clamp(Math.abs(currentLongitudinal) / 34, 0, 1)
    const direction = currentLongitudinal < -0.5 ? -1 : 1
    const handbrake = input.handbrake && speed > 5
    this.braking = (input.backward && currentLongitudinal > 4) || handbrake
    const highSpeedStability = 1 - MathUtils.clamp((speedRatio - 0.72) * 0.42, 0, 0.16)
    const steeringRate = (0.22 + speedRatio * 1.28) * this.performance.handling * highSpeedStability * (handbrake ? 1.55 : 1)

    this.heading += this.steering * steeringRate * direction * delta
    this.updateAxes()

    let longitudinal = this.velocity.dot(this.forward)
    let lateral = this.velocity.dot(this.right)

    if (input.forward) {
      if (longitudinal < -1) {
        longitudinal += 38 * (this.performance.brakePower ?? 1) * input.throttle * delta
      } else {
        const gearSpeed = this.manualTransmission
          ? this.performance.topSpeed * MANUAL_GEAR_SPEED[this.manualGear - 1]
          : this.performance.topSpeed
        const engineFade = 1 - MathUtils.clamp(longitudinal / gearSpeed, 0, this.manualTransmission ? 0.97 : 0.82)
        const damagePower = 1 - this.damage * 0.00125
        const gearTorque = this.manualTransmission ? MANUAL_GEAR_TORQUE[this.manualGear - 1] : 1
        const shiftPower = this.shiftCutTimer > 0 ? 0.12 : 1
        longitudinal += this.performance.acceleration * damagePower * gearTorque * shiftPower * engineFade * input.throttle * delta
      }
    } else if (input.backward) {
      if (longitudinal > 1) {
        longitudinal -= 42 * (this.performance.brakePower ?? 1) * input.brake * delta
      } else {
        const reverseFade = 1 - MathUtils.clamp(Math.abs(longitudinal) / 15, 0, 0.9)
        longitudinal -= 16 * reverseFade * input.brake * delta
      }
    } else {
      const rollingDrag = 0.7 + Math.abs(longitudinal) * 0.018
      longitudinal *= Math.max(0, 1 - rollingDrag * delta)
    }

    this.nitroActive = input.nitro && input.forward && longitudinal > 5 && this.nitro > 0
    if (this.nitroActive) {
      longitudinal += 18 * (this.performance.nitroPower ?? 1) * delta
      this.nitro = Math.max(0, this.nitro - (29 / (this.performance.nitroEfficiency ?? 1)) * delta)
    } else {
      this.nitro = Math.min(100, this.nitro + 5.5 * delta)
    }

    const powerSlide = input.forward && Math.abs(this.steering) > 0.65 && speed > 25
    const loadGrip = MathUtils.lerp(1.05, 0.92, speedRatio)
    const gripUpgrade = this.performance.grip ?? 1
    const grip = (handbrake ? 1.05 : powerSlide ? 3.2 : this.onRoad ? 7.8 : 3.7) * gripUpgrade * loadGrip
    lateral *= Math.exp(-grip * delta)
    this.tireSlip = MathUtils.clamp(Math.abs(lateral) / 9 + (handbrake ? speed / 80 : 0), 0, 1)

    if (handbrake) {
      longitudinal *= Math.max(0, 1 - 0.34 * delta)
    }

    const damageSpeed = 1 - this.damage * 0.0014
    const transmissionSpeed = this.manualTransmission
      ? this.performance.topSpeed * MANUAL_GEAR_SPEED[this.manualGear - 1]
      : this.performance.topSpeed
    const maxForwardSpeed = this.onRoad
      ? transmissionSpeed * damageSpeed + (this.nitroActive ? (this.manualTransmission ? 4.5 : 9) : 0)
      : Math.min(28, this.performance.topSpeed * 0.52)
    longitudinal = MathUtils.clamp(longitudinal, -15, maxForwardSpeed)
    this.velocity.copy(this.forward).multiplyScalar(longitudinal)
    this.velocity.addScaledVector(this.right, lateral)

    if (!this.onRoad) {
      this.velocity.multiplyScalar(Math.max(0, 1 - 0.86 * delta))
    }

    const speedKmh = Math.abs(longitudinal) * 3.6
    const gearSpan = Math.max(26, (this.performance.topSpeed * 3.6) / 6)
    const nextGear = this.manualTransmission
      ? this.manualGear
      : longitudinal > 1 ? Math.min(6, Math.floor(speedKmh / gearSpan) + 1) : 0
    if (!this.manualTransmission && nextGear !== this.currentGear && nextGear > 0 && this.currentGear > 0) {
      this.applyShiftFeedback(nextGear > this.currentGear ? 1 : 0.68)
    }
    this.currentGear = nextGear
    const manualGearMaxKmh = this.performance.topSpeed * MANUAL_GEAR_SPEED[this.manualGear - 1] * 3.6
    const gearFloor = Math.max(0, (nextGear - 1) * gearSpan)
    const gearProgress = this.manualTransmission
      ? MathUtils.clamp(speedKmh / manualGearMaxKmh, 0, 1)
      : nextGear > 0 ? MathUtils.clamp((speedKmh - gearFloor) / gearSpan, 0, 1) : 0
    this.rpm = longitudinal < -1
      ? 0.25 + MathUtils.clamp(Math.abs(longitudinal) / 15, 0, 1) * 0.62
      : nextGear > 0 ? 0.24 + gearProgress * 0.7 + Math.max(0, this.throttle) * 0.04 : 0.12

    this.drifting = speed > 11 && Math.abs(lateral) > (handbrake ? 1.5 : 4.3)
    this.resolveMovement(delta)
  }

  getTelemetry(): CarTelemetry {
    const signedSpeed = this.velocity.dot(this.forward)
    const speedKmh = Math.round(this.velocity.length() * 3.6)
    let gear = 'N'
    if (signedSpeed < -1) gear = 'R'
    else if (this.manualTransmission || speedKmh >= 3) gear = String(Math.max(1, this.currentGear))

    return {
      speedKmh,
      gear,
      drifting: this.drifting,
      nitro: this.nitro,
      nitroActive: this.nitroActive,
      onRoad: this.onRoad,
      position: [this.position.x, this.position.z],
      heading: this.heading,
      rpm: this.rpm,
      shiftKick: this.shiftKick,
      impact: this.impact,
      damage: this.damage,
      tireSlip: this.tireSlip,
      braking: this.braking,
    }
  }

  private updateAxes() {
    this.forward.set(Math.sin(this.heading), 0, Math.cos(this.heading))
    this.right.set(Math.cos(this.heading), 0, -Math.sin(this.heading))
  }

  private requestManualGear(targetGear: number) {
    const nextGear = MathUtils.clamp(targetGear, 1, 6)
    if (nextGear === this.manualGear) return
    const upshift = nextGear > this.manualGear
    if (nextGear < this.manualGear) {
      const targetMaxSpeed = this.performance.topSpeed * MANUAL_GEAR_SPEED[nextGear - 1] * 3.6
      if (this.velocity.length() * 3.6 > targetMaxSpeed * 1.07) return
    }
    this.manualGear = nextGear
    this.currentGear = nextGear
    this.shiftCutTimer = 0.17
    this.applyShiftFeedback(upshift ? 1 : 0.68)
  }

  private applyShiftFeedback(intensity: number) {
    this.shiftKick = intensity
    if (intensity > 0.8) this.velocity.multiplyScalar(0.992)
  }

  private resolveMovement(delta: number) {
    const impactSpeed = this.velocity.length()
    const nextX = this.position.x + this.velocity.x * delta
    if (!this.collides(nextX, this.position.z)) {
      this.position.x = nextX
    } else {
      this.registerImpact(impactSpeed / 32)
      this.velocity.x *= -0.24
      this.velocity.z *= 0.72
    }

    const nextZ = this.position.z + this.velocity.z * delta
    if (!this.collides(this.position.x, nextZ)) {
      this.position.z = nextZ
    } else {
      this.registerImpact(impactSpeed / 32)
      this.velocity.z *= -0.24
      this.velocity.x *= 0.72
    }

    if (this.position.x < WORLD_BOUNDS.minX || this.position.x > WORLD_BOUNDS.maxX) {
      this.position.x = MathUtils.clamp(this.position.x, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX)
      this.registerImpact(impactSpeed / 34)
      this.velocity.x *= -0.3
    }
    if (this.position.z < WORLD_BOUNDS.minZ || this.position.z > WORLD_BOUNDS.maxZ) {
      this.position.z = MathUtils.clamp(this.position.z, WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ)
      this.registerImpact(impactSpeed / 34)
      this.velocity.z *= -0.3
    }

    this.resolveDynamicVehicles()
    this.resolveDestructibles()
    this.position.y = MathUtils.damp(
      this.position.y,
      getPlayerRoadElevation(this.position.x, this.position.z, this.heading, this.position.y),
      12,
      delta,
    )
  }

  private resolveDynamicVehicles() {
    for (const vehicle of getDynamicVehicles()) {
      if (Math.abs(this.position.y - vehicle.y) > 2.4) continue
      const dx = this.position.x - vehicle.x
      const dz = this.position.z - vehicle.z
      const minimumDistance = CAR_RADIUS + vehicle.radius
      const distanceSquared = dx * dx + dz * dz
      if (distanceSquared >= minimumDistance * minimumDistance) continue

      const distance = Math.max(0.001, Math.sqrt(distanceSquared))
      this.collisionNormal.set(dx / distance, 0, dz / distance)
      const overlap = minimumDistance - distance
      this.position.addScaledVector(this.collisionNormal, overlap + 0.03)

      this.obstacleVelocity.set(Math.sin(vehicle.heading) * vehicle.speed, 0, Math.cos(vehicle.heading) * vehicle.speed)
      this.obstacleVelocity.subVectors(this.velocity, this.obstacleVelocity)
      const closingSpeed = this.obstacleVelocity.dot(this.collisionNormal)
      if (closingSpeed < 0) {
        this.velocity.addScaledVector(this.collisionNormal, -closingSpeed * 1.32)
        this.velocity.multiplyScalar(0.86)
      }
      this.registerImpact(Math.abs(closingSpeed) / 28 + 0.18)
    }
  }

  private resolveDestructibles() {
    for (const object of getDestructibles()) {
      if (object.brokenAt > 0 || Math.abs(this.position.y - object.y) > 1.8) continue
      const dx = this.position.x - object.x
      const dz = this.position.z - object.z
      const minimumDistance = CAR_RADIUS + object.radius
      const distanceSquared = dx * dx + dz * dz
      if (distanceSquared >= minimumDistance * minimumDistance) continue

      const speed = this.velocity.length()
      const distance = Math.max(0.001, Math.sqrt(distanceSquared))
      this.collisionNormal.set(dx / distance, 0, dz / distance)
      if (speed >= object.minBreakSpeed) {
        const impulseScale = Math.max(2.5, speed * 0.38)
        breakDestructible(object.id, -this.collisionNormal.x * impulseScale, -this.collisionNormal.z * impulseScale)
        this.velocity.multiplyScalar(object.kind === 'fence' ? 0.89 : 0.95)
        this.registerImpact(object.kind === 'fence' ? 0.24 : 0.17)
        continue
      }

      this.position.addScaledVector(this.collisionNormal, minimumDistance - distance + 0.03)
      this.velocity.addScaledVector(this.collisionNormal, speed * 0.32)
      this.velocity.multiplyScalar(0.72)
      this.registerImpact(0.2)
    }
  }

  private registerImpact(rawStrength: number) {
    const strength = MathUtils.clamp(rawStrength, 0.16, 1)
    this.impact = Math.max(this.impact, strength)
    if (this.impactCooldown > 0 || strength < 0.2) return
    this.damage = Math.min(100, this.damage + strength * 6.5)
    this.impactCooldown = 0.32
  }

  private collides(x: number, z: number) {
    if (BUILDINGS.some((building) =>
      Math.abs(x - building.x) < building.width / 2 + CAR_RADIUS &&
      Math.abs(z - building.z) < building.depth / 2 + CAR_RADIUS,
    )) return true

    const activeBarriers = this.position.y > 1.2
      ? FLYOVER_BARRIERS
      : this.position.y < -0.6 ? UNDERPASS_BARRIERS : []
    return activeBarriers.some((barrier) => {
      const dx = barrier.end[0] - barrier.start[0]
      const dz = barrier.end[1] - barrier.start[1]
      const lengthSquared = dx * dx + dz * dz
      const t = MathUtils.clamp(((x - barrier.start[0]) * dx + (z - barrier.start[1]) * dz) / lengthSquared, 0, 1)
      const nearestX = barrier.start[0] + dx * t
      const nearestZ = barrier.start[1] + dz * t
      return Math.hypot(x - nearestX, z - nearestZ) < CAR_RADIUS + barrier.radius
    })
  }
}
