<script>
  import SettingsPage from './routes/SettingsPage.svelte';

  let { path = typeof window !== 'undefined' ? window.location.pathname : '/' } = $props();
</script>

{#if path === '/settings'}
  <SettingsPage />
{:else}
  <section class="svelte-spa-probe" aria-label="Svelte app probe">
    Svelte ready for pi-web
  </section>
{/if}
