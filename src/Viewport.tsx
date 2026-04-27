import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import {
  CUBE_EDGE_LABELS,
  CUBE_FACE_LABELS,
  KIND_LABELS,
  SPACE_LABELS,
  formatColor,
  getObjectVertices,
  type AxisLock,
  type CubeEdgeKey,
  type CubeFaceKey,
  type PrimitiveKind,
  type SceneObject,
  type Space,
  type ThreeDEditMode,
  type TwoDTool,
} from './scene'

const Viewport3D = lazy(() => import('./Viewport3D'))

const GRID_STEP = 0.5
const WORLD_HEIGHT = 16
const DEFAULT_ASPECT = 16 / 10
const TWO_D_TOOL_LABELS: Record<TwoDTool, string> = {
  select: 'Select',
  line: 'Line',
  rect: 'Rect',
  circle: 'Circle',
  measure: 'Measure',
}
const THREE_D_EDIT_MODE_LABELS: Record<ThreeDEditMode, string> = {
  object: 'Object',
  edge: 'Edge',
  face: 'Face',
  measure: 'Measure',
}

type ViewportProps = {
  space: Space
  objects: SceneObject[]
  selectedId: string | null
  active2DTool: TwoDTool
  threeDEditMode: ThreeDEditMode
  selectedCubeFace: CubeFaceKey | null
  selectedCubeEdge: CubeEdgeKey | null
  grabMode: boolean
  axisLock: AxisLock
  on2DToolChange: (tool: TwoDTool) => void
  onThreeDEditModeChange: (mode: ThreeDEditMode) => void
  onSelectCubeFace: (faceKey: CubeFaceKey | null) => void
  onSelectCubeEdge: (edgeKey: CubeEdgeKey | null) => void
  onSelect: (id: string | null) => void
  onBeginSceneTransaction: () => void
  onCommitSceneTransaction: () => void
  onCancelSceneTransaction: () => void
  onMoveObject: (
    id: string,
    position: [number, number, number],
    recordHistory?: boolean,
  ) => void
  onUpdateCubeFacePull: (
    faceKey: CubeFaceKey,
    value: number,
    recordHistory?: boolean,
  ) => void
  onUpdateCubeEdgePull: (
    edgeKey: CubeEdgeKey,
    value: number,
    recordHistory?: boolean,
  ) => void
  onCreate2DObject: (
    kind: Extract<PrimitiveKind, 'line' | 'rect' | 'circle'>,
    start: [number, number, number],
    end: [number, number, number],
  ) => void
  onStatusChange?: (status: string) => void
  onUpdateObject: (id: string, changes: Partial<SceneObject>) => void
  lastMeasuredId: string | null
}

type TwoDDrawTool = Extract<TwoDTool, 'line' | 'rect' | 'circle'>

type TwoDInteraction =
  | {
    kind: 'draw'
    tool: TwoDDrawTool
    pointerId: number
    start: [number, number, number]
    current: [number, number, number]
    snap: boolean
  }
  | {
    kind: 'grab'
    pointerId: number
    objectId: string
    startPointer: [number, number, number]
    startPosition: [number, number, number]
  }

function roundTo(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"]'),
  )
}

function snapValue(value: number, step = GRID_STEP) {
  return roundTo(Math.round(value / step) * step)
}

function snapPoint(
  point: [number, number, number],
  enabled: boolean,
): [number, number, number] {
  if (!enabled) {
    return point
  }

  return [snapValue(point[0]), snapValue(point[1]), 0] as [number, number, number]
}

function pointerToWorldPoint(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  worldWidth: number,
  worldHeight: number,
): [number, number, number] {
  if (rect.width <= 0 || rect.height <= 0) {
    return [0, 0, 0] as [number, number, number]
  }

  const x = ((clientX - rect.left) / rect.width - 0.5) * worldWidth
  const y = -(((clientY - rect.top) / rect.height - 0.5) * worldHeight)
  return [roundTo(x), roundTo(y), 0] as [number, number, number]
}

function applyAxisLock2D(
  start: [number, number, number],
  next: [number, number, number],
  axisLock: AxisLock,
) {
  if (axisLock === 'x') {
    return [next[0], start[1], 0] as [number, number, number]
  }

  if (axisLock === 'y') {
    return [start[0], next[1], 0] as [number, number, number]
  }

  return [next[0], next[1], 0] as [number, number, number]
}

