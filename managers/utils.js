// managers/utils.js - ENHANCED with Perfect Synchronization
export class Utils {
  // Animation easing functions
  static easeOut(t) {
    return t * (2 - t)
  }

  static easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
  }

  static lerp(start, end, t) {
    return start + (end - start) * t
  }

  static clamp(value, min, max) {
    return Math.min(Math.max(value, min), max)
  }

  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  static debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }

  static calculateRMS(audioData) {
    let sum = 0
    for (let i = 0; i < audioData.length; i++) {
      const sample = (audioData[i] - 128) / 128
      sum += sample * sample
    }
    return Math.sqrt(sum / audioData.length)
  }

  static analyzeFrequencyData(frequencyData, startRatio = 0, endRatio = 1) {
    const startIndex = Math.floor(frequencyData.length * startRatio)
    const endIndex = Math.floor(frequencyData.length * endRatio)

    let sum = 0
    for (let i = startIndex; i < endIndex; i++) {
      sum += frequencyData[i]
    }

    return sum / (endIndex - startIndex) / 255
  }

  static async readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }

  static randomFloat(min, max) {
    return Math.random() * (max - min) + min
  }

  static randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)]
  }

  static getFeatureSupport() {
    return {
      webAudio: !!(window.AudioContext || window.webkitAudioContext),
      speechRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
      webGL: !!window.WebGLRenderingContext,
      fileAPI: !!(window.File && window.FileReader && window.FileList && window.Blob),
      dragAndDrop: 'draggable' in document.createElement('div')
    }
  }

  static createErrorHandler(context) {
    return (error) => {
      console.error(`Error in ${context}:`, error)
      return {
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString()
      }
    }
  }

  static async safeExecute(fn, fallback = null, context = 'unknown') {
    try {
      return await fn()
    } catch (error) {
      const errorInfo = this.createErrorHandler(context)(error)
      console.warn('Safe execute fallback triggered:', errorInfo)
      return fallback
    }
  }

  static createAnimationState() {
    return {
      isPlaying: false,
      startTime: 0,
      duration: 0,
      progress: 0,
      onComplete: null
    }
  }
}

// ==================== PERFECT AUDIO-ANIMATION SYNC ====================

export async function processMessageOptimized(
  message,
  aiClient,
  audioManager,
  animationManager,
  vrm,
  config,
  audioElement
) {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎯 Processing message:', message)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // ==================== STEP 1: Get AI Response ====================
    console.log('🤖 Step 1: Getting AI response...')
    const aiResponse = await aiClient.chatWithAI(message, config.getSystemPrompt())
    console.log('✅ AI response received:', aiResponse.substring(0, 60) + '...')
    console.log('   Length:', aiResponse.length, 'characters')

    // ==================== STEP 2: Parallel TTS + Animation Plan ====================
    console.log('\n🔄 Step 2: Generating TTS and Animation Plan (PARALLEL)...')

    const parallelStart = performance.now()

    const [audioBlob, animationPlan] = await Promise.all([
      // TTS Generation
      audioManager.generateTTS(aiResponse, config.config).catch(err => {
        console.error('❌ TTS failed:', err.message)
        return null
      }),

      // Animation Plan Generation
      aiClient.generateAnimationPlan(aiResponse).catch(err => {
        console.error('❌ Animation plan failed:', err.message)
        return []
      })
    ])

    const parallelDuration = ((performance.now() - parallelStart) / 1000).toFixed(2)
    console.log(`✅ Parallel processing complete in ${parallelDuration}s`)
    console.log('   Audio:', audioBlob ? `${(audioBlob.size / 1024).toFixed(1)}KB` : 'Failed')
    console.log('   Animation plan:', animationPlan.length, 'steps')

    if (!audioBlob) {
      console.warn('⚠️ No audio generated, skipping playback')
      return aiResponse
    }

    // ==================== STEP 3: Get Audio Duration ====================
    console.log('\n⏱️ Step 3: Analyzing audio duration...')

    const audioDuration = await new Promise((resolve) => {
      const tempAudio = new Audio()
      tempAudio.src = URL.createObjectURL(audioBlob)
      tempAudio.onloadedmetadata = () => {
        resolve(tempAudio.duration)
        URL.revokeObjectURL(tempAudio.src)
      }
      tempAudio.onerror = () => resolve(0)
      setTimeout(() => resolve(0), 3000)
    })

    console.log(`✅ Audio duration: ${audioDuration.toFixed(2)}s`)

    // ==================== STEP 4: Sync Animation Timings ====================
    if (animationPlan.length > 0 && audioDuration > 0) {
      console.log('\n🎬 Step 4: Synchronizing animation timings...')

      const totalPlanDuration = animationPlan.reduce((sum, step) => sum + step.duration, 0)
      const audioMs = audioDuration * 1000

      console.log('   Original plan duration:', (totalPlanDuration / 1000).toFixed(2), 's')
      console.log('   Audio duration:', audioDuration.toFixed(2), 's')

      if (totalPlanDuration > 0) {
        const scale = audioMs / totalPlanDuration
        console.log('   Scaling factor:', scale.toFixed(3))

        animationPlan.forEach((step, index) => {
          const originalDuration = step.duration
          step.duration = Math.round(step.duration * scale)

          if (index < 3) { // Log first 3 steps
            console.log(`   Step ${index + 1}: ${originalDuration}ms → ${step.duration}ms`)
          }
        })

        const newTotal = animationPlan.reduce((sum, step) => sum + step.duration, 0)
        console.log('   New plan duration:', (newTotal / 1000).toFixed(2), 's')
        console.log('   ✅ Timings perfectly synchronized!')
      }
    } else {
      console.log('\n⚠️ Step 4: Skipping sync (no animation plan or audio)')
    }

    // ==================== STEP 5: Setup Speech Callbacks ====================
    console.log('\n🎤 Step 5: Setting up speech callbacks...')

    audioManager.setSpeechCallbacks(
      // On speech start
      () => {
        console.log('▶️ SPEECH STARTED')
        if (animationManager) {
          animationManager.startSpeakingAnimation()
        }
      },
      // On speech end
      () => {
        console.log('⏹️ SPEECH ENDED')
        if (animationManager) {
          animationManager.stopSpeakingAnimation()
        }
      }
    )

    // ==================== STEP 6: Play Audio + Animations ====================
    console.log('\n🎭 Step 6: Playing audio and animations...')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const playbackStart = performance.now()

    // Setup mouth sync BEFORE playing
    audioManager.setupMouthSync(audioElement, vrm)

    // Start BOTH at the same time
    const audioPromise = audioManager.playAudioBlob(audioBlob, audioElement)

    const animationPromise = animationManager && animationPlan.length > 0
      ? animationManager.playAnimationSequence(animationPlan)
      : Promise.resolve()

    // Wait for BOTH to complete
    await Promise.all([audioPromise, animationPromise])

    const playbackDuration = ((performance.now() - playbackStart) / 1000).toFixed(2)

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ PLAYBACK COMPLETE')
    console.log(`   Total duration: ${playbackDuration}s`)
    console.log(`   Audio played: ${audioDuration.toFixed(2)}s`)
    console.log(`   Animations: ${animationPlan.length} steps`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    return aiResponse

  } catch (error) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('❌ MESSAGE PROCESSING ERROR')
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error(error)

    // Ensure animations stop on error
    if (animationManager) {
      animationManager.stopSpeakingAnimation()
      animationManager.isPlayingSequence = false
    }

    throw error
  }
}

