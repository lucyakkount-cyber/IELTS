// Enhanced VRM Loader with better animation handling
// vrmLoader.js
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
      console.log('🔄 Loading VRM model from:', path)
      const gltf = await this.loader.loadAsync(path)
      const vrm = gltf.userData.vrm
      this.setupVRMModel(vrm)
      console.log('✅ VRM model loaded successfully')
      return vrm
    } catch (error) {
      console.error('❌ Failed to load VRM model:', error)
      throw error
    }
  }

  async loadVRMFromFile(file) {
    try {
      console.log('🔄 Loading VRM model from file:', file.name)
      const arrayBuffer = await file.arrayBuffer()
      const gltf = await this.loader.parseAsync(arrayBuffer, '', file.name)
      const vrm = gltf.userData.vrm
      this.setupVRMModel(vrm)
      console.log('✅ VRM model loaded from file')
      return vrm
    } catch (error) {
      console.error('❌ Failed to load VRM from file:', error)
      throw error
    }
  }

  setupVRMModel(vrm) {
    if (!vrm) return

    vrm.scene.rotation.y = Math.PI
    vrm.scene.scale.set(2, 2, 2)
    vrm.scene.position.set(0, -2, -0.5)
    vrm.scene.castShadow = true
    vrm.scene.receiveShadow = true

    VRMUtils.removeUnnecessaryJoints(vrm.scene)
    console.log('✅ VRM model setup complete')
  }

  async loadAnimationFromFBX(fbxPath) {
    // Check cache first
    if (this.animationCache.has(fbxPath)) {
      console.log('📦 Using cached animation:', fbxPath)
      return this.animationCache.get(fbxPath)
    }

    try {
      console.log('🎭 Loading FBX animation:', fbxPath)
      const fbxAsset = await this.fbxLoader.loadAsync(fbxPath)
      const clip = THREE.AnimationClip.findByName(fbxAsset.animations, 'mixamo.com') || fbxAsset.animations[0]

      if (!clip) {
        throw new Error('No animation found in FBX')
      }

      const result = { clip, asset: fbxAsset }
      this.animationCache.set(fbxPath, result)
      console.log('✅ Animation loaded:', fbxPath)
      return result
    } catch (error) {
      console.error('❌ Failed to load animation:', fbxPath, error)
      throw error
    }
  }

  async loadDefaultAnimations(vrm) {
    const animations = {}

    try {
      console.log('🎭 Loading default animations...')

      // Load idle animation
      try {
        const idleData = await this.loadAnimationFromFBX('/animations/HappyIdle.fbx')
        animations.idle = await this.convertMixamoClip(idleData.clip, idleData.asset, vrm)
        console.log('✅ Idle animation ready')
      } catch (error) {
        console.warn('⚠️ Idle animation not found')
      }

      // Load gesture animations
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
          console.log(`✅ ${gesture.name} ready`)
        } catch (error) {
          console.warn(`⚠️ ${gesture.file} not loaded`)
        }
      }

      return animations
    } catch (error) {
      console.error('❌ Error loading animations:', error)
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

          if (vrmBoneName === 'hips' && propertyName === 'position') {
            for (let i = 0; i < value.length; i += 3) {
              value[i] = 0
              value[i + 2] = 0
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

// ========================================
// Enhanced Animation Manager with Bug Fixes
// ========================================

export class AnimationManager {
  constructor(vrm) {
    this.vrm = vrm
    this.currentMixer = null
    this.currentAnimationAction = null
    this.idleAnimation = null
    this.gestureAnimations = {}
    this.blinkInterval = null
    this.gestureTimeout = null
    this.activeAnimations = new Set()
    this.isPlayingSequence = false

    this.EXPRESSIONS = {
      neutral: ['neutral'],
      happy: ['happy', 'joy'],
      sad: ['sad', 'sorrow'],
      angry: ['angry', 'fury'],
      surprised: ['surprised', 'shocked'],
      excited: ['excited', 'happy'],
      confused: ['confused', 'sad'],
      smirk: ['smirk', 'happy'],
      laugh: ['happy', 'joy'],
      embarrassed: ['blink', 'happy'],
      determined: ['angry'],
      worried: ['sad', 'blink'],
      curious: ['surprised'],
      sleepy: ['relaxed', 'blink'],
      mischievous: ['smirk', 'wink']
    }
  }

  updateVRM(newVrm) {
    this.cleanup()
    this.vrm = newVrm
    this.startBlinking()
  }

  setIdleAnimation(animation) {
    this.idleAnimation = animation
  }

  setGestureAnimation(name, animation) {
    this.gestureAnimations[name] = animation
  }

  startIdleAnimation() {
    if (!this.vrm || !this.idleAnimation) return

    if (this.currentAnimationAction) {
      this.currentAnimationAction.stop()
    }

    this.currentMixer = new THREE.AnimationMixer(this.vrm.scene)
    this.currentAnimationAction = this.currentMixer.clipAction(this.idleAnimation)
    this.currentAnimationAction.setLoop(THREE.LoopRepeat)
    this.currentAnimationAction.clampWhenFinished = true
    this.currentAnimationAction.reset()
    this.currentAnimationAction.play()
  }

  async setExpression(expression, intensity = 0.7, duration = 500) {
    if (!this.vrm?.expressionManager) return

    const expressions = this.EXPRESSIONS[expression] || [expression]
    const promises = []

    expressions.forEach(expr => {
      const promise = new Promise((resolve) => {
        const start = this.vrm.expressionManager.getValue(expr) || 0
        const target = intensity
        const startTime = performance.now()

        const animate = (now) => {
          const elapsed = now - startTime
          const t = Math.min(elapsed / duration, 1)
          const eased = t * (2 - t) // ease out quad
          const value = start + (target - start) * eased

          this.vrm.expressionManager.setValue(expr, value)
          this.vrm.expressionManager.update()

          if (t < 1) {
            requestAnimationFrame(animate)
          } else {
            resolve()
          }
        }
        requestAnimationFrame(animate)
      })
      promises.push(promise)
    })

    await Promise.all(promises)
  }

  async resetExpression(expression, duration = 500) {
    await this.setExpression(expression, 0, duration)
  }

  async animateHeadMotion(type, duration = 800) {
    if (!this.vrm) return

    const head = this.vrm.humanoid?.getNormalizedBoneNode('head')
    if (!head) return

    const startRot = head.rotation.clone()
    const targetRot = new THREE.Euler()
    let curve = (t) => Math.sin(t * Math.PI)

    switch (type) {
      case 'nod':
        targetRot.set(0.35, 0, 0)
        break
      case 'shake':
        targetRot.set(0, 0.4, 0)
        curve = (t) => Math.sin(t * Math.PI * 2)
        break
      case 'tiltLeft':
        targetRot.set(0, 0, 0.3)
        break
      case 'tiltRight':
        targetRot.set(0, 0, -0.3)
        break
      case 'lookUp':
        targetRot.set(-0.25, 0, 0)
        break
      case 'lookDown':
        targetRot.set(0.25, 0, 0)
        break
      case 'doubleNod':
        targetRot.set(0.3, 0, 0)
        curve = (t) => Math.sin(t * Math.PI * 4)
        duration *= 1.2
        break
      case 'confused':
        targetRot.set(0, 0.15, 0.15)
        curve = (t) => Math.sin(t * Math.PI * 3)
        break
      default:
        return
    }

    return new Promise((resolve) => {
      const startTime = performance.now()

      const animate = (now) => {
        const elapsed = now - startTime
        const t = Math.min(elapsed / duration, 1)
        const eased = curve(t)

        head.rotation.x = startRot.x + targetRot.x * eased
        head.rotation.y = startRot.y + targetRot.y * eased
        head.rotation.z = startRot.z + targetRot.z * eased

        if (t < 1) {
          requestAnimationFrame(animate)
        } else {
          head.rotation.copy(startRot)
          resolve()
        }
      }
      requestAnimationFrame(animate)
    })
  }

  async performGesture(gestureType, duration = 1200) {
    if (!this.vrm || !gestureType || gestureType === 'none') return

    if (this.gestureTimeout) {
      clearTimeout(this.gestureTimeout)
      this.gestureTimeout = null
    }

    // Use preloaded animation if available
    if (this.gestureAnimations[gestureType]) {
      return this.playGestureAnimation(gestureType)
    }

    // Fallback procedural gestures
    const leftArm = this.vrm.humanoid?.getNormalizedBoneNode('leftUpperArm')
    const rightArm = this.vrm.humanoid?.getNormalizedBoneNode('rightUpperArm')
    const leftForearm = this.vrm.humanoid?.getNormalizedBoneNode('leftLowerArm')
    const rightForearm = this.vrm.humanoid?.getNormalizedBoneNode('rightLowerArm')

    if (!leftArm || !rightArm) return

    const startPos = {
      leftArm: leftArm.rotation.clone(),
      rightArm: rightArm.rotation.clone(),
      leftForearm: leftForearm?.rotation.clone(),
      rightForearm: rightForearm?.rotation.clone()
    }

    let gestureFunc

    switch (gestureType) {
      case 'wave':
      case 'handWave':
        gestureFunc = (t) => {
          const wave = Math.sin(t * Math.PI * 6) * 0.4
          const lift = Math.sin(t * Math.PI) * 1.2
          rightArm.rotation.x = startPos.rightArm.x - lift
          rightArm.rotation.z = startPos.rightArm.z - 0.8 + wave
          if (rightForearm) rightForearm.rotation.y = wave * 0.5
        }
        break

      case 'shrug':
        gestureFunc = (t) => {
          const intensity = Math.sin(t * Math.PI) * 0.8
          leftArm.rotation.z = startPos.leftArm.z + intensity
          rightArm.rotation.z = startPos.rightArm.z - intensity
          leftArm.rotation.x = startPos.leftArm.x - intensity * 0.3
          rightArm.rotation.x = startPos.rightArm.x - intensity * 0.3
        }
        break

      case 'point':
      case 'pointing':
        gestureFunc = (t) => {
          const intensity = Math.sin(t * Math.PI) * 0.9
          rightArm.rotation.x = startPos.rightArm.x - intensity * 1.2
          rightArm.rotation.z = startPos.rightArm.z - intensity * 0.5
          if (rightForearm) rightForearm.rotation.x = intensity * 0.8
        }
        break

      case 'think':
        gestureFunc = (t) => {
          const intensity = Math.sin(t * Math.PI) * 0.6
          rightArm.rotation.x = startPos.rightArm.x - intensity * 1.1
          rightArm.rotation.y = startPos.rightArm.y + intensity * 0.2
          if (rightForearm) rightForearm.rotation.x = intensity * 1.2
        }
        break

      default:
        return
    }

    return new Promise((resolve) => {
      const startTime = performance.now()

      const animate = (now) => {
        const elapsed = now - startTime
        const t = Math.min(elapsed / duration, 1)

        gestureFunc(t)

        if (t < 1) {
          requestAnimationFrame(animate)
        } else {
          // Reset to original positions
          leftArm.rotation.copy(startPos.leftArm)
          rightArm.rotation.copy(startPos.rightArm)
          if (leftForearm) leftForearm.rotation.copy(startPos.leftForearm)
          if (rightForearm) rightForearm.rotation.copy(startPos.rightForearm)
          resolve()
        }
      }
      requestAnimationFrame(animate)
    })
  }

  async playGestureAnimation(gestureType) {
    if (!this.currentMixer || !this.gestureAnimations[gestureType]) return

    return new Promise((resolve) => {
      const gestureAction = this.currentMixer.clipAction(this.gestureAnimations[gestureType])
      gestureAction.setLoop(THREE.LoopOnce)
      gestureAction.clampWhenFinished = true
      gestureAction.reset()
      gestureAction.play()

      const duration = this.gestureAnimations[gestureType].duration * 1000

      this.gestureTimeout = setTimeout(() => {
        gestureAction.fadeOut(0.3)
        setTimeout(resolve, 300)
      }, duration)
    })
  }

  startBlinking() {
    if (!this.vrm?.expressionManager) return
    if (this.blinkInterval) clearTimeout(this.blinkInterval)

    const doBlink = () => {
      if (!this.vrm?.expressionManager || this.isPlayingSequence) {
        this.blinkInterval = setTimeout(doBlink, 3000)
        return
      }

      const intensity = 0.85 + Math.random() * 0.15
      const blinkDuration = 100 + Math.random() * 50

      this.vrm.expressionManager.setValue('blink', intensity)
      this.vrm.expressionManager.update()

      setTimeout(() => {
        if (this.vrm?.expressionManager) {
          this.vrm.expressionManager.setValue('blink', 0)
          this.vrm.expressionManager.update()
        }

        const nextBlink = 2500 + Math.random() * 3500
        this.blinkInterval = setTimeout(doBlink, nextBlink)
      }, blinkDuration)
    }

    doBlink()
  }

  async playAnimationSequence(plan) {
    if (!this.vrm?.expressionManager || !plan || plan.length === 0) return

    this.isPlayingSequence = true
    console.log('🎭 Playing animation sequence:', plan.length, 'steps')

    try {
      for (let i = 0; i < plan.length; i++) {
        const step = plan[i]
        const intensity = Math.min((step.intensity || 0.7) * 0.65, 0.9)

        console.log(`Step ${i + 1}/${plan.length}:`, step)

        // Start all animations in parallel
        const animations = []

        // Expression
        if (step.expression && step.expression !== 'neutral') {
          animations.push(this.setExpression(step.expression, intensity, 400))
        }

        // Head motion
        if (step.headMotion && step.headMotion !== 'none') {
          animations.push(this.animateHeadMotion(step.headMotion, Math.min(step.duration * 0.8, 1000)))
        }

        // Gesture
        if (step.gesture && step.gesture !== 'none') {
          animations.push(this.performGesture(step.gesture, Math.min(step.duration * 1.2, 1800)))
        }

        // Wait for all animations to start
        await Promise.all(animations)

        // Hold expression for step duration
        await new Promise(r => setTimeout(r, Math.max(step.duration * 0.6, 400)))

        // Fade out expression
        if (step.expression && step.expression !== 'neutral') {
          await this.resetExpression(step.expression, 300)
        }

        // Small pause between steps
        if (i < plan.length - 1) {
          await new Promise(r => setTimeout(r, 150))
        }
      }
    } catch (error) {
      console.error('❌ Animation sequence error:', error)
    } finally {
      this.isPlayingSequence = false
      console.log('✅ Animation sequence complete')
    }
  }

  update(delta) {
    if (this.currentMixer) {
      this.currentMixer.update(delta)
    }
  }

  cleanup() {
    if (this.blinkInterval) {
      clearTimeout(this.blinkInterval)
      this.blinkInterval = null
    }

    if (this.gestureTimeout) {
      clearTimeout(this.gestureTimeout)
      this.gestureTimeout = null
    }

    if (this.currentMixer) {
      this.currentMixer.stopAllAction()
      this.currentMixer = null
    }

    this.currentAnimationAction = null
    this.activeAnimations.clear()
    this.isPlayingSequence = false
  }
}

// ========================================
// Enhanced AI Client with Parallel Processing
// ========================================

export class AIClient {
  constructor(apiKey) {
    this.client = new GoogleGenAI({
      apiKey: apiKey || 'AIzaSyCYkivW_PQEE3ayBSYTXw1mtnQiDMau7GM'
    })
    this.model = 'gemini-2.5-flash'
    this.conversationHistory = []
    this.maxHistoryLength = 10
  }

  async chatWithAI(message, systemPrompt = '') {
    try {
      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: message
      })

      // Keep history manageable
      if (this.conversationHistory.length > this.maxHistoryLength * 2) {
        this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength * 2)
      }

      const prompt = systemPrompt
        ? `${systemPrompt}\n\nConversation:\n${this.formatHistory()}\n\nUser: ${message}`
        : `Conversation:\n${this.formatHistory()}\n\nUser: ${message}`

      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      })

      const aiReply = response.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not respond.'

      // Add AI response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: aiReply
      })

      return aiReply
    } catch (error) {
      console.error('❌ AI chat error:', error)
      return 'Sorry, something went wrong with the AI response.'
    }
  }

  formatHistory() {
    return this.conversationHistory
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n')
  }

  async generateAnimationPlan(text) {
    const animPrompt = `You are an animation director for a VRM character. Create a detailed animation sequence for the following text.

IMPORTANT: Return ONLY a valid JSON array. No explanations, no code fences, just the JSON array.

Available options:
- expressions: neutral, happy, sad, angry, surprised, excited, confused, smirk, laugh, embarrassed, determined, worried, curious, sleepy, mischievous
- headMotion: none, nod, shake, tiltLeft, tiltRight, lookUp, lookDown, doubleNod, confused
- gestures: none, point, handWave, shrug, think, clap, thumbsUp

Each step must have:
{
  "text": "phrase or sentence",
  "expression": "emotion",
  "headMotion": "head movement",
  "gesture": "body gesture",
  "duration": milliseconds (500-2500),
  "intensity": 0.1-1.0
}

Guidelines:
- Break text into natural phrases (5-15 words each)
- Match expressions to emotional content
- Use gestures sparingly for emphasis
- Vary head motions naturally
- Duration should match speech rhythm
- Lower intensity for subtle emotions

Text to animate:
"""${text}"""

Return only the JSON array:`

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: animPrompt }] }]
      })

      let rawResponse = response.candidates?.[0]?.content?.parts?.[0]?.text || '[]'

      // Clean response
      rawResponse = rawResponse
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .replace(/^[^[]*/, '') // Remove text before first [
        .replace(/[^\]]*$/, '') // Remove text after last ]
        .trim()

      const animationPlan = JSON.parse(rawResponse)

      // Validate and fix plan
      const validPlan = (Array.isArray(animationPlan) ? animationPlan : [animationPlan])
        .filter(step => step && typeof step === 'object')
        .map(step => ({
          text: step.text || text,
          expression: step.expression || 'neutral',
          headMotion: step.headMotion || 'none',
          gesture: step.gesture || 'none',
          duration: Math.max(Math.min(step.duration || 1500, 3000), 500),
          intensity: Math.max(Math.min(step.intensity || 0.7, 1.0), 0.1)
        }))

      console.log('✅ Animation plan generated:', validPlan.length, 'steps')
      return validPlan
    } catch (error) {
      console.error('❌ Animation plan error:', error)

      // Fallback plan
      return [{
        text: text,
        expression: 'neutral',
        headMotion: 'none',
        gesture: 'none',
        duration: 2000,
        intensity: 0.5
      }]
    }
  }

  clearHistory() {
    this.conversationHistory = []
  }

  updateApiKey(newApiKey) {
    this.client = new GoogleGenAI({ apiKey: newApiKey })
  }
}

