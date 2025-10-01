// managers/animationManager.js - Enhanced with Natural Animations
import * as THREE from 'three'

export class AnimationManager {
  constructor(vrm) {
    this.vrm = vrm
    this.currentMixer = null
    this.currentAnimationAction = null
    this.idleAnimation = null
    this.gestureAnimations = {}
    this.blinkInterval = null
    this.breatheInterval = null
    this.subtleMovementInterval = null
    this.wiggleInterval = null
    this.speakingHandInterval = null
    this.gestureTimeout = null
    this.isPlayingSequence = false
    this.activeAnimations = new Set()
    this.currentTransition = null

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
    this.startNaturalIdle()
  }

  setIdleAnimation(animation) {
    this.idleAnimation = animation
  }

  setGestureAnimation(name, animation) {
    this.gestureAnimations[name] = animation
  }

  // Start all natural idle animations
  startNaturalIdle() {
    if (!this.vrm) return

    this.startBlinking()
    this.startBreathing()
    this.startSubtleHeadMovements()
    this.startIdleWiggle()

    console.log('Natural idle animations started')
  }

  startIdleAnimation() {
    // Don't use FBX idle - we have procedural animations
    this.startNaturalIdle()
  }

  // Blinking animation
  startBlinking() {
    if (!this.vrm?.expressionManager) return
    if (this.blinkInterval) clearTimeout(this.blinkInterval)

    const doBlink = () => {
      if (!this.vrm?.expressionManager || this.isPlayingSequence) {
        this.blinkInterval = setTimeout(doBlink, 3000)
        return
      }

      const intensity = 0.9 + Math.random() * 0.1
      const blinkDuration = 80 + Math.random() * 40

      this.vrm.expressionManager.setValue('blink', intensity)
      this.vrm.expressionManager.update()

      setTimeout(() => {
        if (this.vrm?.expressionManager) {
          this.vrm.expressionManager.setValue('blink', 0)
          this.vrm.expressionManager.update()
        }

        const nextBlink = 2000 + Math.random() * 4000
        this.blinkInterval = setTimeout(doBlink, nextBlink)
      }, blinkDuration)
    }

    doBlink()
  }

  // Breathing animation
  startBreathing() {
    if (!this.vrm) return
    if (this.breatheInterval) clearInterval(this.breatheInterval)

    const chest = this.vrm.humanoid?.getNormalizedBoneNode('chest')
    const upperChest = this.vrm.humanoid?.getNormalizedBoneNode('upperChest')

    if (!chest) return

    let breathPhase = 0

    this.breatheInterval = setInterval(() => {
      if (this.isPlayingSequence) return

      breathPhase += 0.015
      const breathIntensity = Math.sin(breathPhase) * 0.025

      if (chest) {
        chest.rotation.x = breathIntensity
      }
      if (upperChest) {
        upperChest.rotation.x = breathIntensity * 0.8
      }
    }, 50)
  }

  // Subtle head movements
  startSubtleHeadMovements() {
    if (!this.vrm) return
    if (this.subtleMovementInterval) clearInterval(this.subtleMovementInterval)

    const head = this.vrm.humanoid?.getNormalizedBoneNode('head')
    const neck = this.vrm.humanoid?.getNormalizedBoneNode('neck')

    if (!head) return

    let phase = 0

    this.subtleMovementInterval = setInterval(() => {
      if (this.isPlayingSequence) return

      phase += 0.008

      // Natural head sway and movement
      const headSway = Math.sin(phase * 0.6) * 0.05
      const headTilt = Math.cos(phase * 0.4) * 0.04
      const headNod = Math.sin(phase * 0.3) * 0.03

      if (head) {
        head.rotation.y = headSway
        head.rotation.z = headTilt
        head.rotation.x = headNod
      }

      if (neck) {
        neck.rotation.x = Math.sin(phase * 0.25) * 0.02
      }
    }, 50)
  }

