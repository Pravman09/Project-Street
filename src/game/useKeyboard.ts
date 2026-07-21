import { useEffect, useRef } from 'react'
import type { ControlBindings } from './gameSettings'

export interface DriveInput {
  steer: number
  throttle: number
  brake: number
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  handbrake: boolean
  nitro: boolean
  reset: boolean
  shiftUp: boolean
  shiftDown: boolean
}

const EMPTY_INPUT: DriveInput = {
  steer: 0,
  throttle: 0,
  brake: 0,
  forward: false,
  backward: false,
  left: false,
  right: false,
  handbrake: false,
  nitro: false,
  reset: false,
  shiftUp: false,
  shiftDown: false,
}

interface DriveControlOptions {
  bindings: ControlBindings
  controllerSensitivity: number
  controllerDeadzone: number
  onControllerStatus: (connected: boolean) => void
}

function applyDeadzone(value: number, deadzone: number) {
  const magnitude = Math.abs(value)
  if (magnitude <= deadzone) return 0
  return Math.sign(value) * ((magnitude - deadzone) / (1 - deadzone))
}

export function useKeyboard({ bindings, controllerSensitivity, controllerDeadzone, onControllerStatus }: DriveControlOptions) {
  const input = useRef<DriveInput>({ ...EMPTY_INPUT })
  const keyboard = useRef<Record<string, boolean>>({})
  const bindingsRef = useRef(bindings)
  const sensitivityRef = useRef(controllerSensitivity)
  const deadzoneRef = useRef(controllerDeadzone)
  const statusRef = useRef(onControllerStatus)

  bindingsRef.current = bindings
  sensitivityRef.current = controllerSensitivity
  deadzoneRef.current = controllerDeadzone
  statusRef.current = onControllerStatus

  useEffect(() => {
    const setKey = (event: KeyboardEvent, pressed: boolean) => {
      const key = event.key.toLowerCase()
      if (Object.values(bindingsRef.current).includes(key)) {
        event.preventDefault()
      }

      keyboard.current[key] = pressed
      const currentBindings = bindingsRef.current
      if (key === currentBindings.reset && pressed && !event.repeat) input.current.reset = true
      if (key === currentBindings.shiftUp && pressed && !event.repeat) input.current.shiftUp = true
      if (key === currentBindings.shiftDown && pressed && !event.repeat) input.current.shiftDown = true
    }

    const keyDown = (event: KeyboardEvent) => setKey(event, true)
    const keyUp = (event: KeyboardEvent) => setKey(event, false)
    const clearKeys = () => {
      keyboard.current = {}
      Object.assign(input.current, EMPTY_INPUT)
    }
    let animationFrame = 0
    let lastControllerState = false
    let previousShiftUp = false
    let previousShiftDown = false
    let previousReset = false
    const poll = () => {
      const activeBindings = bindingsRef.current
      const pad = navigator.getGamepads?.().find((candidate) => candidate?.connected) ?? null
      const connected = Boolean(pad)
      if (connected !== lastControllerState) {
        lastControllerState = connected
        statusRef.current(connected)
      }

      const keyboardSteer = Number(Boolean(keyboard.current[activeBindings.left])) - Number(Boolean(keyboard.current[activeBindings.right]))
      const stick = pad ? -applyDeadzone(pad.axes[0] ?? 0, deadzoneRef.current) * sensitivityRef.current : 0
      input.current.steer = Math.max(-1, Math.min(1, Math.abs(stick) > Math.abs(keyboardSteer) ? stick : keyboardSteer))
      input.current.throttle = Math.max(Number(Boolean(keyboard.current[activeBindings.forward])), pad?.buttons[7]?.value ?? 0)
      input.current.brake = Math.max(Number(Boolean(keyboard.current[activeBindings.backward])), pad?.buttons[6]?.value ?? 0)
      input.current.forward = input.current.throttle > 0.03
      input.current.backward = input.current.brake > 0.03
      input.current.left = input.current.steer > 0.03
      input.current.right = input.current.steer < -0.03
      input.current.handbrake = Boolean(keyboard.current[activeBindings.handbrake]) || Boolean(pad?.buttons[0]?.pressed)
      input.current.nitro = Boolean(keyboard.current[activeBindings.nitro]) || Boolean(pad?.buttons[5]?.pressed)
      const resetPressed = Boolean(pad?.buttons[10]?.pressed)
      const shiftUpPressed = Boolean(pad?.buttons[3]?.pressed)
      const shiftDownPressed = Boolean(pad?.buttons[2]?.pressed)
      if (resetPressed && !previousReset) input.current.reset = true
      if (shiftUpPressed && !previousShiftUp) input.current.shiftUp = true
      if (shiftDownPressed && !previousShiftDown) input.current.shiftDown = true
      previousReset = resetPressed
      previousShiftUp = shiftUpPressed
      previousShiftDown = shiftDownPressed
      animationFrame = window.requestAnimationFrame(poll)
    }

    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', clearKeys)
    animationFrame = window.requestAnimationFrame(poll)

    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', clearKeys)
      window.cancelAnimationFrame(animationFrame)
      statusRef.current(false)
    }
  }, [])

  return input
}
