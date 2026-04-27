import { useRef, useState, useEffect } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { PrismMesh } from '../types/prism.types';
import { extrudeFace, bevelEdge, deleteFace } from '../commands/prismCommands';

interface Props {
  mesh: PrismMesh;
  onUpdateMesh: (newMesh: PrismMesh) => void;
}

export function PrismEditGizmo({ mesh, onUpdateMesh }: Props) {
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [extrudeDelta, setExtrudeDelta] = useState(0);
  const [bevelAmount, setBevelAmount] = useState(0);

  // Helper: build face mesh geometry
  const faceGeometries = useRef<Map<string, THREE.BufferGeometry>>(new Map());
  useEffect(() => {
    faceGeometries.current.clear();
    mesh.faces.forEach(face => {
      const positions: number[] = [];
      face.vertices.forEach(v => { positions.push(v.x, v.y, v.z); });
      if (face.vertices.length === 3) {
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
        geom.computeVertexNormals();
        faceGeometries.current.set(face.id, geom);
      } else if (face.vertices.length === 4) {
        // triangulate quad
        const p = face.vertices;
        const tri1 = [p[0], p[1], p[2]];
        const tri2 = [p[0], p[2], p[3]];
        const allPos = [...tri1, ...tri2].flatMap(v => [v.x, v.y, v.z]);
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(allPos), 3));
        geom.computeVertexNormals();
        faceGeometries.current.set(face.id, geom);
      }
    });
  }, [mesh]);

  const handleExtrude = () => {
    if (selectedFaceId && extrudeDelta !== 0) {
      const newMesh = extrudeFace(mesh, selectedFaceId, extrudeDelta);
      onUpdateMesh(newMesh);
      setExtrudeDelta(0);
    }
  };

  const handleBevel = () => {
    if (selectedEdgeId && bevelAmount !== 0) {
      const newMesh = bevelEdge(mesh, selectedEdgeId, bevelAmount);
      onUpdateMesh(newMesh);
      setBevelAmount(0);
    }
  };

  const handleDeleteFace = () => {
    if (selectedFaceId) {
      const newMesh = deleteFace(mesh, selectedFaceId);
      onUpdateMesh(newMesh);
      setSelectedFaceId(null);
    }
  };

  return (
    <>
      {/* Faces */}
      {mesh.faces.map(face => {
        const geom = faceGeometries.current.get(face.id);
        if (!geom) return null;
        const isSelected = selectedFaceId === face.id;
        return (
          <mesh
            key={face.id}
            geometry={geom}
            onClick={(e) => { e.stopPropagation(); setSelectedFaceId(face.id); setSelectedEdgeId(null); }}
          >
            <meshStandardMaterial
              color={isSelected ? '#ffaa44' : '#3a6ea5'}
              transparent
              opacity={0.7}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}

      {/* Edges (clickable) */}
      {mesh.edges.map(edge => {
        const v1 = mesh.vertices[edge.vertexIndices[0]];
        const v2 = mesh.vertices[edge.vertexIndices[1]];
        const isSelected = selectedEdgeId === edge.id;
        return (
          <Line
            key={edge.id}
            points={[[v1.x, v1.y, v1.z], [v2.x, v2.y, v2.z]]}
            color={isSelected ? '#ffaa44' : '#ffffff'}
            lineWidth={2}
            onClick={(e) => { e.stopPropagation(); setSelectedEdgeId(edge.id); setSelectedFaceId(null); }}
          />
        );
      })}

      {/* HTML panel for controls */}
      <Html position={[2, 2, 2]}>
        <div style={{ background: '#1e1e2e', padding: 8, borderRadius: 4, color: 'white', fontSize: 12, minWidth: 180 }}>
          <div><strong>Prism Edit</strong></div>
          <div>Selected: {selectedFaceId ? `Face ${selectedFaceId}` : selectedEdgeId ? `Edge ${selectedEdgeId}` : 'none'}</div>
          <div style={{ marginTop: 6 }}>
            <input type="number" value={extrudeDelta} onChange={e => setExtrudeDelta(parseFloat(e.target.value))} placeholder="Extrude delta" style={{ width: 80 }} />
            <button onClick={handleExtrude}>Extrude</button>
            <button onClick={handleDeleteFace}>Delete Face</button>
          </div>
          <div style={{ marginTop: 4 }}>
            <input type="number" value={bevelAmount} onChange={e => setBevelAmount(parseFloat(e.target.value))} placeholder="Bevel amount" style={{ width: 80 }} />
            <button onClick={handleBevel}>Bevel Edge</button>
          </div>
        </div>
      </Html>
    </>
  );
}
