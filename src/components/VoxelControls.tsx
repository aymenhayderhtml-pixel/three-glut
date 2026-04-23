import { useCubeStore } from '../store/cubeStore'

export function VoxelControls() {
  const spawnGrid = useCubeStore((state) => state.spawnGrid)
  const spawnRandom = useCubeStore((state) => state.spawnRandom)
  const clearCubes = useCubeStore((state) => state.clearCubes)
  const selectedCubeId = useCubeStore((state) => state.selectedCubeId)
  const selectCube = useCubeStore((state) => state.selectCube)
  const removeCube = useCubeStore((state) => state.removeCube)

  return (
    <div className="voxel-controls">
      <h3>Voxel Builder</h3>
      
      <div className="control-group">
        <button onClick={() => spawnGrid(5)}>
          Spawn 5×5×5 Grid
        </button>
        <button onClick={() => spawnGrid(3)}>
          Spawn 3×3×3 Grid
        </button>
      </div>

      <div className="control-group">
        <button onClick={() => spawnRandom(50)}>
          Spawn 50 Random
        </button>
        <button onClick={() => spawnRandom(200)}>
          Spawn 200 Random
        </button>
      </div>

      <div className="control-group">
        <button onClick={clearCubes} style={{ backgroundColor: '#ff4444' }}>
          Clear All Cubes
        </button>
      </div>

      {selectedCubeId && (
        <div className="control-group selection-info">
          <p>Selected: {selectedCubeId.slice(-8)}</p>
          <button 
            onClick={() => removeCube(selectedCubeId)}
            style={{ backgroundColor: '#ff6644' }}
          >
            Delete Selected
          </button>
          <button onClick={() => selectCube(null)}>
            Deselect
          </button>
        </div>
      )}

      <div className="instructions">
        <p><strong>Controls:</strong></p>
        <ul>
          <li>Click a cube to select it</li>
          <li>Shift+Click or Ctrl+Click to delete a cube</li>
          <li>Use OrbitControls to rotate/zoom the view</li>
        </ul>
      </div>
    </div>
  )
}
