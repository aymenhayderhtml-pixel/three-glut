import { PrismMesh, Face, Vertex } from '../types/prism.types';

/**
 * Extrudes a face outward along its normal by a given delta.
 * The selected face keeps its original shape and size; adjacent faces stretch.
 * Opposite face remains fixed.
 */
export function extrudeFace(mesh: PrismMesh, faceId: string, delta: number): PrismMesh {
    // Find the face to extrude
    const targetFace = mesh.faces.find(f => f.id === faceId);
    if (!targetFace) return mesh;

    // Deep clone the mesh
    const newMesh: PrismMesh = {
        ...mesh,
        vertices: mesh.vertices.map(v => ({ ...v })),
        faces: mesh.faces.map(f => ({ ...f, vertices: f.vertices.map(v => ({ ...v })) })),
        edges: mesh.edges.map(e => ({ ...e })),
    };

    // Get the indices of vertices belonging to the target face
    const vertexIndices = targetFace.indices;

    // Move those vertices outward along the face normal
    const { normal } = targetFace;
    const offset = { x: normal.x * delta, y: normal.y * delta, z: normal.z * delta };

    for (const idx of vertexIndices) {
        newMesh.vertices[idx].x += offset.x;
        newMesh.vertices[idx].y += offset.y;
        newMesh.vertices[idx].z += offset.z;
    }

    // Update affected faces (those sharing moved vertices)
    const affectedFaceIds = new Set<string>();
    for (const idx of vertexIndices) {
        for (const edge of newMesh.edges) {
            if (edge.vertexIndices[0] === idx || edge.vertexIndices[1] === idx) {
                edge.faceIds.forEach(fid => affectedFaceIds.add(fid));
            }
        }
    }

    // Recompute normals and centers for affected faces
    for (const fid of affectedFaceIds) {
        const face = newMesh.faces.find(f => f.id === fid);
        if (face) {
            // Recompute normal from vertices
            face.normal = computeNormal(face.vertices);
            face.center = computeCenter(face.vertices);
        }
    }

    return newMesh;
}

function computeNormal(verts: Vertex[]): Vertex {
    if (verts.length < 3) return { x: 0, y: 0, z: 0 };
    // Use first three vertices for a triangle normal
    const a = verts[0];
    const b = verts[1];
    const c = verts[2];
    const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    let nx = ab.y * ac.z - ab.z * ac.y;
    let ny = ab.z * ac.x - ab.x * ac.z;
    let nz = ab.x * ac.y - ab.y * ac.x;
    const len = Math.hypot(nx, ny, nz);
    if (len !== 0) {
        nx /= len;
        ny /= len;
        nz /= len;
    }
    return { x: nx, y: ny, z: nz };
}

function computeCenter(verts: Vertex[]): Vertex {
    const sum = verts.reduce((acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y, z: acc.z + v.z }), { x: 0, y: 0, z: 0 });
    const count = verts.length;
    return { x: sum.x / count, y: sum.y / count, z: sum.z / count };
}