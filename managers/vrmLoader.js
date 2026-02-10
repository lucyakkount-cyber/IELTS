import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin } from '@pixiv/three-vrm'

export class VRMLoader {
  loader

  constructor() {
    this.loader = new GLTFLoader()
    this.loader.setCrossOrigin('anonymous')
    this.loader.register((parser) => new VRMLoaderPlugin(parser))
  }

  async loadVRMFromPath(path) {
    if (!path) {
      console.warn('VRMLoader: Empty path provided')
      return null
    }
    try {
      console.log('Loading VRM model from:', path)
      const gltf = await this.loader.loadAsync(path)
      const vrm = gltf.userData.vrm
      this.setupVRMModel(vrm)
      return vrm
    } catch (error) {
      // Suppress error logging here to allow for graceful fallbacks in the caller
      // The caller (index.ts) will catch this and try the remote URL.
      throw error
    }
  }

  async loadVRMFromFile(file) {
    try {
      console.log('Loading VRM model from file:', file.name)
      const arrayBuffer = await file.arrayBuffer()
      const gltf = await this.loader.parseAsync(arrayBuffer, '')
      const vrm = gltf.userData.vrm
      this.setupVRMModel(vrm)
      return vrm
    } catch (error) {
      console.error('Failed to load VRM from file:', error)
      throw error
    }
  }

  setupVRMModel(vrm) {
    if (!vrm) return

    vrm.scene.rotation.y = Math.PI
    vrm.scene.scale.set(2, 2, 2)
    vrm.scene.position.set(0, -1.2, -0.3)
    vrm.scene.castShadow = true
    vrm.scene.receiveShadow = true

    this.fixTPose(vrm)
  }

  fixTPose(vrm) {
    if (!vrm || !vrm.humanoid) return
    try {
      const leftUpperArm = vrm.humanoid.getNormalizedBoneNode('leftUpperArm')
      const rightUpperArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm')

      if (leftUpperArm) {
        leftUpperArm.rotation.z = 1.0
        leftUpperArm.rotation.x = 0.3
        leftUpperArm.rotation.y = 0.2
      }
      if (rightUpperArm) {
        rightUpperArm.rotation.z = -1.0
        rightUpperArm.rotation.x = 0.3
        rightUpperArm.rotation.y = -0.2
      }
    } catch (error) {
      console.error('Error fixing T-pose:', error)
    }
  }

  cleanupVRM(vrm) {
    if (!vrm) return
    vrm.scene.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose())
        } else {
          child.material?.dispose()
        }
      }
    })
  }
}
