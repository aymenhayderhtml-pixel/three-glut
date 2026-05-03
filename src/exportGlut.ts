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
      // Three.js renders the cube as a scaled 1x1x1 box (symmetric around object position).
      // We match that exactly: no cx/cy/cz offset — just use half the total extents.
      const ext = computeCubeExtents(object);
      const hx = (ext.xPos + ext.xNeg) / 2;
      const hy = (ext.yPos + ext.yNeg) / 2;
      const hz = (ext.zPos + ext.zNeg) / 2;

      const fc = object.faceColors ?? {}
      const faceColor = (key: string) => {
        const c = fc[key] ?? object.color
        return `  glColor3f(${toF(c[0])}, ${toF(c[1])}, ${toF(c[2])});`
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
      // Left (xNeg) — fixed: second vertex was duplicated, now correctly uses bottom-front
      lines.push(faceColor('xNeg'))
      lines.push(`  glNormal3f(-1,0,0); glVertex3f(${toF(-hx)},${toF(-hy)},${toF(-hz)}); glVertex3f(${toF(-hx)},${toF(-hy)},${toF(hz)}); glVertex3f(${toF(-hx)},${toF(hy)},${toF(hz)}); glVertex3f(${toF(-hx)},${toF(hy)},${toF(-hz)});`)
      lines.push(`  glEnd();`)
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
    case 'window': {
      const W = object.width
      const H = object.height
      const B = object.borderThickness ?? 0.12
      const glassW = Math.max(0.01, W - B * 2)
      const glassH = Math.max(0.01, H - B * 2)
      const fc = object.frameColor ?? object.color
      const gc = object.color
      const opacity = object.glassOpacity ?? 0.35

      lines.push(`  // Window frame (4 borders) — ${object.name}`)
      lines.push(`  glColor3f(${toF(fc[0])}, ${toF(fc[1])}, ${toF(fc[2])});`)
      lines.push(`  glBegin(GL_QUADS);`)
      // Top border
      lines.push(`  // Top border`)
      lines.push(`  glNormal3f(0,0,1); glVertex3f(${toF(-W/2)},${toF(H/2-B)},0); glVertex3f(${toF(W/2)},${toF(H/2-B)},0); glVertex3f(${toF(W/2)},${toF(H/2)},0); glVertex3f(${toF(-W/2)},${toF(H/2)},0);`)
      // Bottom border
      lines.push(`  // Bottom border`)
      lines.push(`  glNormal3f(0,0,1); glVertex3f(${toF(-W/2)},${toF(-H/2)},0); glVertex3f(${toF(W/2)},${toF(-H/2)},0); glVertex3f(${toF(W/2)},${toF(-H/2+B)},0); glVertex3f(${toF(-W/2)},${toF(-H/2+B)},0);`)
      // Left border
      lines.push(`  // Left border`)
      lines.push(`  glNormal3f(0,0,1); glVertex3f(${toF(-W/2)},${toF(-glassH/2)},0); glVertex3f(${toF(-W/2+B)},${toF(-glassH/2)},0); glVertex3f(${toF(-W/2+B)},${toF(glassH/2)},0); glVertex3f(${toF(-W/2)},${toF(glassH/2)},0);`)
      // Right border
      lines.push(`  // Right border`)
      lines.push(`  glNormal3f(0,0,1); glVertex3f(${toF(W/2-B)},${toF(-glassH/2)},0); glVertex3f(${toF(W/2)},${toF(-glassH/2)},0); glVertex3f(${toF(W/2)},${toF(glassH/2)},0); glVertex3f(${toF(W/2-B)},${toF(glassH/2)},0);`)
      lines.push(`  glEnd();`)
      // Glass (transparent quad)
      lines.push(`  // Glass pane (transparent)`)
      lines.push(`  glEnable(GL_BLEND);`)
      lines.push(`  glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);`)
      lines.push(`  glColor4f(${toF(gc[0])}, ${toF(gc[1])}, ${toF(gc[2])}, ${toF(opacity)});`)
      lines.push(`  glBegin(GL_QUADS);`)
      lines.push(`  glNormal3f(0,0,1); glVertex3f(${toF(-glassW/2)},${toF(-glassH/2)},0); glVertex3f(${toF(glassW/2)},${toF(-glassH/2)},0); glVertex3f(${toF(glassW/2)},${toF(glassH/2)},0); glVertex3f(${toF(-glassW/2)},${toF(glassH/2)},0);`)
      lines.push(`  glEnd();`)
      lines.push(`  glDisable(GL_BLEND);`)
      break
    }
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
        const sides = object.prismParams?.sides ?? 3;
        const r = object.radius;
        const hh = object.height / 2;
        const pts: [number, number][] = [];
        for (let i = 0; i < sides; i++) {
          const angle = (Math.PI / 2) + (i * 2 * Math.PI / sides);
          pts.push([r * Math.cos(angle), r * Math.sin(angle)]);
        }
        lines.push(`  // Prism (${sides} sides, centered, per-face colors)`);
        // Top cap — fan from first vertex
        lines.push(faceColor('top'))
        lines.push(`  glBegin(GL_TRIANGLE_FAN);`);
        lines.push(`  glNormal3f(0.0, 1.0, 0.0);`);
        for (const [x, z] of pts) lines.push(`  glVertex3f(${toF(x)}, ${toF(hh)}, ${toF(z)});`);
        lines.push(`  glVertex3f(${toF(pts[0][0])}, ${toF(hh)}, ${toF(pts[0][1])});`);
        lines.push(`  glEnd();`);
        // Bottom cap — reversed winding
        lines.push(faceColor('bottom'))
        lines.push(`  glBegin(GL_TRIANGLE_FAN);`);
        lines.push(`  glNormal3f(0.0, -1.0, 0.0);`);
        for (let i = pts.length - 1; i >= 0; i--) lines.push(`  glVertex3f(${toF(pts[i][0])}, ${toF(-hh)}, ${toF(pts[i][1])});`);
        lines.push(`  glVertex3f(${toF(pts[pts.length-1][0])}, ${toF(-hh)}, ${toF(pts[pts.length-1][1])});`);
        lines.push(`  glEnd();`);
        // Sides
        lines.push(`  glBegin(GL_QUADS);`);
        for (let i = 0; i < sides; i++) {
          const j = (i + 1) % sides;
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
    case 'cylinder': {
      const r = object.radius;
      const h = object.height;
      const segs = object.segments;
      lines.push(`  // Cylinder (centered, using GLU)`);
      lines.push(`  glPushMatrix();`);
      lines.push(`  glRotatef(-90.0f, 1.0f, 0.0f, 0.0f); // Align Z with Y`);
      lines.push(`  glTranslatef(0.0f, 0.0f, ${toF(-h/2)}); // Center along Z`);
      lines.push(`  GLUquadric* quad = gluNewQuadric();`);
      lines.push(`  gluCylinder(quad, ${toF(r)}, ${toF(r)}, ${toF(h)}, ${segs}, 1);`);
      lines.push(`  // Bottom Cap`);
      lines.push(`  glPushMatrix();`);
      lines.push(`  glRotatef(180.0f, 1.0f, 0.0f, 0.0f);`);
      lines.push(`  gluDisk(quad, 0.0, ${toF(r)}, ${segs}, 1);`);
      lines.push(`  glPopMatrix();`);
      lines.push(`  // Top Cap`);
      lines.push(`  glPushMatrix();`);
      lines.push(`  glTranslatef(0.0f, 0.0f, ${toF(h)});`);
      lines.push(`  gluDisk(quad, 0.0, ${toF(r)}, ${segs}, 1);`);
      lines.push(`  glPopMatrix();`);
      lines.push(`  gluDeleteQuadric(quad);`);
      lines.push(`  glPopMatrix();`);
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
  lines.push('  glClearColor(0.53f, 0.81f, 0.92f, 1.0f);')
  if (is3D) {
    lines.push('  glEnable(GL_DEPTH_TEST);')
    lines.push('  glEnable(GL_LIGHTING);')
    lines.push('  glEnable(GL_LIGHT0);')
    lines.push('  glEnable(GL_COLOR_MATERIAL);')
    lines.push('  glColorMaterial(GL_FRONT_AND_BACK, GL_AMBIENT_AND_DIFFUSE);')
    lines.push('  glShadeModel(GL_SMOOTH);')
    lines.push('')
    // High ambient (0.7) + moderate diffuse (0.4) → colors appear close to
    // Three.js meshStandardMaterial which uses PBR with bright scene ambient.
    lines.push('  GLfloat lightPos[] = { 5.0f, 8.0f, 6.0f, 1.0f };')
    lines.push('  GLfloat lightAmb[] = { 0.7f, 0.7f, 0.7f, 1.0f };')
    lines.push('  GLfloat lightDif[] = { 0.4f, 0.4f, 0.4f, 1.0f };')
    lines.push('  GLfloat lightSpec[]= { 0.2f, 0.2f, 0.2f, 1.0f };')
    lines.push('  glLightfv(GL_LIGHT0, GL_POSITION, lightPos);')
    lines.push('  glLightfv(GL_LIGHT0, GL_AMBIENT,  lightAmb);')
    lines.push('  glLightfv(GL_LIGHT0, GL_DIFFUSE,  lightDif);')
    lines.push('  glLightfv(GL_LIGHT0, GL_SPECULAR, lightSpec);')
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
