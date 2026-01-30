// managers/visionManager.js

export class VisionManager {
  constructor() {
    this.videoElement = null
    this.canvasElement = null
    this.stream = null
    this.isInitialized = false
    this.screenStream = null
    this.screenVideoElement = null
    this.isSharingScreen = false
    this.screenShareInterval = null

    // Store callbacks to allow updating them on-the-fly
    this.onCameraFrame = null
    this.onScreenFrame = null
  }

  async initialize() {
    if (this.isInitialized) return true

    // Create hidden video element
    this.videoElement = document.createElement('video')
    this.videoElement.style.display = 'none'
    this.videoElement.autoplay = true
    this.videoElement.muted = true
    this.videoElement.setAttribute('playsinline', 'true')
    document.body.appendChild(this.videoElement)

    // Create hidden canvas for capturing frames
    this.canvasElement = document.createElement('canvas')
    this.canvasElement.style.display = 'none'

    this.isInitialized = true
    return true
  }

  async startCamera() {
    if (!this.isInitialized) await this.initialize()

    try {
      console.log('📷 VisionManager: Requesting camera access...')
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
      })
      this.videoElement.srcObject = this.stream

      await new Promise((resolve) => {
        this.videoElement.onloadedmetadata = () => {
          this.videoElement.play()
          resolve()
        }
      })

      console.log('✅ VisionManager: Camera started')
      return true
    } catch (error) {
      console.error('❌ VisionManager: Camera failed', error)
      return false
    }
  }

  async startCameraStream(onFrameCallback) {
    // Always update the callback to the latest one
    this.onCameraFrame = onFrameCallback

    if (this.cameraInterval) {
      console.log('📷 VisionManager: Stream already active, callback updated.')
      return true
    }

    if (!this.stream) {
      const success = await this.startCamera()
      if (!success) return false
    }

    console.log('📷 VisionManager: Starting continuous camera stream...')
    const video = this.videoElement

    this.cameraInterval = setInterval(() => {
      const frame = this.captureVideoFrame(video, 640)
      // Use the stored callback
      if (frame && this.onCameraFrame) {
        this.onCameraFrame(frame)
      }
    }, 1000)

    return true
  }

  stopCameraStream() {
    if (this.cameraInterval) {
      clearInterval(this.cameraInterval)
      this.cameraInterval = null
      this.onCameraFrame = null
      console.log('🛑 VisionManager: Stopped camera stream')
    }
  }

  async captureFrame() {
    if (!this.stream) {
      const success = await this.startCamera()
      if (!success) return null
    }

    const video = this.videoElement
    if (video.videoWidth === 0 || video.videoHeight === 0) return null

    const scale = Math.min(1, 640 / video.videoWidth)
    const width = Math.floor(video.videoWidth * scale)
    const height = Math.floor(video.videoHeight * scale)

    this.canvasElement.width = width
    this.canvasElement.height = height
    const ctx = this.canvasElement.getContext('2d')
    ctx.drawImage(video, 0, 0, width, height)

    const dataURL = this.canvasElement.toDataURL('image/jpeg', 0.7)
    this.showPreview()
    return dataURL.split(',')[1]
  }

  // --- Screen Capture Methods ---

  async startScreenShare(onFrameCallback) {
    // Always update the callback to the latest one
    this.onScreenFrame = onFrameCallback

    if (this.screenStream) {
      console.log('🖥️ VisionManager: Screen share already active, callback updated.')
      return true
    }

    try {
      console.log('🖥️ VisionManager: Starting continuous screen share...')

      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        console.warn('❌ Screen sharing not supported.')
        return 'Screen sharing is not supported on this device/browser.'
      }

      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      })

      this.screenStream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare()
      }

      const video = document.createElement('video')
      video.srcObject = this.screenStream
      video.muted = true
      video.play()
      this.screenVideoElement = video

      await new Promise((resolve) => (video.onloadedmetadata = resolve))

      this.isSharingScreen = true
      this.screenShareInterval = setInterval(() => {
        if (!this.isSharingScreen) return

        const frame = this.captureVideoFrame(video, 1024)
        // Use the stored callback
        if (frame && this.onScreenFrame) {
          this.onScreenFrame(frame)
        }
      }, 1000)

      return true
    } catch (error) {
      console.error('❌ Screen Share failed:', error)
      return false
    }
  }

  stopScreenShare() {
    if (!this.isSharingScreen && !this.screenStream) return
    console.log('🛑 Stopping screen share...')
    this.isSharingScreen = false
    this.onScreenFrame = null

    if (this.screenShareInterval) {
        clearInterval(this.screenShareInterval)
        this.screenShareInterval = null
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop())
    }

    this.screenStream = null
    this.screenVideoElement = null
  }

  captureVideoFrame(video, maxWidth) {
    if (video.videoWidth === 0 || video.videoHeight === 0) return null

    const scale = Math.min(1, maxWidth / video.videoWidth)
    const width = Math.floor(video.videoWidth * scale)
    const height = Math.floor(video.videoHeight * scale)

    this.canvasElement.width = width
    this.canvasElement.height = height
    const ctx = this.canvasElement.getContext('2d')
    ctx.drawImage(video, 0, 0, width, height)

    const dataURL = this.canvasElement.toDataURL('image/jpeg', 0.6)
    return dataURL.split(',')[1]
  }

  showPreview() {
    const previewCanvas = document.createElement('canvas')
    previewCanvas.width = this.canvasElement.width
    previewCanvas.height = this.canvasElement.height
    previewCanvas.getContext('2d').drawImage(this.canvasElement, 0, 0)

    previewCanvas.style.position = 'fixed'
    previewCanvas.style.bottom = '20px'
    previewCanvas.style.right = '20px'
    previewCanvas.style.width = '300px'
    previewCanvas.style.height = 'auto'
    previewCanvas.style.zIndex = '9999'
    previewCanvas.style.border = '2px solid #00ffa3'
    previewCanvas.style.borderRadius = '8px'
    previewCanvas.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)'
    previewCanvas.style.transition = 'opacity 0.5s'

    document.body.appendChild(previewCanvas)

    setTimeout(() => {
      previewCanvas.style.opacity = '0'
      setTimeout(() => {
        if (previewCanvas.parentNode) {
          document.body.removeChild(previewCanvas)
        }
      }, 500)
    }, 3000)
  }

  cleanup() {
    this.stopCameraStream()
    this.stopScreenShare()
    if (this.videoElement && this.videoElement.parentNode) document.body.removeChild(this.videoElement)
    if (this.screenVideoElement && this.screenVideoElement.parentNode) document.body.removeChild(this.screenVideoElement)
    this.videoElement = null
    this.screenVideoElement = null
    this.canvasElement = null
    this.isInitialized = false
  }
}