// ========================================
// Enhanced Audio Manager with Better TTS
// ========================================

export class AudioManager {
  constructor() {
    this.audioCtx = null
    this.analyser = null
    this.sourceNode = null
    this.mouthRaf = null
    this.isInitialized = false
    this.currentAudio = null
  }

  async initialize() {
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      this.isInitialized = true
      console.log('✅ AudioManager initialized')
    } catch (error) {
      console.error('❌ AudioManager init failed:', error)
    }
  }

  async resumeContext() {
    if (this.audioCtx && this.audioCtx.state !== 'running') {
      try {
        await this.audioCtx.resume()
      } catch (error) {
        console.error('❌ Audio context resume failed:', error)
      }
    }
  }

  async generateTTS(text, config) {
    try {
      const ttsUrl = 'https://a36a9fe4f0cd.ngrok-free.app/tts' // Fixed: removed space
      const payload = {
        text,
        ref_audio_path: config.sovits_ping_config?.ref_audio_path,
        text_lang: config.sovits_ping_config?.text_lang || 'en',
        prompt_text: config.sovits_ping_config?.prompt_text || '',
        prompt_lang: config.sovits_ping_config?.prompt_lang || 'en',
        media_type: 'wav',
        streaming_mode: false,
      }

      console.log('🎤 Generating TTS...')
      const response = await axios.post(ttsUrl, payload, {
        responseType: 'arraybuffer',
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000 // 30 second timeout
      })

      const blob = new Blob([response.data], { type: 'audio/wav' })
      console.log('✅ TTS generated:', blob.size, 'bytes')
      return blob
    } catch (error) {
      console.error('❌ TTS generation error:', error)
      return null
    }
  }

  async playAudioBlob(blob, audioElement) {
    if (!blob || !audioElement) return 0

    try {
      // Stop current audio
      if (this.currentAudio) {
        this.currentAudio.pause()
        this.currentAudio.src = ''
      }

      audioElement.pause()
      audioElement.src = ''
      audioElement.load()

      await this.resumeContext()

      const url = URL.createObjectURL(blob)
      audioElement.src = url
      this.currentAudio = audioElement

      // Wait for metadata to load
      await new Promise((resolve, reject) => {
        audioElement.onloadedmetadata = resolve
        audioElement.onerror = reject
        setTimeout(() => reject(new Error('Audio load timeout')), 5000)
      })

      await audioElement.play()
      console.log('🔊 Playing audio, duration:', audioElement.duration, 's')

      return audioElement.duration
    } catch (error) {
      console.error('❌ Audio play failed:', error)
      return 0
    }
  }

  setupMouthSync(audioElement, vrm) {
    if (!vrm?.expressionManager || !this.audioCtx || !audioElement) return

    if (this.mouthRaf) {
      cancelAnimationFrame(this.mouthRaf)
    }

    // Create audio source
    if (!this.sourceNode) {
      try {
        this.sourceNode = this.audioCtx.createMediaElementSource(audioElement)
      } catch (error) {
        console.warn('Audio source already exists')
        return
      }
    }

    // Create analyzer
    if (this.analyser) {
      this.analyser.disconnect()
    }

    this.analyser = this.audioCtx.createAnalyser()
    this.analyser.fftSize = 2048
    this.analyser.smoothingTimeConstant = 0.3

    const bufferLength = this.analyser.fftSize
    const dataArray = new Uint8Array(bufferLength)
    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount)

    try {
      this.sourceNode.disconnect()
    } catch {
      // Ignore disconnect errors
    }

    this.sourceNode.connect(this.analyser)
    this.analyser.connect(this.audioCtx.destination)

    let prevEnergy = 0
    let prevHighFreq = 0

    const tick = () => {
      if (audioElement.paused || audioElement.ended) {
        this.resetMouth(vrm)
        this.mouthRaf = null
        return
      }

      this.analyser.getByteTimeDomainData(dataArray)
      this.analyser.getByteFrequencyData(frequencyData)

      // Calculate RMS energy
      let sumSquares = 0
      for (let i = 0; i < bufferLength; i++) {
        const val = (dataArray[i] - 128) / 128
        sumSquares += val * val
      }
      const rms = Math.sqrt(sumSquares / bufferLength)

      // Calculate high frequency content
      let highFreqSum = 0
      const startIdx = Math.floor(frequencyData.length * 0.3)
      for (let i = startIdx; i < frequencyData.length; i++) {
        highFreqSum += frequencyData[i]
      }
      const highFreq = highFreqSum / (frequencyData.length * 0.7) / 255

      // Smooth values
      const smoothed = prevEnergy * 0.7 + rms * 0.3
      const smoothedHigh = prevHighFreq * 0.8 + highFreq * 0.2
      prevEnergy = smoothed
      prevHighFreq = smoothedHigh

      // Map to mouth shapes with better scaling
      const mouthOpen = Math.min(Math.max(smoothed * 10, 0), 1)
      const mouthWide = Math.min(smoothedHigh * 2.5, 1)
      const mouthSmile = Math.min(smoothedHigh * 1.8, 0.6)

      // Apply with smooth interpolation
      const curAA = vrm.expressionManager.getValue('aa') || 0
      const curEE = vrm.expressionManager.getValue('ee') || 0
      const curOH = vrm.expressionManager.getValue('oh') || 0
      const curSmile = vrm.expressionManager.getValue('happy') || 0

      vrm.expressionManager.setValue('aa', curAA + (mouthOpen - curAA) * 0.35)
      vrm.expressionManager.setValue('ee', curEE + (mouthWide - curEE) * 0.3)
      vrm.expressionManager.setValue('oh', curOH + (mouthOpen * 0.7 - curOH) * 0.25)
      vrm.expressionManager.setValue('happy', curSmile + (mouthSmile - curSmile) * 0.15)
      vrm.expressionManager.update()

      this.mouthRaf = requestAnimationFrame(tick)
    }

    tick()
  }

  resetMouth(vrm) {
    if (!vrm?.expressionManager) return

    const resetAnim = () => {
      const aa = vrm.expressionManager.getValue('aa') || 0
      const ee = vrm.expressionManager.getValue('ee') || 0
      const oh = vrm.expressionManager.getValue('oh') || 0
      const smile = vrm.expressionManager.getValue('happy') || 0

      if (aa > 0.01 || ee > 0.01 || oh > 0.01 || smile > 0.01) {
        vrm.expressionManager.setValue('aa', Math.max(aa * 0.85, 0))
        vrm.expressionManager.setValue('ee', Math.max(ee * 0.85, 0))
        vrm.expressionManager.setValue('oh', Math.max(oh * 0.85, 0))
        vrm.expressionManager.setValue('happy', Math.max(smile * 0.9, 0))
        vrm.expressionManager.update()
        requestAnimationFrame(resetAnim)
      }
    }
    resetAnim()
  }

  cleanup() {
    if (this.mouthRaf) {
      cancelAnimationFrame(this.mouthRaf)
      this.mouthRaf = null
    }

    try {
      this.sourceNode?.disconnect()
      this.analyser?.disconnect()
    } catch {
      // Ignore
    }

    this.sourceNode = null
    this.analyser = null

    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio = null
    }

    if (this.audioCtx) {
      this.audioCtx.close()
      this.audioCtx = null
    }
  }
}

