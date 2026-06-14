<script lang="ts">
	import type { Writable } from 'svelte/store';
	import type { CancelDetectionBehavior, Settings } from '../../shared/message-types';
	import { t } from '../../shared/i18n';
	import CardHeading from '../../popup/components/CardHeading.svelte';

	let {
		settings,
		setValue,
	}: {
		settings: Writable<Settings | null>;
		setValue: (value: CancelDetectionBehavior) => Promise<void>;
	} = $props();

	let value = $derived<CancelDetectionBehavior>($settings?.cancelDetectionBehavior ?? 'ask');
</script>

<article class="card" id="cancel-detection-section">
	<CardHeading title={t('pasteScanCancellation')} hint={t('canceledPasteBehavior')} />
	<div class="row">
		<div class="info">
			<span class="row-label">{t('whenCancelingScan')}</span>
			<p class="hint">
				{t('cancelDetectionHint')}
			</p>
		</div>
		<select
			aria-label={t('whenCancelingScan')}
			value={value}
			onchange={(event) => setValue(event.currentTarget.value as CancelDetectionBehavior)}
		>
			<option value="ask">{t('askEveryTime')}</option>
			<option value="paste-original">{t('pasteWithoutChecking')}</option>
			<option value="drop">{t('dontPaste')}</option>
		</select>
	</div>
</article>

<style>
	.card { margin-bottom: 12px; overflow: hidden; border: var(--border-hairline); border-radius: var(--radius-lg); background: var(--color-card); }
	.row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 14px; }
	.info { flex: 1; }
	.row-label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 4px; }
	.hint { margin: 0; color: var(--color-muted); font-size: 12px; line-height: 1.5; }
	select {
		padding: 8px 10px;
		border: var(--border-hairline);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-ink);
		font-size: 13px;
		cursor: pointer;
	}
</style>