function getConstrainedDrawPoint(
  tool: TwoDDrawTool,
  start: [number, number, number],
  rawCurrent: [number, number, number],
  shiftKey: boolean,
  snap: boolean,
): [number, number, number] {
  const current = snapPoint(rawCurrent, snap)

  if (tool === 'line' && shiftKey) {
    const dx = Math.abs(current[0] - start[0])
    const dy = Math.abs(current[1] - start[1])

    if (dx >= dy) {
      return [current[0], start[1], 0] as [number, number, number]
    }

    return [start[0], current[1], 0] as [number, number, number]
  }

  if (tool === 'rect' && shiftKey) {
    const dx = current[0] - start[0]
    const dy = current[1] - start[1]
    const size = Math.max(Math.abs(dx), Math.abs(dy))
    const x = start[0] + Math.sign(dx || 1) * size
    const y = start[1] + Math.sign(dy || 1) * size
    return [roundTo(x), roundTo(y), 0]
  }

  return current
}

function lineMetrics(start: [number, number, number], end: [number, number, number]) {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const length = Math.max(0.15, Math.hypot(dx, dy))
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI
  const center: [number, number, number] = [
    roundTo((start[0] + end[0]) / 2),
    roundTo((start[1] + end[1]) / 2),
    0,
  ]

  return {
    center,
    length: roundTo(length),
    angle: roundTo(angle),
  }
}

function polygonPoints(sides: number, radius: number) {
  const pointCount = Math.max(3, Math.round(sides))
  const points: string[] = []

  for (let index = 0; index < pointCount; index += 1) {
    const angle = (Math.PI * 2 * index) / pointCount - Math.PI / 2
    const x = Math.cos(angle) * radius
    const y = -Math.sin(angle) * radius
    points.push(`${roundTo(x)},${roundTo(y)}`)
  }

  return points.join(' ')
}

function useMeasuredSize<T extends HTMLElement>(ref: RefObject<T | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const node = ref.current
    if (!node) {
      return undefined
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) {
        return
      }

      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })

    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])

  return size
}