// ========================================
// Enhanced Message Processing with Parallel Execution
// ========================================

export async function processMessageEnhanced(message, aiClient, audioManager, animationManager, vrm, config, audioElement) {
  try {
    console.log('📤 Processing message:', message)

    // STEP 1: Get AI response first
    console.log('🤖 Getting AI response...')
    const aiResponse = await aiClient.chatWithAI(message, config.getSystemPrompt())
    console.log('✅ AI response received:', aiResponse.substring(0, 50) + '...')

    // STEP 2: Start TTS and Animation Plan generation in PARALLEL
    console.log('🔄 Starting parallel processing: TTS + Animation Plan')

    const [audioBlob, animationPlan] = await Promise.all([
      // Generate TTS audio
      audioManager.generateTTS(aiResponse, config.config).catch(err => {
        console.error('❌ TTS failed:', err)
        return null
      }),

      // Generate animation plan
      aiClient.generateAnimationPlan(aiResponse).catch(err => {
        console.error('❌ Animation plan failed:', err)
        return []
      })
    ])

    console.log('✅ Parallel processing complete')
    console.log('   - Audio:', audioBlob ? 'Ready' : 'Failed')
    console.log('   - Animation plan:', animationPlan.length, 'steps')

    // STEP 3: Play audio and get duration
    let audioDuration = 0
    if (audioBlob) {
      audioDuration = await audioManager.playAudioBlob(audioBlob, audioElement)
      audioManager.setupMouthSync(audioElement, vrm)
    }

    // STEP 4: Scale animation timings to match audio duration
    if (animationPlan.length > 0 && audioDuration > 0) {
      const totalPlanDuration = animationPlan.reduce((sum, step) => sum + step.duration, 0)

      if (totalPlanDuration > 0) {
        const scale = (audioDuration * 1000) / totalPlanDuration
        animationPlan.forEach(step => {
          step.duration = Math.round(step.duration * scale)
        })
        console.log('⚖️ Animation timings scaled by', scale.toFixed(2))
      }
    }

    // STEP 5: Play animations
    if (animationManager && animationPlan.length > 0) {
      console.log('🎭 Starting animation sequence')
      await animationManager.playAnimationSequence(animationPlan)
    }

    console.log('✅ Message processing complete')
    return aiResponse

  } catch (error) {
    console.error('❌ Message processing error:', error)
    throw error
  }
}

