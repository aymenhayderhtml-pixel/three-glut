import React, { useCallback, useRef } from 'react';
import type { SceneObject } from '../../store/types';
import { useStore } from '../../store/useStore';
import { getLineEndpoints, computeLineFromEndpoints } from '../../utils/math';

interface LineEndpointDotsProps {
  obj: SceneObject;
  /** Converts world coordinates to SVG viewport coordinates */
  worldToSvg: (wx: number, wy: number) => { x: number; y: number };
  /** Converts SVG viewport coordinates to world coordinates */
  svgToWorld: (sx: number, sy: number) => { x: number; y: number };
}

/**
 * LineEndpointDots
 *
 * Renders two large SVG <circle> elements at the exact endpoints of a 2D line.
 * When the user drags one dot, the line dynamically updates its position,
 * length, and rotation so that:
 * - The dragged endpoint follows the mouse perfectly
 * - The opposite endpoint stays anchored in place
 *
 * Math:
 * 1. Endpoints are calculated from center (cx, cy), length L, and rotation θ:
 *    endpointA = (cx - L/2·cos(θ), cy - L/2·sin(θ))
 *    endpointB = (cx + L/2·cos(θ), cy + L/2·sin(θ))
 *
 * 2. When dragging endpoint B while A is anchored:
 *    newCenter = midpoint(A, mousePos)
 *    newLength = distance(A, mousePos)
 *    newRotation = atan2(mousePos.y - A.y, mousePos.x - A.x)
 */
export function LineEndpointDots({ obj, worldToSvg, svgToWorld }: LineEndpointDotsProps) {
  const { updateObject } = useStore();
  const dragRef = useRef<{
    anchorIndex: 0 | 1;
    anchorWorld: { x: number; y: number };
  } | null>(null);

  // Calculate the two endpoints in world coordinates
  const [endA, endB] = getLineEndpoints(
    obj.position[0],
    obj.position[1],
    obj.length,
    obj.rotation[2]
  );

  // Convert to SVG coordinates for rendering
  const svgA = worldToSvg(endA.x, endA.y);
  const svgB = worldToSvg(endB.x, endB.y);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGCircleElement>, draggedIndex: 0 | 1) => {
      e.stopPropagation();
      e.preventDefault();

      // The anchor is the opposite endpoint
      const anchor = draggedIndex === 0 ? endB : endA;

      dragRef.current = {
        anchorIndex: draggedIndex === 0 ? 1 : 0,
        anchorWorld: { x: anchor.x, y: anchor.y },
      };

      // Capture pointer on the SVG element
      (e.target as SVGCircleElement).setPointerCapture(e.pointerId);
    },
    [endA, endB]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGCircleElement>) => {
      if (!dragRef.current) return;
      e.stopPropagation();

      // Get mouse position in SVG coordinates
      const svgEl = (e.target as SVGCircleElement).ownerSVGElement;
      if (!svgEl) return;

      const rect = svgEl.getBoundingClientRect();
      const svgX = e.clientX - rect.left;
      const svgY = e.clientY - rect.top;

      // Convert SVG coordinates to world coordinates
      const worldPos = svgToWorld(svgX, svgY);

      // Compute new line parameters
      const { anchorWorld } = dragRef.current;
      const result = computeLineFromEndpoints(
        anchorWorld.x,
        anchorWorld.y,
        worldPos.x,
        worldPos.y
      );

      updateObject(obj.id, {
        position: result.position,
        length: result.length,
        rotation: result.rotation,
      });
    },
    [obj.id, updateObject, svgToWorld]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGCircleElement>) => {
      dragRef.current = null;
      (e.target as SVGCircleElement).releasePointerCapture(e.pointerId);
    },
    []
  );

  const dotRadius = 8;

  return (
    <g>
      {/* Endpoint A dot */}
      <circle
        cx={svgA.x}
        cy={svgA.y}
        r={dotRadius}
        fill="#6366f1"
        stroke="#ffffff"
        strokeWidth={2}
        style={{ cursor: 'grab', touchAction: 'none' }}
        onPointerDown={(e) => handlePointerDown(e, 0)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      {/* Endpoint B dot */}
      <circle
        cx={svgB.x}
        cy={svgB.y}
        r={dotRadius}
        fill="#6366f1"
        stroke="#ffffff"
        strokeWidth={2}
        style={{ cursor: 'grab', touchAction: 'none' }}
        onPointerDown={(e) => handlePointerDown(e, 1)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      {/* Visual feedback: larger hover ring */}
      <circle
        cx={svgA.x}
        cy={svgA.y}
        r={dotRadius + 4}
        fill="transparent"
        stroke="#6366f1"
        strokeWidth={1}
        opacity={0.3}
        pointerEvents="none"
      />
      <circle
        cx={svgB.x}
        cy={svgB.y}
        r={dotRadius + 4}
        fill="transparent"
        stroke="#6366f1"
        strokeWidth={1}
        opacity={0.3}
        pointerEvents="none"
      />
    </g>
  );
}
