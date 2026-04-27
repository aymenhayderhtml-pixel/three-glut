import { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { usePrismStore } from '../store/prismStore';
import { generatePrismMesh } from '../geometry/prismGeometry';
import { extrudeFace } from '../commands/extrudeFace';
import { bevelEdge } from '../commands/bevelEdge';
import { deleteFace } from '../commands/deleteFace';

// Helper to convert our Vertex to THREE.Vector3
function toVector3(v: { x: number; y: number; z: number }) {
    return new THREE.Vector3(v.x, v.y, v.z);
}

// A single face component with selection and extrusion handles
function FaceComponent({ face, isSelected, onSelect, onExtrude }: any) {
    const meshRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);

    // Build geometry from face vertices (triangulated)
    const geometry = useRef<THREE.BufferGeometry>();
    useEffect(() => {
        const vertices = face.vertices;
        if (vertices.length === 4) {
            // Quad -> two triangles
            const positions = [
                vertices[0].x, vertices[0].y, vertices[0].z,
                vertices[1].x, vertices[1].y, vertices[1].z,
                vertices[2].x, vertices[2].y, vertices[2].z,
                vertices[0].x, vertices[0].y, vertices[0].z,
                vertices[2].x, vertices[2].y, vertices[2].z,
                vertices[3].x, vertices[3].y, vertices[3].z,
            ];
            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
            geom.computeVertexNormals();
            geometry.current = geom;
        } else if (vertices.length === 3) {
            const positions = vertices.flatMap(v => [v.x, v.y, v.z]);
            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
            geom.computeVertexNormals();
            geometry.current = geom;
        }
    }, [face]);

    if (!geometry.current) return null;

    return (
        <mesh
            ref={meshRef}
            geometry={geometry.current}
            position={[0, 0, 0]}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(face.id);
            }}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
        >
            <meshStandardMaterial
                color={isSelected ? '#ffaa44' : hovered ? '#88aaff' : '#3a6ea5'}
                side={THREE.DoubleSide}
                transparent
                opacity={0.7}
                emissive={isSelected ? '#442200' : '#000000'}
            />
        </mesh>
    );
}

// Editor for a single prism object
function PrismObject() {
    const { mesh, selectedFaceId, faceMode, extrudeFace: storeExtrude, bevelEdge: storeBevel, deleteFace: storeDelete } = usePrismStore();
    const [extrudeDelta, setExtrudeDelta] = useState(0);
    const [bevelAmount, setBevelAmount] = useState(0);
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

    // Group vertices into a wireframe
    const wireframeEdges = useRef<[THREE.Vector3, THREE.Vector3][]>([]);
    useEffect(() => {
        const edges: [THREE.Vector3, THREE.Vector3][] = [];
        mesh.edges.forEach(edge => {
            const v1 = mesh.vertices[edge.vertexIndices[0]];
            const v2 = mesh.vertices[edge.vertexIndices[1]];
            edges.push([toVector3(v1), toVector3(v2)]);
        });
        wireframeEdges.current = edges;
    }, [mesh]);

    const handleExtrude = () => {
        if (selectedFaceId && extrudeDelta !== 0) {
            storeExtrude(selectedFaceId, extrudeDelta);
            setExtrudeDelta(0);
        }
    };

    const handleBevel = () => {
        if (selectedEdgeId && bevelAmount !== 0) {
            storeBevel(selectedEdgeId, bevelAmount);
            setBevelAmount(0);
        }
    };

    const handleDeleteFace = () => {
        if (selectedFaceId) {
            storeDelete(selectedFaceId);
        }
    };

    return (
        <group>
            {/* Render all faces */}
            {mesh.faces.map(face => (
                <FaceComponent
                    key={face.id}
                    face={face}
                    isSelected={faceMode && selectedFaceId === face.id}
                    onSelect={(id: string) => usePrismStore.getState().setSelectedFaceId(id)}
                    onExtrude={(delta: number) => storeExtrude(face.id, delta)}
                />
            ))}

            {/* Wireframe overlay */}
            {wireframeEdges.current.map(([start, end], idx) => (
                <Line key={idx} points={[start, end]} color="#ffffff" lineWidth={1} />
            ))}

            {/* Simple UI overlay in 3D space (for demonstration) */}
            <Html position={[2, 2, 2]}>
                <div style={{ background: '#1e1e2e', padding: 8, borderRadius: 4, color: 'white', fontSize: 12 }}>
                    {faceMode ? (
                        <>
                            <div>Selected face: {selectedFaceId || 'none'}</div>
                            <input
                                type="number"
                                value={extrudeDelta}
                                onChange={(e) => setExtrudeDelta(parseFloat(e.target.value))}
                                placeholder="Delta"
                                style={{ width: 80 }}
                            />
                            <button onClick={handleExtrude}>Extrude</button>
                            <button onClick={handleDeleteFace}>Delete face</button>
                        </>
                    ) : (
                        <>
                            <div>Edge mode (select by clicking edge)</div>
                            <input
                                type="number"
                                value={bevelAmount}
                                onChange={(e) => setBevelAmount(parseFloat(e.target.value))}
                                placeholder="Amount"
                            />
                            <button onClick={handleBevel}>Bevel selected edge</button>
                        </>
                    )}
                </div>
            </Html>
        </group>
    );
}

// Main editor component that wraps the Canvas and controls
export function PrismEditor() {
    const { mesh, setMesh, faceMode, setFaceMode, selectedFaceId, setSelectedFaceId } = usePrismStore();

    // Regenerate mesh when sides/height/radius change (you can add controls later)
    const regenerate = (sides: number, height: number, radius: number) => {
        setMesh(generatePrismMesh(sides, height, radius));
    };

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: '#222', padding: 8, borderRadius: 4 }}>
                <button onClick={() => setFaceMode(!faceMode)}>
                    {faceMode ? 'Face Mode (ON)' : 'Face Mode (OFF)'}
                </button>
                {faceMode && (
                    <button onClick={() => setSelectedFaceId(null)}>Clear face selection</button>
                )}
                <button onClick={() => regenerate(4, 2, 1)}>Reset Cube</button>
                <button onClick={() => regenerate(6, 2, 1)}>Hexagon Prism</button>
            </div>
            <Canvas camera={{ position: [4, 3, 5], fov: 50 }}>
                <ambientLight intensity={0.5} />
                <directionalLight position={[5, 10, 5]} intensity={1} />
                <OrbitControls />
                <PrismObject />
                <gridHelper args={[10, 20]} />
                <axesHelper args={[3]} />
            </Canvas>
        </div>
    );
}
