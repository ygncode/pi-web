<script setup>
import { withBase } from 'vitepress'
</script>

<template>
  <figure class="hero-demo">
    <img
      class="hero-demo-img"
      :src="withBase('/assets/pi-web-demo.gif')"
      alt="pi-web demo on desktop and iOS"
    />
    <figcaption class="hero-demo-cap">Live demo · desktop + iOS, sped up</figcaption>
  </figure>
</template>

<style scoped>
.hero-demo {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  /* Sit above VitePress's .image-bg glow, which is absolutely positioned and
     would otherwise paint over this in-flow figure and wash out the demo. */
  position: relative;
  z-index: 1;
}
.hero-demo-img {
  width: 580px;
  max-width: 100%;
  border-radius: 14px;
  border: 1px solid var(--vp-c-divider);
  box-shadow: 0 22px 60px -18px rgba(0, 0, 0, 0.55);
}
.hero-demo-cap {
  font-size: 13px;
  color: var(--vp-c-text-3);
  text-align: center;
}
@media (min-width: 960px) {
  .hero-demo-img {
    width: 620px;
  }
}
@media (max-width: 640px) {
  .hero-demo-img {
    width: 100%;
  }
}
</style>
