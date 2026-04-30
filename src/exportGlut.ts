import { computeCubeExtents, type SceneObject, type Space } from './scene'

import { exportPrismToGlut } from './exportGlutExtended';

const toF = (v: number) => v.toFixed(3) + 'f'

const sanitizeName = (name: string, fallback: string) => {
  const trimmed = name.trim()
  return trimmed.length > 0 ? trimmed.replace(/[^a-zA-Z0-9_]/g, '_') : fallback
}

/**
 * Emit 3D draw calls that match exactly how Viewport3D.tsx renders each shape.
 *
 * Viewport3D already applies position/rotation/scale on the outer <group>,
 * so these functions only emit the intrinsic geometry --- the part inside the group.
 */
function emit3DObject(lines: string[], object: SceneObject, customPrismDefs: string[]) {
  switch (object.kind) {
    case 'cube': {
      const ext = computeCubeExtents(object);
      const sx = ext.xPos + ext.xNeg;
      const sy = ext.yPos + ext.yNeg;
      const sz = ext.zPos + ext.zNeg;
      const cx = (ext.xPos - ext.xNeg) / 2;
      const cz = (ext.zPos - ext.zNeg) / 2;

      const fc = object.faceColors ?? {}
      const hasAnyFaceColor = Object.keys(fc).length > 0

      if (!hasAnyFaceColor) {
        // Fast path: uniform color, use glutSolidCube
        if (Math.abs(cx) > 0.001 || Math.abs(cz) > 0.001) {
          lines.push(`  glTranslatef(${toF(cx)}, 0.0f, ${toF(cz)});`);
        }
        lines.push(`  glScalef(${toF(sx)}, ${toF(sy)}, ${toF(sz)});`)
        lines.push(`  glutSolidCube(1.0);`)
      } else {
        // Per-face colors: emit GL_QUADS manually
        const hx = sx / 2, hy = sy / 2, hz = sz / 2
        const faceColor = (key: string) => {
          const c = fc[key] ?? object.color
          return `  glColor3f(${toF(c[0])}, ${toF(c[1])}, ${toF(c[2])});`
        }
        if (Math.abs(cx) > 0.001 || Math.abs(cz) > 0.001) {
          lines.push(`  glTranslatef(${toF(cx)}, 0.0f, ${toF(cz)});`);
        }
        lines.push(`  glBegin(GL_QUADS);`)
        // Top (yPos)
        lines.push(faceColor('yPos'))
        lines.push(`  glNormal3f(0,1,0); glVertex3f(${toF(-hx)},${toF(hy)},${toF(-hz)}); glVertex3f(${toF(hx)},${toF(hy)},${toF(-hz)}); glVertex3f(${toF(hx)},${toF(hy)},${toF(hz)}); glVertex3f(${toF(-hx)},${toF(hy)},${toF(hz)});`)
        // Bottom (yNeg)
        lines.push(faceColor('yNeg'))
        lines.push(`  glNormal3f(0,-1,0); glVertex3f(${toF(-hx)},${toF(-hy)},${toF(hz)}); glVertex3f(${toF(hx)},${toF(-hy)},${toF(hz)}); glVertex3f(${toF(hx)},${toF(-hy)},${toF(-hz)}); glVertex3f(${toF(-hx)},${toF(-hy)},${toF(-hz)});`)
        // Front (zPos)
        lines.push(faceColor('zPos'))
        lines.push(`  glNormal3f(0,0,1); glVertex3f(${toF(-hx)},${toF(-hy)},${toF(hz)}); glVertex3f(${toF(hx)},${toF(-hy)},${toF(hz)}); glVertex3f(${toF(hx)},${toF(hy)},${toF(hz)}); glVertex3f(${toF(-hx)},${toF(hy)},${toF(hz)});`)
        // Back (zNeg)
        lines.push(faceColor('zNeg'))
        lines.push(`  glNormal3f(0,0,-1); glVertex3f(${toF(hx)},${toF(-hy)},${toF(-hz)}); glVertex3f(${toF(-hx)},${toF(-hy)},${toF(-hz)}); glVertex3f(${toF(-hx)},${toF(hy)},${toF(-hz)}); glVertex3f(${toF(hx)},${toF(hy)},${toF(-hz)});`)
        // Right (xPos)
        lines.push(faceColor('xPos'))
        lines.push(`  glNormal3f(1,0,0); glVertex3f(${toF(hx)},${toF(-hy)},${toF(hz)}); glVertex3f(${toF(hx)},${toF(-hy)},${toF(-hz)}); glVertex3f(${toF(hx)},${toF(hy)},${toF(-hz)}); glVertex3f(${toF(hx)},${toF(hy)},${toF(hz)});`)
        // Left (xNeg)
        lines.push(faceColor('xNeg'))
        lines.push(`  glNormal3f(-1,0,0); glVertex3f(${toF(-hx)},${toF(-hy)},${toF(-hz)}); glVertex3f(${toF(-hx)},${toF(-hy)},${toF(hz)}); glVertex3f(${toF(-hx)},${toF(hy)},${toF(hz)}); glVertex3f(${toF(-hx)},${toF(-hy)},${toF(-hz)});`)
        lines.push(`  glEnd();`)
        // Restore object color after
        lines.push(`  glColor3f(${toF(object.color[0])}, ${toF(object.color[1])}, ${toF(object.color[2])});`)
      }
      break
    }
    case 'sphere': {
      lines.push(`  glutSolidSphere(${toF(object.radius)}, ${object.segments}, ${Math.round(object.segments * 0.75)});`)
      break
    }
    case 'cone': {
      lines.push(`  glRotatef(-90.0f, 1.0f, 0.0f, 0.0f);`)
      lines.push(`  glutSolidCone(${toF(object.radius)}, ${toF(object.height)}, ${object.segments}, 1);`)
      break
    }
    case 'torus': {
      lines.push(`  glutSolidTorus(${toF(object.innerRadius)}, ${toF(object.outerRadius)}, ${object.sides}, ${object.segments});`)
      break
    }
    case 'teapot': {
      lines.push(`  glutSolidTeapot(1.0);`)
      break
    }
    case 'ground':
      // Viewport3D: <boxGeometry args={[width, height, depth]} />
      lines.push(`  glScalef(${toF(object.width)}, ${toF(object.height)}, ${toF(object.depth)});`)
      lines.push(`  glutSolidCube(1.0);`)
      break
    case 'prism': {
      if ((object as any).prismMesh) {
        const mesh = (object as any).prismMesh;
        const funcName = `prism_${object.id.replace(/-/g, '_')}`;
        const customFunc = exportPrismToGlut(mesh, funcName);
        customPrismDefs.push(customFunc);
        lines.push(`  draw${funcName}();`);
      } else {
        // Fallback triangular prism (3 sides) --- centered origin, with per-face colors
        const fc = object.faceColors ?? {}
        const faceColor = (key: string) => {
          const c = fc[key] ?? object.color
          return `  glColor3f(${toF(c[0])}, ${toF(c[1])}, ${toF(c[2])});`
        }
        const r = object.radius;
        const hh = object.height / 2;
        const pts: [number, number][] = [];
        for (let i = 0; i < 3; i++) {
          const angle = (Math.PI / 2) + (i * 2 * Math.PI / 3);
          pts.push([r * Math.cos(angle), r * Math.sin(angle)]);
        }
        lines.push(`  // Triangular prism (centered, per-face colors)`);
        // Top cap
        lines.push(faceColor('top'))
        lines.push(`  glBegin(GL_TRIANGLES);`);
        lines.push(`  glNormal3f(0.0, 1.0, 0.0);`);
        for (const [x, z] of pts) lines.push(`  glVertex3f(${toF(x)}, ${toF(hh)}, ${toF(z)});`);
        lines.push(`  glEnd();`);
        // Bottom cap
        lines.push(faceColor('bottom'))
        lines.push(`  glBegin(GL_TRIANGLES);`);
        lines.push(`  glNormal3f(0.0, -1.0, 0.0);`);
        for (let i = 2; i >= 0; i--) lines.push(`  glVertex3f(${toF(pts[i][0])}, ${toF(-hh)}, ${toF(pts[i][1])});`);
        lines.push(`  glEnd();`);
        // Sides
        lines.push(`  glBegin(GL_QUADS);`);
        for (let i = 0; i < 3; i++) {
          const j = (i + 1) % 3;
          const [x1, z1] = pts[i], [x2, z2] = pts[j];
          const dx = x2 - x1, dz = z2 - z1;
          const len = Math.hypot(dx, dz);
          const nx = dz / len, nz = -dx / len;
          lines.push(faceColor(`side${i}`))
          lines.push(`  glNormal3f(${toF(nx)}, 0.0, ${toF(nz)});`);
          lines.push(`  glVertex3f(${toF(x1)}, ${toF(-hh)}, ${toF(z1)});`);
          lines.push(`  glVertex3f(${toF(x2)}, ${toF(-hh)}, ${toF(z2)});`);
          lines.push(`  glVertex3f(${toF(x2)}, ${toF(hh)}, ${toF(z2)});`);
          lines.push(`  glVertex3f(${toF(x1)}, ${toF(hh)}, ${toF(z1)});`);
        }
        lines.push(`  glEnd();`);
        // Restore
        lines.push(`  glColor3f(${toF(object.color[0])}, ${toF(object.color[1])}, ${toF(object.color[2])});`);
      }
      break;
    }
    default:
      lines.push(`  glutSolidCube(1.0);`)
  }
}

