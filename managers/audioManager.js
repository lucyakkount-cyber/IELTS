// managers/audioManager.js - ENHANCED with Perfect Mouth Sync
import axios from 'axios'

export class AudioManager {
  constructor() {
    this.audioCtx = null
    this.analyser = null
    this.sourceNode = null
    this.mouthRaf = null
    this.isInitialized = false
    this.currentAudio = null
    this.onSpeechStart = null
    this.onSpeechEnd = null
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
        console.log('🔊 Audio context resumed')
      } catch (error) {
        console.error('Audio context resume failed:', error)
      }
    }
  }

  async generateTTS(text, config) {
    try {
      const ttsUrl = 'https://furnishings-durable-sessions-tenant.trycloudflare.com/tts' // FIXED: removed spaces
      const payload = {
        text,
        ref_audio_path: config.sovits_ping_config?.ref_audio_path,
        text_lang: config.sovits_ping_config?.text_lang || 'en',
        prompt_text: config.sovits_ping_config?.prompt_text || '',
        prompt_lang: config.sovits_ping_config?.prompt_lang || 'en',
        media_type: 'wav',
        streaming_mode: false,
      }

      console.log('🎙️ Generating TTS for:', text.substring(0, 50) + '...')

      const response = await axios.post(ttsUrl, payload, {
        responseType: 'arraybuffer',
        headers: { 'Content-Type': 'application/json' },
        timeout: 150000,
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
      // Stop any current audio
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

      // Wait for metadata
      await new Promise((resolve, reject) => {
        audioElement.onloadedmetadata = resolve
        audioElement.onerror = reject
        setTimeout(() => reject(new Error('Audio load timeout')), 1500000)
      })

      // Notify speech start
      if (this.onSpeechStart) {
        this.onSpeechStart()
      }

      // Play audio
      await audioElement.play()
      console.log('▶️ Playing audio, duration:', audioElement.duration.toFixed(2), 's')

      // Wait for audio to end
      await new Promise((resolve) => {
        audioElement.onended = resolve
      })

      // Notify speech end
      if (this.onSpeechEnd) {
        this.onSpeechEnd()
      }

      // Cleanup
      URL.revokeObjectURL(url)

      return audioElement.duration
    } catch (error) {
      console.error('❌ Audio play failed:', error)
      if (this.onSpeechEnd) {
        this.onSpeechEnd()
      }
      return 0
    }
  }

  // ENHANCED mouth sync with better lip movement
  setupMouthSync(audioElement, vrm) {
    if (!vrm?.expressionManager || !this.audioCtx || !audioElement) {
      console.warn('Cannot setup mouth sync: missing dependencies')
      return
    }

    if (this.mouthRaf) {
      cancelAnimationFrame(this.mouthRaf)
    }

    // Create audio source if needed
    if (!this.sourceNode) {
      try {
        this.sourceNode = this.audioCtx.createMediaElementSource(audioElement)
      } catch (error) {
        console.warn('Audio source already exists or failed to create')
        return
      }
    }

    // Disconnect and recreate analyser for fresh analysis
    if (this.analyser) {
      try {
        this.analyser.disconnect()
      } catch (e) {
        // Ignore
      }
    }

    this.analyser = this.audioCtx.createAnalyser()
    this.analyser.fftSize = 2048
    this.analyser.smoothingTimeConstant = 0.25 // Less smoothing for more responsive mouth

    const bufferLength = this.analyser.fftSize
    const dataArray = new Uint8Array(bufferLength)
    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount)

    // Connect audio graph
    try {
      this.sourceNode.disconnect()
    } catch {
      // Ignore
    }

    this.sourceNode.connect(this.analyser)
    this.analyser.connect(this.audioCtx.destination)

    let prevEnergy = 0
    let prevHighFreq = 0
    let prevMidFreq = 0

    const tick = () => {
      if (audioElement.paused || audioElement.ended) {
        this.resetMouth(vrm)
        this.mouthRaf = null
        return
      }

      // Get audio data
      this.analyser.getByteTimeDomainData(dataArray)
      this.analyser.getByteFrequencyData(frequencyData)

      // Calculate RMS (volume/energy)
      let sumSquares = 0
      for (let i = 0; i < bufferLength; i++) {
        const val = (dataArray[i] - 128) / 128
        sumSquares += val * val
      }
      const rms = Math.sqrt(sumSquares / bufferLength)

      // Analyze frequency bands for better lip sync
      // Low frequencies (vowels): 0-30%
      let lowFreqSum = 0
      const lowEnd = Math.floor(frequencyData.length * 0.3)
      for (let i = 0; i < lowEnd; i++) {
        lowFreqSum += frequencyData[i]
      }
      const lowFreq = lowFreqSum / lowEnd / 255

      // Mid frequencies (consonants): 30-70%
      let midFreqSum = 0
      const midStart = lowEnd
      const midEnd = Math.floor(frequencyData.length * 0.7)
      for (let i = midStart; i < midEnd; i++) {
        midFreqSum += frequencyData[i]
      }
      const midFreq = midFreqSum / (midEnd - midStart) / 255

      // High frequencies (sibilants): 70-100%
      let highFreqSum = 0
      for (let i = midEnd; i < frequencyData.length; i++) {
        highFreqSum += frequencyData[i]
      }
      const highFreq = highFreqSum / (frequencyData.length - midEnd) / 255

      // Smooth transitions
      const smoothed = prevEnergy * 0.6 + rms * 0.4
      const smoothedHigh = prevHighFreq * 0.7 + highFreq * 0.3
      const smoothedMid = prevMidFreq * 0.7 + midFreq * 0.3
      const smoothedLow = lowFreq

      prevEnergy = smoothed
      prevHighFreq = smoothedHigh
      prevMidFreq = smoothedMid

      // Calculate mouth shapes based on frequencies
      // 'aa' - open mouth (low frequencies, vowels)
      const mouthOpen = Math.min(Math.max(smoothed * 6 * (1 + smoothedLow * 0.8), 0), 0.7)

      // 'ee' - wide mouth (mid-high frequencies)
      const mouthWide = Math.min((smoothedMid + smoothedHigh) * 1.5, 0.6)

      // 'oh' - rounded mouth (low-mid frequencies)
      const mouthRound = Math.min(smoothedLow * smoothed * 8, 0.5)

      // 'smile' - slight smile during speech
      const mouthSmile = Math.min(smoothedHigh * 1.2, 0.35)

      // Get current values
      const curAA = vrm.expressionManager.getValue('aa') || 0
      const curEE = vrm.expressionManager.getValue('ee') || 0
      const curOH = vrm.expressionManager.getValue('oh') || 0
      const curSmile = vrm.expressionManager.getValue('happy') || 0

      // Smooth interpolation for natural movement
      vrm.expressionManager.setValue('aa', curAA + (mouthOpen - curAA) * 0.35)
      vrm.expressionManager.setValue('ee', curEE + (mouthWide - curEE) * 0.3)
      vrm.expressionManager.setValue('oh', curOH + (mouthRound - curOH) * 0.25)
      vrm.expressionManager.setValue('happy', curSmile + (mouthSmile - curSmile) * 0.15)

      vrm.expressionManager.update()

      this.mouthRaf = requestAnimationFrame(tick)
    }

    console.log('👄 Mouth sync started')
    tick()
  }

  resetMouth(vrm) {
    if (!vrm?.expressionManager) return

    console.log('👄 Resetting mouth')

    const resetAnim = () => {
      const aa = vrm.expressionManager.getValue('aa') || 0
      const ee = vrm.expressionManager.getValue('ee') || 0
      const oh = vrm.expressionManager.getValue('oh') || 0
      const smile = vrm.expressionManager.getValue('happy') || 0

      if (aa > 0.01 || ee > 0.01 || oh > 0.01 || smile > 0.01) {
        vrm.expressionManager.setValue('aa', Math.max(aa * 0.8, 0))
        vrm.expressionManager.setValue('ee', Math.max(ee * 0.8, 0))
        vrm.expressionManager.setValue('oh', Math.max(oh * 0.8, 0))
        vrm.expressionManager.setValue('happy', Math.max(smile * 0.85, 0))
        vrm.expressionManager.update()
        requestAnimationFrame(resetAnim)
      } else {
        // Ensure complete reset
        vrm.expressionManager.setValue('aa', 0)
        vrm.expressionManager.setValue('ee', 0)
        vrm.expressionManager.setValue('oh', 0)
        vrm.expressionManager.setValue('happy', 0)
        vrm.expressionManager.update()
      }
    }
    resetAnim()
  }

  // Set callbacks for speech events
  setSpeechCallbacks(onStart, onEnd) {
    this.onSpeechStart = onStart
    this.onSpeechEnd = onEnd
  }

  cleanup() {
    console.log('🧹 Cleaning up AudioManager...')

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

    this.onSpeechStart = null
    this.onSpeechEnd = null

    console.log('✅ AudioManager cleanup complete')
  }
}
