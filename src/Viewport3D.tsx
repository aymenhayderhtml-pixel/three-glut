import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, Line, OrbitControls, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import {
  CUBE_EDGE_KEYS,
  CUBE_FACE_KEYS,
  type SceneObject,
  type TransformMode,
  computeCubeExtents,
  getObjectDimensions,
  getObjectVertices,
} from './scene'
import type { PrismMesh } from './types/prism.types'
import { generatePrismMesh } from './geometry/prismGeometry'
import { PrismEditGizmo } from './components/PrismEditGizmo'

function getObjectRenderProps(object: SceneObject) {
  let geometry: ReactNode = <boxGeometry args={[1, 1, 1]} />
  let scale: [number, number, number] = [1, 1, 1]

  switch (object.kind) {
    case 'cube': {
      const ext = computeCubeExtents(object)
      geometry = <boxGeometry args={[1, 1, 1]} />
      scale = [ext.xNeg + ext.xPos, ext.yNeg + ext.yPos, ext.zNeg + ext.zPos]
      break
    }
    case 'sphere':
      geometry = <sphereGeometry args={[object.radius, object.segments, Math.floor(object.segments * 0.75)]} />
      break
    case 'cone':
      geometry = <coneGeometry args={[object.radius, object.height, object.segments]} />
      break
    case 'torus':
      geometry = <torusGeometry args={[object.outerRadius, object.innerRadius, object.sides, object.segments]} />
      break
    case 'ground':
      geometry = <boxGeometry args={[1, 1, 1]} />
      scale = [object.width, object.height, object.depth]
      break
    case 'prism':
      geometry = <cylinderGeometry args={[object.radius, object.radius, object.height, object.prismParams?.sides ?? 3, 1]} />
      break
  }

  return { geometry, scale }
}

function MeasureLabels({ object }: { object: SceneObject }) {
  const vertices = useMemo(() => getObjectVertices(object), [object])
  const dimensions = useMemo(() => getObjectDimensions(object), [object])
  const worldVertices = useMemo(() => {
    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3(...object.position)
    const rotation = new THREE.Euler(
      object.rotation[0] * Math.PI / 180,
      object.rotation[1] * Math.PI / 180,
      object.rotation[2] * Math.PI / 180,
    )
    const scale = new THREE.Vector3(...object.scale)
    matrix.compose(position, new THREE.Quaternion().setFromEuler(rotation), scale)
    return vertices.map((v) => new THREE.Vector3(...v).applyMatrix4(matrix))
  }, [vertices, object.position, object.rotation, object.scale])
  const [w, h, d] = dimensions
  const edgeLengths = {
    width: w * object.scale[0],
    height: h * object.scale[1],
    depth: d * object.scale[2],
  }

  return (
    <>
      {worldVertices.map((v, i) => (
        <Html key={i} position={[v.x, v.y, v.z]} center style={{ pointerEvents: 'none' }}>
          <div style={labelStyle}>{`V${i}: (${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`}</div>
        </Html>
      ))}
      <Html position={[object.position[0], object.position[1] + edgeLengths.height / 2 + 0.5, object.position[2]]} center style={{ pointerEvents: 'none' }}>
        <div style={{ ...labelStyle, color: '#ffd39c', fontWeight: 'bold' }}>
          {`${object.name} - W:${edgeLengths.width.toFixed(2)} H:${edgeLengths.height.toFixed(2)} D:${edgeLengths.depth.toFixed(2)}`}
        </div>
      </Html>
    </>
  )
}

const labelStyle: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.75)',
  color: '#8ab4f8',
  padding: '2px 6px',
  borderRadius: '3px',
  fontSize: '11px',
  fontFamily: 'monospace',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  userSelect: 'none',
  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
  border: '1px solid rgba(138, 180, 248, 0.3)',
}

