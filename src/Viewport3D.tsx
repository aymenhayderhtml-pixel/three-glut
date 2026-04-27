import { useRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, TransformControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { SceneObject, computeCubeExtents } from './scene';
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

// Individual object with TransformControls and glow, plus prism editing
function SelectableObject({ object, selected, onSelect, onUpdateObject, editMode }: any) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [transformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const { geometry, scale } = getObjectRenderProps(object);
  const [prismMesh, setPrismMesh] = useState<PrismMesh | null>(null);

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
          <group onClick={(e) => { e.stopPropagation(); onSelect(object.id); }}>
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
          {meshRef.current && (
            <TransformControls
              mode={transformMode}
              object={meshRef.current}
              position={object.position}
              rotation={object.rotation.map((r: number) => r * Math.PI / 180) as [number, number, number]}
              scale={object.scale}
              onChange={(e: any) => {
                if (e && e.target && e.target.object) {
                  const o = e.target.object;
                  // Defer the update to avoid "update during render" crash
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
    </>
  );
}

// Main 3D Viewport component
export default function Viewport3D({
  objects,
  selectedId,
  editMode,
  onSelect,
  onUpdateObject,
}: any) {
  const [gridY] = useState(-3.5); // grid lowered for comfortable visual margin
  const selectedObject = objects.find((obj: SceneObject) => obj.id === selectedId);

  // Disable OrbitControls when TransformControls is active or prism gizmo is active
  const usingTransformControls = selectedObject && editMode === 'object';
  const usingPrismGizmo = selectedObject?.kind === 'prism' && (editMode === 'face' || editMode === 'edge');
  const disableOrbit = usingTransformControls || usingPrismGizmo;

  return (
    <div style={{ width: '100%', height: '100%', background: '#111' }}>
      <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />
        <OrbitControls enabled={!disableOrbit} makeDefault />
        <group position={[0, gridY, 0]}>
          <gridHelper args={[20, 20]} />
        </group>
        {objects.map((obj: SceneObject) => (
          <SelectableObject
            key={obj.id}
            object={obj}
            selected={obj.id === selectedId}
            editMode={editMode}
            onSelect={onSelect}
            onUpdateObject={onUpdateObject}
          />
        ))}
      </Canvas>
    </div>
  );
}
