<script lang="ts">
	import type { VaultModel } from '../popup-model.svelte';
	import CardHeading from './CardHeading.svelte';
	import Segmented from './Segmented.svelte';
	import Toggle from './Toggle.svelte';
	import { t } from '../../shared/i18n';

	let { memoryEnabled, consistentReplacementMode, mappingCount, setMemoryEnabled, setReplacementMode, openVaultOptions }: Pick<VaultModel, 'memoryEnabled' | 'consistentReplacementMode' | 'mappingCount' | 'setMemoryEnabled' | 'setReplacementMode' | 'openVaultOptions'> = $props();
</script>

<article class="card">
	<CardHeading title={t('identityVault')} />
	<div class="row">
		<div class="row-label">{t('crossSessionMemory')}</div>
		<Toggle size="sm" checked={$memoryEnabled} label={t('crossSessionMemory')} onchange={(checked) => setMemoryEnabled(checked)} />
	</div>
	<div class="divider"></div>
	<div class="row">
		<div class="row-label">{t('replacement')}</div>
		<Segmented
			ariaLabel={t('replacement')}
			value={$consistentReplacementMode ? 'placeholder' : 'synthetic'}
			options={[{ value: 'placeholder', label: t('placeholder') }, { value: 'synthetic', label: t('synthetic') }]}
			onchange={(mode) => setReplacementMode(mode)}
		/>
	</div>
	<div class="divider"></div>
	<button type="button" class="link-row" onclick={openVaultOptions}>
		<span class="row-label">{t('manageVault')}</span>
		<span class="right"><span class="count">{$mappingCount} {t('saved')}</span><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3.5 2 6.5 5 3.5 8" /></svg></span>
	</button>
</article>

<style>
	.card { overflow: hidden; border: var(--border-hairline); border-radius: var(--radius-lg); background: white; }
	.row, .link-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; }
	.link-row { width: 100%; border: 0; background: transparent; color: var(--color-ink); cursor: pointer; }
	.row-label { font-size: 13px; font-weight: 500; }
	.divider { height: 1px; background: var(--color-border); }
	.right { display: flex; align-items: center; gap: 8px; }
	.count { color: var(--color-muted); font-family: var(--font-mono); font-size: 11px; font-weight: 600; }
	svg { opacity: 0.6; }
</style>
