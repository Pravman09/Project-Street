export interface ServerRaceRoute {
  id: string
  name: string
  checkpoints: Array<{ x: number; z: number }>
}

export const SERVER_RACE_ROUTES: Record<string, ServerRaceRoute> = {
  'downtown-loop': {
    id: 'downtown-loop',
    name: 'Downtown Loop',
    checkpoints: [
      { x: -40, z: 10 }, { x: 45, z: 10 }, { x: 130, z: 10 },
      { x: 130, z: 92 }, { x: 45, z: 92 }, { x: -40, z: 92 },
      { x: -130, z: 92 }, { x: -130, z: 10 }, { x: -40, z: 10 },
    ],
  },
  'meridian-dash': {
    id: 'meridian-dash',
    name: 'Meridian Dash',
    checkpoints: [
      { x: -242, z: -159 }, { x: -174, z: -85 }, { x: -106, z: -10 },
      { x: -38, z: 64 }, { x: 30, z: 138 }, { x: 98, z: 213 }, { x: 150, z: 270 },
    ],
  },
  'metro-grand-tour': {
    id: 'metro-grand-tour',
    name: 'Metro Grand Tour',
    checkpoints: [
      { x: 130, z: -145 }, { x: 45, z: -145 }, { x: -40, z: -145 },
      { x: -130, z: -145 }, { x: -210, z: -145 }, { x: -210, z: -72 },
      { x: -210, z: 10 }, { x: -210, z: 92 }, { x: -130, z: 92 },
      { x: -40, z: 92 }, { x: 45, z: 92 }, { x: 130, z: 92 },
      { x: 220, z: 92 }, { x: 220, z: 10 }, { x: 220, z: -72 }, { x: 220, z: -145 },
    ],
  },
}

export const CHECKPOINT_RADIUS = 17