export function Viewport({
  space,
  objects,
  selectedId,
  active2DTool,
  threeDEditMode,
  selectedCubeFace,
  selectedCubeEdge,
  grabMode,
  axisLock,
  on2DToolChange,
  onThreeDEditModeChange,
  onSelectCubeFace,
  onSelectCubeEdge,
  onSelect,
  onBeginSceneTransaction,
  onCommitSceneTransaction,
  onCancelSceneTransaction,
  onMoveObject,
  onUpdateCubeFacePull,
  onUpdateCubeEdgePull,
  onCreate2DObject,
  onStatusChange,
  onUpdateObject,
  lastMeasuredId,
}: ViewportProps) {
  const selectedObject =
    objects.find((object) => object.id === selectedId) ?? null
  const modeLabel =
    space === '2d'
      ? active2DTool === 'select'
        ? 'Select'
        : `Draw ${TWO_D_TOOL_LABELS[active2DTool]}`
      : THREE_D_EDIT_MODE_LABELS[threeDEditMode]
  const axisLabel =
    axisLock === null ? 'Free' : `Axis ${axisLock.toUpperCase()}`

  return (
    <section className="panel viewport-shell">
      <div className="viewport-header">
        <div className="viewport-copy">
          <p className="panel-kicker">Viewport</p>
          <h2>{SPACE_LABELS[space]} editor</h2>
          <p>
            {selectedObject
              ? `${selectedObject.name} - ${KIND_LABELS[selectedObject.kind]}`
              : 'No object selected'}
          </p>
        </div>

        <div className="viewport-toolbar">
          {space === '2d'
            ? (['select', 'measure', 'line', 'rect', 'circle'] as const).map((tool) => (
              <button
                key={tool}
                type="button"
                className={active2DTool === tool ? 'toggle-active' : ''}
                onClick={() => on2DToolChange(tool)}
              >
                {TWO_D_TOOL_LABELS[tool]}
              </button>
            ))
            : (['object', 'face', 'edge', 'measure'] as const).map((mode) => {
              const disabled =
                (mode === 'face' || mode === 'edge') &&
                (!selectedObject || (selectedObject.kind !== 'cube' && selectedObject.kind !== 'prism'))

              return (
                <button
                  key={mode}
                  type="button"
                  className={threeDEditMode === mode ? 'toggle-active' : ''}
                  disabled={disabled}
                  onClick={() => onThreeDEditModeChange(mode)}
                >
                  {THREE_D_EDIT_MODE_LABELS[mode]}
                </button>
              )
            })}
        </div>
      </div>

      <div className="viewport-stage">
        {space === '2d' ? (
          <TwoDViewport
            objects={objects}
            selectedId={selectedId}
            active2DTool={active2DTool}
            grabMode={grabMode}
            axisLock={axisLock}
            onSelect={onSelect}
            onBeginSceneTransaction={onBeginSceneTransaction}
            onCommitSceneTransaction={onCommitSceneTransaction}
            onCancelSceneTransaction={onCancelSceneTransaction}
            onMoveObject={onMoveObject}
            onCreate2DObject={onCreate2DObject}
            onStatusChange={onStatusChange}
            lastMeasuredId={lastMeasuredId}
          />
        ) : (
          <Suspense
            fallback={
              <div className="viewport-loading">
                Loading 3D scene...
              </div>
            }
          >
            <Viewport3D
              objects={objects}
              selectedId={selectedId}
              editMode={threeDEditMode}
              selectedFace={selectedCubeFace}
              selectedEdge={selectedCubeEdge}
              grabMode={grabMode}
              axisLock={axisLock}
              onSelect={onSelect}
              onSelectFace={onSelectCubeFace}
              onSelectEdge={onSelectCubeEdge}
              onBeginSceneTransaction={onBeginSceneTransaction}
              onCommitSceneTransaction={onCommitSceneTransaction}
              onCancelSceneTransaction={onCancelSceneTransaction}
              onMoveObject={onMoveObject}
              onUpdateCubeFacePull={onUpdateCubeFacePull}
              onUpdateCubeEdgePull={onUpdateCubeEdgePull}
              onUpdateObject={onUpdateObject}
              onStatusChange={onStatusChange}
              lastMeasuredId={lastMeasuredId}
            />
          </Suspense>
        )}
      </div>

      <div className="viewport-hint">
        <span className="viewport-chip">
          {grabMode ? 'Grab mode on' : 'Select mode'}
        </span>
        <span className="viewport-chip">{modeLabel}</span>
        <span className="viewport-chip">{axisLabel}</span>
        {space === '2d' ? (
          <span className="viewport-chip">Alt disables snap</span>
        ) : (
          <span className="viewport-chip">G moves selected objects</span>
        )}
        {space === '3d' && selectedObject?.kind === 'cube' ? (
          <span className="viewport-chip">
            {selectedCubeFace
              ? CUBE_FACE_LABELS[selectedCubeFace]
              : selectedCubeEdge
                ? CUBE_EDGE_LABELS[selectedCubeEdge]
                : 'Cube edit'}
          </span>
        ) : null}
      </div>
    </section>
  )
}

