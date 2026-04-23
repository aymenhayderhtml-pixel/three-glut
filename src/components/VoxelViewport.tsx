import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { VoxelScene } from './VoxelScene'

export function VoxelViewport() {
  return (
    <div className="voxel-viewport">
      <Canvas
        camera={{ position: [15, 10, 15], fov: 60 }}
        shadows
        style={{ background: '#1a1a2e' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 15, 10]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[-10, -10, -10]} intensity={0.3} />
        
        <VoxelScene />
        
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={5}
          maxDistance={100}
        />
      </Canvas>
    </div>
  )
}
