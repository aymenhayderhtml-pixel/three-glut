export type Space = '2d' | '3d'
import { PrismMesh } from './types/prism.types';

export type PrimitiveKind =
  | 'line'
  | 'rect'
  | 'circle'
  | 'polygon'
  | 'cube'
  | 'sphere'
  | 'cone'
  | 'torus'
  | 'teapot'
  | 'ground'
  | 'prism'

export type TwoDDrawKind = 'line' | 'rect' | 'circle'

export type TwoDTool = 'select' | 'move' | 'scale' | 'measure' | TwoDDrawKind

export type ThreeDEditMode = 'object' | 'edge' | 'face' | 'measure'
export type TransformMode = 'translate' | 'rotate' | 'scale'

export type AxisLock = 'x' | 'y' | 'z' | null

export type CubeFaceKey = 'xNeg' | 'xPos' | 'yNeg' | 'yPos' | 'zNeg' | 'zPos'

export type CubeEdgeKey =
  | 'xPos-yPos'
  | 'xPos-yNeg'
  | 'xNeg-yPos'
  | 'xNeg-yNeg'
  | 'xPos-zPos'
  | 'xPos-zNeg'
  | 'xNeg-zPos'
  | 'xNeg-zNeg'
  | 'yPos-zPos'
  | 'yPos-zNeg'
  | 'yNeg-zPos'
  | 'yNeg-zNeg'

export interface CubeExtents {
  xNeg: number
  xPos: number
  yNeg: number
  yPos: number
  zNeg: number
  zPos: number
}

export interface HoleData {
  id: string
  position: [number, number, number]
  radius: number
  axis: 'x' | 'y' | 'z'
}

export interface SceneObject {
  id: string
  name: string
  kind: PrimitiveKind
  space: Space
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  color: [number, number, number]
  length: number
  width: number
  height: number
  radius: number
  thickness: number
  sides: number
  segments: number
  innerRadius: number
  outerRadius: number
  size: number
  depth: number
  facePulls: Partial<Record<CubeFaceKey, number>>
  edgePulls: Partial<Record<CubeEdgeKey, number>>
  holes: HoleData[]
  prismMesh?: PrismMesh;      // custom mesh after editing
  prismParams?: {             // parameters for regeneration
    sides: number;
    radius: number;
    height: number;
  };
}

export interface SceneDocument {
  version: 1
  activeSpace: Space
  scenes: Record<Space, SceneObject[]>
}

export const SPACE_LABELS: Record<Space, string> = {
  '2d': '2D',
  '3d': '3D',
}

export const SPACE_KINDS = {
  '2d': ['line', 'rect', 'circle', 'polygon'] as const,
  '3d': ['cube', 'sphere', 'cone', 'torus', 'teapot', 'ground', 'prism'] as const,
} satisfies Record<Space, readonly PrimitiveKind[]>

export const KIND_LABELS: Record<PrimitiveKind, string> = {
  line: 'Line',
  rect: 'Rectangle',
  circle: 'Circle',
  polygon: 'Polygon',
  cube: 'Cube',
  sphere: 'Sphere',
  cone: 'Cone',
  torus: 'Torus',
  teapot: 'Teapot',
  ground: 'Ground',
  prism: 'Prism',
}

export const CUBE_FACE_KEYS: CubeFaceKey[] = [
  'xNeg',
  'xPos',
  'yNeg',
  'yPos',
  'zNeg',
  'zPos',
]

export const CUBE_EDGE_KEYS: CubeEdgeKey[] = [
  'xPos-yPos',
  'xPos-yNeg',
  'xNeg-yPos',
  'xNeg-yNeg',
  'xPos-zPos',
  'xPos-zNeg',
  'xNeg-zPos',
  'xNeg-zNeg',
  'yPos-zPos',
  'yPos-zNeg',
  'yNeg-zPos',
  'yNeg-zNeg',
]

export const CUBE_EDGE_TO_FACES: Record<CubeEdgeKey, [CubeFaceKey, CubeFaceKey]> = {
  'xPos-yPos': ['xPos', 'yPos'],
  'xPos-yNeg': ['xPos', 'yNeg'],
  'xNeg-yPos': ['xNeg', 'yPos'],
  'xNeg-yNeg': ['xNeg', 'yNeg'],
  'xPos-zPos': ['xPos', 'zPos'],
  'xPos-zNeg': ['xPos', 'zNeg'],
  'xNeg-zPos': ['xNeg', 'zPos'],
  'xNeg-zNeg': ['xNeg', 'zNeg'],
  'yPos-zPos': ['yPos', 'zPos'],
  'yPos-zNeg': ['yPos', 'zNeg'],
  'yNeg-zPos': ['yNeg', 'zPos'],
  'yNeg-zNeg': ['yNeg', 'zNeg'],
}

