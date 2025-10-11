// managers/animationManager.js - COMPLETE WORKING VERSION (ALL BUGS FIXED)
import * as THREE from 'three'

export class AnimationManager {
  constructor(vrm) {
    this.vrm = vrm
    this.currentMixer = null
    this.currentAnimationAction = null
    this.idleAnimation = null
    this.idleAction = null
    this.gestureAnimations = {}

    // All intervals
    this.blinkInterval = null
    this.breatheInterval = null
    this.subtleMovementInterval = null
    this.handGestureInterval = null
    this.eyeMovementInterval = null
    this.speakingHandInterval = null
    this.speakingHeadInterval = null
    this.gestureTimeout = null

    // States
    this.isPlayingSequence = false
    this.isSpeaking = false
    this.activeAnimations = new Set()
    this.currentTransition = null

    this.EXPRESSIONS = {
      neutral: ['neutral'],
      happy: ['happy', 'joy'],
      sad: ['sad', 'sorrow'],
      angry: ['angry', 'fury'],
      surprised: ['surprised', 'shocked'],
      excited: ['excited', 'happy', 'joy'],
      confused: ['confused', 'sad'],
      smirk: ['smirk', 'happy'],
      laugh: ['happy', 'joy'],
      embarrassed: ['blink', 'happy'],
      determined: ['angry'],
      worried: ['sad', 'blink'],
      curious: ['surprised'],
      sleepy: ['relaxed', 'blink'],
      mischievous: ['smirk', 'wink'],
      thinking: ['neutral'],
      shy: ['blink', 'happy']
    }
  }

  updateVRM(newVrm) {
    this.cleanup()
    this.vrm = newVrm
    this.startNaturalIdle()

    if (this.idleAnimation) {
      this.startIdleAnimation()
    }
  }

  setIdleAnimation(animation) {
    this.idleAnimation = animation
    console.log('✅ Idle animation set')
  }

  setGestureAnimation(name, animation) {
    this.gestureAnimations[name] = animation
    console.log('✅ Gesture animation loaded:', name)
  }

  // ==================== IDLE ANIMATION CONTROL ====================

startIdleAnimation() {
    if (!this.idleAnimation || !this.vrm) {
      console.log('⚠️ No idle animation, using natural idle only')
      this.startNaturalIdle()
      return
    }

    this.stopIdleAnimation()

    if (!this.currentMixer) {
      this.currentMixer = new THREE.AnimationMixer(this.vrm.scene)
    }

    this.idleAction = this.currentMixer.clipAction(this.idleAnimation)
    this.idleAction.setLoop(THREE.LoopRepeat)
    this.idleAction.setEffectiveWeight(0.15) // REDUCED: Very subtle for portrait
    this.idleAction.timeScale = 0.7 // Slower for smoother motion
    this.idleAction.play()

    console.log('✅ HappyIdle.fbx started (weight: 0.15, speed: 0.7)')

    // Don't start natural animations if HappyIdle is active
    // Only do blinking and breathing
    this.startEnhancedBlinking()
    this.startSubtleBreathing()
  }

  stopIdleAnimation() {
    if (this.idleAction) {
      this.idleAction.fadeOut(0.3)
      setTimeout(() => {
        if (this.idleAction) {
          this.idleAction.stop()
        }
      }, 300)
      this.idleAction = null
      console.log('⏸️ HappyIdle.fbx stopped')
    }
  }

  pauseIdleForSpeaking() {
    if (this.idleAction) {
      this.idleAction.stop()
      console.log('🗣️ HappyIdle STOPPED for speaking')
    }

    // CRITICAL: Stop ALL natural idle animations
    this.stopAllNaturalAnimations()
  }

  resumeIdleAfterSpeaking() {
    if (this.idleAction && this.idleAnimation) {
      this.idleAction.reset()
      this.idleAction.play()
      console.log('▶️ HappyIdle RESUMED after speaking')
    }

    // Restart natural animations
    this.startNaturalIdle()
  }