  // Idle wiggle for arms and shoulders
  startIdleWiggle() {
    if (!this.vrm) {
      console.error('Cannot start wiggle: VRM not available')
      return
    }

    console.log('Starting idle wiggle animation...')

    // Wait a bit to ensure bones are ready
    setTimeout(() => {
      const leftUpperArm = this.vrm.humanoid?.getNormalizedBoneNode('leftUpperArm')
      const rightUpperArm = this.vrm.humanoid?.getNormalizedBoneNode('rightUpperArm')
      const leftLowerArm = this.vrm.humanoid?.getNormalizedBoneNode('leftLowerArm')
      const rightLowerArm = this.vrm.humanoid?.getNormalizedBoneNode('rightLowerArm')
      const leftShoulder = this.vrm.humanoid?.getNormalizedBoneNode('leftShoulder')
      const rightShoulder = this.vrm.humanoid?.getNormalizedBoneNode('rightShoulder')
      const leftHand = this.vrm.humanoid?.getNormalizedBoneNode('leftHand')
      const rightHand = this.vrm.humanoid?.getNormalizedBoneNode('rightHand')

      if (!leftUpperArm || !rightUpperArm) {
        console.error('Cannot start wiggle: Arm bones not found')
        return
      }

      console.log('Arm bones found, starting wiggle interval')

      // Capture current pose as base
      const baseLeft = {
        upperArm: leftUpperArm.rotation.clone(),
        lowerArm: leftLowerArm?.rotation.clone(),
        shoulder: leftShoulder?.rotation.clone(),
        hand: leftHand?.rotation.clone()
      }
      const baseRight = {
        upperArm: rightUpperArm.rotation.clone(),
        lowerArm: rightLowerArm?.rotation.clone(),
        shoulder: rightShoulder?.rotation.clone(),
        hand: rightHand?.rotation.clone()
      }

      console.log('Base rotations captured:', {
        leftArm: baseLeft.upperArm.z,
        rightArm: baseRight.upperArm.z
      })

      let wigglePhase = 0
      let frameCount = 0

      this.wiggleInterval = setInterval(() => {
        if (this.isPlayingSequence) return

        wigglePhase += 0.008 // SLOWER for natural movement

        // GENTLE, NATURAL wiggling - like a person standing relaxed
        const leftArmSway = Math.sin(wigglePhase * 0.6) * 0.06
        const rightArmSway = Math.sin(wigglePhase * 0.6 + Math.PI * 0.7) * 0.06
        const shoulderShift = Math.sin(wigglePhase * 0.4) * 0.04
        const elbowBend = Math.sin(wigglePhase * 0.5) * 0.03
        const handRelax = Math.sin(wigglePhase * 0.7) * 0.05

        // Left side - gentle swaying
        if (leftUpperArm) {
          leftUpperArm.rotation.z = baseLeft.upperArm.z + leftArmSway
          leftUpperArm.rotation.x = baseLeft.upperArm.x + Math.sin(wigglePhase * 0.35) * 0.04
          leftUpperArm.rotation.y = baseLeft.upperArm.y + Math.cos(wigglePhase * 0.3) * 0.03
        }
        if (leftLowerArm && baseLeft.lowerArm) {
          leftLowerArm.rotation.y = baseLeft.lowerArm.y + elbowBend
          leftLowerArm.rotation.x = baseLeft.lowerArm.x + Math.sin(wigglePhase * 0.45) * 0.02
        }
        if (leftShoulder && baseLeft.shoulder) {
          leftShoulder.rotation.z = baseLeft.shoulder.z + shoulderShift
          leftShoulder.rotation.x = baseLeft.shoulder.x + Math.sin(wigglePhase * 0.25) * 0.02
        }
        if (leftHand && baseLeft.hand) {
          leftHand.rotation.z = baseLeft.hand.z + handRelax
          leftHand.rotation.x = baseLeft.hand.x + Math.sin(wigglePhase * 0.55) * 0.03
        }

        // Right side - gentle swaying (opposite phase)
        if (rightUpperArm) {
          rightUpperArm.rotation.z = baseRight.upperArm.z + rightArmSway
          rightUpperArm.rotation.x = baseRight.upperArm.x + Math.sin(wigglePhase * 0.35 + Math.PI) * 0.04
          rightUpperArm.rotation.y = baseRight.upperArm.y + Math.cos(wigglePhase * 0.3 + Math.PI) * 0.03
        }
        if (rightLowerArm && baseRight.lowerArm) {
          rightLowerArm.rotation.y = baseRight.lowerArm.y - elbowBend
          rightLowerArm.rotation.x = baseRight.lowerArm.x + Math.sin(wigglePhase * 0.45 + Math.PI) * 0.02
        }
        if (rightShoulder && baseRight.shoulder) {
          rightShoulder.rotation.z = baseRight.shoulder.z - shoulderShift
          rightShoulder.rotation.x = baseRight.shoulder.x + Math.sin(wigglePhase * 0.25 + Math.PI) * 0.02
        }
        if (rightHand && baseRight.hand) {
          rightHand.rotation.z = baseRight.hand.z - handRelax
          rightHand.rotation.x = baseRight.hand.x + Math.sin(wigglePhase * 0.55 + Math.PI) * 0.03
        }

        // Log every 200 frames (less frequent)
        frameCount++
        if (frameCount % 200 === 0) {
          console.log('Wiggle active - gentle movement')
        }
      }, 50)

      console.log('Wiggle interval started successfully')
    }, 300) // Longer delay to ensure everything is ready
  }

