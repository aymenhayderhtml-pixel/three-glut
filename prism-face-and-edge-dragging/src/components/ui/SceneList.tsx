import React from 'react';
import { useStore } from '../../store/useStore';

const KIND_ICONS: Record<string, string> = {
  cube: '◻',
  sphere: '○',
  cone: '△',
  torus: '◎',
  prism: '▲',
  ground: '▬',
  teapot: '☕',
  line: '╱',
  rect: '▭',
  circle: '◯',
  polygon: '⬡',
};

export function SceneList() {
  const { objects, selectedId, selectObject } = useStore();

  return (
    <div className="w-52 bg-gray-900 border-r border-gray-800 overflow-y-auto">
      <div className="p-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Scene Objects
        </h2>

        {objects.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-8">
            No objects yet.<br />Use the toolbar to add some.
          </p>
        ) : (
          <div className="space-y-0.5">
            {objects.map((obj) => {
              const is2D = ['line', 'rect', 'circle', 'polygon'].includes(obj.kind);
              return (
                <button
                  key={obj.id}
                  onClick={() => selectObject(obj.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all ${
                    selectedId === obj.id
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200 border border-transparent'
                  }`}
                >
                  <span className="text-sm w-5 text-center shrink-0">
                    {KIND_ICONS[obj.kind] || '?'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium capitalize truncate">
                      {obj.kind}
                    </div>
                    <div className="text-[10px] text-gray-600 font-mono">
                      {obj.id.slice(0, 6)}
                    </div>
                  </div>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                      is2D
                        ? 'bg-emerald-900/30 text-emerald-500'
                        : 'bg-blue-900/30 text-blue-400'
                    }`}
                  >
                    {is2D ? '2D' : '3D'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
