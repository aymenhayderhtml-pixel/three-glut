import React from 'react';
import { useStore } from '../../store/useStore';
import type { PrimitiveKind, ViewMode } from '../../store/types';

const PRIMITIVES_3D: { kind: PrimitiveKind; label: string; icon: string }[] = [
  { kind: 'cube', label: 'Cube', icon: '◻' },
  { kind: 'sphere', label: 'Sphere', icon: '○' },
  { kind: 'cone', label: 'Cone', icon: '△' },
  { kind: 'torus', label: 'Torus', icon: '◎' },
  { kind: 'prism', label: 'Prism', icon: '▲' },
];

const PRIMITIVES_2D: { kind: PrimitiveKind; label: string; icon: string }[] = [
  { kind: 'line', label: 'Line', icon: '╱' },
  { kind: 'rect', label: 'Rectangle', icon: '▭' },
  { kind: 'circle', label: 'Circle', icon: '◯' },
];

export function Toolbar() {
  const { viewMode, setViewMode, addObject } = useStore();

  const primitives = viewMode === '3d' ? PRIMITIVES_3D : PRIMITIVES_2D;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800">
      {/* View mode toggle */}
      <div className="flex bg-gray-800 rounded-lg p-0.5 mr-4">
        {(['3d', '2d'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === mode
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {mode.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-gray-700 mr-2" />

      {/* Add primitives */}
      <span className="text-xs text-gray-500 mr-2 font-medium">Add:</span>
      {primitives.map(({ kind, label, icon }) => (
        <button
          key={kind}
          onClick={() => addObject(kind)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium transition-all border border-gray-700 hover:border-gray-600"
          title={`Add ${label}`}
        >
          <span className="text-base leading-none">{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );
}
