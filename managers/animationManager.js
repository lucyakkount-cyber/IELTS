import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation'
import { cacheManager } from './cacheManager'

export class AnimationManager {
  vrm
  mixer
  actions = {}
  activeAction = null
  loader
  camera = null
  currentState = 'idle'
  mainIdle = 'HappyIdle'
  currentExpression = 'neutral'
  targetExpression = 'neutral'
  expressionTimer = null

  // Blink State
  blinkTimer = 0
  nextBlinkTime = 3
  isBlinking = false
  blinkDuration = 0.15
  blinkProgress = 0

  // Micro-Expression State
  microTimer = 0
  microIntensity = 0

  // Speaking State
  isSpeaking = false

  expressionMap

  constructor(vrm, camera = null) {
    this.vrm = vrm
    this.camera = camera
    this.mixer = new THREE.AnimationMixer(vrm.scene)
    this.loader = new GLTFLoader()
    this.loader.setCrossOrigin('anonymous')
    this.loader.register((parser) => new VRMAnimationLoaderPlugin(parser))

    this.expressionMap = {
      happy: 'happy',
      joy: 'happy',
      excited: 'happy',
      smile: 'happy',
      sad: 'sad',
      crying: 'sad',
      sorrow: 'sad',

      // Composite Emotions
      embarrassed: { sad: 0.3, happy: 0.2 },
      angry: 'angry',
      serious: { angry: 0.5 },
      disgust: { angry: 0.6, sad: 0.2 },
      frustrated: { angry: 0.7, sad: 0.3 },

      surprised: 'surprised',
      shock: { surprised: 1.0, angry: 0.2 },
      fear: { surprised: 0.5, sad: 0.5 },
      confused: { angry: 0.4, surprised: 0.2 },

      relaxed: 'relaxed',
      tired: { relaxed: 0.5, sad: 0.2 },
      fun: 'relaxed',
      smug: { happy: 0.3, relaxed: 0.3 },
      thinking: { angry: 0.3, relaxed: 0.2 },

      deadpan: 'neutral',
      neutral: 'neutral',
      bored: { neutral: 1.0, relaxed: 0.3 },
    }
  }

  getAvailableAnimations() {
    return Object.keys(this.actions)
  }

  async initialize(options = {}) {
    const { onProgress } = options
    console.log('🔄 AnimationManager: Loading clips...')
    this.mixer.addEventListener('finished', (e) => this.onAnimationFinished(e))

    const repoBase =
      'https://raw.githubusercontent.com/lucyakkount-cyber/VRM_1/main/public/animations'

    // Updated file list based on reference
    const files = [
      { name: 'HappyIdle', path: '/animations/HappyIdle.vrma', loop: true },
      { name: 'wave', path: '/animations/Waving.vrma', loop: false },
      { name: 'Macarena_dance', path: '/animations/MacarenaDance.vrma', loop: true }, // Loop true based on ref logic usually, or explicit instruction
      { name: 'dance', path: '/animations/HipHopDance.vrma', loop: false },
      { name: 'clap', path: '/animations/Clapping.vrma', loop: false },
      { name: 'thumbs_up', path: '/animations/ThumbsUp.vrma', loop: false },
      { name: 'shrug', path: '/animations/Shrugging.vrma', loop: false },
      { name: 'pointing', path: '/animations/Pointing.vrma', loop: false },
      { name: 'laugh', path: '/animations/Laughing.vrma', loop: false },
      { name: 'salute', path: '/animations/Salute.vrma', loop: false },
      { name: 'angry', path: '/animations/Angry.vrma', loop: false },
      { name: 'backflip', path: '/animations/BackFlip.vrma', loop: false },
      { name: 'acknowledging', path: '/animations/Acknowledging.vrma', loop: false },
      { name: 'blow_kiss', path: '/animations/BlowKiss.vrma', loop: false },
      { name: 'bored', path: '/animations/Bored.vrma', loop: false },
      { name: 'looking_around', path: '/animations/LookingAround.vrma', loop: false },
    ]

    const total = files.length
    for (const [index, file] of files.entries()) {
      const remoteUrl = `${repoBase}/${file.path.split('/').pop()}`
      await this.loadClipWithFallback(file.name, file.path, remoteUrl, file.loop)
      onProgress?.({
        current: index + 1,
        total,
        name: file.name,
      })
    }

    console.log('✅ AnimationManager Ready')
    if (this.actions[this.mainIdle]) {
      this.play(this.mainIdle)
    }
  }

  async loadClipWithFallback(name, localPath, remoteUrl, isLoop) {
    try {
      await this.loadClip(name, localPath, isLoop)
    } catch {
      await this.loadClip(name, remoteUrl, isLoop)
    }
  }

  setExpression(name, duration = 0) {
    const rawName = name.toLowerCase()
    let resolved = 'neutral'

    if (this.vrm.expressionManager.getExpressionTrackName(rawName)) {
      resolved = rawName
    } else if (this.expressionMap[rawName]) {
      resolved = this.expressionMap[rawName]
    }

    console.log(`😊 Face: ${name} =>`, resolved, `(${duration}s)`)
    this.targetExpression = resolved

    if (this.expressionTimer) clearTimeout(this.expressionTimer)
    if (duration > 0) {
      this.expressionTimer = setTimeout(() => {
        this.targetExpression = 'neutral'
      }, duration * 1000)
    }
  }

  setSpeakingState(isSpeaking) {
    this.isSpeaking = isSpeaking
    // We do NOT assume 'Talking' animation exists.
    // We rely on isSpeaking flag to unlock mouth blendshapes for AudioAnalyzer.
  }

