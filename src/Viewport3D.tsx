import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, Line, OrbitControls, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import {
  CUBE_EDGE_KEYS,
  CUBE_FACE_KEYS,
  type SceneObject,
  type TransformMode,
  type ThreeDEditMode,
  type AxisLock,
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

function WindowObject({ object, selected }: { object: SceneObject; selected: boolean }) {
  const W = object.width
  const H = object.height
  const B = object.borderThickness ?? 0.12
  const fc = object.frameColor ?? ([0.45, 0.32, 0.22] as [number,number,number])
  const gc = object.color
  const frameHex = `rgb(${Math.round(fc[0]*255)},${Math.round(fc[1]*255)},${Math.round(fc[2]*255)})`
  const glassHex = `rgb(${Math.round(gc[0]*255)},${Math.round(gc[1]*255)},${Math.round(gc[2]*255)})`
  const glassW = Math.max(0.01, W - B * 2)
  const glassH = Math.max(0.01, H - B * 2)
  const selEmissive = selected ? 0x332200 : 0x000000

  return (
    <>
      {/* Glass panel */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[glassW, glassH]} />
        <meshStandardMaterial
          color={glassHex}
          transparent
          opacity={object.glassOpacity ?? 0.35}
          side={THREE.DoubleSide}
          depthWrite={false}
          emissive={selEmissive}
        />
      </mesh>

      {/* Top border */}
      <mesh position={[0, H / 2 - B / 2, 0.002]}>
        <planeGeometry args={[W, B]} />
        <meshStandardMaterial color={frameHex} side={THREE.DoubleSide} emissive={selEmissive} />
      </mesh>
      {/* Bottom border */}
      <mesh position={[0, -(H / 2 - B / 2), 0.002]}>
        <planeGeometry args={[W, B]} />
        <meshStandardMaterial color={frameHex} side={THREE.DoubleSide} emissive={selEmissive} />
      </mesh>
      {/* Left border */}
      <mesh position={[-(W / 2 - B / 2), 0, 0.002]}>
        <planeGeometry args={[B, glassH]} />
        <meshStandardMaterial color={frameHex} side={THREE.DoubleSide} emissive={selEmissive} />
      </mesh>
      {/* Right border */}
      <mesh position={[W / 2 - B / 2, 0, 0.002]}>
        <planeGeometry args={[B, glassH]} />
        <meshStandardMaterial color={frameHex} side={THREE.DoubleSide} emissive={selEmissive} />
      </mesh>

      {/* Selection glow */}
      {selected && (
        <mesh position={[0, 0, -0.005]}>
          <planeGeometry args={[W * 1.05, H * 1.05]} />
          <meshBasicMaterial color="#ffaa44" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </>
  )
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
  multiSelected,
  selectedFace,
  selectedEdge,
  transformMode,
  editMode,
  onSelect,
  onShiftSelect,
  onSelectFace,
  onSelectEdge,
  onUpdateObject,
  lastMeasuredId,
  onTransformDraggingChange,
  armedFavorite,
  onFaceColorChange,
}: {
  object: SceneObject
  selected: boolean
  multiSelected?: boolean
  selectedFace: string | null
  selectedEdge: string | null
  transformMode: TransformMode | null
  editMode: 'object' | 'face' | 'edge' | 'measure'
  onSelect: (id: string) => void
  onShiftSelect?: (id: string) => void
  onSelectFace: (faceKey: typeof CUBE_FACE_KEYS[number] | null) => void
  onSelectEdge: (edgeKey: typeof CUBE_EDGE_KEYS[number] | null) => void
  onUpdateObject: (id: string, changes: Partial<SceneObject>) => void
  lastMeasuredId: string | null
  onTransformDraggingChange: (dragging: boolean) => void
  armedFavorite?: string | null
  onFaceColorChange?: (faceKey: string, color: { r: number; g: number; b: number }) => void
}) {
  const isEffectivelySelected = selected || multiSelected
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
  }, [object.kind, object.prismMesh, object.prismParams, object.height, object.radius])

  const materials = useMemo(() => {
    if (object.kind !== 'cube' && object.kind !== 'prism') return null

    const getColor = (face: string) => {
      const c = object.faceColors?.[face] ?? object.color
      return new THREE.Color(c[0], c[1], c[2])
    }

    if (object.kind === 'cube') {
      // Three.js BoxGeometry material order: px, nx, py, ny, pz, nz
      return [
        new THREE.MeshStandardMaterial({ color: getColor('xPos'), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
        new THREE.MeshStandardMaterial({ color: getColor('xNeg'), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
        new THREE.MeshStandardMaterial({ color: getColor('yPos'), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
        new THREE.MeshStandardMaterial({ color: getColor('yNeg'), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
        new THREE.MeshStandardMaterial({ color: getColor('zPos'), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
        new THREE.MeshStandardMaterial({ color: getColor('zNeg'), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
      ]
    }

    if (object.kind === 'prism') {
      // Three.js CylinderGeometry material order: 0: sides, 1: top, 2: bottom
      return [
        new THREE.MeshStandardMaterial({ color: getColor('side_0'), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
        new THREE.MeshStandardMaterial({ color: getColor('top'), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
        new THREE.MeshStandardMaterial({ color: getColor('bottom'), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
      ]
    }

    return null
  }, [object.kind, object.color, object.faceColors])

  // Update emissive imperatively when selection changes — no material rebuild
  useEffect(() => {
    if (!materials) return
    materials.forEach((mat, i) => {
      const faceKeys = object.kind === 'cube'
        ? ['xPos', 'xNeg', 'yPos', 'yNeg', 'zPos', 'zNeg']
        : ['side_0', 'top', 'bottom']
      const faceKey = faceKeys[i]
      if (!isEffectivelySelected) {
        mat.emissive.set(0x000000)
      } else if (editMode === 'face' && selectedFace === faceKey) {
        mat.emissive.set(0x554422)
      } else {
        mat.emissive.set(0x332200)
      }
    })
  }, [materials, isEffectivelySelected, editMode, selectedFace, object.kind])

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

  const cubeFaceMeshes = object.kind === 'cube' && (editMode === 'face' || armedFavorite)
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
          <mesh 
            key={faceKey} 
            position={pos} 
            scale={size} 
            onClick={(e) => { 
              e.stopPropagation(); 
              if (armedFavorite && onFaceColorChange) {
                const [r, g, b] = armedFavorite.match(/\w\w/g)!.map(x => parseInt(x, 16) / 255)
                onFaceColorChange(faceKey, { r, g, b })
              } else {
                onSelectFace(faceKey);
                onSelect(object.id); 
              }
            }}
          >
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

  const prismFaceMeshes = object.kind === 'prism' && (editMode === 'face' || armedFavorite)
    ? (() => {
        const sides = object.prismParams?.sides ?? object.sides ?? 3
        const radius = object.prismParams?.radius ?? object.radius ?? 1
        const height = object.prismParams?.height ?? object.height ?? 1
        const halfH = height / 2
        const angleStep = (2 * Math.PI) / sides
        const meshes = []

        // Top cap
        const topKey = 'top'
        const isTopSelected = selectedFace === topKey
        meshes.push(
          <mesh
            key={topKey}
            position={[0, halfH + 0.01, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            onClick={(e) => {
              e.stopPropagation()
              if (armedFavorite && onFaceColorChange) {
                const [r, g, b] = armedFavorite.match(/\w\w/g)!.map(x => parseInt(x, 16) / 255)
                onFaceColorChange(topKey, { r, g, b })
              } else {
                onSelectFace(topKey as any)
                onSelect(object.id)
              }
            }}
          >
            <circleGeometry args={[radius, sides]} />
            <meshBasicMaterial
              color={isTopSelected ? '#ffd39c' : '#7fe0ff'}
              transparent
              opacity={isTopSelected ? 0.42 : 0.18}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )

        // Bottom cap
        const bottomKey = 'bottom'
        const isBottomSelected = selectedFace === bottomKey
        meshes.push(
          <mesh
            key={bottomKey}
            position={[0, -halfH - 0.01, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            onClick={(e) => {
              e.stopPropagation()
              if (armedFavorite && onFaceColorChange) {
                const [r, g, b] = armedFavorite.match(/\w\w/g)!.map(x => parseInt(x, 16) / 255)
                onFaceColorChange(bottomKey, { r, g, b })
              } else {
                onSelectFace(bottomKey as any)
                onSelect(object.id)
              }
            }}
          >
            <circleGeometry args={[radius, sides]} />
            <meshBasicMaterial
              color={isBottomSelected ? '#ffd39c' : '#7fe0ff'}
              transparent
              opacity={isBottomSelected ? 0.42 : 0.18}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )

        // Side faces
        for (let i = 0; i < sides; i++) {
          const faceKey = `side_${i}`
          const isSelected = selectedFace === faceKey
          const angle = (i + 0.5) * angleStep
          const nx = Math.cos(angle)
          const nz = Math.sin(angle)
          const cx = nx * radius
          const cz = nz * radius
          const faceW = 2 * radius * Math.sin(Math.PI / sides)

          meshes.push(
            <mesh
              key={faceKey}
              position={[cx, 0, cz]}
              rotation={[0, -angle, 0]}
              onClick={(e) => {
                e.stopPropagation()
                if (armedFavorite && onFaceColorChange) {
                  const [r, g, b] = armedFavorite.match(/\w\w/g)!.map(x => parseInt(x, 16) / 255)
                  onFaceColorChange(faceKey, { r, g, b })
                } else {
                  onSelectFace(faceKey as any)
                  onSelect(object.id)
                }
              }}
            >
              <planeGeometry args={[faceW, height]} />
              <meshBasicMaterial
                color={isSelected ? '#ffd39c' : '#7fe0ff'}
                transparent
                opacity={isSelected ? 0.42 : 0.18}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          )
        }

        return (
          <group>
            {meshes}
          </group>
        )
      })()
    : null

  const faceMeshes = cubeFaceMeshes ?? prismFaceMeshes

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
        if (e.shiftKey && onShiftSelect) {
          onShiftSelect(object.id)
          return
        }
        
        // If armed, do nothing here — faceMeshes handle it
        if (armedFavorite) return
        
        // Face selection via Raycasting (faceIndex)
        if (object.kind === 'cube' && editMode === 'face' && e.faceIndex !== undefined && e.faceIndex !== null) {
          const faceGroup = Math.floor(e.faceIndex / 2)
          const keys = ['xPos', 'xNeg', 'yPos', 'yNeg', 'zPos', 'zNeg'] as const
          const faceKey = keys[faceGroup]

          onSelectFace(faceKey)
          onSelect(object.id)
        } else {
          onSelect(object.id)
        }
      }}
    >
      {object.kind === 'window' ? (
        <WindowObject object={object} selected={selected} />
      ) : (
        <>
          <mesh scale={scale} material={materials || undefined}>
            {geometry}
            {!materials && <meshStandardMaterial color={object.color} emissive={isEffectivelySelected ? 0x332200 : 0x000000} polygonOffset={true} polygonOffsetFactor={1} polygonOffsetUnits={1} />}
          </mesh>
          {isEffectivelySelected && !shouldShowPrismGizmo && (
            <mesh scale={[1.05, 1.05, 1.05]}>
              {geometry}
              <meshBasicMaterial color={multiSelected ? "#88ccff" : "#ffaa44"} transparent opacity={0.15} side={THREE.BackSide} depthWrite={false} />
            </mesh>
          )}
        </>
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

import { useThree } from '@react-three/fiber'

function CameraHandler({ enabled }: { enabled: boolean }) {
  const { camera } = useThree()
  const controlsRef = useRef<any>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!enabled || !controlsRef.current) return
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return

      const step = 0.5
      const forward = new THREE.Vector3()
      camera.getWorldDirection(forward)
      
      // Calculate horizontal forward (ignore Y for W/S movement to feel like a walk)
      const horizontalForward = forward.clone()
      horizontalForward.y = 0
      horizontalForward.normalize()

      const right = new THREE.Vector3()
      right.crossVectors(camera.up, forward).negate()
      right.y = 0
      right.normalize()

      switch (e.key.toLowerCase()) {
        case 'w':
          e.preventDefault()
          camera.position.addScaledVector(horizontalForward, step)
          controlsRef.current.target.addScaledVector(horizontalForward, step)
          break
        case 's':
          e.preventDefault()
          camera.position.addScaledVector(horizontalForward, -step)
          controlsRef.current.target.addScaledVector(horizontalForward, -step)
          break
        case 'a':
          e.preventDefault()
          camera.position.addScaledVector(right, -step)
          controlsRef.current.target.addScaledVector(right, -step)
          break
        case 'd':
          e.preventDefault()
          camera.position.addScaledVector(right, step)
          controlsRef.current.target.addScaledVector(right, step)
          break
        case 'q':
        case 'arrowup':
          e.preventDefault()
          camera.position.y += step
          controlsRef.current.target.y += step
          break
        case 'e':
        case 'arrowdown':
          e.preventDefault()
          camera.position.y -= step
          controlsRef.current.target.y -= step
          break
      }
      controlsRef.current.update()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [camera, enabled])

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      minDistance={0.5}
      maxDistance={200}
      enabled={enabled}
    />
  )
}

interface Viewport3DProps {
  objects: SceneObject[]
  selectedId: string | null
  multiSelectedIds?: string[]
  onShiftSelect?: (id: string) => void
  editMode: ThreeDEditMode
  selectedFace: string | null
  selectedEdge: string | null
  transformMode: TransformMode | null
  grabMode?: boolean
  axisLock?: AxisLock
  onSelect: (id: string | null) => void
  onSelectFace: (faceKey: any | null) => void
  onSelectEdge: (edgeKey: any | null) => void
  onUpdateObject: (id: string, changes: Partial<SceneObject>) => void
  lastMeasuredId: string | null
  armedFavorite?: string | null
  onFaceColorChange?: (faceKey: string, color: { r: number; g: number; b: number }) => void
}

export default function Viewport3D({
  objects,
  selectedId,
  multiSelectedIds = [],
  onShiftSelect,
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
  armedFavorite,
  onFaceColorChange,
}: Viewport3DProps) {
  const selectedObject = objects.find((obj: SceneObject) => obj.id === selectedId)
  const disableOrbit = selectedObject?.kind === 'prism' && (editMode === 'face' || editMode === 'edge')
  const [transformDragging, setTransformDragging] = useState(false)
  const isOrbitEnabled = !disableOrbit && !transformDragging

  return (
    <div style={{ width: '100%', height: '100%', background: '#111' }}>
      <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />
        
        <CameraHandler enabled={isOrbitEnabled} />

        <group position={[0, -3.5, 0]}>
          <gridHelper args={[20, 20]} />
        </group>
        {objects.map((obj: SceneObject) => (
          <SelectableObject
            key={obj.id}
            object={obj}
            selected={obj.id === selectedId}
            multiSelected={multiSelectedIds.includes(obj.id)}
            onShiftSelect={onShiftSelect}
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
            armedFavorite={armedFavorite}
            onFaceColorChange={onFaceColorChange}
          />
        ))}
      </Canvas>
    </div>
  )
}
