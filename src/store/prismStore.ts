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

  // Actions
  setMesh: (mesh: PrismMesh) => void;
  setSelectedFaceId: (id: string | null) => void;
  setFaceMode: (mode: boolean) => void;
  extrudeFace: (faceId: string, delta: number) => void;
  bevelEdge: (edgeId: string, amount: number) => void;
  deleteFace: (faceId: string) => void;
}

export const usePrismStore = create<PrismState>((set, get) => ({
  mesh: generatePrismMesh(4, 2, 1), // default 4-sided prism (cube)
  selectedFaceId: null,
  faceMode: false,

  setMesh: (mesh) => set({ mesh }),
  setSelectedFaceId: (id) => set({ selectedFaceId: id }),
  setFaceMode: (mode) => set({ faceMode: mode, selectedFaceId: null }),

  extrudeFace: (faceId, delta) => {
    const { mesh } = get();
    const newMesh = doExtrude(mesh, faceId, delta);
    set({ mesh: newMesh });
  },

  bevelEdge: (edgeId, amount) => {
    const { mesh } = get();
    const newMesh = doBevel(mesh, edgeId, amount);
    set({ mesh: newMesh });
  },

  deleteFace: (faceId) => {
    const { mesh } = get();
    const newMesh = doDelete(mesh, faceId);
    set({ mesh: newMesh, selectedFaceId: null });
  },
}));