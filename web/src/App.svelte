<script>
  import LoginPage from './routes/LoginPage.svelte';
  import SessionsPage from './routes/SessionsPage.svelte';
  import SessionPage from './routes/SessionPage.svelte';
  import SettingsPage from './routes/SettingsPage.svelte';
  import VersionController from './components/shared/VersionController.svelte';

  let { path = typeof window !== 'undefined' ? window.location.pathname : '/' } = $props();
</script>

{#if path === '/'}
  <SessionsPage />
{:else if path === '/session'}
  <SessionPage />
{:else if path === '/settings'}
  <SettingsPage />
{:else if path === '/login'}
  <LoginPage />
{:else}
  <section class="svelte-spa-probe" aria-label="Svelte app probe">
    Svelte ready for pi-web
  </section>
{/if}

<VersionController />