  // Hand animations during speaking
  startSpeakingHandAnimation() {
    if (!this.vrm) return

    const leftHand = this.vrm.humanoid?.getNormalizedBoneNode('leftHand')
    const rightHand = this.vrm.humanoid?.getNormalizedBoneNode('rightHand')
    const leftLowerArm = this.vrm.humanoid?.getNormalizedBoneNode('leftLowerArm')
    const rightLowerArm = this.vrm.humanoid?.getNormalizedBoneNode('rightLowerArm')
    const leftUpperArm = this.vrm.humanoid?.getNormalizedBoneNode('leftUpperArm')
    const rightUpperArm = this.vrm.humanoid?.getNormalizedBoneNode('rightUpperArm')

    if (!leftHand || !rightHand) return

    const baseLeft = {
      hand: leftHand.rotation.clone(),
      lowerArm: leftLowerArm?.rotation.clone(),
      upperArm: leftUpperArm?.rotation.clone()
    }
    const baseRight = {
      hand: rightHand.rotation.clone(),
      lowerArm: rightLowerArm?.rotation.clone(),
      upperArm: rightUpperArm?.rotation.clone()
    }

    let phase = 0

    this.speakingHandInterval = setInterval(() => {
      phase += 0.05

      // Expressive hand gestures while speaking
      const leftMove = Math.sin(phase) * 0.12
      const rightMove = Math.sin(phase + Math.PI * 0.4) * 0.12

      if (leftHand) {
        leftHand.rotation.z = baseLeft.hand.z + leftMove
        leftHand.rotation.x = baseLeft.hand.x + Math.cos(phase * 1.3) * 0.08
      }

      if (rightHand) {
        rightHand.rotation.z = baseRight.hand.z + rightMove
        rightHand.rotation.x = baseRight.hand.x + Math.cos(phase * 1.3 + Math.PI) * 0.08
      }

      // Arm movements while speaking
      if (leftLowerArm && baseLeft.lowerArm) {
        leftLowerArm.rotation.y = baseLeft.lowerArm.y + Math.sin(phase * 0.9) * 0.06
      }

      if (rightLowerArm && baseRight.lowerArm) {
        rightLowerArm.rotation.y = baseRight.lowerArm.y + Math.sin(phase * 0.9 + Math.PI) * 0.06
      }

      if (leftUpperArm && baseLeft.upperArm) {
        leftUpperArm.rotation.x = baseLeft.upperArm.x + Math.sin(phase * 0.6) * 0.04
      }

      if (rightUpperArm && baseRight.upperArm) {
        rightUpperArm.rotation.x = baseRight.upperArm.x + Math.sin(phase * 0.6 + Math.PI) * 0.04
      }
    }, 50)
  }

  stopSpeakingHandAnimation() {
    if (this.speakingHandInterval) {
      clearInterval(this.speakingHandInterval)
      this.speakingHandInterval = null
    }
  }