function TwoDViewport({
  objects,
  selectedId,
  active2DTool,
  grabMode,
  axisLock,
  onSelect,
  onBeginSceneTransaction,
  onCommitSceneTransaction,
  onCancelSceneTransaction,
  onMoveObject,
  onCreate2DObject,
  onStatusChange,
  lastMeasuredId,
}: {
  objects: SceneObject[]
  selectedId: string | null
  active2DTool: TwoDTool
  grabMode: boolean
  axisLock: AxisLock
  onSelect: (id: string | null) => void
  onBeginSceneTransaction: () => void
  onCommitSceneTransaction: () => void
  onCancelSceneTransaction: () => void
  onMoveObject: (
    id: string,
    position: [number, number, number],
    recordHistory?: boolean,
  ) => void
  onCreate2DObject: (
    kind: Extract<PrimitiveKind, 'line' | 'rect' | 'circle'>,
    start: [number, number, number],
    end: [number, number, number],
  ) => void
  onStatusChange?: (status: string) => void
  lastMeasuredId: string | null
}) {
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const size = useMeasuredSize(surfaceRef)
  const [interaction, setInteraction] = useState<TwoDInteraction | null>(null)
  const interactionRef = useRef<TwoDInteraction | null>(null)

  useEffect(() => {
    interactionRef.current = interaction
  }, [interaction])

  const aspect =
    size.width > 0 && size.height > 0 ? size.width / size.height : DEFAULT_ASPECT
  const worldWidth = Math.max(20, roundTo(WORLD_HEIGHT * aspect))
  const halfWidth = worldWidth / 2
  const halfHeight = WORLD_HEIGHT / 2

  const grid = useMemo(() => {
    const vertical: number[] = []
    const horizontal: number[] = []

    for (
      let value = Math.ceil(-halfWidth / GRID_STEP) * GRID_STEP;
      value <= halfWidth + 0.001;
      value += GRID_STEP
    ) {
      vertical.push(roundTo(value))
    }

    for (
      let value = Math.ceil(-halfHeight / GRID_STEP) * GRID_STEP;
      value <= halfHeight + 0.001;
      value += GRID_STEP
    ) {
      horizontal.push(roundTo(value))
    }

    return { vertical, horizontal }
  }, [halfHeight, halfWidth])

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const current = interactionRef.current
      if (!current) {
        return
      }

      const svg = svgRef.current
      if (!svg) {
        return
      }

      if (current.pointerId !== event.pointerId) {
        return
      }

      const rect = svg.getBoundingClientRect()
      const worldPoint = pointerToWorldPoint(
        event.clientX,
        event.clientY,
        rect,
        worldWidth,
        WORLD_HEIGHT,
      )

      if (current.kind === 'draw') {
        const next = getConstrainedDrawPoint(
          current.tool,
          current.start,
          worldPoint,
          event.shiftKey,
          !event.altKey,
        )
        setInteraction({ ...current, current: next })
        return
      }

      const deltaX = worldPoint[0] - current.startPointer[0]
      const deltaY = worldPoint[1] - current.startPointer[1]
      const nextPosition = applyAxisLock2D(
        current.startPosition,
        [
          roundTo(current.startPosition[0] + deltaX),
          roundTo(current.startPosition[1] + deltaY),
          0,
        ],
        axisLock,
      )
      onMoveObject(current.objectId, nextPosition, false)
    }

    const handleUp = (event: PointerEvent) => {
      const current = interactionRef.current
      if (!current || current.pointerId !== event.pointerId) {
        return
      }

      if (current.kind === 'draw') {
        onCreate2DObject(current.tool, current.start, current.current)
      } else {
        onCommitSceneTransaction()
      }

      setInteraction(null)
    }

    const handleCancel = (event: PointerEvent) => {
      const current = interactionRef.current
      if (!current || current.pointerId !== event.pointerId) {
        return
      }

      if (current.kind === 'grab') {
        onCancelSceneTransaction()
      }

      setInteraction(null)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleCancel)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleCancel)
    }
  }, [
    axisLock,
    onCancelSceneTransaction,
    onCommitSceneTransaction,
    onCreate2DObject,
    onMoveObject,
    worldWidth,
  ])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      if (isEditableTarget(event.target)) {
        return
      }

      if (!interactionRef.current) {
        return
      }

      if (interactionRef.current.kind === 'grab') {
        onCancelSceneTransaction()
      }

      setInteraction(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancelSceneTransaction])

  const selectedObject =
    objects.find((object) => object.id === selectedId) ?? null

  const handleStagePointerDown = (event: ReactPointerEvent<SVGRectElement>) => {
    if (event.target !== event.currentTarget) {
      return
    }

    if (!svgRef.current) {
      return
    }

    event.preventDefault()

    const rect = svgRef.current.getBoundingClientRect()
    const worldPoint = pointerToWorldPoint(
      event.clientX,
      event.clientY,
      rect,
      worldWidth,
      WORLD_HEIGHT,
    )

    onSelect(null)

    if (grabMode) {
      return
    }

    if (active2DTool === 'select' || active2DTool === 'measure') {
      return
    }

    const start = snapPoint(worldPoint, !event.altKey)
    setInteraction({
      kind: 'draw',
      tool: active2DTool,
      pointerId: event.pointerId,
      start,
      current: start,
      snap: !event.altKey,
    })
  }

  const beginGrab = (object: SceneObject, event: ReactPointerEvent<SVGGElement>) => {
    if (!svgRef.current) {
      return
    }

    event.stopPropagation()
    event.preventDefault()
    onSelect(object.id)

    if (!grabMode && active2DTool !== 'measure') {
      return
    }

    if (active2DTool === 'measure') {
      onSelect(object.id)
      onStatusChange?.(`Measuring ${object.name}`)
      return
    }

    const rect = svgRef.current.getBoundingClientRect()
    const startPointer = pointerToWorldPoint(
      event.clientX,
      event.clientY,
      rect,
      worldWidth,
      WORLD_HEIGHT,
    )

    onBeginSceneTransaction()
    setInteraction({
      kind: 'grab',
      pointerId: event.pointerId,
      objectId: object.id,
      startPointer,
      startPosition: object.position,
    })
  }

  const draft = interaction?.kind === 'draw' ? interaction : null

  return (
    <div ref={surfaceRef} className="viewport-stage-frame">
      <svg
        ref={svgRef}
        className="viewport-svg"
        viewBox={`${-halfWidth} ${-halfHeight} ${worldWidth} ${WORLD_HEIGHT}`}
        role="img"
        aria-label="2D scene viewport"
      >
        <defs>
          <linearGradient id="viewport-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0c111d" />
            <stop offset="100%" stopColor="#101826" />
          </linearGradient>
        </defs>

        <rect
          x={-halfWidth}
          y={-halfHeight}
          width={worldWidth}
          height={WORLD_HEIGHT}
          fill="url(#viewport-bg)"
          onPointerDown={handleStagePointerDown}
        />

        <g pointerEvents="none">
          {grid.vertical.map((x) => {
            const major = Math.abs((x / 2) - Math.round(x / 2)) < 0.001
            return (
              <line
                key={`grid-x-${x}`}
                x1={x}
                y1={-halfHeight}
                x2={x}
                y2={halfHeight}
                stroke={major ? '#2e3648' : '#1f2636'}
                strokeWidth={major ? 0.05 : 0.03}
                opacity={major ? 0.9 : 0.7}
              />
            )
          })}

          {grid.horizontal.map((y) => {
            const major = Math.abs((y / 2) - Math.round(y / 2)) < 0.001
            return (
              <line
                key={`grid-y-${y}`}
                x1={-halfWidth}
                y1={y}
                x2={halfWidth}
                y2={y}
                stroke={major ? '#2e3648' : '#1f2636'}
                strokeWidth={major ? 0.05 : 0.03}
                opacity={major ? 0.9 : 0.7}
              />
            )
          })}

          <line
            x1={-halfWidth}
            y1={0}
            x2={halfWidth}
            y2={0}
            stroke="#46506a"
            strokeWidth={0.08}
            opacity={0.85}
          />
          <line
            x1={0}
            y1={-halfHeight}
            x2={0}
            y2={halfHeight}
            stroke="#46506a"
            strokeWidth={0.08}
            opacity={0.85}
          />
        </g>

        <g>
          {objects.map((object) => (
            <TwoDObject
              key={object.id}
              object={object}
              selected={selectedObject?.id === object.id}
              onPointerDown={beginGrab}
            />
          ))}
        </g>

        {draft ? (
          <g pointerEvents="none">{renderDraftShape(draft)}</g>
        ) : null}

        {grabMode ? (
          <text
            x={-halfWidth + 0.6}
            y={halfHeight - 0.6}
            fill="#d6d9e5"
            fontSize={0.42}
            opacity={0.72}
          >
            Grab mode is active
          </text>
        ) : null}

        {lastMeasuredId && (
          <g>
            {objects
              .filter((o) => o.id === lastMeasuredId)
              .map((o) => {
                const vertices = getObjectVertices(o)
                return (
                  <g key={`measure-${o.id}`} pointerEvents="none">
                    {vertices.map((vertex, index) => {
                      const lx = vertex[0] * o.scale[0]
                      const ly = vertex[1] * o.scale[1]

                      // Format to 1 decimal
                      const formatCoord = (v: number) => Number(v.toFixed(1))
                      const text = `(${formatCoord(lx)}, ${formatCoord(ly)})`

                      return (
                        <g key={`vertex-${index}`}>
                          <circle cx={o.position[0] + lx} cy={-o.position[1] - ly} r={0.08} fill="#8ab4f8" />
                          <text
                            x={o.position[0] + lx + 0.2}
                            y={-o.position[1] - ly + 0.1}
                            fill="#8ab4f8"
                            fontSize={0.25}
                            fontWeight="bold"
                            style={{
                              textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                            }}
                          >
                            {text}
                          </text>
                        </g>
                      )
                    })}
                  </g>
                )
              })}
          </g>
        )}
      </svg>
    </div>
  )
}

