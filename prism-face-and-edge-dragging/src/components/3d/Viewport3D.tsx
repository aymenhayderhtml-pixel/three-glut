import { useRef, useEffect, useCallback, useState } from 'react';
import { useStore } from '../../store/useStore';
import type { SceneObject } from '../../store/types';
import {
  type Camera, type Vec3, type Mat4, type Face3D,
  v3, v3add, v3sub, v3scale, v3norm, v3dot, v3len, v3cross,
  mat4Identity, mat4Multiply, mat4Translate, mat4RotateX, mat4RotateY, mat4RotateZ,
  mat4LookAt, mat4Perspective,
  generateCubeFaces, generatePrismFaces, generateSphereFaces, generateConeFaces, generateTorusFaces,
  renderScene, hitTestFaces, screenToRay, rayPlaneIntersect,
} from '../../utils/renderer3d';

function getModelMatrix(obj: SceneObject): Mat4 {
  const rx = obj.rotation[0] * Math.PI / 180;
  const ry = obj.rotation[1] * Math.PI / 180;
  const rz = obj.rotation[2] * Math.PI / 180;
  let m = mat4Translate(obj.position[0], obj.position[1], obj.position[2]);
  m = mat4Multiply(m, mat4RotateY(ry));
  m = mat4Multiply(m, mat4RotateX(rx));
  m = mat4Multiply(m, mat4RotateZ(rz));
  return m;
}

function getObjectFaces(obj: SceneObject): Face3D[] {
  switch (obj.kind) {
    case 'cube':
      return generateCubeFaces(obj.scale[0], obj.scale[1], obj.scale[2]);
    case 'prism':
      return generatePrismFaces(obj.radius, obj.height);
    case 'sphere':
      return generateSphereFaces(obj.radius, 10, 6);
    case 'cone':
      return generateConeFaces(obj.radius, obj.height, 12);
    case 'torus':
      return generateTorusFaces(obj.radius, obj.radius * 0.3, 12, 6);
    default:
      return generateCubeFaces(1, 1, 1);
  }
}