  // ==================== NATURAL ANIMATIONS ====================

  startNaturalIdle() {
    if (!this.vrm) return

    // Always do blinking and breathing
    this.startEnhancedBlinking()
    this.startSubtleBreathing()

    // Only do these if NOT speaking and NO idle animation
    if (!this.isSpeaking && !this.idleAnimation) {
      this.startMinimalHeadMovements()
      this.startExpressiveHandGestures()
    }

    console.log('✨ Natural idle started')
  }

  stopAllNaturalAnimations() {
    // Stop head movements
    if (this.subtleMovementInterval) {
      clearInterval(this.subtleMovementInterval)
      this.subtleMovementInterval = null
    }

    // Stop hand gestures
    if (this.handGestureInterval) {
      clearInterval(this.handGestureInterval)
      this.handGestureInterval = null
    }

    // Stop eye movements
    if (this.eyeMovementInterval) {
      clearInterval(this.eyeMovementInterval)
      this.eyeMovementInterval = null
    }

    console.log('🛑 All natural animations stopped')
  }

  startEnhancedBlinking() {
    if (!this.vrm?.expressionManager) return
    if (this.blinkInterval) clearTimeout(this.blinkInterval)

    const doBlink = () => {
      if (!this.vrm?.expressionManager) {
        this.blinkInterval = setTimeout(doBlink, 3000)
        return
      }

      const intensity = 0.9 + Math.random() * 0.1
      const blinkDuration = 60 + Math.random() * 40
      const isDoubleBlink = Math.random() < 0.2

      this.vrm.expressionManager.setValue('blink', intensity)
      this.vrm.expressionManager.update()

      setTimeout(() => {
        if (this.vrm?.expressionManager) {
          this.vrm.expressionManager.setValue('blink', 0)
          this.vrm.expressionManager.update()

          if (isDoubleBlink) {
            setTimeout(() => {
              if (this.vrm?.expressionManager) {
                this.vrm.expressionManager.setValue('blink', intensity * 0.85)
                this.vrm.expressionManager.update()
                setTimeout(() => {
                  if (this.vrm?.expressionManager) {
                    this.vrm.expressionManager.setValue('blink', 0)
                    this.vrm.expressionManager.update()
                  }
                }, blinkDuration * 0.6)
              }
            }, 120)
          }
        }

        const nextBlink = 2000 + Math.random() * 3000
        this.blinkInterval = setTimeout(doBlink, nextBlink)
      }, blinkDuration)
    }

    doBlink()
  }

  startSubtleBreathing() {
    if (!this.vrm) return
    if (this.breatheInterval) clearInterval(this.breatheInterval)

    const chest = this.vrm.humanoid?.getNormalizedBoneNode('chest')
    const upperChest = this.vrm.humanoid?.getNormalizedBoneNode('upperChest')

    if (!chest) return

    let breathPhase = 0

    this.breatheInterval = setInterval(() => {
      breathPhase += 0.008
      const breathIntensity = Math.sin(breathPhase) * 0.008

      if (chest) {
        chest.rotation.x = breathIntensity
      }
      if (upperChest) {
        upperChest.rotation.x = breathIntensity * 0.5
      }
    }, 50)
  }

  startMinimalHeadMovements() {
    if (!this.vrm) return
    if (this.subtleMovementInterval) clearInterval(this.subtleMovementInterval)

    const head = this.vrm.humanoid?.getNormalizedBoneNode('head')
    const neck = this.vrm.humanoid?.getNormalizedBoneNode('neck')

    if (!head) return

    const baseHead = head.rotation.clone()
    const baseNeck = neck?.rotation.clone()

    let phase = 0

    this.subtleMovementInterval = setInterval(() => {
      if (this.isPlayingSequence || this.isSpeaking) return

      phase += 0.004

      const headSway = Math.sin(phase * 0.4) * 0.015
      const headTilt = Math.cos(phase * 0.3) * 0.012
      const headNod = Math.sin(phase * 0.2) * 0.01

      if (head) {
        head.rotation.y = baseHead.y + headSway
        head.rotation.z = baseHead.z + headTilt
        head.rotation.x = baseHead.x + headNod
      }

      if (neck && baseNeck) {
        neck.rotation.x = baseNeck.x + Math.sin(phase * 0.15) * 0.008
      }
    }, 50)
  }

