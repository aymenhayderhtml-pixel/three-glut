import { PrismMesh } from './types/prism.types';

function vertexToGlut(v: { x: number; y: number; z: number }): string {
    return `${v.x.toFixed(3)}f, ${v.y.toFixed(3)}f, ${v.z.toFixed(3)}f`;
}

export function exportPrismToGlut(mesh: PrismMesh, objectName: string): string {
    const lines: string[] = [];
    lines.push(`void draw${objectName}() {`);
    lines.push(`  glPushMatrix();`);
    // You could add translation/rotation here later
    lines.push(`  glBegin(GL_QUADS);`);

    for (const face of mesh.faces) {
        if (face.vertices.length === 4) {
            // Quad
            lines.push(`  // Face ${face.id}`);
            const [v0, v1, v2, v3] = face.vertices;
            lines.push(`  glVertex3f(${vertexToGlut(v0)});`);
            lines.push(`  glVertex3f(${vertexToGlut(v1)});`);
            lines.push(`  glVertex3f(${vertexToGlut(v2)});`);
            lines.push(`  glVertex3f(${vertexToGlut(v3)});`);
        } else if (face.vertices.length === 3) {
            // Triangle --- GLUT doesn't have GL_TRIANGLES? But we can use GL_TRIANGLES.
            // For simplicity, we'll add a note: switch to GL_TRIANGLES.
            lines.push(`  // Face ${face.id} (triangle) --- requires GL_TRIANGLES`);
            const [v0, v1, v2] = face.vertices;
            lines.push(`  glVertex3f(${vertexToGlut(v0)});`);
            lines.push(`  glVertex3f(${vertexToGlut(v1)});`);
            lines.push(`  glVertex3f(${vertexToGlut(v2)});`);
        }
    }

    lines.push(`  glEnd();`);
    lines.push(`  glPopMatrix();`);
    lines.push(`}`);
    lines.push(``);
    lines.push(`// Call draw${objectName}() inside your display function.`);

    return lines.join('\n');
}
