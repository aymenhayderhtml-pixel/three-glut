import { PrismMesh, Face } from '../types/prism.types';

/**
 * Deletes a face from the mesh, leaving an opening.
 * For GLUT export, this will be exported as missing polygons.
 */
export function deleteFace(mesh: PrismMesh, faceId: string): PrismMesh {
    const faceIndex = mesh.faces.findIndex(f => f.id === faceId);
    if (faceIndex === -1) return mesh;

    const newMesh: PrismMesh = {
        ...mesh,
        vertices: mesh.vertices.map(v => ({ ...v })),
        faces: mesh.faces.filter(f => f.id !== faceId),
        edges: mesh.edges.filter(e => !e.faceIds.includes(faceId)),
    };

    // Remove references to this face from remaining edges
    for (const edge of newMesh.edges) {
        edge.faceIds = edge.faceIds.filter(fid => fid !== faceId);
    }

    return newMesh;
}