<template>
  <div class="relative w-full h-screen bg-[#0b0d12] overflow-hidden">
    <!-- VRM Canvas -->
    <canvas ref="canvasRef" class="absolute inset-0 w-full h-full"></canvas>

    <!-- Chat Composer -->
    <div class="absolute bottom-[30px] left-1/2 -translate-x-1/2 w-[calc(100%-40px)] max-w-[1000px]">
      <form
        class="bg-white dark:bg-gray-800 shadow-md rounded-2xl p-3 grid grid-cols-[auto_1fr_auto] gap-2"
        @submit.prevent="sendMessage"
      >
        <button
          type="button"
          class="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <PlusIcon class="w-6 h-6 text-gray-600 dark:text-gray-300" />
        </button>

        <textarea
          ref="textareaRef"
          v-model="userInput"
          rows="1"
          placeholder="Ask anything..."
          class="flex-1 resize-none overflow-hidden bg-transparent focus:outline-none px-2 py-1 text-gray-900 dark:text-gray-100"
          @input="autoResize"
          :disabled="isProcessing || !systemReady"
        ></textarea>

        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="toggleRecording"
            :disabled="!systemReady"
            class="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            :class="{ 'bg-red-500 text-white': isRecording }"
          >
            <MicrophoneIcon class="w-6 h-6" />
          </button>

          <button
            type="submit"
            :disabled="isProcessing || !systemReady || !userInput.trim()"
            class="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <PaperAirplaneIcon v-if="!isProcessing" class="w-5 h-5" />
            <div v-else class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </button>
        </div>
      </form>
    </div>

    <!-- Loading Overlay -->
    <div v-if="!systemReady" class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm z-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
        <div class="flex items-center space-x-3">
          <div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <div>
            <div class="font-semibold">Initializing VRM Chat System</div>
            <div class="text-sm text-gray-600 dark:text-gray-400">{{ systemStatus }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Debug Panel -->
    <div v-if="showDebug" class="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded text-xs backdrop-blur-md">
      <div class="mb-1 font-bold">Debug Info</div>
      <div>Status: <span :class="getStatusClass()">{{ systemStatus }}</span></div>
      <div>Ready: {{ systemReady ? 'Yes' : 'No' }}</div>
      <div>Expression: {{ currentExpression }}</div>
      <div>Gesture: {{ currentGesture }}</div>
      <div>Queue: {{ animationQueue.length }}</div>
      <div>Recording: {{ isRecording ? 'Yes' : 'No' }}</div>
      <div>Processing: {{ isProcessing ? 'Yes' : 'No' }}</div>
      <div>Config: {{ configLoaded ? 'Yes' : 'No' }}</div>
    </div>

    <audio ref="audioRef" class="hidden" controls></audio>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { PlusIcon, PaperAirplaneIcon, MicrophoneIcon } from '@heroicons/vue/24/solid'

// Import our modular managers
import { SceneManager } from '../managers/sceneManager.js'
import { VRMLoader } from '../managers/vrmLoader.js'
import { AnimationManager } from '../managers/animationManager.js'
import { AudioManager } from '../managers/audioManager.js'
import { SpeechManager } from '../managers/speechManager.js'
import { AIClient } from '../managers/aiClient.js'
import { ConfigManager } from '../managers/configManager.js'
import { Utils } from '../managers/utils.js'

// Reactive state
const canvasRef = ref(null)
const audioRef = ref(null)
const textareaRef = ref(null)
const userInput = ref('')
const showDebug = ref(true)
const currentExpression = ref('neutral')
const currentGesture = ref('none')
const animationQueue = ref([])
const isRecording = ref(false)
const isProcessing = ref(false)
const systemStatus = ref('Initializing...')
const configLoaded = ref(false)
const systemReady = ref(false)

// Manager instances
let sceneManager = null
let vrmLoader = null
let animationManager = null
let audioManager = null
let speechManager = null
let aiClient = null
let configManager = null
let vrm = null

onMounted(async () => {
  await initializeManagers()
})



async function initializeManagers() {
  try {
    console.log('🚀 Initializing VRM Chat System...')
    systemStatus.value = 'Loading configuration...'

    // Initialize configuration manager
    configManager = new ConfigManager()
    await configManager.loadConfig()
    configLoaded.value = configManager.isConfigLoaded()

    systemStatus.value = 'Initializing scene...'

    // Initialize scene manager
    sceneManager = new SceneManager(canvasRef.value)
    if (!sceneManager.initialize()) {
      throw new Error('Failed to initialize scene')
    }

    // Initialize VRM loader
    vrmLoader = new VRMLoader()

    systemStatus.value = 'Setting up audio...'

    // Initialize audio manager
    audioManager = new AudioManager()
    await audioManager.initialize()

    // Initialize speech manager
    speechManager = new SpeechManager()
    const speechInitialized = speechManager.initialize({
      lang: configManager.getSpeechRecognitionLang()
    })

    if (speechInitialized) {
      // Setup speech callbacks with reactive state updates
      speechManager.setOnResult(async (transcript) => {
        userInput.value = transcript
        await sendMessage()
      })

      speechManager.setOnError((error) => {
        console.error('Speech recognition error:', error)
        isRecording.value = false
      })

      speechManager.setOnEnd(() => {
        isRecording.value = false
      })
    }

    systemStatus.value = 'Setting up AI...'

    // Initialize AI client
    aiClient = new AIClient(configManager.getApiKey())

    systemStatus.value = 'Loading VRM model...'

    // Load VRM model
    await loadVRMModel()

    // Setup drag and drop
    setupDragAndDrop()

    // Start render loop
    sceneManager.startRenderLoop()

    systemStatus.value = 'Ready'
    systemReady.value = true
    console.log('✅ VRM Chat System initialized successfully!')

  } catch (error) {
    console.error('❌ Failed to initialize VRM Chat System:', error)
    systemStatus.value = `Error: ${error.message}`
    systemReady.value = false
  }
}

// Replace the loadVRMModel function in your App.vue with this:

async function loadVRMModel() {
  try {
    const vrmConfig = configManager.getVRMConfig()
    vrm = await vrmLoader.loadVRMFromPath(vrmConfig.model_path)

    // Add VRM to scene
    sceneManager.addToScene(vrm.scene)

    // Initialize animation manager
    animationManager = new AnimationManager(vrm)

    // Load default animations (gestures only, no idle FBX)
    const animations = await vrmLoader.loadDefaultAnimations(vrm)

    // Set gesture animations if loaded
    Object.entries(animations).forEach(([name, animation]) => {
      if (name !== 'idle') {
        animationManager.setGestureAnimation(name, animation)
      }
    })

    // CRITICAL: Start natural idle animations (wiggling, breathing, etc.)
    animationManager.startNaturalIdle()

    // Add animation update to render loop
    sceneManager.addUpdateCallback((delta) => {
      vrm?.update(delta)
      animationManager?.update(delta)
    })

    console.log('VRM model loaded and natural animations started')

  } catch (error) {
    console.error('Failed to load VRM model:', error)
    systemStatus.value = `Error loading VRM: ${error.message}`
    systemReady.value = false
  }
}

function setupDragAndDrop() {
  sceneManager.setupDragAndDrop(async (file) => {
    await handleVRMFileDrop(file)
  })
}

async function handleVRMFileDrop(file) {
  try {
    console.log('🔄 Loading new VRM model from file...')
    systemStatus.value = 'Loading new VRM...'
    systemReady.value = false

    // Small delay for UI update
    await Utils.delay(100)

    // Clean up old VRM
    if (vrm) {
      sceneManager.removeFromScene(vrm.scene)
      vrmLoader.cleanupVRM(vrm)
    }

    // Load new VRM
    vrm = await vrmLoader.loadVRMFromFile(file)
    sceneManager.addToScene(vrm.scene)

    // Update animation manager
    if (animationManager) {
      animationManager.updateVRM(vrm)
    } else {
      animationManager = new AnimationManager(vrm)
    }

 // Load gesture animations only (no idle FBX)
const animations = await vrmLoader.loadDefaultAnimations(vrm)

Object.entries(animations).forEach(([name, animation]) => {
  animationManager.setGestureAnimation(name, animation)
})

// START WIGGLING AND NATURAL ANIMATIONS
animationManager.startNaturalIdle()

    systemStatus.value = 'VRM loaded successfully'
    systemReady.value = true

    // Auto-reset status message
    setTimeout(() => {
      if (systemReady.value) {
        systemStatus.value = 'Ready'
      }
    }, 2000)

    console.log('✅ New VRM model loaded successfully')

  } catch (error) {
    console.error('❌ Failed to load VRM model from file:', error)
    systemStatus.value = `Error: ${error.message}`
    systemReady.value = false
  }
}

async function sendMessage() {
  if (!userInput.value.trim() || isProcessing.value || !systemReady.value) return

  try {
    isProcessing.value = true
    const message = userInput.value.trim()
    userInput.value = ''
    autoResize()

    console.log('Sending message:', message)

    // USE OPTIMIZED PARALLEL PROCESSING
    const { processMessageOptimized } = await import('../managers/utils.js')

    await processMessageOptimized(
      message,
      aiClient,
      audioManager,
      animationManager,
      vrm,
      configManager,
      audioRef.value
    )

  } catch (error) {
    console.error('Error processing message:', error)
    systemStatus.value = `Error: ${error.message}`

    setTimeout(() => {
      if (systemReady.value) {
        systemStatus.value = 'Ready'
      }
    }, 3000)
  } finally {
    isProcessing.value = false
  }
}

function toggleRecording() {
  if (!speechManager || !systemReady.value) {
    console.error('Speech manager not available or system not ready')
    return
  }

  if (isRecording.value) {
    speechManager.stopRecording()
    isRecording.value = false
  } else {
    const started = speechManager.startRecording()
    if (started) {
      isRecording.value = true
    }
  }
}

function autoResize() {
  const textarea = textareaRef.value
  if (textarea) {
    textarea.style.height = 'auto'
    textarea.style.height = textarea.scrollHeight + 'px'
  }
}

function getStatusClass() {
  if (systemStatus.value === 'Ready') return 'text-green-400'
  if (systemStatus.value.includes('Error')) return 'text-red-400'
  return 'text-yellow-400'
}

onBeforeUnmount(() => {
  console.log('🧹 Cleaning up VRM Chat System...')

  // Cleanup all managers
  animationManager?.cleanup()
  audioManager?.cleanup()
  speechManager?.cleanup()
  sceneManager?.cleanup()

  // Clear VRM reference
  if (vrm) {
    vrmLoader?.cleanupVRM(vrm)
  }

  systemReady.value = false
  console.log('✅ Cleanup complete')
})
</script>

<style scoped>
.chat-input {
  transition: all 0.2s ease;
}

.debug-panel {
  backdrop-filter: blur(10px);
}

/* Loading spinner */
@keyframes spin {
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Smooth transitions */
button {
  transition: all 0.2s ease;
}

button:hover:not(:disabled) {
  transform: translateY(-1px);
}

button:active:not(:disabled) {
  transform: translateY(0);
}

/* Disabled states */
button:disabled,
textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
