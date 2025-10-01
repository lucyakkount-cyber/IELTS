// managers/vrmLoader.js - Enhanced with T-Pose Fix and Natural Animations
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'

export class VRMLoader {
  constructor() {
    this.loader = new GLTFLoader()
    this.fbxLoader = new FBXLoader()
    this.loader.register((parser) => new VRMLoaderPlugin(parser))

    this.animationCache = new Map()
    this.loadedClips = []

    this.mixamoVRMRigMap = {
      mixamorigHips: 'hips',
      mixamorigSpine: 'spine',
      mixamorigSpine1: 'chest',
      mixamorigSpine2: 'upperChest',
      mixamorigNeck: 'neck',
      mixamorigHead: 'head',
      mixamorigLeftShoulder: 'leftShoulder',
      mixamorigLeftArm: 'leftUpperArm',
      mixamorigLeftForeArm: 'leftLowerArm',
      mixamorigLeftHand: 'leftHand',
      mixamorigRightShoulder: 'rightShoulder',
      mixamorigRightArm: 'rightUpperArm',
      mixamorigRightForeArm: 'rightLowerArm',
      mixamorigRightHand: 'rightHand',
      mixamorigLeftUpLeg: 'leftUpperLeg',
      mixamorigLeftLeg: 'leftLowerLeg',
      mixamorigLeftFoot: 'leftFoot',
      mixamorigRightUpLeg: 'rightUpperLeg',
      mixamorigRightLeg: 'rightLowerLeg',
      mixamorigRightFoot: 'rightFoot',
      mixamorigLeftToeBase: 'leftToes',
      mixamorigRightToeBase: 'rightToes',
    }
  }

  async loadVRMFromPath(path) {
    try {
      console.log('Loading VRM model from:', path)
      const gltf = await this.loader.loadAsync(path)
      const vrm = gltf.userData.vrm
      this.setupVRMModel(vrm)
      console.log('VRM model loaded successfully')
      return vrm
    } catch (error) {
      console.error('Failed to load VRM model:', error)
      throw error
    }
  }

  async loadVRMFromFile(file) {
    try {
      console.log('Loading VRM model from file:', file.name)
      const arrayBuffer = await file.arrayBuffer()
      const gltf = await this.loader.parseAsync(arrayBuffer, '', file.name)
      const vrm = gltf.userData.vrm
      this.setupVRMModel(vrm)
      console.log('VRM model loaded from file')
      return vrm
    } catch (error) {
      console.error('Failed to load VRM from file:', error)
      throw error
    }
  }

  setupVRMModel(vrm) {
    if (!vrm) return

    // Portrait mode positioning
    vrm.scene.rotation.y = Math.PI
    vrm.scene.scale.set(2.5, 2.5, 2.5)
    vrm.scene.position.set(0, -1.2, -0.3)
    vrm.scene.castShadow = true
    vrm.scene.receiveShadow = true

    // Use combineSkeletons instead of deprecated removeUnnecessaryJoints
    // VRMUtils.combineSkeletons(vrm.scene) // Removed - not needed for basic setup

    // CRITICAL: Fix T-Pose immediately
    this.fixTPose(vrm)

    console.log('VRM model setup complete with T-pose fixed')
  }

  fixTPose(vrm) {
    if (!vrm || !vrm.humanoid) return

    try {
      // Get all arm bones
      const leftUpperArm = vrm.humanoid.getNormalizedBoneNode('leftUpperArm')
      const rightUpperArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm')
      const leftLowerArm = vrm.humanoid.getNormalizedBoneNode('leftLowerArm')
      const rightLowerArm = vrm.humanoid.getNormalizedBoneNode('rightLowerArm')
      const leftHand = vrm.humanoid.getNormalizedBoneNode('leftHand')
      const rightHand = vrm.humanoid.getNormalizedBoneNode('rightHand')
      const leftShoulder = vrm.humanoid.getNormalizedBoneNode('leftShoulder')
      const rightShoulder = vrm.humanoid.getNormalizedBoneNode('rightShoulder')

      // STRONG rotations to bring arms DOWN from T-pose
      if (leftUpperArm) {
        leftUpperArm.rotation.z = 1.0  // Bring left arm DOWN (stronger)
        leftUpperArm.rotation.x = 0.3  // Forward
        leftUpperArm.rotation.y = 0.2  // Inward
      }

      if (rightUpperArm) {
        rightUpperArm.rotation.z = -1.0 // Bring right arm DOWN (stronger)
        rightUpperArm.rotation.x = 0.3  // Forward
        rightUpperArm.rotation.y = -0.2 // Inward
      }

      // Bend elbows
      if (leftLowerArm) {
        leftLowerArm.rotation.y = -0.5
        leftLowerArm.rotation.x = 0.1
      }

      if (rightLowerArm) {
        rightLowerArm.rotation.y = 0.5
        rightLowerArm.rotation.x = 0.1
      }

      // Relax hands
      if (leftHand) {
        leftHand.rotation.z = 0.3
        leftHand.rotation.x = 0.2
      }

      if (rightHand) {
        rightHand.rotation.z = -0.3
        rightHand.rotation.x = 0.2
      }

      // Shoulders down
      if (leftShoulder) {
        leftShoulder.rotation.z = 0.1
        leftShoulder.rotation.y = 0.05
      }

      if (rightShoulder) {
        rightShoulder.rotation.z = -0.1
        rightShoulder.rotation.y = -0.05
      }

      console.log('T-pose fixed with strong rotations')
    } catch (error) {
      console.error('Error fixing T-pose:', error)
    }
  }

