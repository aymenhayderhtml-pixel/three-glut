/**
 * Lightweight 3D renderer using Canvas2D with perspective projection.
 * No three.js dependency — all math is inline.
 */

export type Vec3 = [number, number, number];
export type Vec2 = [number, number];
export type Mat4 = number[]; // 16 elements, column-major

// ─── Vector Math ──────────────────────────────────────────────

export function v3(x: number, y: number, z: number): Vec3 { return [x, y, z]; }
export function v3add(a: Vec3, b: Vec3): Vec3 { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
export function v3sub(a: Vec3, b: Vec3): Vec3 { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
export function v3scale(a: Vec3, s: number): Vec3 { return [a[0]*s, a[1]*s, a[2]*s]; }
export function v3dot(a: Vec3, b: Vec3): number { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
export function v3cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}
export function v3len(a: Vec3): number { return Math.sqrt(v3dot(a,a)); }
export function v3norm(a: Vec3): Vec3 { const l=v3len(a); return l>0?v3scale(a,1/l):[0,0,0]; }
export function v3lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
}

// ─── Matrix Math ──────────────────────────────────────────────

export function mat4Identity(): Mat4 {
  return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
}

export function mat4Multiply(a: Mat4, b: Mat4): Mat4 {
  const r = new Array(16).fill(0);
  for (let i=0;i<4;i++) for (let j=0;j<4;j++) for (let k=0;k<4;k++)
    r[j*4+i] += a[k*4+i] * b[j*4+k];
  return r;
}

export function mat4Translate(tx: number, ty: number, tz: number): Mat4 {
  return [1,0,0,0, 0,1,0,0, 0,0,1,0, tx,ty,tz,1];
}

export function mat4RotateX(rad: number): Mat4 {
  const c=Math.cos(rad), s=Math.sin(rad);
  return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1];
}

export function mat4RotateY(rad: number): Mat4 {
  const c=Math.cos(rad), s=Math.sin(rad);
  return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1];
}

export function mat4RotateZ(rad: number): Mat4 {
  const c=Math.cos(rad), s=Math.sin(rad);
  return [c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1];
}

export function mat4Perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1/Math.tan(fovY/2);
  const nf = 1/(near-far);
  return [f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0];
}

export function mat4LookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4 {
  const z = v3norm(v3sub(eye, target));
  const x = v3norm(v3cross(up, z));
  const y = v3cross(z, x);
  return [
    x[0],y[0],z[0],0,
    x[1],y[1],z[1],0,
    x[2],y[2],z[2],0,
    -v3dot(x,eye),-v3dot(y,eye),-v3dot(z,eye),1
  ];
}

export function mat4TransformPoint(m: Mat4, p: Vec3): Vec3 {
  const w = m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];
  return [
    (m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12])/w,
    (m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13])/w,
    (m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14])/w,
  ];
}

export function mat4TransformVec(m: Mat4, p: Vec3): Vec3 {
  return [
    m[0]*p[0]+m[4]*p[1]+m[8]*p[2],
    m[1]*p[0]+m[5]*p[1]+m[9]*p[2],
    m[2]*p[0]+m[6]*p[1]+m[10]*p[2],
  ];
}

