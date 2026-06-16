<script>
  import { onMount } from 'svelte';
  import { t } from '../shared/i18n.js';

  onMount(() => {
    const previousTitle = document.title;
    document.title = `${t('notFound.heading')} — Pi Sessions`;
    return () => {
      document.title = previousTitle;
    };
  });
</script>

<section class="not-found" data-not-found>
  <div class="not-found-inner">
    <video
      class="not-found-cat"
      src="/cat.webm"
      autoplay
      loop
      muted
      playsinline
      aria-label={t('notFound.catAlt')}
    ></video>
    <p class="not-found-code">404</p>
    <h1 class="not-found-heading">{t('notFound.heading')}</h1>
    <p class="not-found-message">{t('notFound.message')}</p>
    <a class="btn-primary not-found-home" href="/">{t('notFound.back')}</a>
  </div>
</section>