  async loadAnimationFromFBX(fbxPath) {
    if (this.animationCache.has(fbxPath)) {
      console.log('Using cached animation:', fbxPath)
      return this.animationCache.get(fbxPath)
    }

    try {
      console.log('Loading FBX animation:', fbxPath)
      const fbxAsset = await this.fbxLoader.loadAsync(fbxPath)
      const clip = THREE.AnimationClip.findByName(fbxAsset.animations, 'mixamo.com') || fbxAsset.animations[0]

      if (!clip) {
        throw new Error('No animation found in FBX')
      }

      const result = { clip, asset: fbxAsset }
      this.animationCache.set(fbxPath, result)
      console.log('Animation loaded:', fbxPath)
      return result
    } catch (error) {
      console.error('Failed to load animation:', fbxPath, error)
      throw error
    }
  }

  async loadDefaultAnimations(vrm) {
    const animations = {}

    try {
      console.log('Loading animations...')

      const gestures = [
        { file: 'Wave.fbx', name: 'wave' },
        { file: 'Shrug.fbx', name: 'shrug' },
        { file: 'Pointing.fbx', name: 'pointing' },
        { file: 'Clapping.fbx', name: 'clapping' },
        { file: 'ThumbsUp.fbx', name: 'thumbsup' }
      ]

      for (const gesture of gestures) {
        try {
          const data = await this.loadAnimationFromFBX(`/animations/${gesture.file}`)
          animations[gesture.name] = await this.convertMixamoClip(data.clip, data.asset, vrm)
          this.loadedClips.push(animations[gesture.name])
          console.log(`${gesture.name} loaded`)
        } catch (error) {
          console.warn(`${gesture.file} not available`)
        }
      }

      return animations
    } catch (error) {
      console.error('Error loading animations:', error)
      return animations
    }
  }

  async convertMixamoClip(clip, asset, vrm) {
    const tracks = []
    const restRotationInverse = new THREE.Quaternion()
    const parentRestWorldRotation = new THREE.Quaternion()
    const _quatA = new THREE.Quaternion()
    const _vec3 = new THREE.Vector3()

    const motionHipsHeight = asset.getObjectByName('mixamorigHips')?.position.y || 1
    const vrmHipsY = vrm.humanoid?.getNormalizedBoneNode('hips')?.getWorldPosition(_vec3).y || 0
    const vrmRootY = vrm.scene.getWorldPosition(_vec3).y
    const vrmHipsHeight = Math.abs(vrmHipsY - vrmRootY)
    const hipsPositionScale = vrmHipsHeight / motionHipsHeight

    clip.tracks.forEach((track) => {
      const trackSplitted = track.name.split('.')
      const mixamoRigName = trackSplitted[0]
      const vrmBoneName = this.mixamoVRMRigMap[mixamoRigName]
      const vrmNodeName = vrm.humanoid?.getNormalizedBoneNode(vrmBoneName)?.name
      const mixamoRigNode = asset.getObjectByName(mixamoRigName)

      if (vrmNodeName && mixamoRigNode) {
        const propertyName = trackSplitted[1]

        mixamoRigNode.getWorldQuaternion(restRotationInverse).invert()
        mixamoRigNode.parent?.getWorldQuaternion(parentRestWorldRotation)

        if (track instanceof THREE.QuaternionKeyframeTrack) {
          for (let i = 0; i < track.values.length; i += 4) {
            const flatQuaternion = track.values.slice(i, i + 4)
            _quatA.fromArray(flatQuaternion)
            _quatA.premultiply(parentRestWorldRotation).multiply(restRotationInverse)
            _quatA.toArray(flatQuaternion)
            flatQuaternion.forEach((v, index) => {
              track.values[index + i] = v
            })
          }

          tracks.push(
            new THREE.QuaternionKeyframeTrack(
              `${vrmNodeName}.${propertyName}`,
              track.times,
              track.values.map((v, i) => (vrm.meta?.metaVersion === '0' && i % 2 === 0 ? -v : v))
            )
          )
        } else if (track instanceof THREE.VectorKeyframeTrack) {
          const value = track.values.map(
            (v, i) => (vrm.meta?.metaVersion === '0' && i % 3 !== 1 ? -v : v) * hipsPositionScale
          )

          // Minimize body movement for portrait
          if (vrmBoneName === 'hips' && propertyName === 'position') {
            for (let i = 0; i < value.length; i += 3) {
              value[i] *= 0.2
              value[i + 1] *= 0.1
              value[i + 2] *= 0.2
            }
          }

          tracks.push(
            new THREE.VectorKeyframeTrack(`${vrmNodeName}.${propertyName}`, track.times, value)
          )
        }
      }
    })

    return new THREE.AnimationClip('vrmAnimation', clip.duration, tracks)
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

    this.loadedClips.forEach(clip => {
      clip.tracks = []
    })
    this.loadedClips = []
  }

  clearCache() {
    this.animationCache.clear()
  }
}
