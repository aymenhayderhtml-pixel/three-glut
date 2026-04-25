import { Vertex, Face, Edge, PrismMesh } from '../types/prism.types';

export function generatePrismMesh(sides: number, height: number, radius: number): PrismMesh {
    const vertices: Vertex[] = [];
    const faces: Face[] = [];
    const edges: Edge[] = [];
    const edgeMap = new Map<string, string[]>(); // key "i,j" -> face ids

    // Angle step
    const angleStep = (2 * Math.PI) / sides;

    // 1. Generate vertices: bottom ring, top ring
    for (let i = 0; i < sides; i++) {
        const angle = i * angleStep;
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        // bottom
        vertices.push({ x, y: -height / 2, z });
        // top
        vertices.push({ x, y: height / 2, z });
    }

    // Helper: add edge between two vertex indices
    function addEdge(i1: number, i2: number, faceId: string) {
        const key = i1 < i2 ? `${i1},${i2}` : `${i2},${i1}`;
        if (!edgeMap.has(key)) edgeMap.set(key, []);
        edgeMap.get(key)!.push(faceId);
    }

    // 2. Generate side faces (quads)
    for (let i = 0; i < sides; i++) {
        const next = (i + 1) % sides;
        const bottomCurrent = i * 2;
        const topCurrent = i * 2 + 1;
        const bottomNext = next * 2;
        const topNext = next * 2 + 1;

        const quadVertices = [
            vertices[bottomCurrent],
            vertices[bottomNext],
            vertices[topNext],
            vertices[topCurrent],
        ];

        // compute normal (cross product of two edges)
        const normal = computeNormal(quadVertices);
        const center = computeCenter(quadVertices);

        const face: Face = {
            id: `side_${i}`,
            vertices: quadVertices,
            normal,
            center,
            indices: [bottomCurrent, bottomNext, topNext, topCurrent],
        };
        faces.push(face);

        // edges
        addEdge(bottomCurrent, bottomNext, face.id);
        addEdge(bottomNext, topNext, face.id);
        addEdge(topNext, topCurrent, face.id);
        addEdge(topCurrent, bottomCurrent, face.id);
    }

    // 3. Bottom face (polygon)
    const bottomIndices: number[] = [];
    for (let i = 0; i < sides; i++) bottomIndices.push(i * 2);
    const bottomVertices = bottomIndices.map(idx => vertices[idx]);
    const bottomNormal = { x: 0, y: -1, z: 0 };
    const bottomCenter = computeCenter(bottomVertices);
    const bottomFace: Face = {
        id: 'bottom',
        vertices: bottomVertices,
        normal: bottomNormal,
        center: bottomCenter,
        indices: bottomIndices,
    };
    faces.push(bottomFace);
    // add bottom edges
    for (let i = 0; i < sides; i++) {
        const next = (i + 1) % sides;
        addEdge(i * 2, next * 2, bottomFace.id);
    }

    // 4. Top face
    const topIndices: number[] = [];
    for (let i = 0; i < sides; i++) topIndices.push(i * 2 + 1);
    const topVertices = topIndices.map(idx => vertices[idx]);
    const topNormal = { x: 0, y: 1, z: 0 };
    const topCenter = computeCenter(topVertices);
    const topFace: Face = {
        id: 'top',
        vertices: topVertices,
        normal: topNormal,
        center: topCenter,
        indices: topIndices,
    };
    faces.push(topFace);
    for (let i = 0; i < sides; i++) {
        const next = (i + 1) % sides;
        addEdge(i * 2 + 1, next * 2 + 1, topFace.id);
    }

    // Build edges array from map
    for (const [key, faceIds] of edgeMap.entries()) {
        const [i1, i2] = key.split(',').map(Number);
        edges.push({
            id: `edge_${i1}_${i2}`,
            vertexIndices: [i1, i2],
            faceIds,
        });
    }

    return {
        vertices,
        faces,
        edges,
        sides,
        height,
        radius,
    };
}

function computeNormal(verts: Vertex[]): Vertex {
    // simple for quads: average of two triangle normals
    const a = verts[0];
    const b = verts[1];
    const c = verts[2];
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