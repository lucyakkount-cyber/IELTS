// animationManager.js - Enhanced with bug fixes
import * as THREE from 'three'

export class AnimationManager {
  constructor(vrm) {
    this.vrm = vrm
    this.currentMixer = null
    this.currentAnimationAction = null
    this.idleAnimation = null
    this.gestureAnimations = {}
    this.blinkInterval = null
    this.gestureTimeout = null
    this.isPlayingSequence = false
    this.activeAnimations = new Set()

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
          const eased = t * (2 - t)
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

    if (this.gestureAnimations[gestureType]) {
      return this.playGestureAnimation(gestureType)
    }

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
    console.log('Playing animation sequence:', plan.length, 'steps')

    try {
      for (let i = 0; i < plan.length; i++) {
        const step = plan[i]
        const intensity = Math.min((step.intensity || 0.7) * 0.65, 0.9)

        const animations = []

        if (step.expression && step.expression !== 'neutral') {
          animations.push(this.setExpression(step.expression, intensity, 400))
        }

        if (step.headMotion && step.headMotion !== 'none') {
          animations.push(this.animateHeadMotion(step.headMotion, Math.min(step.duration * 0.8, 1000)))
        }

        if (step.gesture && step.gesture !== 'none') {
          animations.push(this.performGesture(step.gesture, Math.min(step.duration * 1.2, 1800)))
        }

        await Promise.all(animations)
        await new Promise(r => setTimeout(r, Math.max(step.duration * 0.6, 400)))

        if (step.expression && step.expression !== 'neutral') {
          await this.resetExpression(step.expression, 300)
        }

        if (i < plan.length - 1) {
          await new Promise(r => setTimeout(r, 150))
        }
      }
    } catch (error) {
      console.error('Animation sequence error:', error)
    } finally {
      this.isPlayingSequence = false
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
