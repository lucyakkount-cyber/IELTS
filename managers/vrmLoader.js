import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin } from '@pixiv/three-vrm'
import { cacheManager } from './cacheManager'

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
      // 1. Try Cache
      const cached = await cacheManager.getCached('models', path)
      let buffer = null

      if (cached) {
        if (cached.meta && cached.buffer) {
          buffer = cached.buffer
          console.log('⚡ VRMLoader: Loaded from cache (with meta):', path)
        } else if (cached.byteLength) {
          buffer = cached
          console.log('⚡ VRMLoader: Loaded from cache (legacy):', path)
        }
      }

      if (buffer) {
        const gltf = await this.loader.parseAsync(buffer, path)
        const vrm = gltf.userData.vrm
        this.setupVRMModel(vrm)
        return vrm
      }

      // 2. Fetch if not cached
      console.log('🌐 VRMLoader: Fetching from network:', path)
      const response = await fetch(path)
      if (!response.ok) throw new Error(`Failed to fetch ${path}`)

      const arrayBuffer = await response.arrayBuffer()

      // 3. Store in Cache (fire and forget)
      // For remote paths, we treat them as default/server models unless specified otherwise
      cacheManager
        .setCached('models', path, arrayBuffer) // Keep simple buffer for remote/default
        .catch((err) => console.warn('Failed to cache model', err))

      // 4. Parse
      const gltf = await this.loader.parseAsync(arrayBuffer, path)
      const vrm = gltf.userData.vrm
      this.setupVRMModel(vrm)
      return vrm
    } catch (error) {
      console.error('VRMLoader: Error loading', error)
      throw error
    }
  }

  async loadVRMFromFile(file) {
    try {
      console.log('Loading VRM model from file:', file.name)
      const arrayBuffer = await file.arrayBuffer()

      // Save to cache with metadata
      const key = `user_vrm_${Date.now()}`
      const meta = {
        name: file.name,
        date: Date.now(),
        type: 'user',
        size: file.size,
      }

      await cacheManager.setCached('models', key, {
        buffer: arrayBuffer,
        meta,
      })
      console.log('💾 VRMLoader: Cached user model', key)

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

    // 1. Dispose VRM instance (plugin resources, blendshape managers, etc.)
    if (typeof vrm.dispose === 'function') {
      try {
        vrm.dispose()
      } catch (e) {
        console.warn('Error disposing VRM instance:', e)
      }
    }

    // 2. Deep dispose of Scene Graph (Geometries, Materials, Textures)
    if (vrm.scene) {
      vrm.scene.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) {
            child.geometry.dispose()
          }

          const materials = Array.isArray(child.material) ? child.material : [child.material]

          materials.forEach((material) => {
            if (!material) return

            // Dispose all textures on the material
            Object.keys(material).forEach((key) => {
              const prop = material[key]
              if (prop && prop.isTexture) {
                prop.dispose()
              }
            })

            material.dispose()
          })
        }
      })
    }
  }
}
