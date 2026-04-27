import { PrismMesh, Vertex, Edge } from '../types/prism.types';

/**
 * Applies a simple uniform bevel to an edge.
 * This moves the two vertices of the edge inward along the adjacent faces' normals.
 * For a basic implementation, we displace the vertices along the average of the normals
 * of the two faces that share the edge.
 */
export function bevelEdge(mesh: PrismMesh, edgeId: string, amount: number): PrismMesh {
    const edge = mesh.edges.find(e => e.id === edgeId);
    if (!edge || edge.faceIds.length < 2) return mesh;

    // Deep clone
    const newMesh: PrismMesh = {
        ...mesh,
        vertices: mesh.vertices.map(v => ({ ...v })),
        faces: mesh.faces.map(f => ({ ...f, vertices: f.vertices.map(v => ({ ...v })) })),
        edges: mesh.edges.map(e => ({ ...e })),
    };

    const [i1, i2] = edge.vertexIndices;
    const v1 = newMesh.vertices[i1];
    const v2 = newMesh.vertices[i2];

    // Get the two faces
    const face1 = newMesh.faces.find(f => f.id === edge.faceIds[0]);
    const face2 = newMesh.faces.find(f => f.id === edge.faceIds[1]);
    if (!face1 || !face2) return mesh;

    // Compute average normal of the two faces (direction to move vertices)
    const avgNormal = {
        x: (face1.normal.x + face2.normal.x) / 2,
        y: (face1.normal.y + face2.normal.y) / 2,
        z: (face1.normal.z + face2.normal.z) / 2,
    };
    const len = Math.hypot(avgNormal.x, avgNormal.y, avgNormal.z);
    if (len > 0.001) {
        avgNormal.x /= len;
        avgNormal.y /= len;
        avgNormal.z /= len;
    }

    const offset = amount * 0.5; // half each side (simple)
    v1.x += avgNormal.x * offset;
    v1.y += avgNormal.y * offset;
    v1.z += avgNormal.z * offset;
    v2.x += avgNormal.x * offset;
    v2.y += avgNormal.y * offset;
    v2.z += avgNormal.z * offset;

    // Recompute affected faces (the two faces plus any others sharing vertices)
    const affectedFaceIds = new Set<string>([edge.faceIds[0], edge.faceIds[1]]);
    for (const idx of [i1, i2]) {
        for (const e of newMesh.edges) {
            if (e.vertexIndices.includes(idx)) {
                e.faceIds.forEach(fid => affectedFaceIds.add(fid));
            }
        }
    }

    for (const fid of affectedFaceIds) {
        const face = newMesh.faces.find(f => f.id === fid);
        if (face) {
            face.normal = computeNormal(face.vertices);
            face.center = computeCenter(face.vertices);
        }
    }

    return newMesh;
}

function computeNormal(verts: Vertex[]): Vertex {
    if (verts.length < 3) return { x: 0, y: 0, z: 0 };
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