// ==================== ADVANCED ANIMATION SYNCHRONIZATION ====================

export function optimizeAnimationTiming(animationPlan, audioDuration, options = {}) {
  const {
    minStepDuration = 200,
    maxStepDuration = 3000,
    bufferTime = 100,
    distributeEvenly = true
  } = options

  if (!animationPlan || animationPlan.length === 0 || audioDuration <= 0) {
    return animationPlan
  }

  const audioMs = audioDuration * 1000 - bufferTime
  const totalOriginalDuration = animationPlan.reduce((sum, step) => sum + step.duration, 0)

  if (totalOriginalDuration === 0) {
    // No durations set, distribute evenly
    const evenDuration = Math.max(
      minStepDuration,
      Math.min(maxStepDuration, audioMs / animationPlan.length)
    )

    animationPlan.forEach(step => {
      step.duration = evenDuration
    })

    return animationPlan
  }

  if (distributeEvenly) {
    // Scale each step proportionally
    const scale = audioMs / totalOriginalDuration

    animationPlan.forEach(step => {
      step.duration = Math.max(
        minStepDuration,
        Math.min(maxStepDuration, Math.round(step.duration * scale))
      )
    })
  } else {
    // Keep relative timing but fit within audio duration
    const newDurations = animationPlan.map(step => {
      const proportion = step.duration / totalOriginalDuration
      return Math.max(
        minStepDuration,
        Math.min(maxStepDuration, Math.round(audioMs * proportion))
      )
    })

    animationPlan.forEach((step, index) => {
      step.duration = newDurations[index]
    })
  }

  return animationPlan
}

// ==================== ANIMATION QUALITY ENHANCER ====================