export function mat4Inverse(m: Mat4): Mat4 | null {
  const inv = new Array(16);
  inv[0] = m[5]*m[10]*m[15]-m[5]*m[11]*m[14]-m[9]*m[6]*m[15]+m[9]*m[7]*m[14]+m[13]*m[6]*m[11]-m[13]*m[7]*m[10];
  inv[4] = -m[4]*m[10]*m[15]+m[4]*m[11]*m[14]+m[8]*m[6]*m[15]-m[8]*m[7]*m[14]-m[12]*m[6]*m[11]+m[12]*m[7]*m[10];
  inv[8] = m[4]*m[9]*m[15]-m[4]*m[11]*m[13]-m[8]*m[5]*m[15]+m[8]*m[7]*m[13]+m[12]*m[5]*m[11]-m[12]*m[7]*m[9];
  inv[12] = -m[4]*m[9]*m[14]+m[4]*m[10]*m[13]+m[8]*m[5]*m[14]-m[8]*m[6]*m[13]-m[12]*m[5]*m[10]+m[12]*m[6]*m[9];
  inv[1] = -m[1]*m[10]*m[15]+m[1]*m[11]*m[14]+m[9]*m[2]*m[15]-m[9]*m[3]*m[14]-m[13]*m[2]*m[11]+m[13]*m[3]*m[10];
  inv[5] = m[0]*m[10]*m[15]-m[0]*m[11]*m[14]-m[8]*m[2]*m[15]+m[8]*m[3]*m[14]+m[12]*m[2]*m[11]-m[12]*m[3]*m[10];
  inv[9] = -m[0]*m[9]*m[15]+m[0]*m[11]*m[13]+m[8]*m[1]*m[15]-m[8]*m[3]*m[13]-m[12]*m[1]*m[11]+m[12]*m[3]*m[9];
  inv[13] = m[0]*m[9]*m[14]-m[0]*m[10]*m[13]-m[8]*m[1]*m[14]+m[8]*m[2]*m[13]+m[12]*m[1]*m[10]-m[12]*m[2]*m[9];
  inv[2] = m[1]*m[6]*m[15]-m[1]*m[7]*m[14]-m[5]*m[2]*m[15]+m[5]*m[3]*m[14]+m[13]*m[2]*m[7]-m[13]*m[3]*m[6];
  inv[6] = -m[0]*m[6]*m[15]+m[0]*m[7]*m[14]+m[4]*m[2]*m[15]-m[4]*m[3]*m[14]-m[12]*m[2]*m[7]+m[12]*m[3]*m[6];
  inv[10] = m[0]*m[5]*m[15]-m[0]*m[7]*m[13]-m[4]*m[1]*m[15]+m[4]*m[3]*m[13]+m[12]*m[1]*m[7]-m[12]*m[3]*m[5];
  inv[14] = -m[0]*m[5]*m[14]+m[0]*m[6]*m[13]+m[4]*m[1]*m[14]-m[4]*m[2]*m[13]-m[12]*m[1]*m[6]+m[12]*m[2]*m[5];
  inv[3] = -m[1]*m[6]*m[11]+m[1]*m[7]*m[10]+m[5]*m[2]*m[11]-m[5]*m[3]*m[10]-m[9]*m[2]*m[7]+m[9]*m[3]*m[6];
  inv[7] = m[0]*m[6]*m[11]-m[0]*m[7]*m[10]-m[4]*m[2]*m[11]+m[4]*m[3]*m[10]+m[8]*m[2]*m[7]-m[8]*m[3]*m[6];
  inv[11] = -m[0]*m[5]*m[11]+m[0]*m[7]*m[9]+m[4]*m[1]*m[11]-m[4]*m[3]*m[9]-m[8]*m[1]*m[7]+m[8]*m[3]*m[5];
  inv[15] = m[0]*m[5]*m[10]-m[0]*m[6]*m[9]-m[4]*m[1]*m[10]+m[4]*m[2]*m[9]+m[8]*m[1]*m[6]-m[8]*m[2]*m[5];
  
  let det = m[0]*inv[0]+m[1]*inv[4]+m[2]*inv[8]+m[3]*inv[12];
  if (Math.abs(det) < 1e-10) return null;
  det = 1/det;
  return inv.map(v => v*det);
}

// ─── Face/Polygon types ──────────────────────────────────────

export interface Face3D {
  vertices: Vec3[];
  normal: Vec3;
  color: string;
  key: string;
}

// ─── Generate mesh faces ─────────────────────────────────────

export function generateCubeFaces(sx: number, sy: number, sz: number): Face3D[] {
  const hx=sx/2, hy=sy/2, hz=sz/2;
  return [
    { key:'front', normal:[0,0,1], color:'#64748b', vertices: [[-hx,-hy,hz],[hx,-hy,hz],[hx,hy,hz],[-hx,hy,hz]] },
    { key:'back', normal:[0,0,-1], color:'#475569', vertices: [[hx,-hy,-hz],[-hx,-hy,-hz],[-hx,hy,-hz],[hx,hy,-hz]] },
    { key:'right', normal:[1,0,0], color:'#6b7280', vertices: [[hx,-hy,hz],[hx,-hy,-hz],[hx,hy,-hz],[hx,hy,hz]] },
    { key:'left', normal:[-1,0,0], color:'#4b5563', vertices: [[-hx,-hy,-hz],[-hx,-hy,hz],[-hx,hy,hz],[-hx,hy,-hz]] },
    { key:'top', normal:[0,1,0], color:'#78716c', vertices: [[-hx,hy,hz],[hx,hy,hz],[hx,hy,-hz],[-hx,hy,-hz]] },
    { key:'bottom', normal:[0,-1,0], color:'#44403c', vertices: [[-hx,-hy,-hz],[hx,-hy,-hz],[hx,-hy,hz],[-hx,-hy,hz]] },
  ];
}

