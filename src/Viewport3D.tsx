import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Canvas,
  useThree,
  type ThreeEvent,
} from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import {
  Plane,
  Vector2,
  Vector3,
  type Camera,
  type Object3D,
  type Raycaster,
} from 'three'
import { TeapotGeometry } from 'three/examples/jsm/geometries/TeapotGeometry.js'
import {
  CUBE_EDGE_KEYS,
  CUBE_EDGE_TO_FACES,
  computeCubeExtents,
  formatColor,
  type AxisLock,
  type CubeEdgeKey,
  type CubeFaceKey,
  type CubeExtents,
  type SceneObject,
  type ThreeDEditMode,
} from './scene'

type ThreeViewportProps = {
  objects: SceneObject[]
  selectedId: string | null
  editMode: ThreeDEditMode
  selectedFace: CubeFaceKey | null
  selectedEdge: CubeEdgeKey | null
  grabMode: boolean
  axisLock: AxisLock
  onSelect: (id: string | null) => void
  onSelectFace: (faceKey: CubeFaceKey | null) => void
  onSelectEdge: (edgeKey: CubeEdgeKey | null) => void
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
}

type SceneMeshProps = {
  object: SceneObject
  selected: boolean
  editMode: ThreeDEditMode
  selectedFace: CubeFaceKey | null
  selectedEdge: CubeEdgeKey | null
  grabMode: boolean
  axisLock: AxisLock
  onSelect: (id: string | null) => void
  onSelectFace: (faceKey: CubeFaceKey | null) => void
  onSelectEdge: (edgeKey: CubeEdgeKey | null) => void
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
  onDragStateChange: (dragging: boolean) => void
}

type DragState =
  | {
      kind: 'object'
      pointerId: number
      plane: Plane
      startPoint: Vector3
      startPosition: [number, number, number]
    }
  | {
      kind: 'face'
      pointerId: number
      plane: Plane
      startPoint: Vector3
      startClient: { x: number; y: number }
      startLocalPoint: Vector3
      startValue: number
      axis: Vector3
      faceKey: CubeFaceKey
    }
  | {
      kind: 'edge'
      pointerId: number
      plane: Plane
      startPoint: Vector3
      startClient: { x: number; y: number }
      startLocalPoint: Vector3
      startValue: number
      axis: Vector3
      edgeKey: CubeEdgeKey
    }

const teapotGeometry = new TeapotGeometry(1, 12)
const edgeThickness = 0.12
const faceTint = '#9cc8ff'
const activeFaceTint = '#ffd39c'
const edgeTint = '#7fe0ff'
const activeEdgeTint = '#ffcf8f'

const FACE_NORMALS: Record<CubeFaceKey, Vector3> = {
  xNeg: new Vector3(-1, 0, 0),
  xPos: new Vector3(1, 0, 0),
  yNeg: new Vector3(0, -1, 0),
  yPos: new Vector3(0, 1, 0),
  zNeg: new Vector3(0, 0, -1),
  zPos: new Vector3(0, 0, 1),
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"]'),
  )
}