  async setExpression(expression, intensity = 0.6, duration = 400) {
    if (!this.vrm?.expressionManager) return

    const expressions = this.EXPRESSIONS[expression] || [expression]

    if (this.currentTransition) {
      cancelAnimationFrame(this.currentTransition)
    }

    const startValues = {}
    const targetValues = {}

    expressions.forEach(expr => {
      startValues[expr] = this.vrm.expressionManager.getValue(expr) || 0
      targetValues[expr] = intensity
    })

    return new Promise((resolve) => {
      const startTime = performance.now()

      const animate = (now) => {
        const elapsed = now - startTime
        const t = Math.min(elapsed / duration, 1)

        // Smooth easing
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

        expressions.forEach(expr => {
          const value = startValues[expr] + (targetValues[expr] - startValues[expr]) * eased
          this.vrm.expressionManager.setValue(expr, value)
        })

        this.vrm.expressionManager.update()

        if (t < 1) {
          this.currentTransition = requestAnimationFrame(animate)
        } else {
          this.currentTransition = null
          resolve()
        }
      }

      this.currentTransition = requestAnimationFrame(animate)
    })
  }

  async resetExpression(expression, duration = 400) {
    await this.setExpression(expression, 0, duration)
  }

  async animateHeadMotion(type, duration = 600) {
    if (!this.vrm) return

    const head = this.vrm.humanoid?.getNormalizedBoneNode('head')
    if (!head) return

    const startRot = head.rotation.clone()
    const targetRot = new THREE.Euler()
    let curve = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

    switch (type) {
      case 'nod':
        targetRot.set(0.3, 0, 0)
        break
      case 'shake':
        targetRot.set(0, 0.35, 0)
        curve = (t) => Math.sin(t * Math.PI * 2) * (1 - t)
        break
      case 'tiltLeft':
        targetRot.set(0, 0, 0.25)
        break
      case 'tiltRight':
        targetRot.set(0, 0, -0.25)
        break
      case 'lookUp':
        targetRot.set(-0.2, 0, 0)
        break
      case 'lookDown':
        targetRot.set(0.2, 0, 0)
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
          // Smooth return
          const returnDuration = 300
          const returnStart = performance.now()

          const returnAnimate = (now) => {
            const elapsed = now - returnStart
            const rt = Math.min(elapsed / returnDuration, 1)
            const eased = rt < 0.5 ? 2 * rt * rt : 1 - Math.pow(-2 * rt + 2, 2) / 2

            head.rotation.x += (startRot.x - head.rotation.x) * eased
            head.rotation.y += (startRot.y - head.rotation.y) * eased
            head.rotation.z += (startRot.z - head.rotation.z) * eased

            if (rt < 1) {
              requestAnimationFrame(returnAnimate)
            } else {
              resolve()
            }
          }
          requestAnimationFrame(returnAnimate)
        }
      }
      requestAnimationFrame(animate)
    })
  }

  async performGesture(gestureType, duration = 1000) {
    if (!this.vrm || !gestureType || gestureType === 'none') return

    if (this.gestureTimeout) {
      clearTimeout(this.gestureTimeout)
      this.gestureTimeout = null
    }

    // Use preloaded animation if available
    if (this.gestureAnimations[gestureType]) {
      return this.playGestureAnimation(gestureType)
    }

    // Procedural gestures
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
          const wave = Math.sin(t * Math.PI * 4) * 0.3
          const lift = Math.sin(t * Math.PI) * 0.8
          rightArm.rotation.x = startPos.rightArm.x - lift
          rightArm.rotation.z = startPos.rightArm.z - 0.6 + wave
          if (rightForearm) rightForearm.rotation.y = wave * 0.4
        }
        break

      case 'shrug':
        gestureFunc = (t) => {
          const intensity = Math.sin(t * Math.PI) * 0.5
          leftArm.rotation.z = startPos.leftArm.z + intensity
          rightArm.rotation.z = startPos.rightArm.z - intensity
        }
        break

      case 'point':
      case 'pointing':
        gestureFunc = (t) => {
          const intensity = Math.sin(t * Math.PI) * 0.7
          rightArm.rotation.x = startPos.rightArm.x - intensity * 0.9
          rightArm.rotation.z = startPos.rightArm.z - intensity * 0.4
          if (rightForearm) rightForearm.rotation.x = intensity * 0.6
        }
        break

      case 'think':
        gestureFunc = (t) => {
          const intensity = Math.sin(t * Math.PI) * 0.5
          rightArm.rotation.x = startPos.rightArm.x - intensity * 0.8
          if (rightForearm) rightForearm.rotation.x = intensity
        }
        break

      case 'clap':
      case 'clapping':
        gestureFunc = (t) => {
          const clap = Math.sin(t * Math.PI * 6) * 0.4
          leftArm.rotation.z = startPos.leftArm.z - clap
          rightArm.rotation.z = startPos.rightArm.z + clap
        }
        break

      case 'thumbsup':
      case 'thumbsUp':
        gestureFunc = (t) => {
          const intensity = Math.sin(t * Math.PI) * 0.6
          rightArm.rotation.x = startPos.rightArm.x - intensity
          rightArm.rotation.z = startPos.rightArm.z - intensity * 0.3
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
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

        gestureFunc(eased)

        if (t < 1) {
          requestAnimationFrame(animate)
        } else {
          // Smooth return
          const returnDuration = 400
          const returnStart = performance.now()

          const returnAnimate = (now) => {
            const elapsed = now - returnStart
            const rt = Math.min(elapsed / returnDuration, 1)
            const eased = rt < 0.5 ? 2 * rt * rt : 1 - Math.pow(-2 * rt + 2, 2) / 2

            leftArm.rotation.x += (startPos.leftArm.x - leftArm.rotation.x) * eased
            leftArm.rotation.z += (startPos.leftArm.z - leftArm.rotation.z) * eased
            rightArm.rotation.x += (startPos.rightArm.x - rightArm.rotation.x) * eased
            rightArm.rotation.z += (startPos.rightArm.z - rightArm.rotation.z) * eased

            if (leftForearm && startPos.leftForearm) {
              leftForearm.rotation.x += (startPos.leftForearm.x - leftForearm.rotation.x) * eased
              leftForearm.rotation.y += (startPos.leftForearm.y - leftForearm.rotation.y) * eased
            }

            if (rightForearm && startPos.rightForearm) {
              rightForearm.rotation.x += (startPos.rightForearm.x - rightForearm.rotation.x) * eased
              rightForearm.rotation.y += (startPos.rightForearm.y - rightForearm.rotation.y) * eased
            }

            if (rt < 1) {
              requestAnimationFrame(returnAnimate)
            } else {
              resolve()
            }
          }
          requestAnimationFrame(returnAnimate)
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

  async playAnimationSequence(plan) {
    if (!this.vrm?.expressionManager || !plan || plan.length === 0) return

    this.isPlayingSequence = true
    console.log('Playing animation sequence:', plan.length, 'steps')

    // Start hand movements for speaking
    this.startSpeakingHandAnimation()

    try {
      for (let i = 0; i < plan.length; i++) {
        const step = plan[i]
        const intensity = Math.min((step.intensity || 0.6) * 0.65, 0.9)

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
      // Stop hand movements
      this.stopSpeakingHandAnimation()
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

    if (this.breatheInterval) {
      clearInterval(this.breatheInterval)
      this.breatheInterval = null
    }

    if (this.subtleMovementInterval) {
      clearInterval(this.subtleMovementInterval)
      this.subtleMovementInterval = null
    }

    if (this.wiggleInterval) {
      clearInterval(this.wiggleInterval)
      this.wiggleInterval = null
    }

    if (this.speakingHandInterval) {
      clearInterval(this.speakingHandInterval)
      this.speakingHandInterval = null
    }

    if (this.gestureTimeout) {
      clearTimeout(this.gestureTimeout)
      this.gestureTimeout = null
    }

    if (this.currentTransition) {
      cancelAnimationFrame(this.currentTransition)
      this.currentTransition = null
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
