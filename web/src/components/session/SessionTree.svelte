<script>
  import { icon, PanelLeftClose, X } from '../../shared/icons.js';
  import { t } from '../../shared/i18n.js';
</script>

<aside id="sidebar">
  <div class="sidebar-header">
    <div class="sidebar-controls"><input type="text" class="sidebar-search" id="tree-search" placeholder={t('common.search')}><button id="hide-sidebar" class="hide-sidebar" title={t('session.hideSidebar')}>{@html icon(PanelLeftClose, { size: 14 })}</button><button id="sidebar-close" class="sidebar-close" title={t('common.close')} aria-label={t('session.closeTree')}>{@html icon(X, { size: 14 })}</button></div>
    <div class="sidebar-filters"><button class="filter-btn active" data-filter="default" title={t('session.filterDefaultTitle')}>{t('session.filterDefault')}</button><button class="filter-btn" data-filter="no-tools" title={t('session.filterNoToolsTitle')}>{t('session.filterNoTools')}</button><button class="filter-btn" data-filter="user-only" title={t('session.filterUserTitle')}>{t('session.filterUser')}</button><button class="filter-btn" data-filter="labeled-only" title={t('session.filterLabeledTitle')}>{t('session.filterLabeled')}</button><button class="filter-btn" data-filter="all" title={t('session.filterAllTitle')}>{t('session.filterAll')}</button></div>
  </div>
  <div class="tree-container" id="tree-container"></div><div class="tree-status" id="tree-status"></div>
</aside>
<div id="sidebar-resizer" role="separator" aria-orientation="vertical" aria-label={t('session.resizeTree')}></div>