function SelectableObject({
  object,
  selected,
  selectedFace,
  selectedEdge,
  transformMode,
  editMode,
  onSelect,
  onSelectFace,
  onSelectEdge,
  onUpdateObject,
  lastMeasuredId,
  onTransformDraggingChange,
}: {
  object: SceneObject
  selected: boolean
  selectedFace: string | null
  selectedEdge: string | null
  transformMode: TransformMode | null
  editMode: 'object' | 'face' | 'edge' | 'measure'
  onSelect: (id: string) => void
  onSelectFace: (faceKey: typeof CUBE_FACE_KEYS[number] | null) => void
  onSelectEdge: (edgeKey: typeof CUBE_EDGE_KEYS[number] | null) => void
  onUpdateObject: (id: string, changes: Partial<SceneObject>) => void
  lastMeasuredId: string | null
  onTransformDraggingChange: (dragging: boolean) => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [prismMesh, setPrismMesh] = useState<PrismMesh | null>(object.prismMesh ?? null)
  const { geometry, scale } = useMemo(() => getObjectRenderProps(object), [
    object.kind, 
    object.size, 
    object.radius, 
    object.height, 
    object.width, 
    object.depth, 
    object.facePulls, 
    object.edgePulls,
    object.prismParams
  ])
  const shouldShowPrismGizmo = selected && object.kind === 'prism' && (editMode === 'face' || editMode === 'edge')

  useEffect(() => {
    if (object.kind !== 'prism') return
    if (object.prismMesh) {
      setPrismMesh(object.prismMesh)
      return
    }
    setPrismMesh(generatePrismMesh(object.prismParams?.sides ?? 3, object.height, object.radius))
  }, [object])

  const materials = useMemo(() => {
    if (object.kind !== 'cube') return null
    const getColor = (face: string) => {
      const c = object.faceColors?.[face] ?? object.color
      return new THREE.Color(c[0], c[1], c[2])
    }
    const getEmissive = (face: string) => {
      if (!selected) return 0x000000
      if (editMode === 'face' && selectedFace === face) return 0x554422
      return 0x332200
    }
    // Three.js BoxGeometry material order: px, nx, py, ny, pz, nz
    return [
      new THREE.MeshStandardMaterial({ color: getColor('xPos'), emissive: getEmissive('xPos'), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
      new THREE.MeshStandardMaterial({ color: getColor('xNeg'), emissive: getEmissive('xNeg'), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
      new THREE.MeshStandardMaterial({ color: getColor('yPos'), emissive: getEmissive('yPos'), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
      new THREE.MeshStandardMaterial({ color: getColor('yNeg'), emissive: getEmissive('yNeg'), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
      new THREE.MeshStandardMaterial({ color: getColor('zPos'), emissive: getEmissive('zPos'), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
      new THREE.MeshStandardMaterial({ color: getColor('zNeg'), emissive: getEmissive('zNeg'), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
    ]
  }, [object.kind, object.color, object.faceColors, selected, selectedFace, editMode])

  useEffect(() => {
    return () => {
      if (materials) {
        materials.forEach((m) => m.dispose())
      }
    }
  }, [materials])

  const persistTransform = () => {
    const group = groupRef.current
    if (!group) return
    onUpdateObject(object.id, {
      position: [group.position.x, group.position.y, group.position.z],
      rotation: [group.rotation.x * 180 / Math.PI, group.rotation.y * 180 / Math.PI, group.rotation.z * 180 / Math.PI],
      scale: [group.scale.x, group.scale.y, group.scale.z],
    })
  }

  const faceMeshes = object.kind === 'cube' && editMode === 'face'
    ? CUBE_FACE_KEYS.map((faceKey) => {
        const ext = computeCubeExtents(object)
        const half = {
          x: (ext.xNeg + ext.xPos) / 2,
          y: (ext.yNeg + ext.yPos) / 2,
          z: (ext.zNeg + ext.zPos) / 2,
        }
        const pos: [number, number, number] =
          faceKey === 'xNeg' ? [-half.x, 0, 0]
          : faceKey === 'xPos' ? [half.x, 0, 0]
          : faceKey === 'yNeg' ? [0, -half.y, 0]
          : faceKey === 'yPos' ? [0, half.y, 0]
          : faceKey === 'zNeg' ? [0, 0, -half.z]
          : [0, 0, half.z]
        const size: [number, number, number] =
          faceKey.startsWith('x') ? [0.08, ext.yNeg + ext.yPos, ext.zNeg + ext.zPos]
          : faceKey.startsWith('y') ? [ext.xNeg + ext.xPos, 0.08, ext.zNeg + ext.zPos]
          : [ext.xNeg + ext.xPos, ext.yNeg + ext.yPos, 0.08]
        const isSelectedFace = selectedFace === faceKey
        return (
          <mesh key={faceKey} position={pos} scale={size} onClick={(e) => { e.stopPropagation(); onSelectFace(faceKey); onSelect(object.id); }}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial
              color={isSelectedFace ? '#ffd39c' : '#7fe0ff'}
              transparent
              opacity={isSelectedFace ? 0.42 : 0.18}
              depthWrite={false}
            />
          </mesh>
        )
      })
    : null

  const edgeLines = object.kind === 'cube' && editMode === 'edge'
    ? CUBE_EDGE_KEYS.map((edgeKey) => {
        const ext = computeCubeExtents(object)
        const x = edgeKey.includes('xPos') ? ext.xPos : edgeKey.includes('xNeg') ? -ext.xNeg : 0
        const y = edgeKey.includes('yPos') ? ext.yPos : edgeKey.includes('yNeg') ? -ext.yNeg : 0
        const z = edgeKey.includes('zPos') ? ext.zPos : edgeKey.includes('zNeg') ? -ext.zNeg : 0
        const points: [number, number, number][] = []
        if (edgeKey.includes('xPos') || edgeKey.includes('xNeg')) {
          points.push([x, edgeKey.includes('yPos') ? ext.yPos : -ext.yNeg, edgeKey.includes('zPos') ? ext.zPos : -ext.zNeg])
          points.push([x, edgeKey.includes('yPos') ? ext.yPos : -ext.yNeg, edgeKey.includes('zPos') ? -ext.zNeg : ext.zPos])
        } else if (edgeKey.includes('yPos') || edgeKey.includes('yNeg')) {
          points.push([edgeKey.includes('xPos') ? ext.xPos : -ext.xNeg, y, edgeKey.includes('zPos') ? ext.zPos : -ext.zNeg])
          points.push([edgeKey.includes('xPos') ? -ext.xNeg : ext.xPos, y, edgeKey.includes('zPos') ? ext.zPos : -ext.zNeg])
        } else {
          points.push([edgeKey.includes('xPos') ? ext.xPos : -ext.xNeg, edgeKey.includes('yPos') ? ext.yPos : -ext.yNeg, z])
          points.push([edgeKey.includes('xPos') ? -ext.xNeg : ext.xPos, edgeKey.includes('yPos') ? ext.yPos : -ext.yNeg, z])
        }
        const isSelected = selectedEdge === edgeKey
        return (
          <Line
            key={edgeKey}
            points={points}
            color={isSelected ? '#ffd39c' : '#ffffff'}
            lineWidth={1}
            onClick={(e) => { e.stopPropagation(); onSelectEdge(edgeKey); onSelect(object.id); }}
          />
        )
      })
    : null

  const content = (
    <group
      ref={groupRef}
      position={object.position}
      rotation={object.rotation.map((r) => r * Math.PI / 180) as [number, number, number]}
      scale={object.scale}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(object.id)
        
        // Face selection via Raycasting (faceIndex)
        if (object.kind === 'cube' && editMode === 'face' && e.faceIndex !== undefined && e.faceIndex !== null) {
          const faceGroup = Math.floor(e.faceIndex / 2)
          const keys = ['xPos', 'xNeg', 'yPos', 'yNeg', 'zPos', 'zNeg'] as const
          onSelectFace(keys[faceGroup])
        }
      }}
    >
      <mesh scale={scale} material={materials || undefined}>
        {geometry}
        {!materials && <meshStandardMaterial color={object.color} emissive={selected ? 0x332200 : 0x000000} polygonOffset={true} polygonOffsetFactor={1} polygonOffsetUnits={1} />}
      </mesh>
      {selected && !shouldShowPrismGizmo && (
        <mesh scale={[1.05, 1.05, 1.05]}>
          {geometry}
          <meshBasicMaterial color="#ffaa44" transparent opacity={0.15} side={THREE.BackSide} depthWrite={false} />
        </mesh>
      )}
      {faceMeshes}
      {edgeLines}
      {shouldShowPrismGizmo && prismMesh && (
        <group>
          <PrismEditGizmo mesh={prismMesh} onUpdateMesh={(newMesh) => { setPrismMesh(newMesh); onUpdateObject(object.id, { prismMesh: newMesh }) }} />
        </group>
      )}
      {selected && object.kind === 'prism' && (editMode === 'face' || editMode === 'edge') && (
        <Html position={[0, -1.5, 0]}>
          <div style={{ background: '#222', color: 'white', padding: 4, borderRadius: 4, fontSize: 12, whiteSpace: 'nowrap' }}>
            Press ESC to exit edit mode
          </div>
        </Html>
      )}
    </group>
  )

  return (
    <>
      {content}
      {selected && !shouldShowPrismGizmo && transformMode && (
        <TransformControls
          object={groupRef.current ?? undefined}
          mode={transformMode}
          enabled
          onMouseDown={() => {
            setIsDragging(true)
            onTransformDraggingChange(true)
          }}
          onMouseUp={() => {
            setIsDragging(false)
            onTransformDraggingChange(false)
            persistTransform()
          }}
          onChange={() => {
            if (isDragging) persistTransform()
          }}
        />
      )}
      {lastMeasuredId === object.id ? <MeasureLabels object={object} /> : null}
    </>
  )
}

export default function Viewport3D({
  objects,
  selectedId,
  editMode,
  selectedFace,
  selectedEdge,
  transformMode,
  grabMode: _grabMode,
  axisLock: _axisLock,
  onSelect,
  onSelectFace,
  onSelectEdge,
  onUpdateObject,
  lastMeasuredId,
}: any) {
  const selectedObject = objects.find((obj: SceneObject) => obj.id === selectedId)
  const disableOrbit = selectedObject?.kind === 'prism' && (editMode === 'face' || editMode === 'edge')
  const [transformDragging, setTransformDragging] = useState(false)
  return (
    <div style={{ width: '100%', height: '100%', background: '#111' }}>
      <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />
        <OrbitControls enabled={!disableOrbit && !transformDragging} />
        <group position={[0, -3.5, 0]}>
          <gridHelper args={[20, 20]} />
        </group>
        {objects.map((obj: SceneObject) => (
          <SelectableObject
            key={obj.id}
            object={obj}
            selected={obj.id === selectedId}
            selectedFace={selectedId === obj.id ? selectedFace : null}
            selectedEdge={selectedId === obj.id ? selectedEdge : null}
            transformMode={transformMode}
            editMode={editMode}
            onSelect={onSelect}
            onSelectFace={onSelectFace}
            onSelectEdge={onSelectEdge}
            onUpdateObject={onUpdateObject}
            lastMeasuredId={lastMeasuredId}
            onTransformDraggingChange={setTransformDragging}
          />
        ))}
      </Canvas>
    </div>
  )
}