  startExpressiveHandGestures() {
    if (!this.vrm) return
    if (this.handGestureInterval) clearInterval(this.handGestureInterval)

    setTimeout(() => {
      const leftUpperArm = this.vrm.humanoid?.getNormalizedBoneNode('leftUpperArm')
      const rightUpperArm = this.vrm.humanoid?.getNormalizedBoneNode('rightUpperArm')
      const leftLowerArm = this.vrm.humanoid?.getNormalizedBoneNode('leftLowerArm')
      const rightLowerArm = this.vrm.humanoid?.getNormalizedBoneNode('rightLowerArm')
      const leftHand = this.vrm.humanoid?.getNormalizedBoneNode('leftHand')
      const rightHand = this.vrm.humanoid?.getNormalizedBoneNode('rightHand')

      if (!leftUpperArm || !rightUpperArm) return

      const baseLeft = {
        upperArm: leftUpperArm.rotation.clone(),
        lowerArm: leftLowerArm?.rotation.clone(),
        hand: leftHand?.rotation.clone()
      }
      const baseRight = {
        upperArm: rightUpperArm.rotation.clone(),
        lowerArm: rightLowerArm?.rotation.clone(),
        hand: rightHand?.rotation.clone()
      }

      let phase = 0

      this.handGestureInterval = setInterval(() => {
        if (this.isPlayingSequence || this.isSpeaking) return

        phase += 0.01

        const leftHandMove = Math.sin(phase * 0.6) * 0.15
        const rightHandMove = Math.sin(phase * 0.6 + Math.PI * 0.6) * 0.15
        const fingerCurl = Math.sin(phase * 0.8) * 0.1

        if (leftHand) {
          leftHand.rotation.z = baseLeft.hand.z + leftHandMove
          leftHand.rotation.x = baseLeft.hand.x + fingerCurl
        }
        if (leftLowerArm && baseLeft.lowerArm) {
          leftLowerArm.rotation.y = baseLeft.lowerArm.y + Math.sin(phase * 0.5) * 0.08
        }
        if (leftUpperArm) {
          leftUpperArm.rotation.x = baseLeft.upperArm.x + Math.sin(phase * 0.4) * 0.06
        }

        if (rightHand) {
          rightHand.rotation.z = baseRight.hand.z + rightHandMove
          rightHand.rotation.x = baseRight.hand.x + fingerCurl
        }
        if (rightLowerArm && baseRight.lowerArm) {
          rightLowerArm.rotation.y = baseRight.lowerArm.y - Math.sin(phase * 0.5) * 0.08
        }
        if (rightUpperArm) {
          rightUpperArm.rotation.x = baseRight.upperArm.x + Math.sin(phase * 0.4 + Math.PI) * 0.06
        }
      }, 50)

      console.log('✅ Hand gestures started')
    }, 300)
  }

  // ==================== SPEAKING ANIMATIONS ====================

  startSpeakingAnimation() {
    this.isSpeaking = true

    // Stop HappyIdle and natural animations
    this.pauseIdleForSpeaking()

    // Start expressive speaking gestures
    this.startSpeakingHandGestures()
    this.startSpeakingHeadMovements()

    console.log('🗣️ Speaking started')
  }

  stopSpeakingAnimation() {
    this.isSpeaking = false

    // Stop speaking gestures
    this.stopSpeakingHandGestures
    this.stopSpeakingHeadMovements

    // Resume idle
    this.resumeIdleAfterSpeaking()

    console.log('🔇 Speaking stopped')
  }

