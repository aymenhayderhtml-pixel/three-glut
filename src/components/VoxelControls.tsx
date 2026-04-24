import { useCubeStore } from '../store/cubeStore'
import { useState } from 'react'

export function VoxelControls() {
  const spawnGrid = useCubeStore((state) => state.spawnGrid)
  const spawnRandom = useCubeStore((state) => state.spawnRandom)
  const clearCubes = useCubeStore((state) => state.clearCubes)
  const selectedCubeId = useCubeStore((state) => state.selectedCubeId)
  const selectCube = useCubeStore((state) => state.selectCube)
  const removeCube = useCubeStore((state) => state.removeCube)
  const updateCube = useCubeStore((state) => state.updateCube)
  const cubes = useCubeStore((state) => state.cubes)
  
  const [isExplorerOpen, setIsExplorerOpen] = useState(true)
  const [isInspectorOpen, setIsInspectorOpen] = useState(true)
  const [isCodeOpen, setIsCodeOpen] = useState(true)

  const selectedCube = cubes.find((c) => c.id === selectedCubeId)

  const handleRotationChange = (axis: 'x' | 'y' | 'z', value: number) => {
    if (!selectedCubeId || !selectedCube) return
    
    const newRotation: [number, number, number] = [...(selectedCube.rotation || [0, 0, 0])]
    const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
    newRotation[axisIndex] = value
    updateCube(selectedCubeId, { rotation: newRotation })
  }

  return (
    <div className="voxel-controls">
      <h3>Voxel Builder</h3>
      
      {/* Panel Toggle Buttons */}
      <div className="control-group panel-toggles">
        <button 
          onClick={() => setIsExplorerOpen(!isExplorerOpen)}
          className={isExplorerOpen ? 'active' : ''}
        >
          {isExplorerOpen ? '▼' : '▶'} Explorer
        </button>
        <button 
          onClick={() => setIsInspectorOpen(!isInspectorOpen)}
          className={isInspectorOpen ? 'active' : ''}
        >
          {isInspectorOpen ? '▼' : '▶'} Inspector
        </button>
        <button 
          onClick={() => setIsCodeOpen(!isCodeOpen)}
          className={isCodeOpen ? 'active' : ''}
        >
          {isCodeOpen ? '▼' : '▶'} Code
        </button>
      </div>

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

      {selectedCube && (
        <div className="control-group selection-info">
          <p>Selected: {selectedCube.id.slice(-8)}</p>
          
          {/* Rotation Controls */}
          <div className="rotation-controls">
            <label>
              Rotation X:
              <input
                type="number"
                value={Math.round(selectedCube.rotation?.[0] || 0)}
                onChange={(e) => handleRotationChange('x', Number(e.target.value))}
                min={0}
                max={360}
                step={15}
              />
            </label>
            <label>
              Rotation Y:
              <input
                type="number"
                value={Math.round(selectedCube.rotation?.[1] || 0)}
                onChange={(e) => handleRotationChange('y', Number(e.target.value))}
                min={0}
                max={360}
                step={15}
              />
            </label>
            <label>
              Rotation Z:
              <input
                type="number"
                value={Math.round(selectedCube.rotation?.[2] || 0)}
                onChange={(e) => handleRotationChange('z', Number(e.target.value))}
                min={0}
                max={360}
                step={15}
              />
            </label>
          </div>
          
          <button 
            onClick={() => { if (selectedCubeId) removeCube(selectedCubeId) }}
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
          <li>Adjust rotation values for selected cube</li>
        </ul>
      </div>
    </div>
  )
}
