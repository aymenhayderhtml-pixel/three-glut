import { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, TransformControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { SceneObject, computeCubeExtents, getObjectVertices, getObjectDimensions } from './scene';
import { PrismMesh } from './types/prism.types';
import { generatePrismMesh } from './geometry/prismGeometry';
import { PrismEditGizmo } from './components/PrismEditGizmo';

// Helper to get geometry and scale for any object (centered origin)
function getObjectRenderProps(object: SceneObject) {
  let geometry: any = null;
  let scale: [number, number, number] = [1, 1, 1];

  switch (object.kind) {
    case 'cube': {
      const ext = computeCubeExtents(object);
      const sx = ext.xPos + ext.xNeg;
      const sy = ext.yPos + ext.yNeg;
      const sz = ext.zPos + ext.zNeg;
      geometry = <boxGeometry args={[1, 1, 1]} />;
      scale = [sx, sy, sz];
      break;
    }
    case 'sphere':
      geometry = <sphereGeometry args={[object.radius, object.segments, Math.floor(object.segments * 0.75)]} />;
      break;
    case 'cone':
      geometry = <coneGeometry args={[object.radius, object.height, object.segments]} />;
      break;
    case 'torus':
      geometry = <torusGeometry args={[object.outerRadius, object.innerRadius, object.sides, object.segments]} />;
      break;
    case 'ground':
      geometry = <boxGeometry args={[1, 1, 1]} />;
      scale = [object.width, object.height, object.depth];
      break;
    case 'prism':
      geometry = <cylinderGeometry args={[object.radius, object.radius, object.height, object.prismParams?.sides || 3, 1]} />;
      scale = [1, 1, 1];
      break;
    default:
      geometry = <boxGeometry args={[1, 1, 1]} />;
  }

  return { geometry, scale };
}

// Measure labels component - shows vertex coordinates and edge lengths
function MeasureLabels({ object }: { object: SceneObject }) {
  const vertices = useMemo(() => getObjectVertices(object), [object]);
  const dimensions = useMemo(() => getObjectDimensions(object), [object]);
  
  // Transform vertices by object's position, rotation, scale
  const worldVertices = useMemo(() => {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3(...object.position);
    const rotation = new THREE.Euler(
      object.rotation[0] * Math.PI / 180,
      object.rotation[1] * Math.PI / 180,
      object.rotation[2] * Math.PI / 180
    );
    const scale = new THREE.Vector3(...object.scale);
    matrix.compose(position, new THREE.Quaternion().setFromEuler(rotation), scale);
    
    return vertices.map(v => {
      const vec = new THREE.Vector3(...v);
      vec.applyMatrix4(matrix);
      return vec;
    });
  }, [vertices, object.position, object.rotation, object.scale]);

  // Calculate edge lengths for the bounding box edges
  const edgeLengths = useMemo(() => {
    const [w, h, d] = dimensions;
    return {
      width: w * object.scale[0],
      height: h * object.scale[1],
      depth: d * object.scale[2],
    };
  }, [dimensions, object.scale]);

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
  };

  const formatCoord = (v: number) => v.toFixed(2);
  const formatLen = (v: number) => v.toFixed(2);

  return (
    <>
      {/* Vertex coordinate labels */}
      {worldVertices.map((v, i) => (
        <Html key={`v-${i}`} position={[v.x, v.y, v.z]} center style={{ pointerEvents: 'none' }}>
          <div style={labelStyle}>
            V{i}: ({formatCoord(v.x)}, {formatCoord(v.y)}, {formatCoord(v.z)})
          </div>
        </Html>
      ))}
      
      {/* Dimension labels at center */}
      <Html position={[object.position[0], object.position[1] + (edgeLengths.height/2) + 0.5, object.position[2]]} center style={{ pointerEvents: 'none' }}>
        <div style={{ ...labelStyle, color: '#ffd39c', fontWeight: 'bold' }}>
          {object.name} — W:{formatLen(edgeLengths.width)} H:{formatLen(edgeLengths.height)} D:{formatLen(edgeLengths.depth)}
        </div>
      </Html>

      {/* Edge length labels for key edges */}
      {worldVertices.length >= 8 && (
        <>
          {/* Width edge (bottom front) */}
          <Html position={[
            (worldVertices[0].x + worldVertices[1].x) / 2,
            worldVertices[0].y,
            (worldVertices[0].z + worldVertices[4].z) / 2
          ]} center style={{ pointerEvents: 'none' }}>
            <div style={{ ...labelStyle, color: '#7fe0ff' }}>
              w={formatLen(edgeLengths.width)}
            </div>
          </Html>
          {/* Height edge */}
          <Html position={[
            worldVertices[0].x - 0.3,
            (worldVertices[0].y + worldVertices[2].y) / 2,
            (worldVertices[0].z + worldVertices[4].z) / 2
          ]} center style={{ pointerEvents: 'none' }}>
            <div style={{ ...labelStyle, color: '#7fe0ff' }}>
              h={formatLen(edgeLengths.height)}
            </div>
          </Html>
          {/* Depth edge */}
          <Html position={[
            (worldVertices[0].x + worldVertices[1].x) / 2,
            worldVertices[0].y,
            (worldVertices[0].z + worldVertices[4].z) / 2 + 0.3
          ]} center style={{ pointerEvents: 'none' }}>
            <div style={{ ...labelStyle, color: '#7fe0ff' }}>
              d={formatLen(edgeLengths.depth)}
            </div>
          </Html>
        </>
      )}
    </>
  );
}