  startSpeakingHandGestures() {
    if (!this.vrm) return
    if (this.speakingHandInterval) clearInterval(this.speakingHandInterval)

    const leftUpperArm = this.vrm.humanoid?.getNormalizedBoneNode('leftUpperArm')
    const rightUpperArm = this.vrm.humanoid?.getNormalizedBoneNode('rightUpperArm')
    const leftLowerArm = this.vrm.humanoid?.getNormalizedBoneNode('leftLowerArm')
    const rightLowerArm = this.vrm.humanoid?.getNormalizedBoneNode('rightLowerArm')
    const leftHand = this.vrm.humanoid?.getNormalizedBoneNode('leftHand')
    const rightHand = this.vrm.humanoid?.getNormalizedBoneNode('rightHand')

    if (!leftUpperArm || !rightUpperArm) return

    // IMPORTANT: Capture CURRENT position as base (not clone)
    const baseLeft = {
      upperArm: {
        x: leftUpperArm.rotation.x,
        y: leftUpperArm.rotation.y,
        z: leftUpperArm.rotation.z
      },
      lowerArm: leftLowerArm ? {
        x: leftLowerArm.rotation.x,
        y: leftLowerArm.rotation.y,
        z: leftLowerArm.rotation.z
      } : null,
      hand: leftHand ? {
        x: leftHand.rotation.x,
        y: leftHand.rotation.y,
        z: leftHand.rotation.z
      } : null
    }

    const baseRight = {
      upperArm: {
        x: rightUpperArm.rotation.x,
        y: rightUpperArm.rotation.y,
        z: rightUpperArm.rotation.z
      },
      lowerArm: rightLowerArm ? {
        x: rightLowerArm.rotation.x,
        y: rightLowerArm.rotation.y,
        z: rightLowerArm.rotation.z
      } : null,
      hand: rightHand ? {
        x: rightHand.rotation.x,
        y: rightHand.rotation.y,
        z: rightHand.rotation.z
      } : null
    }

    let phase = 0

    this.speakingHandInterval = setInterval(() => {
      if (!this.isSpeaking) return

      phase += 0.12 // Fast for expressiveness

      // VERY EXPRESSIVE hand movements during speech
      const leftMove = Math.sin(phase) * 0.35
      const rightMove = Math.sin(phase + Math.PI * 0.5) * 0.35
      const emphasis = Math.sin(phase * 1.8) * 0.25
      const wave = Math.sin(phase * 2.2) * 0.15

      // Left hand - STAYING AT BASE POSITION + movement
      if (leftHand) {
        leftHand.rotation.z = baseLeft.hand.z + leftMove
        leftHand.rotation.x = baseLeft.hand.x + Math.cos(phase * 1.5) * 0.2
        leftHand.rotation.y = baseLeft.hand.y + emphasis * 0.7
      }
      if (leftLowerArm && baseLeft.lowerArm) {
        leftLowerArm.rotation.y = baseLeft.lowerArm.y + Math.sin(phase * 1.2) * 0.15
        leftLowerArm.rotation.x = baseLeft.lowerArm.x + emphasis * 0.9
        leftLowerArm.rotation.z = baseLeft.lowerArm.z + wave * 0.5
      }
      if (leftUpperArm) {
        leftUpperArm.rotation.x = baseLeft.upperArm.x + Math.sin(phase * 0.8) * 0.12
        leftUpperArm.rotation.y = baseLeft.upperArm.y + Math.cos(phase * 0.7) * 0.08
        leftUpperArm.rotation.z = baseLeft.upperArm.z + Math.cos(phase * 0.9) * 0.08
      }

      // Right hand - STAYING AT BASE POSITION + movement
      if (rightHand) {
        rightHand.rotation.z = baseRight.hand.z + rightMove
        rightHand.rotation.x = baseRight.hand.x + Math.cos(phase * 1.5 + Math.PI) * 0.2
        rightHand.rotation.y = baseRight.hand.y - emphasis * 0.7
      }
      if (rightLowerArm && baseRight.lowerArm) {
        rightLowerArm.rotation.y = baseRight.lowerArm.y - Math.sin(phase * 1.2) * 0.15
        rightLowerArm.rotation.x = baseRight.lowerArm.x - emphasis * 0.9
        rightLowerArm.rotation.z = baseRight.lowerArm.z - wave * 0.5
      }
      if (rightUpperArm) {
        rightUpperArm.rotation.x = baseRight.upperArm.x + Math.sin(phase * 0.8 + Math.PI) * 0.12
        rightUpperArm.rotation.y = baseRight.upperArm.y + Math.cos(phase * 0.7 + Math.PI) * 0.08
        rightUpperArm.rotation.z = baseRight.upperArm.z - Math.cos(phase * 0.9) * 0.08
      }
    }, 50)

    console.log('✅ Speaking hand gestures started (ENHANCED)')
  }

