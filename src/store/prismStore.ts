import { create } from 'zustand';
import { PrismMesh } from '../types/prism.types';
import { generatePrismMesh } from '../geometry/prismGeometry';
import {
  extrudeFace as doExtrude,
  bevelEdge as doBevel,
  deleteFace as doDelete,
} from '../commands/prismCommands';

interface PrismState {
  mesh: PrismMesh;
  selectedFaceId: string | null;
  faceMode: boolean;
  history: PrismMesh[];
  historyIndex: number;

  // Actions
  setMesh: (mesh: PrismMesh) => void;
  setSelectedFaceId: (id: string | null) => void;
  setFaceMode: (mode: boolean) => void;
  extrudeFace: (faceId: string, delta: number) => void;
  bevelEdge: (edgeId: string, amount: number) => void;
  deleteFace: (faceId: string) => void;
  undo: () => void;
  redo: () => void;
}

function pushHistory(
  mesh: PrismMesh,
  history: PrismMesh[],
  historyIndex: number,
): { newHistory: PrismMesh[]; newIndex: number } {
  const newHistory = history.slice(0, historyIndex + 1);
  newHistory.push(mesh);
  return { newHistory, newIndex: newHistory.length - 1 };
}

export const usePrismStore = create<PrismState>((set, get) => ({
  mesh: generatePrismMesh(4, 2, 1), // default 4-sided prism (cube)
  selectedFaceId: null,
  faceMode: false,
  history: [],
  historyIndex: -1,

  setMesh: (mesh) => set({ mesh }),
  setSelectedFaceId: (id) => set({ selectedFaceId: id }),
  setFaceMode: (mode) => set({ faceMode: mode, selectedFaceId: null }),

  extrudeFace: (faceId, delta) => {
    const { mesh, history, historyIndex } = get();
    const { newHistory, newIndex } = pushHistory(mesh, history, historyIndex);
    const newMesh = doExtrude(mesh, faceId, delta);
    set({ mesh: newMesh, history: newHistory, historyIndex: newIndex });
  },

  bevelEdge: (edgeId, amount) => {
    const { mesh, history, historyIndex } = get();
    const { newHistory, newIndex } = pushHistory(mesh, history, historyIndex);
    const newMesh = doBevel(mesh, edgeId, amount);
    set({ mesh: newMesh, history: newHistory, historyIndex: newIndex });
  },

  deleteFace: (faceId) => {
    const { mesh, history, historyIndex } = get();
    const { newHistory, newIndex } = pushHistory(mesh, history, historyIndex);
    const newMesh = doDelete(mesh, faceId);
    set({ mesh: newMesh, history: newHistory, historyIndex: newIndex, selectedFaceId: null });
  },

  undo: () => {
    const { history, historyIndex } = get();
    // Fix: use >= 0 so index 0 (first saved state) can be restored
    if (historyIndex >= 0) {
      set({
        mesh: history[historyIndex],
        historyIndex: historyIndex - 1,
      });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      set({ mesh: history[historyIndex + 1], historyIndex: historyIndex + 1 });
    }
  },
}));