export function enhanceAnimationPlan(plan, options = {}) {
  const {
    addTransitions = true,
    intensityBoost = 1.0,
    addVariation = true
  } = options

  if (!plan || plan.length === 0) return plan

  const enhanced = plan.map((step, index) => {
    const enhancedStep = { ...step }

    // Boost intensity for more visible animations
    if (enhancedStep.intensity) {
      enhancedStep.intensity = Math.min(enhancedStep.intensity * intensityBoost, 1.0)
    }

    // Add variation to prevent repetition
    if (addVariation && index > 0) {
      const prevStep = plan[index - 1]

      // If same expression/gesture, slightly vary intensity
      if (prevStep.expression === enhancedStep.expression && enhancedStep.intensity) {
        enhancedStep.intensity = Math.min(
          enhancedStep.intensity + (Math.random() * 0.15 - 0.075),
          1.0
        )
      }
    }

    // Ensure minimum duration for visibility
    if (enhancedStep.duration < 300) {
      enhancedStep.duration = 300
    }

    return enhancedStep
  })

  // Add smooth transitions between major expression changes
  if (addTransitions && enhanced.length > 1) {
    const withTransitions = []

    for (let i = 0; i < enhanced.length; i++) {
      withTransitions.push(enhanced[i])

      // Add transition step between different expressions
      if (i < enhanced.length - 1) {
        const current = enhanced[i]
        const next = enhanced[i + 1]

        if (current.expression !== next.expression &&
            current.expression !== 'neutral' &&
            next.expression !== 'neutral') {
          withTransitions.push({
            text: '',
            expression: 'neutral',
            headMotion: 'none',
            gesture: 'none',
            duration: 150,
            intensity: 0.3
          })
        }
      }
    }

    return withTransitions
  }

  return enhanced
}

// ==================== PERFORMANCE MONITORING ====================

export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      aiResponseTime: [],
      ttsGenerationTime: [],
      animationPlanTime: [],
      totalProcessingTime: [],
      audioPlaybackTime: [],
      animationPlaybackTime: []
    }
  }

  recordMetric(metricName, value) {
    if (this.metrics[metricName]) {
      this.metrics[metricName].push(value)

      // Keep only last 20 measurements
      if (this.metrics[metricName].length > 20) {
        this.metrics[metricName].shift()
      }
    }
  }

  getAverage(metricName) {
    const values = this.metrics[metricName]
    if (!values || values.length === 0) return 0

    const sum = values.reduce((a, b) => a + b, 0)
    return sum / values.length
  }

  getStats(metricName) {
    const values = this.metrics[metricName]
    if (!values || values.length === 0) {
      return { min: 0, max: 0, avg: 0, count: 0 }
    }

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: this.getAverage(metricName),
      count: values.length
    }
  }

  printReport() {
    console.log('\n📊 PERFORMANCE REPORT')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    Object.keys(this.metrics).forEach(metric => {
      const stats = this.getStats(metric)
      if (stats.count > 0) {
        console.log(`${metric}:`)
        console.log(`  Avg: ${stats.avg.toFixed(2)}ms`)
        console.log(`  Min: ${stats.min.toFixed(2)}ms`)
        console.log(`  Max: ${stats.max.toFixed(2)}ms`)
        console.log(`  Count: ${stats.count}`)
      }
    })

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  }

  reset() {
    Object.keys(this.metrics).forEach(key => {
      this.metrics[key] = []
    })
  }
}

// ==================== TEXT PROCESSING HELPERS ====================

export function splitTextIntoSegments(text, maxLength = 100) {
  if (!text || text.length <= maxLength) {
    return [text]
  }

  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  const segments = []
  let currentSegment = ''

  sentences.forEach(sentence => {
    if ((currentSegment + sentence).length <= maxLength) {
      currentSegment += sentence
    } else {
      if (currentSegment) {
        segments.push(currentSegment.trim())
      }
      currentSegment = sentence
    }
  })

  if (currentSegment) {
    segments.push(currentSegment.trim())
  }

  return segments
}

export function estimateSpeechDuration(text, wordsPerMinute = 150) {
  const words = text.split(/\s+/).length
  return (words / wordsPerMinute) * 60 // seconds
}

// ==================== DEBUG HELPERS ====================

export function logAnimationPlan(plan, title = 'Animation Plan') {
  console.log(`\n📋 ${title}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  plan.forEach((step, index) => {
    console.log(`Step ${index + 1}:`)
    console.log(`  Text: "${step.text?.substring(0, 40)}..."`)
    console.log(`  Expression: ${step.expression}`)
    console.log(`  Head: ${step.headMotion}`)
    console.log(`  Gesture: ${step.gesture}`)
    console.log(`  Duration: ${step.duration}ms`)
    console.log(`  Intensity: ${step.intensity}`)
    console.log('')
  })

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

export function createDebugOverlay() {
  const overlay = document.createElement('div')
  overlay.id = 'vrm-debug-overlay'
  overlay.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: #0f0;
    font-family: monospace;
    font-size: 12px;
    padding: 10px;
    border-radius: 5px;
    z-index: 10000;
    max-width: 300px;
    backdrop-filter: blur(10px);
  `

  document.body.appendChild(overlay)

  return {
    update: (data) => {
      overlay.innerHTML = Object.entries(data)
        .map(([key, value]) => `${key}: <span style="color: #fff">${value}</span>`)
        .join('<br>')
    },
    remove: () => overlay.remove()
  }
}
