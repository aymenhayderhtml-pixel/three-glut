import * as THREE from 'three'

export type CubeData = {
  id: string
  position: [number, number, number]
  rotation: [number, number, number] // x, y, z rotation in degrees
  color: [number, number, number]
  size: number
}

export class CubeManager {
  private mesh: THREE.InstancedMesh | null = null
  private cubeMap: Map<string, number> = new Map()
  private dataMap: Map<string, CubeData> = new Map()
  private dummy: THREE.Object3D
  private maxCubes: number
  private geometry: THREE.BoxGeometry
  private material: THREE.MeshStandardMaterial

  constructor(maxCubes: number = 10000) {
    this.maxCubes = maxCubes
    this.dummy = new THREE.Object3D()
    this.geometry = new THREE.BoxGeometry(1, 1, 1)
    this.material = new THREE.MeshStandardMaterial({
      roughness: 0.55,
      metalness: 0.12,
    })
  }

  public createMesh(): THREE.InstancedMesh {
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.maxCubes)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    return this.mesh
  }

  public getMesh(): THREE.InstancedMesh | null {
    return this.mesh
  }

  public addCube(cube: CubeData): void {
    if (!this.mesh || this.cubeMap.size >= this.maxCubes) {
      console.warn('CubeManager: Cannot add more cubes')
      return
    }

    const instanceId = this.cubeMap.size
    this.cubeMap.set(cube.id, instanceId)
    this.dataMap.set(cube.id, cube)

    this.updateInstance(instanceId, cube)
    this.mesh!.count = this.cubeMap.size
  }

  public removeCube(id: string): void {
    const instanceId = this.cubeMap.get(id)
    if (instanceId === undefined) {
      return
    }

    this.cubeMap.delete(id)
    this.dataMap.delete(id)

    // Remove the instance by swapping with the last one
    this.removeInstance(instanceId)
  }

  public updateCube(id: string, updates: Partial<CubeData>): void {
    const cube = this.dataMap.get(id)
    const instanceId = this.cubeMap.get(id)

    if (!cube || instanceId === undefined || !this.mesh) {
      return
    }

    const updatedCube: CubeData = { ...cube, ...updates }
    this.dataMap.set(id, updatedCube)
    this.updateInstance(instanceId, updatedCube)
  }

  public getCube(id: string): CubeData | undefined {
    return this.dataMap.get(id)
  }

  public getAllCubes(): CubeData[] {
    return Array.from(this.dataMap.values())
  }

  public raycast(raycaster: THREE.Raycaster): { id: string; instanceId: number } | null {
    if (!this.mesh) {
      return null
    }

    const intersects = raycaster.intersectObject(this.mesh)

    if (intersects.length > 0) {
      const instanceId = intersects[0].instanceId
      // Find the cube id by instanceId
      for (const [id, instId] of this.cubeMap.entries()) {
        if (instId === instanceId) {
          return { id, instanceId }
        }
      }
    }

    return null
  }

  public setCubeHighlight(id: string | null, emissiveColor?: THREE.Color): void {
    if (!this.mesh) {
      return
    }

    // Reset all to default emissive
    const defaultEmissive = new THREE.Color(0x000000)

    for (let i = 0; i < this.mesh.count; i++) {
      this.mesh.setColorAt(i, defaultEmissive)
    }

    if (id !== null) {
      const instanceId = this.cubeMap.get(id)
      if (instanceId !== undefined && emissiveColor) {
        this.mesh.setColorAt(instanceId, emissiveColor)
      }
    }

    this.mesh.instanceColor!.needsUpdate = true
  }

  public clear(): void {
    this.cubeMap.clear()
    this.dataMap.clear()
    if (this.mesh) {
      this.mesh.count = 0
    }
  }

  public dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
    if (this.mesh) {
      this.mesh.dispose()
    }
    this.cubeMap.clear()
    this.dataMap.clear()
  }

  private updateInstance(instanceId: number, cube: CubeData): void {
    if (!this.mesh) {
      return
    }

    this.dummy.position.set(cube.position[0], cube.position[1], cube.position[2])
    this.dummy.scale.set(cube.size, cube.size, cube.size)

    // Apply rotation (convert degrees to radians)
    this.dummy.rotation.x = (cube.rotation?.[0] ?? 0) * (Math.PI / 180)
    this.dummy.rotation.y = (cube.rotation?.[1] ?? 0) * (Math.PI / 180)
    this.dummy.rotation.z = (cube.rotation?.[2] ?? 0) * (Math.PI / 180)

    this.dummy.updateMatrix()

    this.mesh.setMatrixAt(instanceId, this.dummy.matrix)
    this.mesh.instanceMatrix.needsUpdate = true

    // Update color
    const color = new THREE.Color().setRGB(cube.color[0], cube.color[1], cube.color[2])
    this.mesh.setColorAt(instanceId, color)
    this.mesh.instanceColor!.needsUpdate = true
  }

  private removeInstance(instanceId: number): void {
    if (!this.mesh) {
      return
    }

    const lastIndex = this.mesh.count - 1

    // If we're not removing the last instance, swap it with the last one
    if (instanceId !== lastIndex) {
      // Find the cube at the last index
      let lastCubeId: string | null = null
      for (const [id, idx] of this.cubeMap.entries()) {
        if (idx === lastIndex) {
          lastCubeId = id
          break
        }
      }

      if (lastCubeId) {
        // Copy the last instance's matrix to the removed instance's slot
        const matrix = new THREE.Matrix4()
        this.mesh.getMatrixAt(lastIndex, matrix)
        this.mesh.setMatrixAt(instanceId, matrix)

        // Copy the color
        const color = new THREE.Color()
        this.mesh.getColorAt(lastIndex, color)
        this.mesh.setColorAt(instanceId, color)

        // Update the map
        this.cubeMap.set(lastCubeId, instanceId)
      }
    }

    this.mesh.count = lastIndex
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true
    }
  }
}