export function generatePrismFaces(radius: number, height: number): Face3D[] {
  const halfH = height/2;
  const angles = [0, 2*Math.PI/3, 4*Math.PI/3];
  const topVerts: Vec3[] = angles.map(a => [Math.sin(a)*radius, halfH, Math.cos(a)*radius]);
  const botVerts: Vec3[] = angles.map(a => [Math.sin(a)*radius, -halfH, Math.cos(a)*radius]);
  
  const faces: Face3D[] = [];
  
  // 3 side faces
  for (let i=0;i<3;i++) {
    const j=(i+1)%3;
    const tl=topVerts[i], tr=topVerts[j], br=botVerts[j], bl=botVerts[i];
    const tangent = v3norm(v3sub(tr,tl));
    let normal = v3cross(tangent, [0,1,0]);
    const center: Vec3 = [(tl[0]+tr[0]+br[0]+bl[0])/4, 0, (tl[2]+tr[2]+br[2]+bl[2])/4];
    if (v3dot(normal, center) < 0) normal = v3scale(normal, -1);
    normal = v3norm(normal);
    faces.push({ key:`side_${i}`, normal, color: ['#6b7280','#64748b','#78716c'][i], vertices:[tl,tr,br,bl] });
  }
  
  // Top face
  faces.push({ key:'top', normal:[0,1,0], color:'#94a3b8', vertices:[...topVerts] });
  // Bottom face
  faces.push({ key:'bottom', normal:[0,-1,0], color:'#475569', vertices:[...botVerts].reverse() });
  
  return faces;
}

export function generateSphereFaces(radius: number, segments: number = 12, rings: number = 8): Face3D[] {
  const faces: Face3D[] = [];
  for (let i=0;i<rings;i++) {
    const phi1 = Math.PI*i/rings;
    const phi2 = Math.PI*(i+1)/rings;
    for (let j=0;j<segments;j++) {
      const theta1 = 2*Math.PI*j/segments;
      const theta2 = 2*Math.PI*(j+1)/segments;
      const p1: Vec3 = [radius*Math.sin(phi1)*Math.cos(theta1), radius*Math.cos(phi1), radius*Math.sin(phi1)*Math.sin(theta1)];
      const p2: Vec3 = [radius*Math.sin(phi1)*Math.cos(theta2), radius*Math.cos(phi1), radius*Math.sin(phi1)*Math.sin(theta2)];
      const p3: Vec3 = [radius*Math.sin(phi2)*Math.cos(theta2), radius*Math.cos(phi2), radius*Math.sin(phi2)*Math.sin(theta2)];
      const p4: Vec3 = [radius*Math.sin(phi2)*Math.cos(theta1), radius*Math.cos(phi2), radius*Math.sin(phi2)*Math.sin(theta1)];
      const center = v3scale(v3add(v3add(p1,p2),v3add(p3,p4)), 0.25);
      const normal = v3norm(center);
      const brightness = 0.4+0.3*Math.abs(normal[1]);
      const c = Math.floor(brightness*255);
      faces.push({ key:`s${i}_${j}`, normal, color:`rgb(${c-20},${c-10},${c})`, vertices:[p1,p2,p3,p4] });
    }
  }
  return faces;
}

export function generateConeFaces(radius: number, height: number, segments: number = 16): Face3D[] {
  const faces: Face3D[] = [];
  const halfH = height/2;
  const apex: Vec3 = [0,halfH,0];
  
  for (let i=0;i<segments;i++) {
    const theta1 = 2*Math.PI*i/segments;
    const theta2 = 2*Math.PI*(i+1)/segments;
    const b1: Vec3 = [radius*Math.cos(theta1),-halfH,radius*Math.sin(theta1)];
    const b2: Vec3 = [radius*Math.cos(theta2),-halfH,radius*Math.sin(theta2)];
    const center = v3scale(v3add(v3add(apex,b1),b2), 1/3);
    const normal = v3norm(center);
    faces.push({ key:`cone_${i}`, normal, color:'#78716c', vertices:[apex,b2,b1] });
  }
  
  // Bottom cap
  const botVerts: Vec3[] = [];
  for (let i=segments-1;i>=0;i--) {
    const theta = 2*Math.PI*i/segments;
    botVerts.push([radius*Math.cos(theta),-halfH,radius*Math.sin(theta)]);
  }
  faces.push({ key:'cone_bottom', normal:[0,-1,0], color:'#475569', vertices:botVerts });
  
  return faces;
}