function TwoDObject({
  object,
  selected,
  onPointerDown,
}: {
  object: SceneObject
  selected: boolean
  onPointerDown: (
    object: SceneObject,
    event: ReactPointerEvent<SVGGElement>,
  ) => void
}) {
  const color = formatColor(object.color)
  const strokeColor = selected ? '#ffd39c' : color
  const common = {
    onPointerDown: (event: ReactPointerEvent<SVGGElement>) =>
      onPointerDown(object, event),
  }

  if (object.kind === 'line') {
    const halfLength = object.length / 2
    return (
      <g
        key={object.id}
        transform={`translate(${object.position[0]} ${-object.position[1]}) rotate(${-object.rotation[2]})`}
        opacity={selected ? 1 : 0.96}
        {...common}
      >
        <line
          x1={-halfLength}
          y1={0}
          x2={halfLength}
          y2={0}
          stroke="transparent"
          strokeWidth={Math.max(0.8, object.thickness * 1.8)}
          strokeLinecap="round"
        />
        <line
          x1={-halfLength}
          y1={0}
          x2={halfLength}
          y2={0}
          stroke={strokeColor}
          strokeWidth={Math.max(0.18, object.thickness * 0.14)}
          strokeLinecap="round"
        />
      </g>
    )
  }

  if (object.kind === 'rect') {
    return (
      <g
        key={object.id}
        transform={`translate(${object.position[0]} ${-object.position[1]}) rotate(${-object.rotation[2]})`}
        {...common}
      >
        <rect
          x={-object.width / 2}
          y={-object.height / 2}
          width={object.width}
          height={object.height}
          rx={0.15}
          fill={color}
          fillOpacity={selected ? 0.28 : 0.18}
          stroke={strokeColor}
          strokeWidth={0.12}
        />
      </g>
    )
  }

  if (object.kind === 'circle') {
    return (
      <g
        key={object.id}
        transform={`translate(${object.position[0]} ${-object.position[1]})`}
        {...common}
      >
        <circle
          r={object.radius}
          fill={color}
          fillOpacity={selected ? 0.24 : 0.16}
          stroke={strokeColor}
          strokeWidth={0.12}
        />
      </g>
    )
  }

  if (object.kind === 'polygon') {
    return (
      <g
        key={object.id}
        transform={`translate(${object.position[0]} ${-object.position[1]}) rotate(${-object.rotation[2]})`}
        {...common}
      >
        <polygon
          points={polygonPoints(object.sides, object.radius)}
          fill={color}
          fillOpacity={selected ? 0.24 : 0.16}
          stroke={strokeColor}
          strokeWidth={0.12}
        />
      </g>
    )
  }

  return null
}

