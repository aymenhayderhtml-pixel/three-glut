import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import type { SceneObject } from '../../store/types';
import { getLineEndpoints } from '../../utils/math';
import { LineEndpointDots } from './LineEndpointDots';

/**
 * 2D SVG Viewport
 *
 * Renders 2D primitives (line, rect, circle, polygon) in an SVG canvas.
 * Also renders top-down projections of 3D objects as semi-transparent shapes.
 *
 * Coordinate system:
 * - World: standard math coordinates (Y up, X right)
 * - SVG: Y is inverted (Y down)
 * - We use a viewBox and transform to handle this
 */

const SVG_WIDTH = 1000;
const SVG_HEIGHT = 700;
const WORLD_SCALE = 50; // pixels per world unit
const WORLD_OFFSET_X = SVG_WIDTH / 2;
const WORLD_OFFSET_Y = SVG_HEIGHT / 2;

function worldToSvg(wx: number, wy: number): { x: number; y: number } {
  return {
    x: WORLD_OFFSET_X + wx * WORLD_SCALE,
    y: WORLD_OFFSET_Y - wy * WORLD_SCALE, // invert Y
  };
}

function svgToWorld(sx: number, sy: number): { x: number; y: number } {
  return {
    x: (sx - WORLD_OFFSET_X) / WORLD_SCALE,
    y: -(sy - WORLD_OFFSET_Y) / WORLD_SCALE, // invert Y
  };
}

interface Object2DProps {
  obj: SceneObject;
  isSelected: boolean;
  onSelect: () => void;
}

