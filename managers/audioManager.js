// audioManager.js - Enhanced with fixes
import axios from 'axios'

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
      console.log('AudioManager initialized')
    } catch (error) {
      console.error('AudioManager init failed:', error)
    }
  }

  async resumeContext() {
    if (this.audioCtx && this.audioCtx.state !== 'running') {
      try {
        await this.audioCtx.resume()
      } catch (error) {
        console.error('Audio context resume failed:', error)
      }
    }
  }

  async generateTTS(text, config) {
    try {
      const ttsUrl = 'https://a36a9fe4f0cd.ngrok-free.app/tts' // FIXED: removed space
      const payload = {
        text,
        ref_audio_path: config.sovits_ping_config?.ref_audio_path,
        text_lang: config.sovits_ping_config?.text_lang || 'en',
        prompt_text: config.sovits_ping_config?.prompt_text || '',
        prompt_lang: config.sovits_ping_config?.prompt_lang || 'en',
        media_type: 'wav',
        streaming_mode: false,
      }

      console.log('Generating TTS...')
      const response = await axios.post(ttsUrl, payload, {
        responseType: 'arraybuffer',
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      })

      const blob = new Blob([response.data], { type: 'audio/wav' })
      console.log('TTS generated:', blob.size, 'bytes')
      return blob
    } catch (error) {
      console.error('TTS generation error:', error)
      return null
    }
  }

  async playAudioBlob(blob, audioElement) {
    if (!blob || !audioElement) return 0

    try {
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

      await new Promise((resolve, reject) => {
        audioElement.onloadedmetadata = resolve
        audioElement.onerror = reject
        setTimeout(() => reject(new Error('Audio load timeout')), 5000)
      })

      await audioElement.play()
      console.log('Playing audio, duration:', audioElement.duration, 's')

      return audioElement.duration
    } catch (error) {
      console.error('Audio play failed:', error)
      return 0
    }
  }

  setupMouthSync(audioElement, vrm) {
    if (!vrm?.expressionManager || !this.audioCtx || !audioElement) return

    if (this.mouthRaf) {
      cancelAnimationFrame(this.mouthRaf)
    }

    if (!this.sourceNode) {
      try {
        this.sourceNode = this.audioCtx.createMediaElementSource(audioElement)
      } catch (error) {
        console.warn('Audio source already exists')
        return
      }
    }

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
      // Ignore
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

      let sumSquares = 0
      for (let i = 0; i < bufferLength; i++) {
        const val = (dataArray[i] - 128) / 128
        sumSquares += val * val
      }
      const rms = Math.sqrt(sumSquares / bufferLength)

      let highFreqSum = 0
      const startIdx = Math.floor(frequencyData.length * 0.3)
      for (let i = startIdx; i < frequencyData.length; i++) {
        highFreqSum += frequencyData[i]
      }
      const highFreq = highFreqSum / (frequencyData.length * 0.7) / 255

      const smoothed = prevEnergy * 0.7 + rms * 0.3
      const smoothedHigh = prevHighFreq * 0.8 + highFreq * 0.2
      prevEnergy = smoothed
      prevHighFreq = smoothedHigh

      const mouthOpen = Math.min(Math.max(smoothed * 10, 0), 1)
      const mouthWide = Math.min(smoothedHigh * 2.5, 1)
      const mouthSmile = Math.min(smoothedHigh * 1.8, 0.6)

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