// ========================================
// Extra Features
// ========================================

export class EnhancedFeatures {

  // Feature 1: Emotion Detection
  static detectEmotion(text) {
    const emotions = {
      happy: ['happy', 'glad', 'joy', 'excited', 'wonderful', 'great', 'awesome', 'love', '😊', '😄', '🎉'],
      sad: ['sad', 'unhappy', 'sorry', 'unfortunate', 'depressed', 'down', '😢', '😞'],
      angry: ['angry', 'mad', 'furious', 'annoyed', 'irritated', '😠', '😡'],
      surprised: ['wow', 'amazing', 'incredible', 'surprising', 'shocked', '😮', '😲'],
      confused: ['confused', 'unsure', 'puzzled', 'wondering', '🤔'],
      neutral: []
    }

    const lowerText = text.toLowerCase()
    let maxScore = 0
    let detectedEmotion = 'neutral'

    for (const [emotion, keywords] of Object.entries(emotions)) {
      let score = 0
      keywords.forEach(keyword => {
        if (lowerText.includes(keyword)) score++
      })

      if (score > maxScore) {
        maxScore = score
        detectedEmotion = emotion
      }
    }

    return detectedEmotion
  }

  // Feature 2: Auto-respond to common greetings
  static getQuickResponse(message) {
    const lower = message.toLowerCase().trim()

    const quickResponses = {
      'hello': 'Hello! How can I help you today?',
      'hi': 'Hi there! What can I do for you?',
      'hey': 'Hey! What\'s up?',
      'how are you': 'I\'m doing great! Thanks for asking. How are you?',
      'good morning': 'Good morning! Hope you\'re having a great day!',
      'good night': 'Good night! Sleep well!',
      'thanks': 'You\'re welcome!',
      'thank you': 'You\'re very welcome!',
      'bye': 'Goodbye! Have a great day!',
      'goodbye': 'Goodbye! Take care!'
    }

    for (const [key, response] of Object.entries(quickResponses)) {
      if (lower.includes(key)) {
        return response
      }
    }

    return null
  }

