<script>
  import { onMount, untrack } from 'svelte';
  import LoginPage from './routes/LoginPage.svelte';
  import SessionsPage from './routes/SessionsPage.svelte';
  import SessionPage from './routes/SessionPage.svelte';
  import SettingsPage from './routes/SettingsPage.svelte';
  import VersionController from './components/shared/VersionController.svelte';

  let {
    path: initialPath = typeof window !== 'undefined' ? window.location.pathname : '/',
    search: initialSearch = typeof window !== 'undefined' ? window.location.search : '',
  } = $props();

  // Reactive current route. Seeded from the props (so prop-driven tests stay
  // deterministic) and thereafter updated only by real navigation events, never
  // re-read on mount.
  let path = $state(untrack(() => initialPath));
  let search = $state(untrack(() => initialSearch));

  // The session route is keyed on this so a session→session navigation (same
  // pathname, different ?id=) tears down and remounts <SessionPage>, which reads
  // ?id= only at mount. Within-session navigation never changes the URL, so this
  // stays stable while reading a session.
  const sessionId = $derived(new URLSearchParams(search).get('id') || '');

  // Make in-app history navigation swap views without a full reload. popstate
  // covers back/forward; pushState/replaceState don't emit a native event, so
  // we wrap them to dispatch one. syncPath re-reads pathname + search: the
  // pathname drives which page renders, and search drives the session-route
  // {#key} so /session?id=A → ?id=B remounts <SessionPage>. A pushState that
  // changes neither (e.g. FullScreenSheet's mobile back-button trap, which
  // pushes the same URL) is a no-op.
  onMount(() => {
    const syncPath = () => { path = window.location.pathname; search = window.location.search; };
    const { history } = window;
    const wrap = (name) => {
      const original = history[name];
      if (typeof original !== 'function' || original.__piPatched) return original;
      const patched = function (...args) {
        const result = original.apply(this, args);
        window.dispatchEvent(new window.CustomEvent('pi:locationchange'));
        return result;
      };
      patched.__piPatched = true;
      patched.__piOriginal = original;
      history[name] = patched;
      return original;
    };
    const originalPush = wrap('pushState');
    const originalReplace = wrap('replaceState');
    window.addEventListener('popstate', syncPath);
    window.addEventListener('pi:locationchange', syncPath);
    return () => {
      window.removeEventListener('popstate', syncPath);
      window.removeEventListener('pi:locationchange', syncPath);
      if (history.pushState?.__piOriginal === originalPush) history.pushState = originalPush;
      if (history.replaceState?.__piOriginal === originalReplace) history.replaceState = originalReplace;
    };
  });
</script>

{#if path === '/'}
  <SessionsPage />
{:else if path === '/session'}
  {#key sessionId}
    <SessionPage />
  {/key}
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
