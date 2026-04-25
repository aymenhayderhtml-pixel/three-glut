import React from 'react';
import { useStore } from './store/useStore';
import { Toolbar } from './components/ui/Toolbar';
import { SceneList } from './components/ui/SceneList';
import { PropertiesPanel } from './components/ui/PropertiesPanel';
import { Viewport3D } from './components/3d/Viewport3D';
import { Viewport2D } from './components/2d/Viewport2D';

export default function App() {
  const { viewMode } = useStore();

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* Top toolbar */}
      <Toolbar />

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Scene list sidebar */}
        <SceneList />

        {/* Viewport */}
        <div className="flex-1 relative min-w-0">
          {/* View mode indicator */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
            <span className="px-2 py-1 rounded bg-gray-800/80 backdrop-blur text-xs font-semibold text-gray-300 border border-gray-700/50">
              {viewMode === '3d' ? '3D Viewport' : '2D Canvas'}
            </span>
          </div>

          {viewMode === '3d' ? <Viewport3D /> : <Viewport2D />}
        </div>

        {/* Properties panel */}
        <PropertiesPanel />
      </div>

      {/* Status bar */}
      <div className="px-4 py-1.5 bg-gray-900 border-t border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-gray-500">
            CAD Builder v1.0
          </span>
          <span className="text-[10px] text-gray-600">
            {viewMode === '3d'
              ? 'Orbit: Left Mouse • Pan: Right Mouse • Zoom: Scroll'
              : 'Click objects to select • Drag line endpoints to edit'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-600">
            Objects: {useStore.getState().objects.length}
          </span>
        </div>
      </div>
    </div>
  );
}
