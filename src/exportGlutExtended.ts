import { PrismMesh } from './types/prism.types';

function vertexToGlut(v: { x: number; y: number; z: number }): string {
  return `${v.x.toFixed(3)}f, ${v.y.toFixed(3)}f, ${v.z.toFixed(3)}f`;
}

/**
 * Export a PrismMesh to a GLUT C function.
 * Triangles and quads are emitted in separate glBegin/glEnd blocks with
 * the correct primitive type — mixing them inside a single GL_QUADS block
 * produces corrupted geometry.
 */
export function exportPrismToGlut(mesh: PrismMesh, objectName: string): string {
  const lines: string[] = [];
  lines.push(`void draw${objectName}() {`);
  lines.push(`  glPushMatrix();`);

  const quads = mesh.faces.filter((f) => f.vertices.length === 4);
  const tris  = mesh.faces.filter((f) => f.vertices.length === 3);

  // --- Quads ---
  if (quads.length > 0) {
    lines.push(`  glBegin(GL_QUADS);`);
    for (const face of quads) {
      lines.push(`  // Face ${face.id}`);
      const [v0, v1, v2, v3] = face.vertices;
      lines.push(`  glVertex3f(${vertexToGlut(v0)});`);
      lines.push(`  glVertex3f(${vertexToGlut(v1)});`);
      lines.push(`  glVertex3f(${vertexToGlut(v2)});`);
      lines.push(`  glVertex3f(${vertexToGlut(v3)});`);
    }
    lines.push(`  glEnd();`);
  }

  // --- Triangles (e.g. prism top/bottom caps) ---
  if (tris.length > 0) {
    lines.push(`  glBegin(GL_TRIANGLES);`);
    for (const face of tris) {
      lines.push(`  // Face ${face.id}`);
      const [v0, v1, v2] = face.vertices;
      lines.push(`  glVertex3f(${vertexToGlut(v0)});`);
      lines.push(`  glVertex3f(${vertexToGlut(v1)});`);
      lines.push(`  glVertex3f(${vertexToGlut(v2)});`);
    }
    lines.push(`  glEnd();`);
  }

  lines.push(`  glPopMatrix();`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`// Call draw${objectName}() inside your display function.`);

  return lines.join('\n');
}
