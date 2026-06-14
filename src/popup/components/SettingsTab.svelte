<script lang="ts">
	import type { Readable, Writable } from 'svelte/store';
	import type { FeedbackCounts } from '../popup-model.svelte';
	import type { NerModelKey, Settings } from '../../shared/message-types';
	import type { NerModelChoice } from '../../shared/constants';
	import Toggle from './Toggle.svelte';
	import LegalCard from './LegalCard.svelte';
	import { t, currentLocale, setLanguage, SUPPORTED_LOCALES, type Locale } from '../../shared/i18n';

	let {
		minConfidence,
		debug,
		clipboardInterceptEnabled,
		nerModel,
		nerModelChoice,
		nerModelChoices,
		sensitivityMode,
		feedbackCounts,
		mappingCount,
		setMinConfidence,
		setDebug,
		setClipboardInterceptEnabled,
		setNerModelChoice,
		openOptions,
		openIssueReport,
		openSecurityReport,
		openPrivacySupport,
		openPrivacyPolicy,
		openImpressum,
		clearFeedback,
		clearMappings,
	}: {
		minConfidence: Writable<number>;
		debug: Writable<boolean>;
		clipboardInterceptEnabled: Writable<boolean>;
		nerModel: Writable<NerModelKey>;
		nerModelChoice: Writable<string>;
		nerModelChoices: readonly NerModelChoice[];
		sensitivityMode: Writable<Settings['sensitivityMode']>;
		feedbackCounts: Writable<FeedbackCounts>;
		mappingCount: Writable<number>;
		setMinConfidence: (value: number) => Promise<void>;
		setDebug: (enabled: boolean) => Promise<void>;
		setClipboardInterceptEnabled: (enabled: boolean) => Promise<void>;
		setNerModelChoice: (value: string) => Promise<void>;
		openOptions: () => void;
		openIssueReport: () => void;
		openSecurityReport: () => void;
		openPrivacySupport: () => void;
		openPrivacyPolicy: () => void;
		openImpressum: () => void;
		clearFeedback: () => Promise<void>;
		clearMappings: () => Promise<void>;
	} = $props();
	let sliderValue = $derived(Math.round($minConfidence * 100));
</script>

<div class="settings-stack">
	<article class="card">
		<div class="head"><span>{t('detection')}</span></div>
		{#if $sensitivityMode === 'global'}
			<div class="row-col">
				<div class="row-head"><span class="row-label">{t('sensitivity')}</span><span class="mono">{$minConfidence.toFixed(2)}</span></div>
				<input type="range" min="0" max="100" value={sliderValue} oninput={(event) => setMinConfidence(Number(event.currentTarget.value) / 100)} aria-label={t('sensitivity')} />
				<div class="ticks"><span>{t('fewerDetections')}</span><span>{t('moreDetections')}</span></div>
			</div>
		{:else}
			<div class="row">
				<div><div class="row-label">{t('sensitivity')}</div><div class="row-meta">{t('individualModeHint')}</div></div>
				<button type="button" class="select" onclick={openOptions}>{t('options')}</button>
			</div>
		{/if}
		<div class="divider"></div>
		<div class="row">
			<div><div class="row-label">{t('nerModel')}</div><div class="row-meta">{t('localTransformerHint')}</div></div>
			<select value={$nerModelChoice} onchange={(event) => setNerModelChoice(event.currentTarget.value)}>
				{#each nerModelChoices as choice (choice.value)}
					<option value={choice.value}>{choice.label}</option>
				{/each}
			</select>
		</div>
	</article>

	<article class="card">
		<div class="head"><span>{t('language')}</span></div>
		<div class="row">
			<div><div class="row-label">{t('language')}</div><div class="row-meta">{t('languageHint')}</div></div>
			<select value={$currentLocale} onchange={(event) => setLanguage(event.currentTarget.value as Locale)}>
				<option value="en">English</option>
				<option value="fr">Français</option>
			</select>
		</div>
	</article>

	<article class="card">
		<div class="head"><span>{t('behavior')}</span></div>
		<div class="row"><div><div class="row-label">{t('interceptClipboard')}</div><div class="row-meta">{t('restoreCopiedHint')}</div></div><Toggle size="sm" checked={$clipboardInterceptEnabled} onchange={(checked) => setClipboardInterceptEnabled(checked)} label={t('interceptClipboard')} /></div>
		<div class="divider"></div>
		<div class="row"><div><div class="row-label">{t('debugMode')}</div><div class="row-meta">{t('verboseLogging')}</div></div><Toggle size="sm" checked={$debug} onchange={(checked) => setDebug(checked)} label={t('debugMode')} /></div>
	</article>

	<article class="card">
		<div class="head"><span>{t('maintenance')}</span></div>
		<button type="button" class="link-row" onclick={clearFeedback}><span class="row-label">{t('clearFeedback')}</span><span class="right"><span class="count">{$feedbackCounts.confirmed} {t('corrections')}</span>›</span></button>
		<div class="divider"></div>
		<button type="button" class="link-row" onclick={clearMappings}><span class="row-label">{t('clearMappings')}</span><span class="right"><span class="count">{$mappingCount} {t('saved')}</span>›</span></button>
	</article>

	<article class="card">
		<div class="head"><span>{t('support')}</span></div>
		<button type="button" class="link-row" onclick={openIssueReport}><span class="row-label">{t('reportIssue')}</span><span class="right">›</span></button>
		<div class="divider"></div>
		<button type="button" class="link-row" onclick={openSecurityReport}><span class="row-label">{t('reportSecurityIssue')}</span><span class="right">›</span></button>
		<div class="divider"></div>
		<button type="button" class="link-row" onclick={openPrivacySupport}><span class="row-label">{t('support')}</span><span class="right">›</span></button>
	</article>

	<LegalCard {openPrivacyPolicy} {openImpressum} />
	<div class="version-note">Privacy Guardrail · {$nerModel}</div>
</div>

<style>
	.settings-stack { display: flex; flex-direction: column; gap: 8px; }
	.card { overflow: hidden; border: var(--border-hairline); border-radius: var(--radius-lg); background: white; }
	.head { display: flex; justify-content: space-between; padding: 11px 12px; border-bottom: 1px solid var(--color-border); }
	.head span { font-size: 12px; font-weight: 600; }
	.row, .link-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; }
	.link-row { width: 100%; border: 0; background: transparent; color: var(--color-ink); cursor: pointer; }
	.row-col { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; }
	.row-head, .ticks { display: flex; justify-content: space-between; }
	.row-label { font-size: 13px; font-weight: 500; }
	.row-meta, .ticks { color: var(--color-muted); font-size: 11px; }
	.mono, .count { color: var(--color-accent); font-family: var(--font-mono); font-size: 12px; font-weight: 600; }
	.count { color: var(--color-muted); font-size: 11px; }
	input { width: 100%; accent-color: var(--color-accent); }
	select, .select { display: flex; align-items: center; gap: 6px; max-width: 180px; padding: 5px 10px; border: 0; border-radius: 6px; background: #f1f5f9; color: var(--color-ink); font-size: 12px; font-weight: 500; cursor: pointer; }
	.divider { height: 1px; background: var(--color-border); }
	.right { display: flex; align-items: center; gap: 8px; }
	.version-note { padding: 4px 0 8px; color: var(--color-subtle); font-family: var(--font-mono); font-size: 10px; text-align: center; }
</style>