  stopSpeakingHandGestures() {
    if (this.speakingHandInterval) {
      clearInterval(this.speakingHandInterval)
      this.speakingHandInterval = null
      console.log('🛑 Speaking hand gestures stopped')
    }
  }

  startSpeakingHeadMovements() {
    if (!this.vrm) return
    if (this.speakingHeadInterval) clearInterval(this.speakingHeadInterval)

    const head = this.vrm.humanoid?.getNormalizedBoneNode('head')
    const neck = this.vrm.humanoid?.getNormalizedBoneNode('neck')

    if (!head) return

    // Capture BASE position
    const baseHead = {
      x: head.rotation.x,
      y: head.rotation.y,
      z: head.rotation.z
    }
    const baseNeck = neck ? {
      x: neck.rotation.x,
      y: neck.rotation.y,
      z: neck.rotation.z
    } : null

    let phase = 0

    this.speakingHeadInterval = setInterval(() => {
      if (!this.isSpeaking) return

      phase += 0.02

      // Expressive head movements RELATIVE to base position
      const headNod = Math.sin(phase * 1.3) * 0.1
      const headTilt = Math.sin(phase * 0.8 + 1) * 0.08
      const headTurn = Math.sin(phase * 0.6 + 2) * 0.06

      if (head) {
        head.rotation.x = baseHead.x + headNod
        head.rotation.y = baseHead.y + headTurn
        head.rotation.z = baseHead.z + headTilt
      }

      if (neck && baseNeck) {
        neck.rotation.x = baseNeck.x + Math.sin(phase * 0.9) * 0.05
      }
    }, 50)

    console.log('✅ Speaking head movements started')
  }

  stopSpeakingHeadMovements() {
    if (this.speakingHeadInterval) {
      clearInterval(this.speakingHeadInterval)
      this.speakingHeadInterval = null
      console.log('🛑 Speaking head movements stopped')
    }
  }

  // ==================== EXPRESSION SYSTEM ====================