function roundTo(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function createCubeFaceData(extents: CubeExtents) {
  const left = -extents.xNeg
  const right = extents.xPos
  const bottom = -extents.yNeg
  const top = extents.yPos
  const back = -extents.zNeg
  const front = extents.zPos
  const width = right - left
  const height = top - bottom
  const depth = front - back
  const centerX = (left + right) / 2
  const centerY = (bottom + top) / 2
  const centerZ = (back + front) / 2

  return {
    xNeg: {
      position: [left, centerY, centerZ] as [number, number, number],
      rotation: [0, -Math.PI / 2, 0] as [number, number, number],
      size: [depth, height] as [number, number],
    },
    xPos: {
      position: [right, centerY, centerZ] as [number, number, number],
      rotation: [0, Math.PI / 2, 0] as [number, number, number],
      size: [depth, height] as [number, number],
    },
    yNeg: {
      position: [centerX, bottom, centerZ] as [number, number, number],
      rotation: [Math.PI / 2, 0, 0] as [number, number, number],
      size: [width, depth] as [number, number],
    },
    yPos: {
      position: [centerX, top, centerZ] as [number, number, number],
      rotation: [-Math.PI / 2, 0, 0] as [number, number, number],
      size: [width, depth] as [number, number],
    },
    zNeg: {
      position: [centerX, centerY, back] as [number, number, number],
      rotation: [0, Math.PI, 0] as [number, number, number],
      size: [width, height] as [number, number],
    },
    zPos: {
      position: [centerX, centerY, front] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      size: [width, height] as [number, number],
    },
  }
}

function createCubeEdgeData(extents: CubeExtents) {
  const left = -extents.xNeg
  const right = extents.xPos
  const bottom = -extents.yNeg
  const top = extents.yPos
  const back = -extents.zNeg
  const front = extents.zPos
  const width = right - left
  const height = top - bottom
  const depth = front - back
  const centerX = (left + right) / 2
  const centerY = (bottom + top) / 2
  const centerZ = (back + front) / 2

  return {
    'xPos-yPos': {
      position: [right, top, centerZ] as [number, number, number],
      size: [edgeThickness, edgeThickness, depth] as [number, number, number],
    },
    'xPos-yNeg': {
      position: [right, bottom, centerZ] as [number, number, number],
      size: [edgeThickness, edgeThickness, depth] as [number, number, number],
    },
    'xNeg-yPos': {
      position: [left, top, centerZ] as [number, number, number],
      size: [edgeThickness, edgeThickness, depth] as [number, number, number],
    },
    'xNeg-yNeg': {
      position: [left, bottom, centerZ] as [number, number, number],
      size: [edgeThickness, edgeThickness, depth] as [number, number, number],
    },
    'xPos-zPos': {
      position: [right, centerY, front] as [number, number, number],
      size: [edgeThickness, height, edgeThickness] as [number, number, number],
    },
    'xPos-zNeg': {
      position: [right, centerY, back] as [number, number, number],
      size: [edgeThickness, height, edgeThickness] as [number, number, number],
    },
    'xNeg-zPos': {
      position: [left, centerY, front] as [number, number, number],
      size: [edgeThickness, height, edgeThickness] as [number, number, number],
    },
    'xNeg-zNeg': {
      position: [left, centerY, back] as [number, number, number],
      size: [edgeThickness, height, edgeThickness] as [number, number, number],
    },
    'yPos-zPos': {
      position: [centerX, top, front] as [number, number, number],
      size: [width, edgeThickness, edgeThickness] as [number, number, number],
    },
    'yPos-zNeg': {
      position: [centerX, top, back] as [number, number, number],
      size: [width, edgeThickness, edgeThickness] as [number, number, number],
    },
    'yNeg-zPos': {
      position: [centerX, bottom, front] as [number, number, number],
      size: [width, edgeThickness, edgeThickness] as [number, number, number],
    },
    'yNeg-zNeg': {
      position: [centerX, bottom, back] as [number, number, number],
      size: [width, edgeThickness, edgeThickness] as [number, number, number],
    },
  }
}

function getFaceNormal(faceKey: CubeFaceKey) {
  return FACE_NORMALS[faceKey].clone()
}

function getEdgeDirection(edgeKey: CubeEdgeKey) {
  const [firstFace, secondFace] = CUBE_EDGE_TO_FACES[edgeKey]
  return getFaceNormal(firstFace).add(getFaceNormal(secondFace)).normalize()
}

function applyAxisLock(vector: Vector3, axisLock: AxisLock) {
  if (axisLock === 'x') {
    return new Vector3(vector.x, 0, 0)
  }

  if (axisLock === 'y') {
    return new Vector3(0, vector.y, 0)
  }

  if (axisLock === 'z') {
    return new Vector3(0, 0, vector.z)
  }

  return vector.clone()
}

function getPointerVector(
  clientX: number,
  clientY: number,
  element: HTMLElement,
  camera: Camera,
  raycaster: Raycaster,
) {
  const rect = element.getBoundingClientRect()
  const pointer = new Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -(((clientY - rect.top) / rect.height) * 2 - 1),
  )
  raycaster.setFromCamera(pointer, camera)
  return raycaster.ray
}