export const CUBE_FACE_LABELS: Record<CubeFaceKey, string> = {
  xNeg: 'Left face',
  xPos: 'Right face',
  yNeg: 'Bottom face',
  yPos: 'Top face',
  zNeg: 'Back face',
  zPos: 'Front face',
}

export const CUBE_EDGE_LABELS: Record<CubeEdgeKey, string> = {
  'xPos-yPos': 'Top-right edge',
  'xPos-yNeg': 'Bottom-right edge',
  'xNeg-yPos': 'Top-left edge',
  'xNeg-yNeg': 'Bottom-left edge',
  'xPos-zPos': 'Front-right edge',
  'xPos-zNeg': 'Back-right edge',
  'xNeg-zPos': 'Front-left edge',
  'xNeg-zNeg': 'Back-left edge',
  'yPos-zPos': 'Front-top edge',
  'yPos-zNeg': 'Back-top edge',
  'yNeg-zPos': 'Front-bottom edge',
  'yNeg-zNeg': 'Back-bottom edge',
}

const DEFAULT_COLORS: Record<PrimitiveKind, [number, number, number]> = {
  line: [0.98, 0.56, 0.18],
  rect: [0.47, 0.67, 1.0],
  circle: [0.95, 0.35, 0.62],
  polygon: [0.43, 0.86, 0.62],
  cube: [0.95, 0.68, 0.28],
  sphere: [0.58, 0.74, 1.0],
  cone: [0.97, 0.43, 0.35],
  torus: [0.66, 0.52, 1.0],
  teapot: [0.52, 0.91, 0.83],
  ground: [0.45, 0.42, 0.38],
  prism: [0.85, 0.55, 0.95],
}

const VALID_KINDS = new Set<PrimitiveKind>([
  'line',
  'rect',
  'circle',
  'polygon',
  'cube',
  'sphere',
  'cone',
  'torus',
  'teapot',
  'ground',
  'prism',
])

const STORAGE_KEY = 'three-glut-scene-document'

function makeId() {
  return globalThis.crypto.randomUUID()
}

