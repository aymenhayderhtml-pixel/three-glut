import React from 'react';
import { useStore } from '../../store/useStore';
import type { SceneObject } from '../../store/types';

function NumberInput({
  label,
  value,
  onChange,
  step = 0.1,
  min,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-400 w-8 shrink-0">{label}</label>
      <input
        type="number"
        value={value.toFixed(2)}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        step={step}
        min={min}
        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:border-indigo-500 focus:outline-none"
      />
    </div>
  );
}

function Vec3Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: [number, number, number];
  onChange: (v: [number, number, number]) => void;
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-gray-400">{label}</span>
      <div className="grid grid-cols-3 gap-1">
        {['X', 'Y', 'Z'].map((axis, i) => (
          <NumberInput
            key={axis}
            label={axis}
            value={value[i]}
            onChange={(v) => {
              const next = [...value] as [number, number, number];
              next[i] = v;
              onChange(next);
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function PropertiesPanel() {
  const { objects, selectedId, updateObject, removeObject } = useStore();
  const obj = objects.find((o) => o.id === selectedId);

  if (!obj) {
    return (
      <div className="w-64 bg-gray-900 border-l border-gray-800 p-4 flex items-center justify-center">
        <p className="text-xs text-gray-500 text-center">
          Select an object to<br />view its properties
        </p>
      </div>
    );
  }

  const is2D = ['line', 'rect', 'circle', 'polygon'].includes(obj.kind);

  return (
    <div className="w-64 bg-gray-900 border-l border-gray-800 overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white capitalize">{obj.kind}</h3>
            <p className="text-[10px] text-gray-500 font-mono mt-0.5">
              {obj.id.slice(0, 8)}
            </p>
          </div>
          <button
            onClick={() => removeObject(obj.id)}
            className="p-1.5 rounded hover:bg-red-900/50 text-gray-400 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        <div className="w-full h-px bg-gray-800" />

        {/* Position */}
        <Vec3Input
          label="Position"
          value={obj.position}
          onChange={(v) => updateObject(obj.id, { position: v })}
        />

        {/* Rotation */}
        <Vec3Input
          label="Rotation (°)"
          value={obj.rotation}
          onChange={(v) => updateObject(obj.id, { rotation: v })}
        />

        {/* Scale (for cube, rect) */}
        {(obj.kind === 'cube' || obj.kind === 'rect') && (
          <Vec3Input
            label="Scale"
            value={obj.scale}
            onChange={(v) => updateObject(obj.id, { scale: v })}
          />
        )}

        {/* Radius (for sphere, cone, torus, prism, circle) */}
        {['sphere', 'cone', 'torus', 'prism', 'circle'].includes(obj.kind) && (
          <NumberInput
            label="R"
            value={obj.radius}
            onChange={(v) => updateObject(obj.id, { radius: Math.max(0.1, v) })}
            min={0.1}
          />
        )}

        {/* Height (for cone, prism) */}
        {['cone', 'prism'].includes(obj.kind) && (
          <NumberInput
            label="H"
            value={obj.height}
            onChange={(v) => updateObject(obj.id, { height: Math.max(0.1, v) })}
            min={0.1}
          />
        )}

        {/* Length (for line) */}
        {obj.kind === 'line' && (
          <NumberInput
            label="L"
            value={obj.length}
            onChange={(v) => updateObject(obj.id, { length: Math.max(0.1, v) })}
            min={0.1}
          />
        )}

        {/* Face pulls display */}
        {Object.keys(obj.facePulls).length > 0 && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-400">Face Pulls</span>
            {Object.entries(obj.facePulls).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{key}</span>
                <span className="text-gray-300 font-mono">{(value as number).toFixed(3)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Usage hints */}
        <div className="w-full h-px bg-gray-800" />
        <div className="space-y-1">
          <p className="text-[10px] text-gray-600 font-medium uppercase tracking-wider">Tips</p>
          {obj.kind === 'prism' && (
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Click and drag on a prism face to resize. Side faces change radius, top/bottom faces change height.
            </p>
          )}
          {obj.kind === 'cube' && (
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Click and drag on a cube face to resize that axis. The opposite face stays anchored.
            </p>
          )}
          {obj.kind === 'line' && (
            <p className="text-[10px] text-gray-500 leading-relaxed">
              In 2D view, drag the endpoint dots to resize and rotate the line. The opposite endpoint stays anchored.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
