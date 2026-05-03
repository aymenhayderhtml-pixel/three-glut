import { Vertex, Face, Edge, PrismMesh } from '../types/prism.types';

export function generatePrismMesh(sides: number, height: number, radius: number): PrismMesh {
  const vertices: Vertex[] = [];
  const faces: Face[] = [];
  const edges: Edge[] = [];
  const edgeMap = new Map<string, string[]>();

  const angleStep = (2 * Math.PI) / sides;
  const halfH = height / 2;

  // Vertices: bottom ring (y = -halfH), top ring (y = +halfH)
  for (let i = 0; i < sides; i++) {
    const angle = i * angleStep;
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    vertices.push({ x, y: -halfH, z }); // bottom
    vertices.push({ x, y: halfH, z });  // top
  }

  function addEdge(i1: number, i2: number, faceId: string) {
    const key = i1 < i2 ? `${i1},${i2}` : `${i2},${i1}`;
    if (!edgeMap.has(key)) edgeMap.set(key, []);
    edgeMap.get(key)!.push(faceId);
  }

  // Side faces (quads)
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    const b0 = i * 2;
    const t0 = i * 2 + 1;
    const b1 = next * 2;
    const t1 = next * 2 + 1;
    const quadVertices = [vertices[b0], vertices[b1], vertices[t1], vertices[t0]];
    const normal = computeNormal(quadVertices);
    const center = computeCenter(quadVertices);
    const face: Face = {
      id: `side_${i}`,
      vertices: quadVertices,
      normal,
      center,
      indices: [b0, b1, t1, t0],
    };
    faces.push(face);
    addEdge(b0, b1, face.id);
    addEdge(b1, t1, face.id);
    addEdge(t1, t0, face.id);
    addEdge(t0, b0, face.id);
  }

  // Bottom face (polygon)
  const bottomIndices: number[] = [];
  for (let i = 0; i < sides; i++) bottomIndices.push(i * 2);
  const bottomVertices = bottomIndices.map(idx => vertices[idx]);
  const bottomFace: Face = {
    id: 'bottom',
    vertices: bottomVertices,
    normal: { x: 0, y: -1, z: 0 },
    center: computeCenter(bottomVertices),
    indices: bottomIndices,
  };
  faces.push(bottomFace);
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    addEdge(i * 2, next * 2, bottomFace.id);
  }

  // Top face
  const topIndices: number[] = [];
  for (let i = 0; i < sides; i++) topIndices.push(i * 2 + 1);
  const topVertices = topIndices.map(idx => vertices[idx]);
  const topFace: Face = {
    id: 'top',
    vertices: topVertices,
    normal: { x: 0, y: 1, z: 0 },
    center: computeCenter(topVertices),
    indices: topIndices,
  };
  faces.push(topFace);
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    addEdge(i * 2 + 1, next * 2 + 1, topFace.id);
  }

  // Build edges list
  for (const [key, faceIds] of edgeMap.entries()) {
    const [i1, i2] = key.split(',').map(Number);
    edges.push({
      id: `edge_${i1}_${i2}`,
      vertexIndices: [i1, i2],
      faceIds,
    });
  }

  return { vertices, faces, edges, sides, height, radius };
}

function computeNormal(verts: Vertex[]): Vertex {
  // Use Newell's method: accumulate cross products across all edges.
  // Works correctly for both triangles and quads, even after edits.
  let nx = 0, ny = 0, nz = 0;
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const cur = verts[i];
    const nxt = verts[(i + 1) % n];
    nx += (cur.y - nxt.y) * (cur.z + nxt.z);
    ny += (cur.z - nxt.z) * (cur.x + nxt.x);
    nz += (cur.x - nxt.x) * (cur.y + nxt.y);
  }
  const len = Math.hypot(nx, ny, nz);
  if (len !== 0) { nx /= len; ny /= len; nz /= len; }
  return { x: nx, y: ny, z: nz };
}

function computeCenter(verts: Vertex[]): Vertex {
  const sum = verts.reduce((acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y, z: acc.z + v.z }), { x: 0, y: 0, z: 0 });
  const count = verts.length;
  return { x: sum.x / count, y: sum.y / count, z: sum.z / count };
}