  // Feature 3: Typing indicator animation
  static createTypingIndicator(vrm, animationManager) {
    let isTyping = false
    let typingInterval = null

    return {
      start: () => {
        if (isTyping || !animationManager) return
        isTyping = true

        let direction = 1
        typingInterval = setInterval(() => {
          if (!vrm?.expressionManager) return

          const current = vrm.expressionManager.getValue('happy') || 0
          const target = direction > 0 ? 0.2 : 0.05

          vrm.expressionManager.setValue('happy', current + (target - current) * 0.3)
          vrm.expressionManager.update()

          direction *= -1
        }, 300)
      },

      stop: () => {
        if (!isTyping) return
        isTyping = false

        if (typingInterval) {
          clearInterval(typingInterval)
          typingInterval = null
        }

        if (vrm?.expressionManager) {
          vrm.expressionManager.setValue('happy', 0)
          vrm.expressionManager.update()
        }
      }
    }
  }

  // Feature 4: Performance monitor
  static createPerformanceMonitor() {
    const stats = {
      fps: 0,
      frameCount: 0,
      lastTime: performance.now(),
      avgResponseTime: 0,
      responseTimes: []
    }

    return {
      update: () => {
        stats.frameCount++
        const now = performance.now()

        if (now >= stats.lastTime + 1000) {
          stats.fps = Math.round((stats.frameCount * 1000) / (now - stats.lastTime))
          stats.frameCount = 0
          stats.lastTime = now
        }
      },

      recordResponseTime: (time) => {
        stats.responseTimes.push(time)
        if (stats.responseTimes.length > 10) {
          stats.responseTimes.shift()
        }
        stats.avgResponseTime = stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length
      },

      getStats: () => ({
        fps: stats.fps,
        avgResponseTime: Math.round(stats.avgResponseTime)
      })
    }
  }