export function generateTorusFaces(R: number, r: number, segments: number = 16, tubeSeg: number = 8): Face3D[] {
  const faces: Face3D[] = [];
  for (let i=0;i<segments;i++) {
    const t1=2*Math.PI*i/segments, t2=2*Math.PI*(i+1)/segments;
    for (let j=0;j<tubeSeg;j++) {
      const p1=2*Math.PI*j/tubeSeg, p2=2*Math.PI*(j+1)/tubeSeg;
      const pt = (t: number, p: number): Vec3 => [
        (R+r*Math.cos(p))*Math.cos(t), r*Math.sin(p), (R+r*Math.cos(p))*Math.sin(t)
      ];
      const v1=pt(t1,p1),v2=pt(t2,p1),v3=pt(t2,p2),v4=pt(t1,p2);
      const center = v3scale(v3add(v3add(v1,v2),v3add(v3,v4)),0.25);
      const tubCenter: Vec3 = [R*Math.cos((t1+t2)/2),0,R*Math.sin((t1+t2)/2)];
      const normal = v3norm(v3sub(center, tubCenter));
      faces.push({ key:`t${i}_${j}`, normal, color:'#78716c', vertices:[v1,v2,v3,v4] });
    }
  }
  return faces;
}

// ─── Rendering pipeline ─────────────────────────────────────

export interface Camera {
  position: Vec3;
  target: Vec3;
  fov: number;
}

export function projectPoint(
  point: Vec3,
  viewProj: Mat4,
  width: number,
  height: number
): Vec2 | null {
  const clip = mat4TransformPoint(viewProj, point);
  if (clip[2] < -1 || clip[2] > 1) return null;
  return [
    (clip[0] * 0.5 + 0.5) * width,
    (1 - (clip[1] * 0.5 + 0.5)) * height,
  ];
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  camera: Camera,
  objectFaces: Array<{ faces: Face3D[]; modelMatrix: Mat4; selected: boolean; objectKey: string }>
) {
  ctx.clearRect(0, 0, width, height);
  
  const aspect = width/height;
  const proj = mat4Perspective(camera.fov * Math.PI/180, aspect, 0.1, 100);
  const view = mat4LookAt(camera.position, camera.target, [0,1,0]);
  const viewProj = mat4Multiply(proj, view);
  
  // Collect all faces with their world-space data
  const allFaces: Array<{
    projected: Vec2[];
    depth: number;
    color: string;
    selected: boolean;
    objectKey: string;
    faceKey: string;
    worldNormal: Vec3;
  }> = [];
  
  for (const obj of objectFaces) {
    const mvp = mat4Multiply(viewProj, obj.modelMatrix);
    
    for (const face of obj.faces) {
      const projected: Vec2[] = [];
      let totalDepth = 0;
      let valid = true;
      
      for (const v of face.vertices) {
        const p = projectPoint(v, mvp, width, height);
        if (!p) { valid = false; break; }
        projected.push(p);
        const wp = mat4TransformPoint(obj.modelMatrix, v);
        totalDepth += v3len(v3sub(wp, camera.position));
      }
      
      if (!valid || projected.length < 3) continue;
      
      // Back-face culling
      const worldNormal = v3norm(mat4TransformVec(obj.modelMatrix, face.normal));
      const faceCenter = face.vertices.reduce((acc,v) => v3add(acc, mat4TransformPoint(obj.modelMatrix, v)), v3(0,0,0));
      const fc = v3scale(faceCenter, 1/face.vertices.length);
      const viewDir = v3norm(v3sub(camera.position, fc));
      if (v3dot(worldNormal, viewDir) < -0.1) continue;
      
      allFaces.push({
        projected,
        depth: totalDepth / face.vertices.length,
        color: face.color,
        selected: obj.selected,
        objectKey: obj.objectKey,
        faceKey: face.key,
        worldNormal,
      });
    }
  }
  
  // Sort by depth (painter's algorithm)
  allFaces.sort((a, b) => b.depth - a.depth);
  
  // Draw
  for (const face of allFaces) {
    // Lighting
    const lightDir = v3norm([0.5, 0.8, 0.3]);
    const diffuse = Math.max(0, v3dot(face.worldNormal, lightDir));
    const ambient = 0.35;
    const intensity = Math.min(1, ambient + diffuse * 0.65);
    
    ctx.beginPath();
    ctx.moveTo(face.projected[0][0], face.projected[0][1]);
    for (let i = 1; i < face.projected.length; i++) {
      ctx.lineTo(face.projected[i][0], face.projected[i][1]);
    }
    ctx.closePath();
    
    // Parse color and apply lighting
    if (face.selected) {
      const r = Math.floor(99 * intensity);
      const g = Math.floor(102 * intensity);
      const b = Math.floor(241 * intensity);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 1.5;
    } else {
      // Parse hex color
      const hex = face.color;
      const pr = parseInt(hex.slice(1,3),16);
      const pg = parseInt(hex.slice(3,5),16);
      const pb = parseInt(hex.slice(5,7),16);
      ctx.fillStyle = `rgb(${Math.floor(pr*intensity)},${Math.floor(pg*intensity)},${Math.floor(pb*intensity)})`;
      ctx.strokeStyle = `rgba(0,0,0,0.2)`;
      ctx.lineWidth = 0.5;
    }
    
    ctx.fill();
    ctx.stroke();
  }
}

