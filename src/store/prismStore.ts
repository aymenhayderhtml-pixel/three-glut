import { create } from 'zustand';
import { PrismMesh, Face, Edge } from '../types/prism.types';
import { generatePrismMesh } from '../geometry/prismGeometry';

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

    // Internal helpers (will be implemented in separate command files)
    _performExtrude: (faceId: string, delta: number) => PrismMesh;
    _performBevel: (edgeId: string, amount: number) => PrismMesh;
    _performDeleteFace: (faceId: string) => PrismMesh;
}

// Temporary placeholder functions – will be replaced later
const placeholderExtrude = (mesh: PrismMesh, faceId: string, delta: number): PrismMesh => {
    console.warn('Extrude not fully implemented yet');
    return mesh;
};

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
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(mesh);
        const newMesh = placeholderExtrude(mesh, faceId, delta);
        set({ mesh: newMesh, history: newHistory, historyIndex: newHistory.length - 1 });
    },

    bevelEdge: (edgeId, amount) => {
        // placeholder
        console.log('Bevel not yet implemented');
    },

    deleteFace: (faceId) => {
        // placeholder
        console.log('Delete face not yet implemented');
    },

    undo: () => {
        const { history, historyIndex, mesh } = get();
        if (historyIndex > 0) {
            set({ mesh: history[historyIndex - 1], historyIndex: historyIndex - 1 });
        } else if (historyIndex === -1 && history.length > 0) {
            // special case: go to first state
            set({ mesh: history[0], historyIndex: 0 });
        }
    },

    redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex < history.length - 1) {
            set({ mesh: history[historyIndex + 1], historyIndex: historyIndex + 1 });
        }
    },

    _performExtrude: placeholderExtrude,
    _performBevel: (mesh, edgeId, amount) => mesh,
    _performDeleteFace: (mesh, faceId) => mesh,
}));