import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import GitHubStar from './GitHubStar.vue'
import ThemeSwitcher from './ThemeSwitcher.vue'
import HeroImage from './HeroImage.vue'
import './custom.css'

// Match the pi-web app's four named themes (dark/light/nord/dracula) via a
// data-theme attribute, driven by a custom switcher in the nav, plus a GitHub
// "Star" call-to-action. The hero image slot renders the demo GIF with a
// caption. The default theme + flash-free first paint are set by the inline
// head script in config.js.
export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-content-after': () => [h(GitHubStar), h(ThemeSwitcher)],
      'home-hero-image': () => h(HeroImage),
    })
  },
}