function Line2D({ obj, isSelected, onSelect }: Object2DProps) {
  const [endA, endB] = getLineEndpoints(
    obj.position[0],
    obj.position[1],
    obj.length,
    obj.rotation[2]
  );

  const svgA = worldToSvg(endA.x, endA.y);
  const svgB = worldToSvg(endB.x, endB.y);

  return (
    <g>
      {/* Invisible wider line for easier clicking */}
      <line
        x1={svgA.x}
        y1={svgA.y}
        x2={svgB.x}
        y2={svgB.y}
        stroke="transparent"
        strokeWidth={12}
        style={{ cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      />
      {/* Visible line */}
      <line
        x1={svgA.x}
        y1={svgA.y}
        x2={svgB.x}
        y2={svgB.y}
        stroke={isSelected ? '#6366f1' : '#e2e8f0'}
        strokeWidth={isSelected ? 3 : 2}
        strokeLinecap="round"
        pointerEvents="none"
      />
      {/* Length label */}
      <text
        x={(svgA.x + svgB.x) / 2}
        y={(svgA.y + svgB.y) / 2 - 10}
        textAnchor="middle"
        fill="#94a3b8"
        fontSize="11"
        pointerEvents="none"
      >
        {obj.length.toFixed(2)}
      </text>
    </g>
  );
}

function Rect2D({ obj, isSelected, onSelect }: Object2DProps) {
  const center = worldToSvg(obj.position[0], obj.position[1]);
  const w = obj.scale[0] * WORLD_SCALE;
  const h = obj.scale[1] * WORLD_SCALE;
  const rotDeg = -obj.rotation[2]; // invert for SVG

  return (
    <rect
      x={center.x - w / 2}
      y={center.y - h / 2}
      width={w}
      height={h}
      fill={isSelected ? 'rgba(99,102,241,0.15)' : 'rgba(148,163,184,0.1)'}
      stroke={isSelected ? '#6366f1' : '#94a3b8'}
      strokeWidth={isSelected ? 2 : 1}
      transform={`rotate(${rotDeg}, ${center.x}, ${center.y})`}
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    />
  );
}

function Circle2D({ obj, isSelected, onSelect }: Object2DProps) {
  const center = worldToSvg(obj.position[0], obj.position[1]);
  const r = obj.radius * WORLD_SCALE;

  return (
    <circle
      cx={center.x}
      cy={center.y}
      r={r}
      fill={isSelected ? 'rgba(99,102,241,0.15)' : 'rgba(148,163,184,0.1)'}
      stroke={isSelected ? '#6366f1' : '#94a3b8'}
      strokeWidth={isSelected ? 2 : 1}
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    />
  );
}

function ThreeDProjection({ obj, isSelected, onSelect }: Object2DProps) {
  const center = worldToSvg(obj.position[0], obj.position[2]); // top-down: X, Z

  let shape: React.ReactNode = null;

  switch (obj.kind) {
    case 'cube': {
      const w = obj.scale[0] * WORLD_SCALE;
      const h = obj.scale[2] * WORLD_SCALE;
      shape = (
        <rect
          x={center.x - w / 2}
          y={center.y - h / 2}
          width={w}
          height={h}
          fill={isSelected ? 'rgba(99,102,241,0.1)' : 'rgba(100,116,139,0.08)'}
          stroke={isSelected ? '#6366f1' : '#64748b'}
          strokeWidth={1}
          strokeDasharray="4,3"
          style={{ cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
        />
      );
      break;
    }
    case 'sphere':
    case 'cone': {
      const r = obj.radius * WORLD_SCALE;
      shape = (
        <circle
          cx={center.x}
          cy={center.y}
          r={r}
          fill={isSelected ? 'rgba(99,102,241,0.1)' : 'rgba(100,116,139,0.08)'}
          stroke={isSelected ? '#6366f1' : '#64748b'}
          strokeWidth={1}
          strokeDasharray="4,3"
          style={{ cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
        />
      );
      break;
    }
    case 'prism': {
      // Triangle top-down view
      const r = obj.radius * WORLD_SCALE;
      const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
      const points = angles
        .map((a) => `${center.x + Math.sin(a) * r},${center.y - Math.cos(a) * r}`)
        .join(' ');
      shape = (
        <polygon
          points={points}
          fill={isSelected ? 'rgba(99,102,241,0.1)' : 'rgba(100,116,139,0.08)'}
          stroke={isSelected ? '#6366f1' : '#64748b'}
          strokeWidth={1}
          strokeDasharray="4,3"
          style={{ cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
        />
      );
      break;
    }
    case 'torus': {
      const R = obj.radius * WORLD_SCALE;
      const r = obj.radius * 0.3 * WORLD_SCALE;
      shape = (
        <g>
          <circle
            cx={center.x}
            cy={center.y}
            r={R + r}
            fill="none"
            stroke={isSelected ? '#6366f1' : '#64748b'}
            strokeWidth={1}
            strokeDasharray="4,3"
            style={{ cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
          />
          <circle
            cx={center.x}
            cy={center.y}
            r={R - r}
            fill="none"
            stroke={isSelected ? '#6366f1' : '#64748b'}
            strokeWidth={1}
            strokeDasharray="4,3"
            pointerEvents="none"
          />
        </g>
      );
      break;
    }
  }

  return <>{shape}</>;
}

export function Viewport2D() {
  const { objects, selectedId, selectObject } = useStore();
  const svgRef = useRef<SVGSVGElement>(null);

  const objects2D = objects.filter((o) =>
    ['line', 'rect', 'circle', 'polygon'].includes(o.kind)
  );
  const objects3D = objects.filter(
    (o) => !['line', 'rect', 'circle', 'polygon'].includes(o.kind)
  );

  return (
    <div className="w-full h-full bg-gray-950 relative">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="w-full h-full"
        onClick={() => selectObject(null)}
        style={{ touchAction: 'none' }}
      >
        {/* Grid */}
        <defs>
          <pattern
            id="grid-small"
            width={WORLD_SCALE}
            height={WORLD_SCALE}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${WORLD_SCALE} 0 L 0 0 0 ${WORLD_SCALE}`}
              fill="none"
              stroke="#1e293b"
              strokeWidth="0.5"
            />
          </pattern>
          <pattern
            id="grid-large"
            width={WORLD_SCALE * 5}
            height={WORLD_SCALE * 5}
            patternUnits="userSpaceOnUse"
          >
            <rect
              width={WORLD_SCALE * 5}
              height={WORLD_SCALE * 5}
              fill="url(#grid-small)"
            />
            <path
              d={`M ${WORLD_SCALE * 5} 0 L 0 0 0 ${WORLD_SCALE * 5}`}
              fill="none"
              stroke="#334155"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="url(#grid-large)" />

        {/* Axes */}
        <line
          x1={WORLD_OFFSET_X}
          y1={0}
          x2={WORLD_OFFSET_X}
          y2={SVG_HEIGHT}
          stroke="#374151"
          strokeWidth="1"
        />
        <line
          x1={0}
          y1={WORLD_OFFSET_Y}
          x2={SVG_WIDTH}
          y2={WORLD_OFFSET_Y}
          stroke="#374151"
          strokeWidth="1"
        />

        {/* Origin label */}
        <text
          x={WORLD_OFFSET_X + 5}
          y={WORLD_OFFSET_Y - 5}
          fill="#64748b"
          fontSize="10"
        >
          (0,0)
        </text>

        {/* 3D object projections */}
        {objects3D.map((obj) => (
          <ThreeDProjection
            key={obj.id}
            obj={obj}
            isSelected={selectedId === obj.id}
            onSelect={() => selectObject(obj.id)}
          />
        ))}

        {/* 2D objects */}
        {objects2D.map((obj) => {
          const isSelected = selectedId === obj.id;
          const props = {
            key: obj.id,
            obj,
            isSelected,
            onSelect: () => selectObject(obj.id),
          };

          switch (obj.kind) {
            case 'line':
              return <Line2D {...props} />;
            case 'rect':
              return <Rect2D {...props} />;
            case 'circle':
              return <Circle2D {...props} />;
            default:
              return null;
          }
        })}

        {/* Line endpoint dots for selected line */}
        {selectedId &&
          objects.find((o) => o.id === selectedId && o.kind === 'line') && (
            <LineEndpointDots
              obj={objects.find((o) => o.id === selectedId)!}
              worldToSvg={worldToSvg}
              svgToWorld={(sx, sy) => {
                // We need to account for the SVG viewBox scaling
                if (!svgRef.current) return svgToWorld(sx, sy);
                const rect = svgRef.current.getBoundingClientRect();
                const scaleX = SVG_WIDTH / rect.width;
                const scaleY = SVG_HEIGHT / rect.height;
                return svgToWorld(sx * scaleX, sy * scaleY);
              }}
            />
          )}
      </svg>
    </div>
  );
}
