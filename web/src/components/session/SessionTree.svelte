<script>
  import { icon, PanelLeftClose, X } from '../../shared/icons.js';
  import { t } from '../../shared/i18n.js';
  import { getSessionModel } from '../../session/session-context.js';
  import { sessionRuntime } from '../../session/session-runtime.js';
  import { getSessionRuntime } from '../../session/session-runtime-context.js';
  import SessionTreeNodes from './SessionTreeNodes.svelte';

  const model = getSessionModel();

  // Route a tree-node click through the imperative navigator so message content
  // scrolls/renders; the navigator's
  // onNavigate writes back to the model, which re-highlights the tree reactively.
  // Parity with the old tree-renderer: navigate to the newest leaf under the
  // clicked node, with the clicked node as the scroll target; auto-close the
  // drawer on mobile.
  function onNavigate(id) {
    const leaf = model?.newestLeaf(id) || id;
    const navigateTo = getSessionRuntime().navigateTo || window.navigateTo;
    navigateTo?.(leaf, 'target', id);
    if (sessionRuntime.layout?.isMobileLayout?.()) sessionRuntime.layout?.closeSidebar?.();
  }
</script>

<aside id="sidebar">
  <div class="sidebar-header">
    <div class="sidebar-controls"><input type="text" class="sidebar-search" id="tree-search" placeholder={t('common.search')}><button id="hide-sidebar" class="hide-sidebar" title={t('session.hideSidebar')}>{@html icon(PanelLeftClose, { size: 14 })}</button><button id="sidebar-close" class="sidebar-close" title={t('common.close')} aria-label={t('session.closeTree')}>{@html icon(X, { size: 14 })}</button></div>
    <div class="sidebar-filters"><button class="filter-btn active" data-filter="default" title={t('session.filterDefaultTitle')}>{t('session.filterDefault')}</button><button class="filter-btn" data-filter="no-tools" title={t('session.filterNoToolsTitle')}>{t('session.filterNoTools')}</button><button class="filter-btn" data-filter="user-only" title={t('session.filterUserTitle')}>{t('session.filterUser')}</button><button class="filter-btn" data-filter="labeled-only" title={t('session.filterLabeledTitle')}>{t('session.filterLabeled')}</button><button class="filter-btn" data-filter="all" title={t('session.filterAllTitle')}>{t('session.filterAll')}</button></div>
  </div>
  {#if model}<SessionTreeNodes {model} {onNavigate} />{:else}<div class="tree-container" id="tree-container"></div><div class="tree-status" id="tree-status"></div>{/if}
</aside>
<div id="sidebar-resizer" role="separator" aria-orientation="vertical" aria-label={t('session.resizeTree')}></div>