function intersectPointerPlane(
  clientX: number,
  clientY: number,
  element: HTMLElement,
  camera: Camera,
  raycaster: Raycaster,
  plane: Plane,
) {
  const ray = getPointerVector(clientX, clientY, element, camera, raycaster)
  return ray.intersectPlane(plane, new Vector3())
}

function getWorldDelta(
  group: Object3D,
  startPoint: Vector3,
  currentPoint: Vector3,
) {
  const startLocal = group.worldToLocal(startPoint.clone())
  const currentLocal = group.worldToLocal(currentPoint.clone())
  return currentLocal.sub(startLocal)
}

function CubeEditOverlay({
  object,
  editMode,
  selectedFace,
  selectedEdge,
  grabMode,
  onSelectFace,
  onSelectEdge,
  onStartFaceDrag,
  onStartEdgeDrag,
}: {
  object: SceneObject
  editMode: ThreeDEditMode
  selectedFace: CubeFaceKey | null
  selectedEdge: CubeEdgeKey | null
  grabMode: boolean
  onSelectFace: (faceKey: CubeFaceKey | null) => void
  onSelectEdge: (edgeKey: CubeEdgeKey | null) => void
  onStartFaceDrag: (faceKey: CubeFaceKey, event: ThreeEvent<PointerEvent>) => void
  onStartEdgeDrag: (edgeKey: CubeEdgeKey, event: ThreeEvent<PointerEvent>) => void
}) {
  const extents = computeCubeExtents(object)
  const faces = createCubeFaceData(extents)
  const edges = createCubeEdgeData(extents)

  if (editMode === 'face') {
    return (
      <>
        {(Object.keys(faces) as CubeFaceKey[]).map((faceKey) => {
          const face = faces[faceKey]
          const active = faceKey === selectedFace

          return (
            <mesh
              key={faceKey}
              position={face.position}
              rotation={face.rotation}
              onPointerDown={(event) => {
                event.stopPropagation()
                onSelectFace(faceKey)
                if (grabMode) {
                  onStartFaceDrag(faceKey, event)
                }
              }}
            >
              <planeGeometry args={face.size} />
              <meshBasicMaterial
                color={active ? activeFaceTint : faceTint}
                transparent
                opacity={active ? 0.42 : 0.18}
                side={2}
              />
            </mesh>
          )
        })}
      </>
    )
  }

  if (editMode === 'edge') {
    return (
      <>
        {CUBE_EDGE_KEYS.map((edgeKey) => {
          const edge = edges[edgeKey]
          const active = edgeKey === selectedEdge
          const [firstFace, secondFace] = CUBE_EDGE_TO_FACES[edgeKey]
          const emphasized =
            active || selectedFace === firstFace || selectedFace === secondFace

          return (
            <mesh
              key={edgeKey}
              position={edge.position}
              onPointerDown={(event) => {
                event.stopPropagation()
                onSelectEdge(edgeKey)
                if (grabMode) {
                  onStartEdgeDrag(edgeKey, event)
                }
              }}
            >
              <boxGeometry args={edge.size} />
              <meshBasicMaterial
                color={active ? activeEdgeTint : edgeTint}
                transparent
                opacity={emphasized ? 0.78 : 0.42}
              />
            </mesh>
          )
        })}
      </>
    )
  }

  return null
}

