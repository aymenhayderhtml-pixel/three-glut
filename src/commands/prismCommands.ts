import { PrismMesh, Vertex } from '../types/prism.types';

export function extrudeFace(mesh: PrismMesh, faceId: string, delta: number): PrismMesh {
  const targetFace = mesh.faces.find(f => f.id === faceId);
  if (!targetFace) return mesh;

  const newMesh: PrismMesh = JSON.parse(JSON.stringify(mesh)); // deep clone
  const face = newMesh.faces.find(f => f.id === faceId)!;
  const offset = { x: face.normal.x * delta, y: face.normal.y * delta, z: face.normal.z * delta };

  for (const idx of face.indices) {
    newMesh.vertices[idx].x += offset.x;
    newMesh.vertices[idx].y += offset.y;
    newMesh.vertices[idx].z += offset.z;
  }

  // Update affected faces (those sharing moved vertices)
  const affectedFaceIds = new Set<string>();
  for (const idx of face.indices) {
    for (const edge of newMesh.edges) {
      if (edge.vertexIndices.includes(idx)) {
        edge.faceIds.forEach(fid => affectedFaceIds.add(fid));
      }
    }
  }
  for (const fid of affectedFaceIds) {
    const f = newMesh.faces.find(f => f.id === fid);
    if (f) {
      f.normal = computeNormal(f.vertices);
      f.center = computeCenter(f.vertices);
    }
  }
  return newMesh;
}

export function bevelEdge(mesh: PrismMesh, edgeId: string, amount: number): PrismMesh {
  const edge = mesh.edges.find(e => e.id === edgeId);
  if (!edge || edge.faceIds.length < 2) return mesh;

  const newMesh: PrismMesh = JSON.parse(JSON.stringify(mesh));
  const [i1, i2] = edge.vertexIndices;
  const face1 = newMesh.faces.find(f => f.id === edge.faceIds[0])!;
  const face2 = newMesh.faces.find(f => f.id === edge.faceIds[1])!;
  const avgNormal = {
    x: (face1.normal.x + face2.normal.x) / 2,
    y: (face1.normal.y + face2.normal.y) / 2,
    z: (face1.normal.z + face2.normal.z) / 2,
  };
  const len = Math.hypot(avgNormal.x, avgNormal.y, avgNormal.z);
  if (len > 0.001) { avgNormal.x /= len; avgNormal.y /= len; avgNormal.z /= len; }
  const move = amount * 0.5;
  newMesh.vertices[i1].x += avgNormal.x * move;
  newMesh.vertices[i1].y += avgNormal.y * move;
  newMesh.vertices[i1].z += avgNormal.z * move;
  newMesh.vertices[i2].x += avgNormal.x * move;
  newMesh.vertices[i2].y += avgNormal.y * move;
  newMesh.vertices[i2].z += avgNormal.z * move;

  const affectedIds = new Set<string>(edge.faceIds);
  for (const idx of [i1, i2]) {
    for (const e of newMesh.edges) {
      if (e.vertexIndices.includes(idx)) {
        e.faceIds.forEach(fid => affectedIds.add(fid));
      }
    }
  }
  for (const fid of affectedIds) {
    const f = newMesh.faces.find(f => f.id === fid);
    if (f) { f.normal = computeNormal(f.vertices); f.center = computeCenter(f.vertices); }
  }
  return newMesh;
}

export function deleteFace(mesh: PrismMesh, faceId: string): PrismMesh {
  const newMesh: PrismMesh = JSON.parse(JSON.stringify(mesh));
  newMesh.faces = newMesh.faces.filter(f => f.id !== faceId);
  newMesh.edges = newMesh.edges.filter(e => !e.faceIds.includes(faceId));
  for (const edge of newMesh.edges) {
    edge.faceIds = edge.faceIds.filter(fid => fid !== faceId);
  }
  return newMesh;
}

function computeNormal(verts: Vertex[]): Vertex {
  if (verts.length < 3) return { x: 0, y: 1, z: 0 };
  const a = verts[0], b = verts[1], c = verts[2];
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  let nx = ab.y * ac.z - ab.z * ac.y;
  let ny = ab.z * ac.x - ab.x * ac.z;
  let nz = ab.x * ac.y - ab.y * ac.x;
  const len = Math.hypot(nx, ny, nz);
  if (len !== 0) { nx /= len; ny /= len; nz /= len; }
  return { x: nx, y: ny, z: nz };
}

function computeCenter(verts: Vertex[]): Vertex {
  const sum = verts.reduce((acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y, z: acc.z + v.z }), { x: 0, y: 0, z: 0 });
  const count = verts.length;
  return { x: sum.x / count, y: sum.y / count, z: sum.z / count };
}