function round(value: number) {
  return Number(value.toFixed(2))
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isSpace(value: unknown): value is Space {
  return value === '2d' || value === '3d'
}

function isKind(value: unknown): value is PrimitiveKind {
  return typeof value === 'string' && VALID_KINDS.has(value as PrimitiveKind)
}

function clamp(value: number, min: number) {
  return value < min ? min : value
}

function sanitizeVector(
  value: unknown,
  fallback: [number, number, number],
): [number, number, number] {
  if (!Array.isArray(value) || value.length < 3) {
    return fallback
  }

  return [
    isFiniteNumber(value[0]) ? value[0] : fallback[0],
    isFiniteNumber(value[1]) ? value[1] : fallback[1],
    isFiniteNumber(value[2]) ? value[2] : fallback[2],
  ]
}

function sanitizeColor(
  value: unknown,
  fallback: [number, number, number],
): [number, number, number] {
  const [r, g, b] = sanitizeVector(value, fallback)
  return [
    Math.max(0, Math.min(1, r)),
    Math.max(0, Math.min(1, g)),
    Math.max(0, Math.min(1, b)),
  ]
}

function sanitizePullMap<Key extends string>(
  value: unknown,
  keys: Key[],
): Partial<Record<Key, number>> {
  if (typeof value !== 'object' || value === null) {
    return {}
  }

  const raw = value as Record<string, unknown>
  const result: Partial<Record<Key, number>> = {}

  for (const key of keys) {
    const current = raw[key]
    if (isFiniteNumber(current)) {
      result[key] = Number(current.toFixed(2))
    }
  }

  return result
}

function defaultName(kind: PrimitiveKind, index: number) {
  return `${KIND_LABELS[kind]} ${index + 1}`
}

function baseSceneObject(kind: PrimitiveKind, index: number): SceneObject {
  const is2D = SPACE_KINDS['2d'].includes(kind as (typeof SPACE_KINDS)['2d'][number])

  return {
    id: makeId(),
    name: defaultName(kind, index),
    kind,
    space: is2D ? '2d' : '3d',
    position: is2D
      ? ([round(index * 1.5 - 1.5), round(index % 2 === 0 ? 0.4 : -0.2), 0] as [
          number,
          number,
          number,
        ])
      : ([round(index * 1.4 - 1.4), round(index % 2 === 0 ? 0.3 : -0.35), round(index * 0.35)] as [
          number,
          number,
          number,
        ]),
    rotation: is2D
      ? ([0, 0, round(index * 10)] as [number, number, number])
      : ([0, 0, 0] as [number, number, number]),
    scale: [1, 1, 1] as [number, number, number],
    color: DEFAULT_COLORS[kind],
    length: 3.2,
    width: 2.1,
    height: 1.4,
    radius: 1.1,
    thickness: 3,
    sides: 5,
    segments: 24,
    innerRadius: 0.35,
    outerRadius: 1.0,
    size: 1.1,
    depth: 1.0,
    facePulls: {},
    edgePulls: {},
    holes: [],
  }
}

export function createSceneObject(kind: PrimitiveKind, index: number): SceneObject {
  const object = baseSceneObject(kind, index)

  switch (kind) {
    case 'line':
      return {
        ...object,
        length: 3.6,
        thickness: 4,
      }
    case 'rect':
      return {
        ...object,
        width: 2.4,
        height: 1.5,
      }
    case 'circle':
      return {
        ...object,
        radius: 1.15,
        segments: 40,
      }
    case 'polygon':
      return {
        ...object,
        radius: 1.2,
        sides: 6,
      }
    case 'cube':
      return {
        ...object,
        size: 1.15,
        scale: [1.2, 1.0, 0.9] as [number, number, number],
      }
    case 'sphere':
      return {
        ...object,
        radius: 0.95,
        segments: 28,
        scale: [1, 1, 1] as [number, number, number],
      }
    case 'cone':
      return {
        ...object,
        radius: 0.8,
        height: 1.7,
        segments: 28,
      }
    case 'torus':
      return {
        ...object,
        innerRadius: 0.28,
        outerRadius: 1.0,
        sides: 24,
        segments: 18,
      }
    case 'teapot':
      return {
        ...object,
        size: 0.95,
        segments: 10,
      }
    case 'ground':
      return {
        ...object,
        width: 8,
        height: 0.1,
        depth: 8,
        position: [0, -2.3, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
      }
    case 'prism':
      return {
        ...object,
        radius: 0.9,
        height: 1.6,
        sides: 3,
        segments: 1,
        prismParams: {
          sides: 3,
          radius: 0.9,
          height: 1.6,
        },
      }
  }
}

export function cloneSceneObject(source: SceneObject): SceneObject {
  return {
    ...source,
    id: makeId(),
    name: `${source.name} Copy`,
    position: [
      round(source.position[0] + 0.5),
      round(source.position[1] + 0.35),
      round(source.position[2] + 0.35),
    ] as [number, number, number],
  }
}

export function copySceneObject(source: SceneObject): SceneObject {
  return {
    ...source,
    position: [...source.position] as [number, number, number],
    rotation: [...source.rotation] as [number, number, number],
    scale: [...source.scale] as [number, number, number],
    color: [...source.color] as [number, number, number],
    facePulls: { ...source.facePulls },
    edgePulls: { ...source.edgePulls },
    holes: source.holes.map(h => ({ ...h, position: [...h.position] as [number, number, number] })),
    prismMesh: source.prismMesh ? JSON.parse(JSON.stringify(source.prismMesh)) : undefined,
    prismParams: source.prismParams ? { ...source.prismParams } : undefined,
  }
}

export function copySceneObjects(objects: SceneObject[]) {
  return objects.map(copySceneObject)
}

export function copySceneDocument(document: SceneDocument): SceneDocument {
  return {
    version: document.version,
    activeSpace: document.activeSpace,
    scenes: {
      '2d': copySceneObjects(document.scenes['2d']),
      '3d': copySceneObjects(document.scenes['3d']),
    },
  }
}

function hydrateSceneObject(
  value: unknown,
  space: Space,
  index: number,
): SceneObject {
  const raw = typeof value === 'object' && value !== null ? value : {}
  const rawRecord = raw as Record<string, unknown>
  const fallbackKind = SPACE_KINDS[space][0]
  const kind = isKind(rawRecord.kind) ? rawRecord.kind : fallbackKind
  const base = createSceneObject(kind, index)

  return {
    ...base,
    id:
      typeof rawRecord.id === 'string' && rawRecord.id.length > 0
        ? rawRecord.id
        : base.id,
    name:
      typeof rawRecord.name === 'string' && rawRecord.name.trim().length > 0
        ? rawRecord.name
        : base.name,
    space,
    position: sanitizeVector(rawRecord.position, base.position),
    rotation: sanitizeVector(rawRecord.rotation, base.rotation),
    scale: sanitizeVector(rawRecord.scale, base.scale).map((component) =>
      clamp(component, 0.1),
    ) as [number, number, number],
    color: sanitizeColor(rawRecord.color, base.color),
    length: isFiniteNumber(rawRecord.length) ? clamp(rawRecord.length, 0.1) : base.length,
    width: isFiniteNumber(rawRecord.width) ? clamp(rawRecord.width, 0.1) : base.width,
    height: isFiniteNumber(rawRecord.height) ? clamp(rawRecord.height, 0.1) : base.height,
    radius: isFiniteNumber(rawRecord.radius) ? clamp(rawRecord.radius, 0.1) : base.radius,
    thickness: isFiniteNumber(rawRecord.thickness)
      ? clamp(rawRecord.thickness, 1)
      : base.thickness,
    sides: isFiniteNumber(rawRecord.sides) ? Math.max(3, Math.round(rawRecord.sides)) : base.sides,
    segments: isFiniteNumber(rawRecord.segments)
      ? Math.max(4, Math.round(rawRecord.segments))
      : base.segments,
    innerRadius: isFiniteNumber(rawRecord.innerRadius)
      ? clamp(rawRecord.innerRadius, 0.05)
      : base.innerRadius,
    outerRadius: isFiniteNumber(rawRecord.outerRadius)
      ? clamp(rawRecord.outerRadius, 0.1)
      : base.outerRadius,
    size: isFiniteNumber(rawRecord.size) ? clamp(rawRecord.size, 0.1) : base.size,
    depth: isFiniteNumber(rawRecord.depth) ? clamp(rawRecord.depth, 0.1) : base.depth,
    facePulls: sanitizePullMap(rawRecord.facePulls, CUBE_FACE_KEYS),
    edgePulls: sanitizePullMap(rawRecord.edgePulls, CUBE_EDGE_KEYS),
    holes: Array.isArray(rawRecord.holes) ? rawRecord.holes as HoleData[] : [],
    prismMesh: rawRecord.prismMesh && typeof rawRecord.prismMesh === 'object' 
      ? JSON.parse(JSON.stringify(rawRecord.prismMesh)) as PrismMesh 
      : undefined,
    prismParams: rawRecord.prismParams && typeof rawRecord.prismParams === 'object'
      ? {
          sides: isFiniteNumber((rawRecord.prismParams as any).sides) ? Math.max(3, Math.round((rawRecord.prismParams as any).sides)) : 3,
          radius: isFiniteNumber((rawRecord.prismParams as any).radius) ? Math.max(0.1, (rawRecord.prismParams as any).radius) : 0.9,
          height: isFiniteNumber((rawRecord.prismParams as any).height) ? Math.max(0.1, (rawRecord.prismParams as any).height) : 1.6,
        }
      : undefined,
  }
}

export function computeCubeExtents(object: SceneObject): CubeExtents {
  const half = Math.max(0.15, object.size / 2)
  const extents: CubeExtents = {
    xNeg: half + (object.facePulls.xNeg ?? 0),
    xPos: half + (object.facePulls.xPos ?? 0),
    yNeg: half + (object.facePulls.yNeg ?? 0),
    yPos: half + (object.facePulls.yPos ?? 0),
    zNeg: half + (object.facePulls.zNeg ?? 0),
    zPos: half + (object.facePulls.zPos ?? 0),
  }

  for (const edgeKey of CUBE_EDGE_KEYS) {
    const pull = object.edgePulls[edgeKey] ?? 0
    if (!pull) {
      continue
    }

    const [firstFace, secondFace] = CUBE_EDGE_TO_FACES[edgeKey]
    extents[firstFace] += pull
    extents[secondFace] += pull
  }

  for (const faceKey of CUBE_FACE_KEYS) {
    extents[faceKey] = Math.max(0.15, Number(extents[faceKey].toFixed(2)))
  }

  return extents
}

export function createSceneDocument(
  activeSpace: Space,
  scenes: Record<Space, SceneObject[]>,
): SceneDocument {
  return {
    version: 1,
    activeSpace,
    scenes,
  }
}

export function serializeSceneDocument(document: SceneDocument) {
  return JSON.stringify(document, null, 2)
}

export function parseSceneDocument(json: string): SceneDocument {
  const parsed = JSON.parse(json) as Record<string, unknown>
  const scenesValue =
    typeof parsed.scenes === 'object' && parsed.scenes !== null
      ? (parsed.scenes as Record<string, unknown>)
      : null

  if (!scenesValue) {
    throw new Error('Scene file is missing a scenes object.')
  }

  const scenes: Record<Space, SceneObject[]> = {
    '2d': Array.isArray(scenesValue['2d'])
      ? scenesValue['2d'].map((item, index) => hydrateSceneObject(item, '2d', index))
      : [],
    '3d': Array.isArray(scenesValue['3d'])
      ? scenesValue['3d'].map((item, index) => hydrateSceneObject(item, '3d', index))
      : [],
  }

  return {
    version: 1,
    activeSpace: isSpace(parsed.activeSpace) ? parsed.activeSpace : '2d',
    scenes,
  }
}

export function loadStoredSceneDocument() {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    return parseSceneDocument(raw)
  } catch {
    return null
  }
}

export function storeSceneDocument(document: SceneDocument) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, serializeSceneDocument(document))
}