function SceneMesh({
  object,
  selected,
  editMode,
  selectedFace,
  selectedEdge,
  grabMode,
  axisLock,
  onSelect,
  onSelectFace,
  onSelectEdge,
  onBeginSceneTransaction,
  onCommitSceneTransaction,
  onCancelSceneTransaction,
  onMoveObject,
  onUpdateCubeFacePull,
  onUpdateCubeEdgePull,
  onDragStateChange,
}: SceneMeshProps) {
  const { camera, gl, raycaster } = useThree()
  const groupRef = useRef<Object3D | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const dragStateRef = useRef<DragState | null>(null)

  useEffect(() => {
    dragStateRef.current = dragState
  }, [dragState])

  useEffect(() => {
    if (!dragState) {
      return undefined
    }

    const handleMove = (event: PointerEvent) => {
      const current = dragStateRef.current
      if (!current || current.pointerId !== event.pointerId) {
        return
      }

      const element = gl.domElement
      const point = intersectPointerPlane(
        event.clientX,
        event.clientY,
        element,
        camera,
        raycaster,
        current.plane,
      )
      if (!point) {
        return
      }

      if (current.kind === 'object') {
        const delta = applyAxisLock(
          point.clone().sub(current.startPoint),
          axisLock,
        )
        const nextPosition: [number, number, number] = [
          roundTo(current.startPosition[0] + delta.x),
          roundTo(current.startPosition[1] + delta.y),
          roundTo(current.startPosition[2] + delta.z),
        ]
        onMoveObject(object.id, nextPosition, false)
        return
      }

      if (!groupRef.current) {
        return
      }

      const localDelta = getWorldDelta(groupRef.current, current.startPoint, point)
      const constrainedDelta = applyAxisLock(localDelta, axisLock)
      let amount = constrainedDelta.dot(current.axis)

      if (axisLock === null && Math.abs(amount) < 0.001) {
        const cameraRight = new Vector3()
          .setFromMatrixColumn(camera.matrixWorld, 0)
          .normalize()
        const cameraUp = new Vector3()
          .setFromMatrixColumn(camera.matrixWorld, 1)
          .normalize()
        const screenAxisX = current.axis.dot(cameraRight)
        const screenAxisY = current.axis.dot(cameraUp)
        const screenScale = 0.02

        if (Math.hypot(screenAxisX, screenAxisY) > 0.05) {
          amount =
            ((event.clientX - current.startClient.x) * screenAxisX -
              (event.clientY - current.startClient.y) * screenAxisY) *
            screenScale
        } else {
          const cameraForward = camera.getWorldDirection(new Vector3()).normalize()
          const facing = current.axis.dot(cameraForward) >= 0 ? 1 : -1
          amount = (current.startClient.y - event.clientY) * facing * screenScale
        }
      }

      if (current.kind === 'face') {
        const nextValue = roundTo(current.startValue + amount)
        onUpdateCubeFacePull(current.faceKey, nextValue, false)
        return
      }

      const nextValue = roundTo(current.startValue + amount)
      onUpdateCubeEdgePull(current.edgeKey, nextValue, false)
    }

    const handleUp = (event: PointerEvent) => {
      const current = dragStateRef.current
      if (!current || current.pointerId !== event.pointerId) {
        return
      }

      setDragState(null)
      onDragStateChange(false)
      onCommitSceneTransaction()
    }

    const handleCancel = (event: PointerEvent) => {
      const current = dragStateRef.current
      if (!current || current.pointerId !== event.pointerId) {
        return
      }

      setDragState(null)
      onDragStateChange(false)
      onCancelSceneTransaction()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      if (isEditableTarget(event.target)) {
        return
      }

      if (!dragStateRef.current) {
        return
      }

      setDragState(null)
      onDragStateChange(false)
      onCancelSceneTransaction()
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleCancel)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleCancel)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    axisLock,
    camera,
    gl.domElement,
    onCancelSceneTransaction,
    onCommitSceneTransaction,
    onDragStateChange,
    onMoveObject,
    onUpdateCubeEdgePull,
    onUpdateCubeFacePull,
    object.id,
    raycaster,
    dragState,
  ])

  const color = useMemo(() => formatColor(object.color), [object.color])
  const scaleBoost = selected ? 1.08 : 1
  const extents = object.kind === 'cube' ? computeCubeExtents(object) : null
  const cubeSize = extents
    ? [
        extents.xNeg + extents.xPos,
        extents.yNeg + extents.yPos,
        extents.zNeg + extents.zPos,
      ] as [number, number, number]
    : null
  const cubeOffset = extents
    ? [
        (extents.xPos - extents.xNeg) / 2,
        (extents.yPos - extents.yNeg) / 2,
        (extents.zPos - extents.zNeg) / 2,
      ] as [number, number, number]
    : null

  // Compute clipping planes for holes (beta)
  const clippingPlanes = useMemo(() => {
    if (!object.holes || object.holes.length === 0) return undefined
    const planes: Plane[] = []
    for (const hole of object.holes) {
      const normal = new Vector3(
        hole.axis === 'x' ? 1 : 0,
        hole.axis === 'y' ? 1 : 0,
        hole.axis === 'z' ? 1 : 0,
      )
      const pos = new Vector3(...hole.position)
      // Two planes that clip a disc-like region through the object
      planes.push(new Plane(normal.clone(), -pos.dot(normal) - hole.radius))
      planes.push(new Plane(normal.clone().negate(), pos.dot(normal) - hole.radius))
    }
    return planes.length > 0 ? planes : undefined
  }, [object.holes])

  const hasHoles = clippingPlanes !== undefined

  const startObjectDrag = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    event.nativeEvent.preventDefault()
    onSelect(object.id)

    if (!grabMode) {
      return
    }

    const cameraForward = camera.getWorldDirection(new Vector3()).normalize()
    const plane = new Plane().setFromNormalAndCoplanarPoint(
      cameraForward,
      new Vector3(...object.position),
    )
    const startPoint = new Vector3()
    if (!event.ray.intersectPlane(plane, startPoint)) {
      return
    }

    onBeginSceneTransaction()
    onDragStateChange(true)
    setDragState({
      kind: 'object',
      pointerId: event.nativeEvent.pointerId,
      plane,
      startPoint,
      startPosition: object.position,
    })
  }

  const startFaceDrag = (faceKey: CubeFaceKey, event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    event.nativeEvent.preventDefault()
    onSelectFace(faceKey)

    if (!grabMode || !groupRef.current) {
      return
    }

    const cameraForward = camera.getWorldDirection(new Vector3()).normalize()
    const plane = new Plane().setFromNormalAndCoplanarPoint(
      cameraForward,
      event.point.clone(),
    )
    const startPoint = event.point.clone()
    const startLocalPoint = groupRef.current.worldToLocal(startPoint.clone())
    const axis = getFaceNormal(faceKey)
    const startValue = object.facePulls[faceKey] ?? 0

    onBeginSceneTransaction()
    onDragStateChange(true)
    setDragState({
      kind: 'face',
      pointerId: event.nativeEvent.pointerId,
      plane,
      startPoint,
      startClient: {
        x: event.nativeEvent.clientX,
        y: event.nativeEvent.clientY,
      },
      startLocalPoint,
      startValue,
      axis,
      faceKey,
    })
  }

  const startEdgeDrag = (edgeKey: CubeEdgeKey, event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    event.nativeEvent.preventDefault()
    onSelectEdge(edgeKey)

    if (!grabMode || !groupRef.current) {
      return
    }

    const cameraForward = camera.getWorldDirection(new Vector3()).normalize()
    const plane = new Plane().setFromNormalAndCoplanarPoint(
      cameraForward,
      event.point.clone(),
    )
    const startPoint = event.point.clone()
    const startLocalPoint = groupRef.current.worldToLocal(startPoint.clone())
    const axis = getEdgeDirection(edgeKey)
    const startValue = object.edgePulls[edgeKey] ?? 0

    onBeginSceneTransaction()
    onDragStateChange(true)
    setDragState({
      kind: 'edge',
      pointerId: event.nativeEvent.pointerId,
      plane,
      startPoint,
      startClient: {
        x: event.nativeEvent.clientX,
        y: event.nativeEvent.clientY,
      },
      startLocalPoint,
      startValue,
      axis,
      edgeKey,
    })
  }

  return (
    <group
      ref={groupRef}
      position={object.position}
      rotation={[
        (object.rotation[0] * Math.PI) / 180,
        (object.rotation[1] * Math.PI) / 180,
        (object.rotation[2] * Math.PI) / 180,
      ]}
      scale={[
        object.scale[0] * scaleBoost,
        object.scale[1] * scaleBoost,
        object.scale[2] * scaleBoost,
      ]}
      onPointerDown={startObjectDrag}
    >
      {object.kind === 'cube' && cubeSize && cubeOffset && (
        <mesh position={cubeOffset}>
          <boxGeometry args={cubeSize} />
          <meshStandardMaterial
            color={color}
            roughness={0.55}
            metalness={0.12}
            emissive={selected ? '#ffe4b5' : '#000000'}
            emissiveIntensity={selected ? 0.28 : 0}
            clippingPlanes={clippingPlanes}
            clipShadows={hasHoles}
          />
        </mesh>
      )}

      {/* Hole indicator rings */}
      {object.holes && object.holes.map((hole) => {
        const rot: [number, number, number] =
          hole.axis === 'x' ? [0, 0, Math.PI / 2] :
          hole.axis === 'z' ? [Math.PI / 2, 0, 0] :
          [0, 0, 0]
        return (
          <mesh key={hole.id} position={hole.position} rotation={rot}>
            <torusGeometry args={[hole.radius, 0.02, 8, 32]} />
            <meshBasicMaterial color="#ff6644" transparent opacity={0.7} />
          </mesh>
        )
      })}

      {object.kind === 'sphere' && (
        <mesh>
          <sphereGeometry
            args={[
              object.radius,
              Math.max(8, Math.round(object.segments)),
              Math.max(8, Math.round(object.segments * 0.75)),
            ]}
          />
          <meshStandardMaterial
            color={color}
            roughness={0.35}
            metalness={0.18}
            emissive={selected ? '#ffe4b5' : '#000000'}
            emissiveIntensity={selected ? 0.35 : 0}
          />
        </mesh>
      )}

      {object.kind === 'cone' && (
        <mesh>
          <coneGeometry
            args={[
              object.radius,
              object.height,
              Math.max(8, Math.round(object.segments)),
            ]}
          />
          <meshStandardMaterial
            color={color}
            roughness={0.4}
            metalness={0.1}
            emissive={selected ? '#ffe4b5' : '#000000'}
            emissiveIntensity={selected ? 0.35 : 0}
          />
        </mesh>
      )}

      {object.kind === 'torus' && (
        <mesh>
          <torusGeometry
            args={[
              object.outerRadius,
              object.innerRadius,
              Math.max(8, Math.round(object.sides)),
              Math.max(8, Math.round(object.segments)),
            ]}
          />
          <meshStandardMaterial
            color={color}
            roughness={0.45}
            metalness={0.22}
            emissive={selected ? '#ffe4b5' : '#000000'}
            emissiveIntensity={selected ? 0.35 : 0}
          />
        </mesh>
      )}

      {object.kind === 'teapot' && (
        <mesh geometry={teapotGeometry}>
          <meshStandardMaterial
            color={color}
            roughness={0.42}
            metalness={0.14}
            emissive={selected ? '#ffe4b5' : '#000000'}
            emissiveIntensity={selected ? 0.35 : 0}
          />
        </mesh>
      )}

      {object.kind === 'ground' && (
        <mesh>
          <boxGeometry args={[object.width, object.height, object.depth]} />
          <meshStandardMaterial
            color={color}
            roughness={0.85}
            metalness={0.05}
            emissive={selected ? '#ffe4b5' : '#000000'}
            emissiveIntensity={selected ? 0.2 : 0}
          />
        </mesh>
      )}

      {object.kind === 'prism' && (
        <mesh>
          <cylinderGeometry
            args={[
              object.radius,
              object.radius,
              object.height,
              3,
              1,
            ]}
          />
          <meshStandardMaterial
            color={color}
            roughness={0.45}
            metalness={0.15}
            emissive={selected ? '#ffe4b5' : '#000000'}
            emissiveIntensity={selected ? 0.35 : 0}
          />
        </mesh>
      )}

      {selected && object.kind === 'cube' && editMode !== 'object' && (
        <CubeEditOverlay
          object={object}
          editMode={editMode}
          selectedFace={selectedFace}
          selectedEdge={selectedEdge}
          grabMode={grabMode}
          onSelectFace={onSelectFace}
          onSelectEdge={onSelectEdge}
          onStartFaceDrag={startFaceDrag}
          onStartEdgeDrag={startEdgeDrag}
        />
      )}
    </group>
  )
}

