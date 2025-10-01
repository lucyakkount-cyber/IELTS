// utils.js - Essential utility functions for the VRM chat system
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

  // Timing utilities
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

  // Audio analysis utilities
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

  // File handling utilities
  static async readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }

  // Random utilities
  static randomFloat(min, max) {
    return Math.random() * (max - min) + min
  }

  static randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)]
  }

  // Browser feature detection
  static getFeatureSupport() {
    return {
      webAudio: !!(window.AudioContext || window.webkitAudioContext),
      speechRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
      webGL: !!window.WebGLRenderingContext,
      fileAPI: !!(window.File && window.FileReader && window.FileList && window.Blob),
      dragAndDrop: 'draggable' in document.createElement('div')
    }
  }

  // Error handling
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

  // Animation state utilities
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

// Add this PARALLEL PROCESSING function at the end
// Replace processMessageOptimized in your managers/utils.js

export async function processMessageOptimized(message, aiClient, audioManager, animationManager, vrm, config, audioElement) {
  try {
    console.log('Processing message:', message)

    // STEP 1: Get AI response
    console.log('Getting AI response...')
    const aiResponse = await aiClient.chatWithAI(message, config.getSystemPrompt())
    console.log('AI response received:', aiResponse.substring(0, 50) + '...')

    // STEP 2: Generate TTS and Animation Plan in PARALLEL
    console.log('Starting parallel: TTS + Animation Plan')

    const [audioBlob, animationPlan] = await Promise.all([
      audioManager.generateTTS(aiResponse, config.config).catch(err => {
        console.error('TTS failed:', err)
        return null
      }),

      aiClient.generateAnimationPlan(aiResponse).catch(err => {
        console.error('Animation plan failed:', err)
        return []
      })
    ])

    console.log('Parallel processing complete')
    console.log('Audio blob:', audioBlob ? 'Ready' : 'Failed')
    console.log('Animation plan:', animationPlan.length, 'steps')

    if (!audioBlob) {
      console.warn('No audio generated, skipping mouth sync')
      return aiResponse
    }

    // STEP 3: Get audio duration FIRST (before playing)
    const audioDuration = await new Promise((resolve) => {
      const tempAudio = new Audio()
      tempAudio.src = URL.createObjectURL(audioBlob)
      tempAudio.onloadedmetadata = () => {
        resolve(tempAudio.duration)
        URL.revokeObjectURL(tempAudio.src)
      }
      tempAudio.onerror = () => resolve(0)
    })

    console.log('Audio duration:', audioDuration, 'seconds')

    // STEP 4: Scale animation timings to match audio BEFORE playing
    if (animationPlan.length > 0 && audioDuration > 0) {
      const totalPlanDuration = animationPlan.reduce((sum, step) => sum + step.duration, 0)

      if (totalPlanDuration > 0) {
        const scale = (audioDuration * 1000) / totalPlanDuration
        animationPlan.forEach(step => {
          step.duration = Math.round(step.duration * scale)
        })
        console.log('Animation timings scaled by', scale.toFixed(2))
        console.log('Scaled durations:', animationPlan.map(s => s.duration))
      }
    }

    // STEP 5: Start BOTH audio and animations at the SAME time
    console.log('Starting audio and animations together...')

    const audioPromise = audioManager.playAudioBlob(audioBlob, audioElement)
    audioManager.setupMouthSync(audioElement, vrm)

    const animationPromise = animationManager && animationPlan.length > 0
      ? animationManager.playAnimationSequence(animationPlan)
      : Promise.resolve()

    // Wait for BOTH to complete
    await Promise.all([audioPromise, animationPromise])

    console.log('Message processing complete')
    return aiResponse

  } catch (error) {
    console.error('Message processing error:', error)
    throw error
  }
}