export function formatColor([r, g, b]: [number, number, number]) {
  return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(
    b * 255,
  )})`
}

export function vec3ToHex([r, g, b]: [number, number, number]) {
  const toByte = (value: number) => {
    const byte = Math.max(0, Math.min(255, Math.round(value * 255)))
    return byte.toString(16).padStart(2, '0')
  }

  return `#${toByte(r)}${toByte(g)}${toByte(b)}`
}

export function hexToVec3(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  const parts = normalized.match(/.{1,2}/g) ?? ['ff', 'ff', 'ff']

  return [
    Number.parseInt(parts[0] ?? 'ff', 16) / 255,
    Number.parseInt(parts[1] ?? 'ff', 16) / 255,
    Number.parseInt(parts[2] ?? 'ff', 16) / 255,
  ]
}

export function getObjectDimensions(object: SceneObject): [number, number, number] {
  switch (object.kind) {
    case 'cube': {
      const extents = computeCubeExtents(object)
      return [
        round(extents.xNeg + extents.xPos),
        round(extents.yNeg + extents.yPos),
        round(extents.zNeg + extents.zPos),
      ]
    }
    case 'sphere':
      return [round(object.radius * 2), round(object.radius * 2), round(object.radius * 2)]
    case 'cone':
      return [round(object.radius * 2), round(object.height), round(object.radius * 2)]
    case 'torus':
      return [round(object.outerRadius * 2), round(object.outerRadius * 2), round(object.innerRadius * 2)]
    case 'teapot':
      return [round(object.size * 2), round(object.size * 1.5), round(object.size * 2)]
    case 'ground':
      return [round(object.width), round(object.height), round(object.depth)]
    case 'prism': {
      const topPull = object.facePulls?.yPos || 0
      const botPull = object.facePulls?.yNeg || 0
      const sidePull = (object.facePulls?.xPos || 0) + (object.facePulls?.xNeg || 0) + (object.facePulls?.zNeg || 0)
      const r = object.radius + sidePull
      const h = object.height + topPull + botPull
      return [round(r * 2), round(h), round(r * 2)]
    }
    case 'rect':
      return [round(object.width), round(object.height), 0]
    case 'line':
      return [round(object.length), 0, 0]
    case 'circle':
    case 'polygon':
      return [round(object.radius * 2), round(object.radius * 2), 0]
    default:
      return [0, 0, 0]
  }
}

