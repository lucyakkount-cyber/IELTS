// managers/aiClient.js
import { GoogleGenAI } from '@google/genai'

const WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      this.port.postMessage(new Float32Array(input[0]));
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`

export class AIClient {
  constructor(apiKey, model) {
    this.client = new GoogleGenAI({ apiKey: apiKey })
    this.liveModel = model
    this.activeSession = null
    this.audioContext = null
    this.workletNode = null
    this.mediaStream = null
    this.isRecording = false
    this.inputBuffer = new Int16Array(4096)
    this.inputBufferIndex = 0
    this.isDisconnecting = false
    this.lastResumptionHandle = null
    this.isSessionOpen = false

    // 🔄 Reconnection Logic
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 3
    this.connectionStableTimer = null
  }

  // History methods removed
  // setHistory(history) {}
  // getHistory() {}
  // addToHistory(role, text) {}

  async connectLive(
    systemPrompt = '',
    onAudioData,
    onAnimationTrigger,
    onExpressionTrigger,
    onVisionTrigger,
    onScreenTrigger,
    onDisconnect,
    availableAnimations = [],
    onUserNameSet,
    onMemorySaved,
    onMemoryDeleted,
    onHistoryChange,
    onSystemMessage,
  ) {
    if (this.activeSession) return

    console.log('🔌 Connecting to Gemini Live...')
    this.isDisconnecting = false
    this.isReconnecting = false

    try {
      this.connectionArgs = {
        systemPrompt,
        onAudioData,
        onAnimationTrigger,
        onExpressionTrigger,
        onVisionTrigger,
        onScreenTrigger,
        onDisconnect,
        availableAnimations,
        onUserNameSet,
        onMemorySaved,
        onMemoryDeleted,
        onHistoryChange,
        onSystemMessage,
      }

      await this._establishConnection()
    } catch (e) {
      console.error('🔥 Connection Failed:', e)
      this.disconnect('Initial connection failed')
      onSystemMessage?.('Connection Failed', e.message, 'error')
    }
  }

  async _establishConnection() {
    if (this.isDisconnecting) return

    const {
      systemPrompt,
      onAudioData,
      onAnimationTrigger,
      onExpressionTrigger,
      onVisionTrigger,
      onScreenTrigger,
      onUserNameSet,
      onMemorySaved,
      onMemoryDeleted,
      onSystemMessage,
    } = this.connectionArgs

    const animString =
      this.connectionArgs.availableAnimations.length > 0
        ? this.connectionArgs.availableAnimations.join(', ')
        : 'wave, clap, dance, backflip'

    const tools = this._getTools(animString)

    const config = {
      responseModalities: ['AUDIO'],
      tools: tools,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
      },
    }

    console.log('🔌 Starting New Session...')

    // 1️⃣ Connect
    this.activeSession = await this.client.live.connect({
      model: this.liveModel,
      config,
      callbacks: {
        onopen: () => {
          console.log('✅ Live Session Started')
          this.isSessionOpen = true

          // 🔔 Notify User
          if (this.isReconnecting) {
            onSystemMessage?.('Reconnected', 'Started new session', 'success')
            this.isReconnecting = false
          } else {
            onSystemMessage?.('Connected', 'Live session started', 'success')
          }

          this.startMicrophone()
        },
        onmessage: (msg) => {
          if (msg.serverContent?.modelTurn?.parts) {
            for (const part of msg.serverContent.modelTurn.parts) {
              if (part.inlineData?.data) {
                const binaryString = atob(part.inlineData.data)
                const bytes = new Uint8Array(binaryString.length)
                for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)
                onAudioData?.(new Int16Array(bytes.buffer))
              }
              if (part.functionCall)
                this._executeFunction(
                  part.functionCall,
                  onAnimationTrigger,
                  onExpressionTrigger,
                  onVisionTrigger,
                  onScreenTrigger,
                  onUserNameSet,
                  onMemorySaved,
                  onMemoryDeleted,
                )
            }
          }
          if (msg.toolCall)
            this._handleToolCall(
              msg.toolCall,
              onAnimationTrigger,
              onExpressionTrigger,
              onVisionTrigger,
              onScreenTrigger,
              onUserNameSet,
              onMemorySaved,
              onMemoryDeleted,
              onSystemMessage,
            )
        },
        onclose: (e) => {
          console.log('❌ Connection Closed', e)
          this.isSessionOpen = false
          this.activeSession = null

          if (this.isDisconnecting) return

          const reason = e.reason || 'Connection lost'
          console.log(`🔄 Re-establishing immediately: ${reason}`)
          onSystemMessage?.('Reconnecting', 'Establishing new session...', 'warning')

          // ⚡ IMMEDIATE NEW CONNECTION
          this.lastResumptionHandle = null
          this.isReconnecting = true
          this._establishConnection()
        },
        onerror: (e) => {
          console.error('🔥 Live Error:', e)
        },
      },
    })

    // 2️⃣ Resend Pending Message - REMOVED
  }

  // ... (Tool Handling Code: _handleToolCall, _executeFunction, _sendToolResponse - KEEP THESE AS IS)
  _handleToolCall(
    toolCall,
    onAnimationTrigger,
    onExpressionTrigger,
    onVisionTrigger,
    onScreenTrigger,
    onUserNameSet,
    onMemorySaved,
    onMemoryDeleted,
    onSystemMessage,
  ) {
    if (!toolCall.functionCalls) return
    for (const fc of toolCall.functionCalls)
      this._executeFunction(
        fc,
        onAnimationTrigger,
        onExpressionTrigger,
        onVisionTrigger,
        onScreenTrigger,
        onUserNameSet,
        onMemorySaved,
        onMemoryDeleted,
        onSystemMessage,
      )
  }

  _executeFunction(
    fc,
    onAnimationTrigger,
    onExpressionTrigger,
    onVisionTrigger,
    onScreenTrigger,
    onUserNameSet,
    onMemorySaved,
    onMemoryDeleted,
  ) {
    const { id, name, args } = fc
    console.log(`🎯 Function: ${name}`, args)

    if (name === 'set_user_name') {
      onUserNameSet?.(args.name)
      this._sendToolResponse(id, name, { result: 'ok' })
      return
    }
    if (name === 'save_memory') {
      onMemorySaved?.(args.key, args.value)
      this._sendToolResponse(id, name, { result: 'ok' })
      return
    }
    if (name === 'delete_memory') {
      onMemoryDeleted?.(args.key)
      this._sendToolResponse(id, name, { result: 'ok' })
      return
    }

    if (name === 'look_at_user') {
      onVisionTrigger?.().then((res) => {
        if (typeof res === 'string') this._sendRealtimeImage(res)
        this._sendToolResponse(id, name, {
          result: typeof res === 'string' ? 'Image sent' : 'Stream started',
        })
      })
      return
    }
    if (name === 'look_at_screen') {
      onScreenTrigger?.().then((res) => {
        if (typeof res === 'string') this._sendRealtimeImage(res)
        this._sendToolResponse(id, name, {
          result: typeof res === 'string' ? 'Screen sent' : 'Screen stream started',
        })
      })
      return
    }

    setTimeout(() => {
      if (name === 'trigger_animation') onAnimationTrigger?.(args.animation_name)
      if (name === 'set_expression') onExpressionTrigger?.(args.expression, args.duration || 2.0)
    }, 2400)
    this._sendToolResponse(id, name, { status: 'queued' })
  }

  async _sendToolResponse(id, name, response) {
    if (!this.activeSession) return
    try {
      await this.activeSession.sendToolResponse({
        functionResponses: [{ id, name, response: { result: response } }],
      })
    } catch (e) {}
  }

  async _sendRealtimeImage(base64Image) {
    if (!this.activeSession || !this.isSessionOpen) return
    try {
      await this.activeSession.sendRealtimeInput({
        media: { mimeType: 'image/jpeg', data: base64Image },
      })
    } catch (e) {
      console.error('Image send failed', e)
    }
  }

  // 🛡️ SAFE MICROPHONE START
  async startMicrophone() {
    if (this.isRecording) return
    try {
      try {
        this.recognition?.start()
      } catch (e) {}

      if (!this.audioContext) this.audioContext = new AudioContext({ sampleRate: 16000 })
      if (this.audioContext.state === 'suspended') await this.audioContext.resume().catch(() => {})

      // 🛡️ Check if disconnected during await
      if (!this.audioContext || this.isDisconnecting) return

      if (!this.mediaStream || !this.mediaStream.active) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, sampleRate: 16000 },
        })
      }

      if (!this.audioContext || this.isDisconnecting) return // 🛡️ Double Check

      if (!this.workletNode) {
        const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' })
        const blobUrl = URL.createObjectURL(blob)
        await this.audioContext.audioWorklet.addModule(blobUrl)

        // 🛡️ Triple Check (Worklet loading is async)
        if (!this.audioContext || this.isDisconnecting) return

        const source = this.audioContext.createMediaStreamSource(this.mediaStream)
        this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor')
        this.workletNode.port.onmessage = (e) => {
          if (this.isRecording) this._processAudioChunk(e.data)
        }
        source.connect(this.workletNode)
      }
      this.isRecording = true
    } catch (e) {
      console.error('Mic Error:', e)
    }
  }

  stopMicrophone() {
    this.isRecording = false
    this.recognition?.stop()
    this.mediaStream?.getTracks().forEach((t) => t.stop())
    this.mediaStream = null
    this.workletNode?.disconnect()
    this.workletNode = null
    this.audioContext?.close()
    this.audioContext = null
    this.inputBufferIndex = 0
  }

  _processAudioChunk(float32Data) {
    if (!this.activeSession || this.isDisconnecting) return
    for (let i = 0; i < float32Data.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Data[i]))
      this.inputBuffer[this.inputBufferIndex++] = s < 0 ? s * 0x8000 : s * 0x7fff
      if (this.inputBufferIndex === this.inputBuffer.length) this._flushInputBuffer()
    }
  }

  _flushInputBuffer() {
    if (!this.activeSession || this.isDisconnecting || !this.isSessionOpen) return
    const base64 = btoa(String.fromCharCode(...new Uint8Array(this.inputBuffer.buffer)))
    this._sendToGemini(base64)
    this.inputBufferIndex = 0
  }

  async _sendToGemini(base64Audio) {
    if (!this.activeSession || !this.isSessionOpen) return
    try {
      await this.activeSession.sendRealtimeInput({
        media: { mimeType: 'audio/pcm;rate=16000', data: base64Audio },
      })
    } catch (e) {
      if (!e.message.includes('closed')) console.error('Audio Send Error:', e)
    }
  }

  // 📝 UPDATED: Send Text (Safe & Optional History)
  async sendRealtimeText(text, saveToHistory = true) {
    if (!this.activeSession) return false
    try {
      // if (saveToHistory) this.addToHistory('user', text) // Removed
      await this.activeSession.sendRealtimeInput({ text: text })
      await this.activeSession.sendRealtimeInput({ audioStreamEnd: true }) // 👈 Signal VAD end
      return true
    } catch (e) {
      console.error('Send Text Error:', e)
      return false
    }
  }

  disconnect(reason = 'User disconnected') {
    if ((!this.activeSession && !this.isRecording) || this.isDisconnecting) return
    this.isDisconnecting = true
    console.log(`🔌 Disconnecting: ${reason}`)

    if (this.connectionStableTimer) clearTimeout(this.connectionStableTimer)
    this.lastResumptionHandle = null
    this.reconnectAttempts = 0
    this.isSessionOpen = false
    this.stopMicrophone()

    if (this.activeSession) {
      try {
        this.activeSession.close()
      } catch (e) {}
      this.activeSession = null
    }
    this.onDisconnectCallback?.(reason)
    this.onDisconnectCallback = null
  }

  // Legacy (Keep as is)
  async chatWithNativeAudio(message, systemPrompt) {
    /* ... same as before ... */
  }

  // 🛠️ TOOLS DEFINITION (Crucial)
  _getTools(animString) {
    return [
      {
        functionDeclarations: [
          {
            name: 'trigger_animation',
            description: 'Triggers a body movement.',
            parameters: {
              type: 'OBJECT',
              properties: {
                animation_name: { type: 'STRING', description: `Available: ${animString}` },
              },
              required: ['animation_name'],
            },
          },
          {
            name: 'set_expression',
            description: 'Sets facial expression.',
            parameters: {
              type: 'OBJECT',
              properties: {
                expression: {
                  type: 'STRING',
                  description: 'happy, sad, angry, surprised, excited, thinking, smug',
                },
                duration: { type: 'NUMBER' },
              },
              required: ['expression'],
            },
          },
          {
            name: 'look_at_user',
            description: 'See the user via camera.',
            parameters: { type: 'OBJECT', properties: {} },
          },
          {
            name: 'look_at_screen',
            description: 'See the user screen.',
            parameters: { type: 'OBJECT', properties: {} },
          },
          {
            name: 'set_user_name',
            description: 'Save user name.',
            parameters: {
              type: 'OBJECT',
              properties: { name: { type: 'STRING' } },
              required: ['name'],
            },
          },
          {
            name: 'save_memory',
            description: 'Save a fact.',
            parameters: {
              type: 'OBJECT',
              properties: { key: { type: 'STRING' }, value: { type: 'STRING' } },
              required: ['key', 'value'],
            },
          },
          {
            name: 'delete_memory',
            description: 'Delete a fact.',
            parameters: {
              type: 'OBJECT',
              properties: { key: { type: 'STRING' } },
              required: ['key'],
            },
          },
        ],
      },
    ]
  }
}