function renderDraftShape(interaction: Extract<TwoDInteraction, { kind: 'draw' }>) {
  const start = interaction.start
  const current = interaction.current
  const color = '#ffd39c'

  if (interaction.tool === 'line') {
    const metrics = lineMetrics(start, current)
    return (
      <g
        transform={`translate(${metrics.center[0]} ${-metrics.center[1]}) rotate(${-metrics.angle})`}
      >
        <line
          x1={-metrics.length / 2}
          y1={0}
          x2={metrics.length / 2}
          y2={0}
          stroke={color}
          strokeWidth={0.12}
          strokeDasharray="0.42 0.3"
          strokeLinecap="round"
          fill="none"
          opacity={0.95}
        />
      </g>
    )
  }

  if (interaction.tool === 'rect') {
    const width = Math.max(0.15, Math.abs(current[0] - start[0]))
    const height = Math.max(0.15, Math.abs(current[1] - start[1]))
    const center: [number, number, number] = [
      roundTo((start[0] + current[0]) / 2),
      roundTo((start[1] + current[1]) / 2),
      0,
    ]

    return (
      <g transform={`translate(${center[0]} ${-center[1]})`}>
        <rect
          x={-width / 2}
          y={-height / 2}
          width={width}
          height={height}
          rx={0.15}
          fill="none"
          stroke={color}
          strokeWidth={0.12}
          strokeDasharray="0.42 0.3"
          opacity={0.95}
        />
      </g>
    )
  }

  if (interaction.tool === 'circle') {
    // Match final object behavior: start is center, distance is radius
    const radius = Math.max(
      0.15,
      Math.hypot(interaction.current[0] - interaction.start[0], interaction.current[1] - interaction.start[1]),
    )

    return (
      <g transform={`translate(${interaction.start[0]} ${-interaction.start[1]})`}>
        <circle
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={0.12}
          strokeDasharray="0.42 0.3"
          opacity={0.95}
        />
        {/* Center point indicator */}
        <circle r={0.08} fill={color} opacity={0.6} />
      </g>
    )
  }

  return null
}
