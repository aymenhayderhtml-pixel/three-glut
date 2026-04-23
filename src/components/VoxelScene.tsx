import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { CubeManager, type CubeData } from '../managers/CubeManager'
import { useCubeStore } from '../store/cubeStore'

export function VoxelScene() {
  const managerRef = useRef<CubeManager | null>(null)
  const meshRef = useRef<THREE.InstancedMesh | null>(null)
  const { scene, raycaster, camera, gl } = useThree()

  const cubes = useCubeStore((state) => state.cubes)
  const selectedCubeId = useCubeStore((state) => state.selectedCubeId)
  const hoveredCubeId = useCubeStore((state) => state.hoveredCubeId)
  const selectCube = useCubeStore((state) => state.selectCube)
  const setHoveredCube = useCubeStore((state) => state.setHoveredCube)
  const removeCube = useCubeStore((state) => state.removeCube)

  // Initialize CubeManager and InstancedMesh
  useEffect(() => {
    if (!managerRef.current) {
      managerRef.current = new CubeManager(10000)
      const mesh = managerRef.current.createMesh()
      meshRef.current = mesh
      scene.add(mesh)
    }

    return () => {
      if (managerRef.current) {
        if (meshRef.current) {
          scene.remove(meshRef.current)
        }
        managerRef.current.dispose()
        managerRef.current = null
        meshRef.current = null
      }
    }
  }, [scene])

  // Sync cubes from store to InstancedMesh
  useEffect(() => {
    const manager = managerRef.current
    if (!manager) return

    const currentCubes = manager.getAllCubes()
    const currentIds = new Set(currentCubes.map((c) => c.id))
    const storeIds = new Set(cubes.map((c) => c.id))

    // Remove cubes that are no longer in the store
    for (const cube of currentCubes) {
      if (!storeIds.has(cube.id)) {
        manager.removeCube(cube.id)
      }
    }

    // Add or update cubes from the store
    for (const cube of cubes) {
      if (!currentIds.has(cube.id)) {
        manager.addCube(cube)
      } else {
        manager.updateCube(cube.id, cube)
      }
    }
  }, [cubes])

  // Handle selection highlighting
  useEffect(() => {
    const manager = managerRef.current
    if (!manager) return

    // Highlight selected cube
    if (selectedCubeId) {
      manager.setCubeHighlight(selectedCubeId, new THREE.Color(0xffaa00))
    } else if (hoveredCubeId) {
      manager.setCubeHighlight(hoveredCubeId, new THREE.Color(0xffff00))
    } else {
      manager.setCubeHighlight(null)
    }
  }, [selectedCubeId, hoveredCubeId])

  // Handle raycasting for selection
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const manager = managerRef.current
      if (!manager || !meshRef.current) return

      const rect = gl.domElement.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      )

      raycaster.setFromCamera(mouse, camera)
      const result = manager.raycast(raycaster)

      if (result) {
        if (event.shiftKey || event.ctrlKey || event.metaKey) {
          // Delete cube
          removeCube(result.id)
        } else {
          // Select cube
          selectCube(result.id)
        }
      } else {
        selectCube(null)
      }
    }

    const handlePointerMove = (event: MouseEvent) => {
      const manager = managerRef.current
      if (!manager || !meshRef.current) return

      const rect = gl.domElement.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      )

      raycaster.setFromCamera(mouse, camera)
      const result = manager.raycast(raycaster)

      if (result) {
        setHoveredCube(result.id)
        gl.domElement.style.cursor = 'pointer'
      } else {
        setHoveredCube(null)
        gl.domElement.style.cursor = 'default'
      }
    }

    const canvas = gl.domElement
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
    }
  }, [raycaster, camera, gl, selectCube, setHoveredCube, removeCube])

  return null
}
