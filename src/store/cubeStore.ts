import { create } from 'zustand'
import type { CubeData } from '../managers/CubeManager'

export interface CubeStore {
  cubes: CubeData[]
  selectedCubeId: string | null
  hoveredCubeId: string | null
  
  // Actions
  addCube: (cube: CubeData) => void
  removeCube: (id: string) => void
  updateCube: (id: string, updates: Partial<CubeData>) => void
  selectCube: (id: string | null) => void
  setHoveredCube: (id: string | null) => void
  clearCubes: () => void
  spawnGrid: (size: number, spacing?: number) => void
  spawnRandom: (count: number, bounds?: { x: [number, number]; y: [number, number]; z: [number, number] }) => void
}

const DEFAULT_BOUNDS = {
  x: [-10, 10] as [number, number],
  y: [0, 10] as [number, number],
  z: [-10, 10] as [number, number],
}

function generateId(): string {
  return `cube_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function randomInRange([min, max]: [number, number]): number {
  return min + Math.random() * (max - min)
}

export const useCubeStore = create<CubeStore>((set, get) => ({
  cubes: [],
  selectedCubeId: null,
  hoveredCubeId: null,

  addCube: (cube: CubeData) => {
    set((state) => ({
      cubes: [...state.cubes, cube],
    }))
  },

  removeCube: (id: string) => {
    set((state) => ({
      cubes: state.cubes.filter((c) => c.id !== id),
      selectedCubeId: state.selectedCubeId === id ? null : state.selectedCubeId,
      hoveredCubeId: state.hoveredCubeId === id ? null : state.hoveredCubeId,
    }))
  },

  updateCube: (id: string, updates: Partial<CubeData>) => {
    set((state) => ({
      cubes: state.cubes.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }))
  },

  selectCube: (id: string | null) => {
    set({ selectedCubeId: id })
  },

  setHoveredCube: (id: string | null) => {
    set({ hoveredCubeId: id })
  },

  clearCubes: () => {
    set({ cubes: [], selectedCubeId: null, hoveredCubeId: null })
  },

  spawnGrid: (size: number, spacing: number = 1.2) => {
    const newCubes: CubeData[] = []
    const offset = ((size - 1) * spacing) / 2

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          newCubes.push({
            id: generateId(),
            position: [
              x * spacing - offset,
              y * spacing,
              z * spacing - offset,
            ],
            color: [
              0.5 + Math.random() * 0.5,
              0.5 + Math.random() * 0.5,
              0.5 + Math.random() * 0.5,
            ],
            size: 1,
          })
        }
      }
    }

    set((state) => ({
      cubes: [...state.cubes, ...newCubes],
    }))
  },

  spawnRandom: (
    count: number,
    bounds: { x: [number, number]; y: [number, number]; z: [number, number] } = DEFAULT_BOUNDS
  ) => {
    const newCubes: CubeData[] = []

    for (let i = 0; i < count; i++) {
      newCubes.push({
        id: generateId(),
        position: [
          randomInRange(bounds.x),
          randomInRange(bounds.y),
          randomInRange(bounds.z),
        ],
        color: [
          0.3 + Math.random() * 0.7,
          0.3 + Math.random() * 0.7,
          0.3 + Math.random() * 0.7,
        ],
        size: 0.8 + Math.random() * 0.4,
      })
    }

    set((state) => ({
      cubes: [...state.cubes, ...newCubes],
    }))
  },
}))