export function getObjectVertices(object: SceneObject): [number, number, number][] {
  if (object.kind === 'cube') {
    const extents = computeCubeExtents(object)
    return [
      [-extents.xNeg, -extents.yNeg, -extents.zNeg],
      [extents.xPos, -extents.yNeg, -extents.zNeg],
      [-extents.xNeg, extents.yPos, -extents.zNeg],
      [extents.xPos, extents.yPos, -extents.zNeg],
      [-extents.xNeg, -extents.yNeg, extents.zPos],
      [extents.xPos, -extents.yNeg, extents.zPos],
      [-extents.xNeg, extents.yPos, extents.zPos],
      [extents.xPos, extents.yPos, extents.zPos],
    ]
  }

  // Fallback for other shapes: use the bounding box based on dimensions
  const [w, h, d] = getObjectDimensions(object)
  const hw = w / 2
  const hh = h / 2
  const hd = d / 2

  // For 2D shapes, z is 0
  if (object.space === '2d') {
    return [
      [-hw, -hh, 0],
      [hw, -hh, 0],
      [-hw, hh, 0],
      [hw, hh, 0],
    ]
  }

  return [
    [-hw, -hh, -hd],
    [hw, -hh, -hd],
    [-hw, hh, -hd],
    [hw, hh, -hd],
    [-hw, -hh, hd],
    [hw, -hh, hd],
    [-hw, hh, hd],
    [hw, hh, hd],
  ]
}