// Individual object with TransformControls and glow, plus prism editing
function SelectableObject({ object, selected, onSelect, onUpdateObject, editMode, lastMeasuredId }: any) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [transformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const { geometry, scale } = getObjectRenderProps(object);
  const [prismMesh, setPrismMesh] = useState<PrismMesh | null>(null);
  const isMeasured = lastMeasuredId === object.id;

  // Load or generate prism mesh
  useEffect(() => {
    if (object.kind === 'prism') {
      if (object.prismMesh) {
        setPrismMesh(object.prismMesh);
      } else {
        const sides = object.prismParams?.sides || 3;
        const height = object.height;
        const radius = object.radius;
        setPrismMesh(generatePrismMesh(sides, height, radius));
      }
    }
  }, [object]);

  const handlePrismUpdate = (newMesh: PrismMesh) => {
    setPrismMesh(newMesh);
    onUpdateObject(object.id, { prismMesh: newMesh });
  };

  const shouldShowPrismGizmo = selected && object.kind === 'prism' && (editMode === 'face' || editMode === 'edge');
  const showTransformControls = selected && !shouldShowPrismGizmo && editMode === 'object';

  return (
    <>
      {showTransformControls ? (
        <>
          {/* Group carries the world transform so the mesh is in the right place */}
          <group
            position={object.position}
            rotation={object.rotation.map((r: number) => r * Math.PI / 180) as [number, number, number]}
            scale={object.scale}
            onClick={(e) => { e.stopPropagation(); onSelect(object.id); }}
          >
            <mesh ref={meshRef} scale={scale}>
              {geometry}
              <meshStandardMaterial color={object.color} emissive={selected ? 0x332200 : 0x000000} />
            </mesh>
            {selected && (
              <mesh scale={[1.05, 1.05, 1.05]}>
                {geometry}
                <meshBasicMaterial color="#ffaa44" transparent opacity={0.25} side={THREE.BackSide} />
              </mesh>
            )}
          </group>
          {/* Attach TransformControls to the mesh ref — no extra position/rotation/scale needed */}
          {meshRef.current && (
            <TransformControls
              mode={transformMode}
              object={meshRef.current}
              onChange={(e: any) => {
                if (e && e.target && e.target.object) {
                  const o = e.target.object;
                  requestAnimationFrame(() => {
                    onUpdateObject(object.id, {
                      position: [o.position.x, o.position.y, o.position.z],
                      rotation: [o.rotation.x * 180 / Math.PI, o.rotation.y * 180 / Math.PI, o.rotation.z * 180 / Math.PI],
                      scale: [o.scale.x, o.scale.y, o.scale.z],
                    });
                  });
                }
              }}
            />
          )}
        </>
      ) : (
        <group
          position={object.position}
          rotation={object.rotation.map((r: number) => r * Math.PI / 180) as [number, number, number]}
          scale={object.scale}
          onClick={(e) => { e.stopPropagation(); onSelect(object.id); }}
        >
          <mesh ref={meshRef} scale={scale}>
            {geometry}
            <meshStandardMaterial color={object.color} emissive={selected ? 0x332200 : 0x000000} />
          </mesh>
          {selected && !shouldShowPrismGizmo && (
            <mesh scale={[1.05, 1.05, 1.05]}>
              {geometry}
              <meshBasicMaterial color="#ffaa44" transparent opacity={0.25} side={THREE.BackSide} />
            </mesh>
          )}
        </group>
      )}

      {shouldShowPrismGizmo && prismMesh && (
        <group
          position={object.position}
          rotation={object.rotation.map((r: number) => r * Math.PI / 180) as [number, number, number]}
          scale={object.scale}
        >
          <PrismEditGizmo mesh={prismMesh} onUpdateMesh={handlePrismUpdate} />
          <Html position={[0, -1.5, 0]}>
            <div style={{ background: '#222', color: 'white', padding: 4, borderRadius: 4, fontSize: 12, whiteSpace: 'nowrap' }}>
              Press ESC to exit edit mode
            </div>
          </Html>
        </group>
      )}

      {/* Measure labels */}
      {isMeasured && <MeasureLabels object={object} />}
    </>
  );
}

// Main 3D Viewport component
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
  onUpdateObject,
  onStatusChange,
  lastMeasuredId,
}: any) {
  const [gridY] = useState(-3.5);
  const selectedObject = objects.find((obj: SceneObject) => obj.id === selectedId);

  // Disable orbit only when the prism gizmo needs exclusive pointer events.
  // TransformControls handles its own pointer capture, so we don't need to
  // globally block orbit when an object is merely selected in object mode.
  const usingPrismGizmo = selectedObject?.kind === 'prism' && (editMode === 'face' || editMode === 'edge');
  const disableOrbit = usingPrismGizmo;

  return (
    <div style={{ width: '100%', height: '100%', background: '#111' }}>
      <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />
        <group position={[0, gridY, 0]}>
          <gridHelper args={[20, 20]} />
        </group>
        {objects.map((obj: SceneObject) => (
          <SelectableObject
            key={obj.id}
            object={obj}
            selected={obj.id === selectedId}
            editMode={editMode}
            lastMeasuredId={lastMeasuredId}
            onSelect={onSelect}
            onUpdateObject={onUpdateObject}
          />
        ))}
      </Canvas>
    </div>
  );
}