  async setExpression(expression, intensity = 0.7, duration = 400) {
    if (!this.vrm?.expressionManager) return

    const expressions = this.EXPRESSIONS[expression] || [expression]

    if (this.currentTransition) {
      cancelAnimationFrame(this.currentTransition)
    }

    const startValues = {}
    const targetValues = {}

    expressions.forEach(expr => {
      startValues[expr] = this.vrm.expressionManager.getValue(expr) || 0
      targetValues[expr] = Math.min(intensity, 0.95)
    })

    return new Promise((resolve) => {
      const startTime = performance.now()

      const animate = (now) => {
        const elapsed = now - startTime
        const t = Math.min(elapsed / duration, 1)
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

  async resetExpression(expression, duration = 350) {
    await this.setExpression(expression, 0, duration)
  }

  // ==================== HEAD MOTION SYSTEM ====================

  async animateHeadMotion(type, duration = 700) {
    if (!this.vrm) return

    const head = this.vrm.humanoid?.getNormalizedBoneNode('head')
    const neck = this.vrm.humanoid?.getNormalizedBoneNode('neck')
    if (!head) return

    const startRotHead = head.rotation.clone()
    const startRotNeck = neck?.rotation.clone()
    const targetRot = new THREE.Euler()
    const neckTarget = new THREE.Euler()

    let curve = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

    switch (type) {
      case 'nod':
        targetRot.set(0.4, 0, 0)
        neckTarget.set(0.18, 0, 0)
        break
      case 'shake':
        targetRot.set(0, 0.45, 0)
        curve = (t) => Math.sin(t * Math.PI * 2.5) * (1 - t)
        break
      case 'tiltLeft':
        targetRot.set(0, 0.12, 0.35)
        break
      case 'tiltRight':
        targetRot.set(0, -0.12, -0.35)
        break
      case 'lookUp':
        targetRot.set(-0.3, 0, 0)
        neckTarget.set(-0.12, 0, 0)
        break
      case 'lookDown':
        targetRot.set(0.3, 0, 0)
        neckTarget.set(0.12, 0, 0)
        break
      case 'doubleNod':
        targetRot.set(0.4, 0, 0)
        neckTarget.set(0.18, 0, 0)
        curve = (t) => Math.sin(t * Math.PI * 4) * (1 - t * 0.3)
        duration *= 1.3
        break
      case 'confused':
        targetRot.set(0.12, 0.25, 0.25)
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

        head.rotation.x = startRotHead.x + targetRot.x * eased
        head.rotation.y = startRotHead.y + targetRot.y * eased
        head.rotation.z = startRotHead.z + targetRot.z * eased

        if (neck && neckTarget.x !== 0) {
          neck.rotation.x = startRotNeck.x + neckTarget.x * eased
        }

        if (t < 1) {
          requestAnimationFrame(animate)
        } else {
          const returnDuration = 400
          const returnStart = performance.now()

          const returnAnimate = (now) => {
            const elapsed = now - returnStart
            const rt = Math.min(elapsed / returnDuration, 1)
            const eased = rt < 0.5 ? 2 * rt * rt : 1 - Math.pow(-2 * rt + 2, 2) / 2

            head.rotation.x += (startRotHead.x - head.rotation.x) * eased
            head.rotation.y += (startRotHead.y - head.rotation.y) * eased
            head.rotation.z += (startRotHead.z - head.rotation.z) * eased

            if (neck && startRotNeck) {
              neck.rotation.x += (startRotNeck.x - neck.rotation.x) * eased
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

  // ==================== GESTURE SYSTEM ====================

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
    const leftHand = this.vrm.humanoid?.getNormalizedBoneNode('leftHand')
    const rightHand = this.vrm.humanoid?.getNormalizedBoneNode('rightHand')

    if (!leftArm || !rightArm) return

    const startPos = {
      leftArm: leftArm.rotation.clone(),
      rightArm: rightArm.rotation.clone(),
      leftForearm: leftForearm?.rotation.clone(),
      rightForearm: rightForearm?.rotation.clone(),
      leftHand: leftHand?.rotation.clone(),
      rightHand: rightHand?.rotation.clone()
    }

    let gestureFunc

    switch (gestureType) {
      case 'wave':
      case 'handWave':
        gestureFunc = (t) => {
          const wave = Math.sin(t * Math.PI * 5) * 0.5
          const lift = Math.sin(t * Math.PI) * 1.2
          rightArm.rotation.x = startPos.rightArm.x - lift * 0.9
          rightArm.rotation.z = startPos.rightArm.z - 0.8 + wave
          if (rightForearm) rightForearm.rotation.y = wave * 0.7
          if (rightHand) rightHand.rotation.z = wave * 0.4
        }
        break

      case 'point':
      case 'pointing':
        gestureFunc = (t) => {
          const intensity = Math.sin(t * Math.PI) * 1.0
          rightArm.rotation.x = startPos.rightArm.x - intensity * 1.2
          rightArm.rotation.z = startPos.rightArm.z - intensity * 0.6
          if (rightForearm) rightForearm.rotation.x = intensity * 0.9
          if (rightHand) rightHand.rotation.x = intensity * 0.5
        }
        break

      case 'think':
        gestureFunc = (t) => {
          const intensity = Math.sin(t * Math.PI) * 0.8
          rightArm.rotation.x = startPos.rightArm.x - intensity * 1.0
          rightArm.rotation.y = startPos.rightArm.y + intensity * 0.4
          if (rightForearm) rightForearm.rotation.x = intensity * 1.3
          if (rightHand) {
            rightHand.rotation.x = intensity * 0.6
            rightHand.rotation.z = intensity * 0.3
          }
        }
        break

      case 'clap':
      case 'clapping':
        gestureFunc = (t) => {
          const clap = Math.sin(t * Math.PI * 8) * 0.7
          const lift = Math.sin(t * Math.PI) * 0.6
          leftArm.rotation.z = startPos.leftArm.z - clap - lift
          rightArm.rotation.z = startPos.rightArm.z + clap + lift
          leftArm.rotation.x = startPos.leftArm.x - lift * 0.4
          rightArm.rotation.x = startPos.rightArm.x - lift * 0.4
        }
        break

      case 'shrug':
        gestureFunc = (t) => {
          const intensity = Math.sin(t * Math.PI) * 0.8
          leftArm.rotation.z = startPos.leftArm.z + intensity
          rightArm.rotation.z = startPos.rightArm.z - intensity
          leftArm.rotation.x = startPos.leftArm.x - intensity * 0.4
          rightArm.rotation.x = startPos.rightArm.x - intensity * 0.4
          if (leftForearm) leftForearm.rotation.y = -intensity * 0.5
          if (rightForearm) rightForearm.rotation.y = intensity * 0.5
        }
        break

      case 'thumbsUp':
        gestureFunc = (t) => {
          const intensity = Math.sin(t * Math.PI) * 0.9
          rightArm.rotation.x = startPos.rightArm.x - intensity * 0.8
          rightArm.rotation.z = startPos.rightArm.z - intensity * 0.5
          if (rightForearm) rightForearm.rotation.y = intensity * 0.4
          if (rightHand) {
            rightHand.rotation.z = -intensity * 0.6
            rightHand.rotation.x = intensity * 0.4
          }
        }
        break

      case 'handToHeart':
        gestureFunc = (t) => {
          const intensity = Math.sin(t * Math.PI) * 0.9
          rightArm.rotation.x = startPos.rightArm.x - intensity * 0.7
          rightArm.rotation.y = startPos.rightArm.y + intensity * 0.6
          if (rightForearm) rightForearm.rotation.x = intensity * 0.9
          if (rightHand) rightHand.rotation.x = intensity * 0.5
        }
        break

      case 'talk':
      case 'talking':
        gestureFunc = (t) => {
          const move = Math.sin(t * Math.PI * 3) * 0.35
          const sway = Math.cos(t * Math.PI * 2) * 0.25
          leftArm.rotation.x = startPos.leftArm.x + move * 0.5
          rightArm.rotation.x = startPos.rightArm.x - move * 0.5
          if (leftHand) leftHand.rotation.z = sway
          if (rightHand) rightHand.rotation.z = -sway
        }
        break

      case 'idle':
        gestureFunc = () => {}
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
          const returnDuration = 500
          const returnStart = performance.now()

          const returnAnimate = (now) => {
            const elapsed = now - returnStart
            const rt = Math.min(elapsed / returnDuration, 1)
            const eased = rt < 0.5 ? 2 * rt * rt : 1 - Math.pow(-2 * rt + 2, 2) / 2

            leftArm.rotation.x += (startPos.leftArm.x - leftArm.rotation.x) * eased
            leftArm.rotation.y += (startPos.leftArm.y - leftArm.rotation.y) * eased
            leftArm.rotation.z += (startPos.leftArm.z - leftArm.rotation.z) * eased

            rightArm.rotation.x += (startPos.rightArm.x - rightArm.rotation.x) * eased
            rightArm.rotation.y += (startPos.rightArm.y - rightArm.rotation.y) * eased
            rightArm.rotation.z += (startPos.rightArm.z - rightArm.rotation.z) * eased

            if (leftForearm && startPos.leftForearm) {
              leftForearm.rotation.x += (startPos.leftForearm.x - leftForearm.rotation.x) * eased
              leftForearm.rotation.y += (startPos.leftForearm.y - leftForearm.rotation.y) * eased
            }

            if (rightForearm && startPos.rightForearm) {
              rightForearm.rotation.x += (startPos.rightForearm.x - rightForearm.rotation.x) * eased
              rightForearm.rotation.y += (startPos.rightForearm.y - rightForearm.rotation.y) * eased
            }

            if (leftHand && startPos.leftHand) {
              leftHand.rotation.x += (startPos.leftHand.x - leftHand.rotation.x) * eased
              leftHand.rotation.z += (startPos.leftHand.z - leftHand.rotation.z) * eased
            }

            if (rightHand && startPos.rightHand) {
              rightHand.rotation.x += (startPos.rightHand.x - rightHand.rotation.x) * eased
              rightHand.rotation.z += (startPos.rightHand.z - rightHand.rotation.z) * eased
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
      gestureAction.setEffectiveWeight(0.85)
      gestureAction.play()

      const duration = this.gestureAnimations[gestureType].duration * 1000

      this.gestureTimeout = setTimeout(() => {
        gestureAction.fadeOut(0.4)
        setTimeout(resolve, 400)
      }, duration)
    })
  }

  // ==================== ANIMATION SEQUENCE PLAYER ====================

  async playAnimationSequence(plan) {
    if (!this.vrm?.expressionManager || !plan || plan.length === 0) return

    this.isPlayingSequence = true
    console.log('🎬 Playing animation sequence:', plan.length, 'steps')

    this.startSpeakingAnimation()

    try {
      for (let i = 0; i < plan.length; i++) {
        const step = plan[i]
        const intensity = Math.min((step.intensity || 0.7) * 0.75, 0.95)

        const animations = []

        if (step.expression && step.expression !== 'neutral') {
          animations.push(this.setExpression(step.expression, intensity, 400))
        }

        if (step.headMotion && step.headMotion !== 'none') {
          animations.push(
            this.animateHeadMotion(
              step.headMotion,
              Math.min(step.duration * 0.7, 1000)
            )
          )
        }

        if (step.gesture && step.gesture !== 'none' && step.gesture !== 'talk') {
          animations.push(
            this.performGesture(
              step.gesture,
              Math.min(step.duration * 1.0, 1500)
            )
          )
        }

        await Promise.all(animations)
        await new Promise(r => setTimeout(r, Math.max(step.duration * 0.5, 300)))

        if (step.expression && step.expression !== 'neutral') {
          await this.resetExpression(step.expression, 300)
        }

        if (i < plan.length - 1) {
          await new Promise(r => setTimeout(r, 100))
        }
      }

      console.log('✅ Animation sequence complete')
    } catch (error) {
      console.error('❌ Animation sequence error:', error)
    } finally {
      this.stopSpeakingAnimation()
      this.isPlayingSequence = false
    }
  }

  // ==================== UPDATE & CLEANUP ====================

  update(delta) {
    if (this.currentMixer) {
      this.currentMixer.update(delta)
    }
  }

  cleanup() {
    console.log('🧹 Cleaning up AnimationManager...')

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

    if (this.handGestureInterval) {
      clearInterval(this.handGestureInterval)
      this.handGestureInterval = null
    }

    if (this.speakingHandInterval) {
      clearInterval(this.speakingHandInterval)
      this.speakingHandInterval = null
    }

    if (this.speakingHeadInterval) {
      clearInterval(this.speakingHeadInterval)
      this.speakingHeadInterval = null
    }

    if (this.eyeMovementInterval) {
      clearInterval(this.eyeMovementInterval)
      this.eyeMovementInterval = null
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

    this.idleAction = null
    this.currentAnimationAction = null
    this.activeAnimations.clear()
    this.isPlayingSequence = false
    this.isSpeaking = false

    console.log('✅ AnimationManager cleanup complete')
  }
}