// ─── Hit testing ─────────────────────────────────────────────

export function hitTestFaces(
  x: number, y: number,
  width: number, height: number,
  camera: Camera,
  objectFaces: Array<{ faces: Face3D[]; modelMatrix: Mat4; objectKey: string }>
): { objectKey: string; faceKey: string; worldNormal: Vec3; worldPoint: Vec3 } | null {
  const aspect = width/height;
  const proj = mat4Perspective(camera.fov * Math.PI/180, aspect, 0.1, 100);
  const view = mat4LookAt(camera.position, camera.target, [0,1,0]);
  const viewProj = mat4Multiply(proj, view);
  
  const hits: Array<{
    objectKey: string;
    faceKey: string;
    worldNormal: Vec3;
    worldPoint: Vec3;
    depth: number;
  }> = [];
  
  for (const obj of objectFaces) {
    const mvp = mat4Multiply(viewProj, obj.modelMatrix);
    
    for (const face of obj.faces) {
      const projected: Vec2[] = [];
      let valid = true;
      
      for (const v of face.vertices) {
        const p = projectPoint(v, mvp, width, height);
        if (!p) { valid = false; break; }
        projected.push(p);
      }
      
      if (!valid || projected.length < 3) continue;
      
      // Point in polygon test
      if (pointInPolygon(x, y, projected)) {
        const worldNormal = v3norm(mat4TransformVec(obj.modelMatrix, face.normal));
        const faceCenter = face.vertices.reduce(
          (acc,v) => v3add(acc, mat4TransformPoint(obj.modelMatrix, v)), v3(0,0,0)
        );
        const fc = v3scale(faceCenter, 1/face.vertices.length);
        const depth = v3len(v3sub(fc, camera.position));
        hits.push({ objectKey: obj.objectKey, faceKey: face.key, worldNormal, worldPoint: fc, depth });
      }
    }
  }
  
  if (hits.length === 0) return null;
  hits.sort((a,b) => a.depth - b.depth);
  return hits[0];
}

function pointInPolygon(px: number, py: number, polygon: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ─── Ray from screen coordinates ────────────────────────────

export function screenToRay(
  x: number, y: number,
  width: number, height: number,
  camera: Camera
): { origin: Vec3; direction: Vec3 } {
  const aspect = width/height;
  const proj = mat4Perspective(camera.fov * Math.PI/180, aspect, 0.1, 100);
  const view = mat4LookAt(camera.position, camera.target, [0,1,0]);
  const vpInv = mat4Inverse(mat4Multiply(proj, view));
  if (!vpInv) return { origin: camera.position, direction: [0,0,-1] };
  
  const ndcX = (x / width) * 2 - 1;
  const ndcY = 1 - (y / height) * 2;
  
  const nearPt = mat4TransformPoint(vpInv, [ndcX, ndcY, -1]);
  const farPt = mat4TransformPoint(vpInv, [ndcX, ndcY, 1]);
  
  return {
    origin: nearPt,
    direction: v3norm(v3sub(farPt, nearPt)),
  };
}

/**
 * Intersect a ray with a plane defined by normal and point.
 */
export function rayPlaneIntersect(
  rayOrigin: Vec3, rayDir: Vec3,
  planeNormal: Vec3, planePoint: Vec3
): Vec3 | null {
  const denom = v3dot(planeNormal, rayDir);
  if (Math.abs(denom) < 1e-6) return null;
  const t = v3dot(v3sub(planePoint, rayOrigin), planeNormal) / denom;
  if (t < 0) return null;
  return v3add(rayOrigin, v3scale(rayDir, t));
}