function emit2DObject(lines: string[], object: SceneObject) {
  switch (object.kind) {
    case 'line':
      lines.push(`  glLineWidth(${toF(object.thickness)});`)
      lines.push(`  glBegin(GL_LINES);`)
      lines.push(`  glVertex2f(${toF(-object.length / 2)}, 0.0f);`)
      lines.push(`  glVertex2f(${toF(object.length / 2)}, 0.0f);`)
      lines.push(`  glEnd();`)
      lines.push(`  glLineWidth(1.0f);`)
      break
    case 'rect':
      lines.push(`  glBegin(GL_QUADS);`)
      lines.push(`  glVertex2f(${toF(-object.width / 2)}, ${toF(-object.height / 2)});`)
      lines.push(`  glVertex2f(${toF(object.width / 2)}, ${toF(-object.height / 2)});`)
      lines.push(`  glVertex2f(${toF(object.width / 2)}, ${toF(object.height / 2)});`)
      lines.push(`  glVertex2f(${toF(-object.width / 2)}, ${toF(object.height / 2)});`)
      lines.push(`  glEnd();`)
      break
    case 'circle': {
      const segs = Math.max(8, object.segments)
      lines.push(`  glBegin(GL_TRIANGLE_FAN);`)
      lines.push(`  glVertex2f(0.0f, 0.0f);`)
      lines.push(`  for (int i = 0; i <= ${segs}; i++) {`)
      lines.push(`    float angle = 2.0f * 3.14159265f * i / ${segs}.0f;`)
      lines.push(`    glVertex2f(${toF(object.radius)} * cosf(angle), ${toF(object.radius)} * sinf(angle));`)
      lines.push(`  }`)
      lines.push(`  glEnd();`)
      break
    }
    case 'polygon': {
      const s = Math.max(3, object.sides)
      lines.push(`  glBegin(GL_POLYGON);`)
      lines.push(`  for (int i = 0; i < ${s}; i++) {`)
      lines.push(`    float angle = 2.0f * 3.14159265f * i / ${s}.0f;`)
      lines.push(`    glVertex2f(${toF(object.radius)} * cosf(angle), ${toF(object.radius)} * sinf(angle));`)
      lines.push(`  }`)
      lines.push(`  glEnd();`)
      break
    }
    default:
      lines.push(`  glBegin(GL_LINE_LOOP);`)
      lines.push(`  glVertex2f(-0.5f, -0.5f);`)
      lines.push(`  glVertex2f(0.5f, -0.5f);`)
      lines.push(`  glVertex2f(0.5f, 0.5f);`)
      lines.push(`  glVertex2f(-0.5f, 0.5f);`)
      lines.push(`  glEnd();`)
  }
}