  // Feature 5: Voice activity detection
  static createVoiceActivityDetector(audioContext) {
    let isActive = false
    let threshold = 30 // Adjustable threshold

    return {
      analyze: (analyser, dataArray) => {
        if (!analyser) return false

        analyser.getByteFrequencyData(dataArray)

        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]
        }
        const average = sum / dataArray.length

        isActive = average > threshold
        return isActive
      },

      setThreshold: (newThreshold) => {
        threshold = newThreshold
      },

      isActive: () => isActive
    }
  }

  // Feature 6: Animation presets
  static getAnimationPreset(presetName) {
    const presets = {
      greeting: [
        { expression: 'happy', headMotion: 'nod', gesture: 'handWave', duration: 1500, intensity: 0.8 }
      ],

      thinking: [
        { expression: 'curious', headMotion: 'tiltLeft', gesture: 'think', duration: 2000, intensity: 0.6 }
      ],

      excited: [
        { expression: 'excited', headMotion: 'doubleNod', gesture: 'clap', duration: 1800, intensity: 0.9 }
      ],

      confused: [
        { expression: 'confused', headMotion: 'confused', gesture: 'shrug', duration: 1600, intensity: 0.7 }
      ],

      agreement: [
        { expression: 'happy', headMotion: 'nod', gesture: 'thumbsUp', duration: 1200, intensity: 0.8 }
      ],

      farewell: [
        { expression: 'happy', headMotion: 'none', gesture: 'handWave', duration: 2000, intensity: 0.7 }
      ]
    }

    return presets[presetName] || []
  }

  // Feature 7: Context-aware responses
  static enhanceResponseContext(message, conversationHistory) {
    const context = {
      isQuestion: message.includes('?'),
      isCommand: message.toLowerCase().startsWith('can you') || message.toLowerCase().startsWith('please'),
      sentiment: this.detectEmotion(message),
      previousTopic: conversationHistory.length > 0 ? conversationHistory[conversationHistory.length - 1] : null
    }

    return context
  }

  // Feature 8: Dynamic animation intensity
  static calculateAnimationIntensity(emotion, textLength) {
    const baseIntensity = 0.6

    const emotionMultiplier = {
      happy: 0.9,
      excited: 1.0,
      sad: 0.5,
      angry: 0.8,
      surprised: 0.85,
      confused: 0.7,
      neutral: 0.6
    }

    const lengthFactor = Math.min(textLength / 100, 1.2)
    const intensity = baseIntensity * (emotionMultiplier[emotion] || 0.6) * lengthFactor

    return Math.min(Math.max(intensity, 0.3), 1.0)
  }
}

// ========================================
// Export everything
// ========================================

export default {
  VRMLoader,
  AnimationManager,
  AIClient,
  AudioManager,
  processMessageEnhanced,
  EnhancedFeatures
}