  update(delta) {
    if (this.mixer) this.mixer.update(delta)
    if (this.vrm) {
      if (this.vrm.expressionManager) {
        this.updateBlink(delta)
        this.updateExpressions(delta)
      }

      // LookAt implementation - eyes track camera
      if (this.vrm.lookAt && this.camera) {
        this.vrm.lookAt.target = this.camera
        this.vrm.lookAt.update(delta)
      }
    }
  }

  updateBlink(delta) {
    this.blinkTimer += delta
    if (this.blinkTimer >= this.nextBlinkTime) {
      this.isBlinking = true
      this.blinkTimer = 0
      this.nextBlinkTime = 2 + Math.random() * 3
    }

    if (this.isBlinking) {
      this.blinkProgress += delta
      if (this.blinkProgress >= this.blinkDuration) {
        this.isBlinking = false
        this.blinkProgress = 0
      }
    }
  }

  updateExpressions(delta) {
    const manager = this.vrm.expressionManager
    const speed = 5.0 * delta

    // 1. Blink
    let blinkValue = 0
    if (this.isBlinking) {
      const t = Math.PI * (this.blinkProgress / this.blinkDuration)
      blinkValue = Math.sin(t)
    }

    // 2. Micro-Expressions
    this.microTimer += delta
    this.microIntensity = Math.sin(this.microTimer * 2) * 0.05

    // 3. Moods
    const moodKeys = ['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised']
    const mouthKeys = ['aa', 'ee', 'ih', 'oh', 'ou']

    moodKeys.forEach((key) => {
      const currentVal = manager.getValue(key) || 0
      let baseTarget = 0.0

      if (typeof this.targetExpression === 'string') {
        baseTarget = key === this.targetExpression ? 1.0 : 0.0
      } else if (typeof this.targetExpression === 'object') {
        baseTarget = this.targetExpression[key] || 0.0
      }

      if (baseTarget > 0.1) {
        baseTarget += this.microIntensity
      }
      baseTarget = Math.max(0, Math.min(1, baseTarget))

      const newVal = THREE.MathUtils.lerp(currentVal, baseTarget, speed)
      manager.setValue(key, newVal < 0.01 ? 0 : newVal)
    })

    manager.setValue('blink', blinkValue)

    // 4. Mouth Movement Control
    // Reference Logic: If talking, let external lip-sync control it (do nothing).
    // If NOT talking, force mouth closed.
    if (!this.isSpeaking) {
      mouthKeys.forEach((key) => {
        const currentVal = manager.getValue(key) || 0
        const newVal = THREE.MathUtils.lerp(currentVal, 0, speed)
        manager.setValue(key, newVal < 0.01 ? 0 : newVal)
      })
    }

    manager.update()
  }

  triggerNamedAnimation(name) {
    // 1. Exact Match
    if (this.actions[name]) {
      this.play(name)
      return
    }
    // 2. Case-Insensitive Match
    const lowerName = name.toLowerCase()
    const foundKey = Object.keys(this.actions).find((k) => k.toLowerCase() === lowerName)
    if (foundKey) {
      this.play(foundKey)
      return
    }
    console.warn(`⚠️ Animation '${name}' not found.`)
  }

  onAnimationFinished(e) {
    const clipName = e.action.getClip().name
    const isLoopOnce = e.action.loop === THREE.LoopOnce

    if (clipName !== 'HappyIdle' && clipName !== 'Macarena_dance' && isLoopOnce) {
      this.play(this.mainIdle)
    }
  }

  async loadClip(name, url, isLoop) {
    try {
      let arrayBuffer

      // 1. Try Cache
      const cached = await cacheManager.getCached('animations', url)
      if (cached) {
        // console.log(`⚡ Anim Cache Hit: ${name}`)
        arrayBuffer = cached
      } else {
        // 2. Fetch
        // console.log(`🌐 Anim Fetching: ${name}`)
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Failed to fetch ${url}`)
        arrayBuffer = await response.arrayBuffer()

        // 3. Cache
        cacheManager
          .setCached('animations', url, arrayBuffer)
          .catch((e) => console.warn('Anim cache failed', e))
      }

      // 4. Parse
      return new Promise((resolve, reject) => {
        this.loader.parse(
          arrayBuffer,
          url,
          (gltf) => {
            let clip = null
            if (gltf.userData.vrmAnimations && gltf.userData.vrmAnimations.length > 0) {
              clip = createVRMAnimationClip(gltf.userData.vrmAnimations[0], this.vrm)
            } else if (gltf.animations && gltf.animations.length > 0) {
              clip = createVRMAnimationClip(gltf.animations[0], this.vrm)
            }

            if (clip) {
              clip.name = name
              const action = this.mixer.clipAction(clip)
              action.loop = isLoop ? THREE.LoopRepeat : THREE.LoopOnce
              action.clampWhenFinished = true
              this.actions[name] = action
              resolve(action)
            } else {
              console.warn(`⚠️ Empty animation: ${url}`)
              resolve(null)
            }
          },
          (err) => {
            console.warn(`❌ Parse failed: ${url}`, err)
            reject(err)
          },
        )
      })
    } catch (err) {
      console.warn(`❌ Load failed: ${url}`, err)
      throw err
    }
  }

  play(name) {
    const action = this.actions[name]
    if (!action) return
    if (this.activeAction === action) return

    if (this.activeAction) {
      this.activeAction.fadeOut(0.5)
    }

    action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.5).play()

    this.activeAction = action

    if (name === this.mainIdle) {
      this.currentState = 'idle'
    } else {
      this.currentState = name
    }
  }

  cleanup() {
    if (this.mixer) this.mixer.stopAllAction()
    if (this.expressionTimer) clearTimeout(this.expressionTimer)
  }
}
