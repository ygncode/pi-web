<script>
  import { onMount } from 'svelte';

  onMount(() => {
    const previousTitle = document.title;
    document.title = 'Login — Pi Sessions';
    return () => {
      document.title = previousTitle;
    };
  });
</script>

<main class="settings-page" aria-labelledby="login-title">
  <div class="settings-header">
    <a class="settings-back" href="/"><span aria-hidden="true">←</span><span>Sessions</span></a>
    <h1 id="login-title">Login</h1>
  </div>

  <section class="settings-section">
    <div class="settings-section-title">Access Token</div>
    <form class="settings-row" method="post">
      <div class="settings-row-label">
        <label class="name" for="token">Token</label>
        <span class="hint">Enter the PI_WEB_TOKEN for this pi-web instance.</span>
      </div>
      <div class="settings-control">
        <input id="token" name="token" type="password" autocomplete="current-password">
        <button class="settings-link" type="submit">Continue</button>
      </div>
    </form>
  </section>
</main>