export const exportGlutProgram = (space: Space, objects: SceneObject[]) => {
  const lines: string[] = []
  const is3D = space === '3d'
  const customPrismDefs: string[] = []

  // Includes
  lines.push('#include <GL/glut.h>')
  lines.push('#include <math.h>')
  lines.push('')

  // Window dimensions
  lines.push('int windowWidth = 800;')
  lines.push('int windowHeight = 600;')
  lines.push('')

  // Camera variables for WASD movement
  if (is3D) {
    lines.push('// Camera position and angle')
    lines.push('float camX = 0.0f, camY = 1.6f, camZ = 8.0f;')
    lines.push('float camAngleX = 0.0f, camAngleY = 0.0f;')
    lines.push('float moveSpeed = 0.3f;')
    lines.push('float lookSpeed = 0.3f;')
    lines.push('')
    lines.push('// Mouse tracking')
    lines.push('int lastMouseX = -1, lastMouseY = -1;')
    lines.push('int mouseDown = 0;')
    lines.push('')
  } else {
    lines.push('// Camera pan for 2D')
    lines.push('float camPanX = 0.0f, camPanY = 0.0f;')
    lines.push('float panSpeed = 0.3f;')
    lines.push('')
  }

  // Init function
  lines.push('void init() {')
  lines.push('  glClearColor(0.12f, 0.12f, 0.15f, 1.0f);')
  if (is3D) {
    lines.push('  glEnable(GL_DEPTH_TEST);')
    lines.push('  glEnable(GL_LIGHTING);')
    lines.push('  glEnable(GL_LIGHT0);')
    lines.push('  glEnable(GL_COLOR_MATERIAL);')
    lines.push('  glColorMaterial(GL_FRONT_AND_BACK, GL_AMBIENT_AND_DIFFUSE);')
    lines.push('')
    lines.push('  GLfloat lightPos[] = { 4.0f, 6.0f, 5.0f, 1.0f };')
    lines.push('  GLfloat lightAmb[] = { 0.3f, 0.3f, 0.3f, 1.0f };')
    lines.push('  GLfloat lightDif[] = { 0.8f, 0.8f, 0.8f, 1.0f };')
    lines.push('  glLightfv(GL_LIGHT0, GL_POSITION, lightPos);')
    lines.push('  glLightfv(GL_LIGHT0, GL_AMBIENT, lightAmb);')
    lines.push('  glLightfv(GL_LIGHT0, GL_DIFFUSE, lightDif);')
  }
  lines.push('}')
  lines.push('')

  // Reshape function
  lines.push('void reshape(int w, int h) {')
  lines.push('  windowWidth = w;')
  lines.push('  windowHeight = h;')
  lines.push('  glViewport(0, 0, w, h);')
  lines.push('  glMatrixMode(GL_PROJECTION);')
  lines.push('  glLoadIdentity();')
  if (is3D) {
    lines.push('  gluPerspective(45.0, (double)w / (double)h, 0.1, 100.0);')
  } else {
    lines.push('  float aspect = (float)w / (float)h;')
    lines.push('  float range = 5.0f;')
    lines.push('  if (aspect >= 1.0f)')
    lines.push('    gluOrtho2D(-range * aspect, range * aspect, -range, range);')
    lines.push('  else')
    lines.push('    gluOrtho2D(-range, range, -range / aspect, range / aspect);')
  }
  lines.push('  glMatrixMode(GL_MODELVIEW);')
  lines.push('}')
  lines.push('')

  // Display function --- matches Viewport3D camera exactly
  lines.push('void display() {')
  if (is3D) {
    lines.push('  glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);')
  } else {
    lines.push('  glClear(GL_COLOR_BUFFER_BIT);')
  }
  lines.push('  glLoadIdentity();')
  if (is3D) {
    // Use camera variables instead of fixed position
    lines.push('  float lookX = camX - sinf(camAngleY * 3.14159265f / 180.0f);')
    lines.push('  float lookY = camY + sinf(camAngleX * 3.14159265f / 180.0f);')
    lines.push('  float lookZ = camZ - cosf(camAngleY * 3.14159265f / 180.0f);')
    lines.push('  gluLookAt(camX, camY, camZ,  lookX, lookY, lookZ,  0.0, 1.0, 0.0);')
  } else {
    lines.push('  glTranslatef(camPanX, camPanY, 0.0f);')
  }
  lines.push('')

  if (objects.length === 0) {
    lines.push('  // No objects in scene.')
  }

  // Each object: push matrix, apply transform, draw, pop
  objects.forEach((object, index) => {
    const name = sanitizeName(object.name, `object_${index + 1}`)
    lines.push(`  // --- ${name} ---`)
    lines.push(`  glPushMatrix();`)

    // Position (same as group position)
    lines.push(`  glTranslatef(${toF(object.position[0])}, ${toF(object.position[1])}, ${toF(object.position[2])});`)

    // Rotation --- Viewport3D converts degrees to radians for Three.js
    // glRotatef takes degrees, so we pass object.rotation directly
    if (object.rotation[0] !== 0)
      lines.push(`  glRotatef(${toF(object.rotation[0])}, 1.0f, 0.0f, 0.0f);`)
    if (object.rotation[1] !== 0)
      lines.push(`  glRotatef(${toF(object.rotation[1])}, 0.0f, 1.0f, 0.0f);`)
    if (object.rotation[2] !== 0)
      lines.push(`  glRotatef(${toF(object.rotation[2])}, 0.0f, 0.0f, 1.0f);`)

    // Scale (same as group scale --- no scaleBoost in export)
    lines.push(`  glScalef(${toF(object.scale[0])}, ${toF(object.scale[1])}, ${toF(object.scale[2])});`)

    // Color
    lines.push(`  glColor3f(${toF(object.color[0])}, ${toF(object.color[1])}, ${toF(object.color[2])});`)

    // Draw the shape (intrinsic geometry only)
    if (is3D) {
      emit3DObject(lines, object, customPrismDefs)
    } else {
      emit2DObject(lines, object)
    }

    lines.push(`  glPopMatrix();`)
    lines.push('')
  })

  lines.push('  glutSwapBuffers();')
  lines.push('}')
  lines.push('')

  // Keyboard handler --- WASD movement
  if (is3D) {
    lines.push('void keyboard(unsigned char key, int x, int y) {')
    lines.push('  (void)x; (void)y;')
    lines.push('  float radY = camAngleY * 3.14159265f / 180.0f;')
    lines.push('  float dirX = -sinf(radY);')
    lines.push('  float dirZ = -cosf(radY);')
    lines.push('  switch (key) {')
    lines.push('    case \'w\': case \'W\':')
    lines.push('      camX += dirX * moveSpeed;')
    lines.push('      camZ += dirZ * moveSpeed;')
    lines.push('      break;')
    lines.push('    case \'s\': case \'S\':')
    lines.push('      camX -= dirX * moveSpeed;')
    lines.push('      camZ -= dirZ * moveSpeed;')
    lines.push('      break;')
    lines.push('    case \'a\': case \'A\':')
    lines.push('      camX += dirZ * moveSpeed;')
    lines.push('      camZ -= dirX * moveSpeed;')
    lines.push('      break;')
    lines.push('    case \'d\': case \'D\':')
    lines.push('      camX -= dirZ * moveSpeed;')
    lines.push('      camZ += dirX * moveSpeed;')
    lines.push('      break;')
    lines.push('    case \'q\': case \'Q\':')
    lines.push('      camY += moveSpeed;')
    lines.push('      break;')
    lines.push('    case \'e\': case \'E\':')
    lines.push('      camY -= moveSpeed;')
    lines.push('      break;')
    lines.push('    case 27: // ESC')
    lines.push('      exit(0);')
    lines.push('      break;')
    lines.push('  }')
    lines.push('  glutPostRedisplay();')
    lines.push('}')
    lines.push('')
    lines.push('void mouseButton(int button, int state, int x, int y) {')
    lines.push('  if (button == GLUT_LEFT_BUTTON) {')
    lines.push('    if (state == GLUT_DOWN) {')
    lines.push('      mouseDown = 1;')
    lines.push('      lastMouseX = x;')
    lines.push('      lastMouseY = y;')
    lines.push('    } else {')
    lines.push('      mouseDown = 0;')
    lines.push('    }')
    lines.push('  }')
    lines.push('}')
    lines.push('')
    lines.push('void mouseMotion(int x, int y) {')
    lines.push('  if (mouseDown) {')
    lines.push('    camAngleY += (x - lastMouseX) * lookSpeed;')
    lines.push('    camAngleX += (lastMouseY - y) * lookSpeed;')
    lines.push('    if (camAngleX > 89.0f) camAngleX = 89.0f;')
    lines.push('    if (camAngleX < -89.0f) camAngleX = -89.0f;')
    lines.push('    lastMouseX = x;')
    lines.push('    lastMouseY = y;')
    lines.push('    glutPostRedisplay();')
    lines.push('  }')
    lines.push('}')
    lines.push('')
    // Arrow keys for Y axis and strafing
    lines.push('void specialKeys(int key, int x, int y) {')
    lines.push('  (void)x; (void)y;')
    lines.push('  float radY = camAngleY * 3.14159265f / 180.0f;')
    lines.push('  float dirX = -sinf(radY);')
    lines.push('  float dirZ = -cosf(radY);')
    lines.push('  switch (key) {')
    lines.push('    case GLUT_KEY_UP:')
    lines.push('      camY += moveSpeed;')
    lines.push('      break;')
    lines.push('    case GLUT_KEY_DOWN:')
    lines.push('      camY -= moveSpeed;')
    lines.push('      break;')
    lines.push('    case GLUT_KEY_LEFT:')
    lines.push('      camX += dirZ * moveSpeed;')
    lines.push('      camZ -= dirX * moveSpeed;')
    lines.push('      break;')
    lines.push('    case GLUT_KEY_RIGHT:')
    lines.push('      camX -= dirZ * moveSpeed;')
    lines.push('      camZ += dirX * moveSpeed;')
    lines.push('      break;')
    lines.push('  }')
    lines.push('  glutPostRedisplay();')
    lines.push('}')
    lines.push('')
  } else {
    lines.push('void keyboard(unsigned char key, int x, int y) {')
    lines.push('  (void)x; (void)y;')
    lines.push('  switch (key) {')
    lines.push('    case \'w\': case \'W\': camPanY += panSpeed; break;')
    lines.push('    case \'s\': case \'S\': camPanY -= panSpeed; break;')
    lines.push('    case \'a\': case \'A\': camPanX -= panSpeed; break;')
    lines.push('    case \'d\': case \'D\': camPanX += panSpeed; break;')
    lines.push('    case 27: exit(0); break;')
    lines.push('  }')
    lines.push('  glutPostRedisplay();')
    lines.push('}')
    lines.push('')
    // Arrow keys for 2D panning
    lines.push('void specialKeys(int key, int x, int y) {')
    lines.push('  (void)x; (void)y;')
    lines.push('  switch (key) {')
    lines.push('    case GLUT_KEY_UP: camPanY += panSpeed; break;')
    lines.push('    case GLUT_KEY_DOWN: camPanY -= panSpeed; break;')
    lines.push('    case GLUT_KEY_LEFT: camPanX -= panSpeed; break;')
    lines.push('    case GLUT_KEY_RIGHT: camPanX += panSpeed; break;')
    lines.push('  }')
    lines.push('  glutPostRedisplay();')
    lines.push('}')
    lines.push('')
  }

  // Main function
  lines.push('int main(int argc, char** argv) {')
  lines.push('  glutInit(&argc, argv);')
  if (is3D) {
    lines.push('  glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB | GLUT_DEPTH);')
  } else {
    lines.push('  glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB);')
  }
  lines.push('  glutInitWindowSize(windowWidth, windowHeight);')
  lines.push(`  glutCreateWindow("Three GLUT - ${is3D ? '3D' : '2D'} Scene");`)
  lines.push('')
  lines.push('  init();')
  lines.push('')
  lines.push('  glutDisplayFunc(display);')
  lines.push('  glutReshapeFunc(reshape);')
  lines.push('  glutKeyboardFunc(keyboard);')
  lines.push('  glutSpecialFunc(specialKeys);')
  if (is3D) {
    lines.push('  glutMouseFunc(mouseButton);')
    lines.push('  glutMotionFunc(mouseMotion);')
  }
  lines.push('  glutMainLoop();')
  lines.push('')
  lines.push('  return 0;')
  lines.push('}')
  lines.push('')

  const customDefs = customPrismDefs.join('\n\n');

  return lines.join('\n') + '\n\n' + customDefs;
}
