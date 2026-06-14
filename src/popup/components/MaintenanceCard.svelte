<script lang="ts">
	import { t } from '../../shared/i18n';
	let { restoreDefaults, clearMappings }: { restoreDefaults: () => void; clearMappings: () => void } = $props();
</script>

<div class="maint-row">
	<button type="button" onclick={restoreDefaults}>{t('restoreDefaults')}</button>
	<button type="button" onclick={clearMappings}>{t('clearMappings')}</button>
</div>

<style>
	.maint-row { display: flex; gap: 8px; }
	button { flex: 1; padding: 9px; border: 1px solid var(--color-border-strong); border-radius: 8px; background: white; color: #475569; font-size: 11px; font-weight: 500; cursor: pointer; }
</style>
