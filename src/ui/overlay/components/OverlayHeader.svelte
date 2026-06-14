<script lang="ts">
  import PGLogo from "./PGLogo.svelte";
  import { t } from '../../../shared/i18n';

  let { totalCount, timingMs, onClose }: { totalCount: number; timingMs?: number; onClose: () => void } = $props();
</script>

<header class="pg-header">
  <span class="pg-logo-box"><PGLogo size={32} /></span>
  <div class="pg-header-text">
    <span class="pg-brand">{t('sensitiveDataDetected')}</span>
    <span class="pg-header-status">
      <span class="pg-count-num">{totalCount}</span>
      <span class="pg-count-text">
        {t('itemsFound', String(totalCount), totalCount === 1 ? "" : "s")}
        {#if timingMs !== undefined}
          · {t('detectionTook', String(timingMs))}{/if}</span
      >
    </span>
  </div>
  <button type="button" class="pg-close" title="{t('cancelNothingPasted')}" aria-label="Cancel" onclick={onClose}>×</button
  >
</header>
