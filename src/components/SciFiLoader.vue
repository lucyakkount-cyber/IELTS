<template>
  <div class="loader-root">
    <div class="loader-grid"></div>
    <div class="loader-aurora"></div>
    <div class="loader-noise"></div>

    <div class="loader-panel">
      <div class="loader-head">
        <p class="loader-kicker">Riko Live Core</p>
        <p class="loader-stage">{{ stageLabel }}</p>
      </div>

      <div class="loader-core">
        <div class="loader-ring" :style="ringStyle">
          <div class="loader-ring-inner">
            <p class="loader-value">{{ clampedProgress }}%</p>
            <p class="loader-label">Sync</p>
          </div>
        </div>

        <div class="loader-telemetry">
          <p class="loader-detail">{{ detailLabel }}</p>
          <div class="loader-signal">
            <span
              v-for="bar in telemetryBars"
              :key="bar.id"
              class="loader-signal-bar"
              :class="bar.active ? 'is-active' : ''"
              :style="{ height: `${bar.height}px` }"
            ></span>
          </div>
        </div>
      </div>

      <div class="loader-progress">
        <div class="loader-progress-bar" :style="{ width: `${clampedProgress}%` }"></div>
      </div>

      <div class="loader-foot">
        <p class="loader-chip">Neural Voice</p>
        <p class="loader-chip">Avatar Rig</p>
        <p class="loader-chip">Vision Bus</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  progress: {
    type: Number,
    required: true,
  },
  stage: {
    type: String,
    default: 'Initializing',
  },
  detail: {
    type: String,
    default: '',
  },
})

const clampedProgress = computed(() => {
  const value = Number.isFinite(props.progress) ? props.progress : 0
  return Math.max(0, Math.min(100, Math.round(value)))
})

const ringStyle = computed(() => {
  return {
    '--loader-progress': `${clampedProgress.value}%`,
  }
})

const stageLabel = computed(() => props.stage || 'Initializing')
const detailLabel = computed(() => props.detail || 'Preparing subsystems')

const telemetryBars = computed(() => {
  return Array.from({ length: 9 }, (_, index) => {
    const height = 12 + ((index * 9 + 14) % 34)
    const threshold = ((index + 1) / 9) * 100
    return {
      id: index,
      height,
      active: clampedProgress.value >= threshold,
    }
  })
})
</script>