export default function Viewport3D({
  objects,
  selectedId,
  editMode,
  selectedFace,
  selectedEdge,
  grabMode,
  axisLock,
  onSelect,
  onSelectFace,
  onSelectEdge,
  onBeginSceneTransaction,
  onCommitSceneTransaction,
  onCancelSceneTransaction,
  onMoveObject,
  onUpdateCubeFacePull,
  onUpdateCubeEdgePull,
}: ThreeViewportProps) {
  const [isDragging, setIsDragging] = useState(false)

  return (
    <Canvas
      camera={{ position: [0, 1.6, 8], fov: 45 }}
      dpr={[1, 1.5]}
      shadows={false}
      gl={{ localClippingEnabled: true }}
      onPointerMissed={() => {
        onSelect(null)
        onSelectFace(null)
        onSelectEdge(null)
      }}
    >
      <color attach="background" args={['#10121a']} />
      <fog attach="fog" args={['#10121a', 12, 24]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 6, 5]} intensity={1.5} />
      <directionalLight position={[-4, -2, -3]} intensity={0.45} />
      <pointLight position={[0, 3, 0]} intensity={0.35} color="#9cc8ff" />
      <axesHelper args={[3.8]} position={[-5.2, -1.7, -5.2]} />
      <gridHelper args={[18, 18, '#31394f', '#1f2433']} position={[0, -2.3, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.31, 0]}>
        <circleGeometry args={[6.8, 48]} />
        <meshStandardMaterial
          color="#0d1321"
          metalness={0.1}
          roughness={0.9}
          transparent
          opacity={0.95}
        />
      </mesh>
      <OrbitControls
        makeDefault
        enabled={!isDragging}
        enableDamping
        dampingFactor={0.09}
      />

      {objects.map((object) => (
        <SceneMesh
          key={object.id}
          object={object}
          selected={object.id === selectedId}
          editMode={editMode}
          selectedFace={selectedFace}
          selectedEdge={selectedEdge}
          grabMode={grabMode}
          axisLock={axisLock}
          onSelect={onSelect}
          onSelectFace={onSelectFace}
          onSelectEdge={onSelectEdge}
          onBeginSceneTransaction={onBeginSceneTransaction}
          onCommitSceneTransaction={onCommitSceneTransaction}
          onCancelSceneTransaction={onCancelSceneTransaction}
          onMoveObject={onMoveObject}
          onUpdateCubeFacePull={onUpdateCubeFacePull}
          onUpdateCubeEdgePull={onUpdateCubeEdgePull}
          onDragStateChange={setIsDragging}
        />
      ))}
    </Canvas>
  )
}
