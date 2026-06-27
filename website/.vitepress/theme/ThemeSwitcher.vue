<script setup>
import { ref, computed, onMounted } from 'vue'

const THEMES = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'nord', label: 'Nord' },
  { id: 'dracula', label: 'Dracula' },
]

const current = ref('dracula')
const label = computed(() => THEMES.find((t) => t.id === current.value)?.label ?? 'Dracula')

function apply(id) {
  const el = document.documentElement
  el.dataset.theme = id
  el.classList.toggle('dark', id !== 'light')
  try {
    localStorage.setItem('pi-web-docs-theme', id)
  } catch (e) {}
  current.value = id
}

function cycle() {
  const i = THEMES.findIndex((t) => t.id === current.value)
  apply(THEMES[(i + 1) % THEMES.length].id)
}

onMounted(() => {
  try {
    current.value = localStorage.getItem('pi-web-docs-theme') || 'dracula'
  } catch (e) {
    current.value = 'dracula'
  }
})
</script>

<template>
  <button
    class="theme-switcher"
    type="button"
    :title="`Theme: ${label} — click to cycle Dark / Light / Nord / Dracula`"
    @click="cycle"
  >
    <span class="theme-swatch" :data-theme-id="current"></span>
    <span class="theme-label">{{ label }}</span>
  </button>
</template>

<style scoped>
.theme-switcher {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 11px;
  margin-left: 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  color: var(--vp-c-text-2);
  background: transparent;
  cursor: pointer;
  transition:
    border-color 0.25s,
    color 0.25s;
}
.theme-switcher:hover {
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-brand-1);
}
.theme-swatch {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid var(--vp-c-divider);
  box-shadow: 0 0 0 2px var(--vp-c-bg);
}
.theme-swatch[data-theme-id='dark'] {
  background: #9cc7c0;
}
.theme-swatch[data-theme-id='light'] {
  background: #496f69;
}
.theme-swatch[data-theme-id='nord'] {
  background: #88c0d0;
}
.theme-swatch[data-theme-id='dracula'] {
  background: #ff79c6;
}
/* Hide the text label on narrow screens; the swatch alone identifies the theme. */
@media (max-width: 640px) {
  .theme-label {
    display: none;
  }
  .theme-switcher {
    padding: 0 9px;
  }
}
</style>
