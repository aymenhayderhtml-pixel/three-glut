import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { SceneObject, ViewMode, DragState } from './types';

interface AppState {
  objects: SceneObject[];
  selectedId: string | null;
  viewMode: ViewMode;
  dragState: DragState | null;

  addObject: (kind: SceneObject['kind']) => void;
  removeObject: (id: string) => void;
  selectObject: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
  setDragState: (state: DragState | null) => void;
  updateFacePull: (id: string, faceKey: string, value: number) => void;
  updateEdgePull: (id: string, edgeKey: string, value: number) => void;
}

function createDefaultObject(kind: SceneObject['kind']): SceneObject {
  const base: SceneObject = {
    id: uuidv4(),
    kind,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    radius: 1,
    height: 2,
    length: 3,
    facePulls: {},
    edgePulls: {},
  };

  switch (kind) {
    case 'cube':
      return { ...base, scale: [1, 1, 1] };
    case 'sphere':
      return { ...base, radius: 1 };
    case 'prism':
      return { ...base, radius: 1, height: 2 };
    case 'line':
      return { ...base, length: 3, position: [0, 0, 0] };
    case 'rect':
      return { ...base, scale: [2, 1, 1] };
    case 'circle':
      return { ...base, radius: 1 };
    case 'cone':
      return { ...base, radius: 1, height: 2 };
    case 'torus':
      return { ...base, radius: 1 };
    default:
      return base;
  }
}

export const useStore = create<AppState>((set) => ({
  objects: [],
  selectedId: null,
  viewMode: '3d',
  dragState: null,

  addObject: (kind) =>
    set((state) => ({
      objects: [...state.objects, createDefaultObject(kind)],
    })),

  removeObject: (id) =>
    set((state) => ({
      objects: state.objects.filter((o) => o.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    })),

  selectObject: (id) => set({ selectedId: id }),

  setViewMode: (mode) => set({ viewMode: mode }),

  updateObject: (id, updates) =>
    set((state) => ({
      objects: state.objects.map((o) => (o.id === id ? { ...o, ...updates } : o)),
    })),

  setDragState: (dragState) => set({ dragState }),

  updateFacePull: (id, faceKey, value) =>
    set((state) => ({
      objects: state.objects.map((o) =>
        o.id === id
          ? { ...o, facePulls: { ...o.facePulls, [faceKey]: value } }
          : o
      ),
    })),

  updateEdgePull: (id, edgeKey, value) =>
    set((state) => ({
      objects: state.objects.map((o) =>
        o.id === id
          ? { ...o, edgePulls: { ...o.edgePulls, [edgeKey]: value } }
          : o
      ),
    })),
}));
