<script setup>
import { ref, onMounted } from 'vue'

const REPO = 'ygncode/pi-web'
const CACHE_KEY = 'pi-web-docs-stars'
const TTL = 6 * 60 * 60 * 1000 // 6h

const stars = ref(null)

function format(n) {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n)
}

onMounted(async () => {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    if (cached && Date.now() - cached.t < TTL) {
      stars.value = cached.n
      return
    }
  } catch (e) {}
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}`)
    if (!res.ok) return
    const data = await res.json()
    stars.value = data.stargazers_count
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ n: stars.value, t: Date.now() }))
    } catch (e) {}
  } catch (e) {}
})
</script>

<template>
  <a
    class="gh-star"
    :href="`https://github.com/${REPO}`"
    target="_blank"
    rel="noopener noreferrer"
    title="Star pi-web on GitHub"
  >
    <svg class="gh-mark" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
    <span class="gh-label">Star</span>
    <span v-if="stars != null" class="gh-count">{{ format(stars) }}</span>
  </a>
</template>

<style scoped>
.gh-star {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 11px;
  margin-left: 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  color: var(--vp-c-text-2);
  background: transparent;
  transition:
    border-color 0.25s,
    color 0.25s;
}
.gh-star:hover {
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-brand-1);
}
.gh-mark {
  flex: none;
}
.gh-count {
  padding-left: 6px;
  margin-left: 2px;
  border-left: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
  font-variant-numeric: tabular-nums;
}
@media (max-width: 640px) {
  .gh-label {
    display: none;
  }
  .gh-star {
    padding: 0 9px;
  }
}
</style>