// Grid lines for the floor
function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, camera: Camera) {
  const view = mat4LookAt(camera.position, camera.target, [0, 1, 0]);
  const proj = mat4Perspective(camera.fov * Math.PI / 180, w / h, 0.1, 100);
  const vp = mat4Multiply(proj, view);

  const project = (p: Vec3): [number, number] | null => {
    const wp = p;
    const c0 = vp[0]*wp[0]+vp[4]*wp[1]+vp[8]*wp[2]+vp[12];
    const c1 = vp[1]*wp[0]+vp[5]*wp[1]+vp[9]*wp[2]+vp[13];
    const c3 = vp[3]*wp[0]+vp[7]*wp[1]+vp[11]*wp[2]+vp[15];
    if (c3 <= 0.01) return null;
    return [(c0/c3*0.5+0.5)*w, (1-(c1/c3*0.5+0.5))*h];
  };

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 0.5;
  for (let i = -10; i <= 10; i++) {
    const a = project([i, 0, -10]);
    const b = project([i, 0, 10]);
    if (a && b) {
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    const c = project([-10, 0, i]);
    const d = project([10, 0, i]);
    if (c && d) {
      ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke();
    }
  }

  // Axes
  const o = project([0, 0, 0]);
  const xEnd = project([2, 0, 0]);
  const yEnd = project([0, 2, 0]);
  const zEnd = project([0, 0, 2]);
  if (o) {
    if (xEnd) { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(xEnd[0], xEnd[1]); ctx.stroke(); }
    if (yEnd) { ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(yEnd[0], yEnd[1]); ctx.stroke(); }
    if (zEnd) { ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(zEnd[0], zEnd[1]); ctx.stroke(); }
  }
}

export function Viewport3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { objects, selectedId, selectObject, updateObject } = useStore();
  const animRef = useRef<number>(0);

  // Camera orbit state
  const [cameraState, setCameraState] = useState({
    theta: Math.PI / 4,   // horizontal angle
    phi: Math.PI / 4,     // vertical angle  
    distance: 8,
    target: [0, 0, 0] as Vec3,
  });

  const orbitRef = useRef<{
    dragging: boolean;
    panning: boolean;
    lastX: number;
    lastY: number;
  }>({ dragging: false, panning: false, lastX: 0, lastY: 0 });

  // Face drag state
  const faceDragRef = useRef<{
    objectId: string;
    faceKey: string;
    startScreenX: number;
    startScreenY: number;
    startWorldPoint: Vec3;
    worldNormal: Vec3;
    initialRadius: number;
    initialHeight: number;
    initialScale: [number, number, number];
    initialPosition: [number, number, number];
    camera: Camera;
  } | null>(null);

  const getCamera = useCallback((): Camera => {
    const { theta, phi, distance, target } = cameraState;
    const x = target[0] + distance * Math.sin(phi) * Math.cos(theta);
    const y = target[1] + distance * Math.cos(phi);
    const z = target[2] + distance * Math.sin(phi) * Math.sin(theta);
    return { position: [x, y, z], target, fov: 50 };
  }, [cameraState]);

  // Get scene data for rendering
  const getSceneData = useCallback(() => {
    return objects
      .filter(o => !['line', 'rect', 'circle', 'polygon'].includes(o.kind))
      .map(obj => ({
        faces: getObjectFaces(obj),
        modelMatrix: getModelMatrix(obj),
        selected: obj.id === selectedId,
        objectKey: obj.id,
      }));
  }, [objects, selectedId]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;
      const camera = getCamera();
      const sceneData = getSceneData();

      // Background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      drawGrid(ctx, w, h, camera);
      renderScene(ctx, w, h, camera, sceneData);

      // Draw face overlay hints for selected objects
      const sel = objects.find(o => o.id === selectedId);
      if (sel && (sel.kind === 'cube' || sel.kind === 'prism')) {
        // Show subtle face outlines on hover
        ctx.save();
        ctx.restore();
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      animRef.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animRef.current);
  }, [getCamera, getSceneData, objects, selectedId]);

  // Handle mouse events
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Right click = orbit, Middle = pan
    if (e.button === 2 || e.button === 1) {
      orbitRef.current = { dragging: true, panning: e.button === 1, lastX: e.clientX, lastY: e.clientY };
      e.preventDefault();
      return;
    }

    // Left click: check face hit on selected object first
    const camera = getCamera();
    const sceneData = getSceneData();
    const hit = hitTestFaces(x, y, rect.width, rect.height, camera, sceneData);

    if (hit) {
      const obj = objects.find(o => o.id === hit.objectKey);
      if (!obj) return;

      // If clicking on already-selected object's face, start face drag
      if (obj.id === selectedId && (obj.kind === 'cube' || obj.kind === 'prism')) {
        faceDragRef.current = {
          objectId: obj.id,
          faceKey: hit.faceKey,
          startScreenX: x,
          startScreenY: y,
          startWorldPoint: hit.worldPoint,
          worldNormal: hit.worldNormal,
          initialRadius: obj.radius,
          initialHeight: obj.height,
          initialScale: [...obj.scale],
          initialPosition: [...obj.position],
          camera,
        };
        canvas.setPointerCapture(e.pointerId);
        return;
      }

      // Otherwise select the object
      selectObject(obj.id);
    } else {
      // Start orbit on left-click on empty space
      orbitRef.current = { dragging: true, panning: false, lastX: e.clientX, lastY: e.clientY };
      selectObject(null);
    }
  }, [getCamera, getSceneData, objects, selectedId, selectObject]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    // Face dragging
    if (faceDragRef.current) {
      const fd = faceDragRef.current;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Cast a ray from the current mouse position
      const ray = screenToRay(x, y, rect.width, rect.height, fd.camera);
      // Also cast from start
      const startRay = screenToRay(fd.startScreenX, fd.startScreenY, rect.width, rect.height, fd.camera);

      // Intersect both rays with a plane passing through startWorldPoint, 
      // perpendicular to the camera's view direction
      const camDir = v3norm(v3sub(fd.camera.target, fd.camera.position));
      const startHit = rayPlaneIntersect(startRay.origin, startRay.direction, camDir, fd.startWorldPoint);
      const currentHit = rayPlaneIntersect(ray.origin, ray.direction, camDir, fd.startWorldPoint);

      if (!startHit || !currentHit) return;

      const delta = v3sub(currentHit, startHit);
      const pullAmount = v3dot(delta, fd.worldNormal);

      const obj = objects.find(o => o.id === fd.objectId);
      if (!obj) return;

      if (obj.kind === 'prism') {
        if (fd.faceKey.startsWith('side')) {
          const newRadius = Math.max(0.2, fd.initialRadius + pullAmount);
          updateObject(obj.id, { radius: newRadius });
        } else if (fd.faceKey === 'top') {
          const newHeight = Math.max(0.2, fd.initialHeight + pullAmount);
          const posYDelta = pullAmount / 2;
          updateObject(obj.id, {
            height: newHeight,
            position: [fd.initialPosition[0], fd.initialPosition[1] + posYDelta, fd.initialPosition[2]],
          });
        } else if (fd.faceKey === 'bottom') {
          const newHeight = Math.max(0.2, fd.initialHeight + pullAmount);
          const posYDelta = pullAmount / 2;
          updateObject(obj.id, {
            height: newHeight,
            position: [fd.initialPosition[0], fd.initialPosition[1] + posYDelta, fd.initialPosition[2]],
          });
        }
      } else if (obj.kind === 'cube') {
        const newScale: [number, number, number] = [...fd.initialScale];
        const newPos: [number, number, number] = [...fd.initialPosition];

        let axisIndex: number;
        let sign: number;
        switch (fd.faceKey) {
          case 'right':  axisIndex = 0; sign = 1; break;
          case 'left':   axisIndex = 0; sign = -1; break;
          case 'top':    axisIndex = 1; sign = 1; break;
          case 'bottom': axisIndex = 1; sign = -1; break;
          case 'front':  axisIndex = 2; sign = 1; break;
          case 'back':   axisIndex = 2; sign = -1; break;
          default: return;
        }

        newScale[axisIndex] = Math.max(0.1, fd.initialScale[axisIndex] + pullAmount);
        newPos[axisIndex] = fd.initialPosition[axisIndex] + (pullAmount / 2) * sign;
        updateObject(obj.id, { scale: newScale, position: newPos });
      }
      return;
    }

    // Orbit/pan
    if (orbitRef.current.dragging) {
      const dx = e.clientX - orbitRef.current.lastX;
      const dy = e.clientY - orbitRef.current.lastY;
      orbitRef.current.lastX = e.clientX;
      orbitRef.current.lastY = e.clientY;

      if (orbitRef.current.panning) {
        setCameraState(prev => ({
          ...prev,
          target: [
            prev.target[0] - dx * 0.01,
            prev.target[1] + dy * 0.01,
            prev.target[2],
          ],
        }));
      } else {
        setCameraState(prev => ({
          ...prev,
          theta: prev.theta - dx * 0.008,
          phi: Math.max(0.1, Math.min(Math.PI - 0.1, prev.phi - dy * 0.008)),
        }));
      }
    }
  }, [objects, updateObject]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    orbitRef.current.dragging = false;
    orbitRef.current.panning = false;
    if (faceDragRef.current) {
      faceDragRef.current = null;
      canvasRef.current?.releasePointerCapture(e.pointerId);
    }
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    setCameraState(prev => ({
      ...prev,
      distance: Math.max(2, Math.min(30, prev.distance + e.deltaY * 0.01)),
    }));
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-gray-950 relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
      />
      {/* Drag hint overlay */}
      {selectedId && objects.find(o => o.id === selectedId && (o.kind === 'cube' || o.kind === 'prism')) && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-gray-800/90 backdrop-blur rounded-lg border border-gray-700/50 text-xs text-gray-300">
          Click and drag on a face to resize • Left-drag empty space to orbit • Scroll to zoom
        </div>
      )}
    </div>
  );
}
