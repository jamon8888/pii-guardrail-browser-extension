<script lang="ts">
	import type { Writable } from 'svelte/store';
	import type { LocalAiUnloadTimeoutMs, Settings, SystemCompatibilityStatus } from '../../shared/message-types';
	import { LOCAL_AI_UNLOAD_TIMEOUT_CHOICES, nerModelChoices, nerModelChoiceValue } from '../../shared/constants';
	import { t } from '../../shared/i18n';
	import CardHeading from '../../popup/components/CardHeading.svelte';

	let {
		settings,
		status,
		warmupState,
		setLocalAiDetection,
		retryLocalAi,
		rerunSystemCheck,
		setNerModelChoice,
		setLocalAiUnloadTimeoutMs,
		setKeepLocalAiLoadedWhileActive,
		setAutoWarmLocalAiOnActiveSupportedPage,
	}: {
		settings: Writable<Settings | null>;
		status: Writable<SystemCompatibilityStatus | null>;
		warmupState: Writable<'idle' | 'loading' | 'ready' | 'failed'>;
		setLocalAiDetection: (enabled: boolean) => Promise<void>;
		retryLocalAi: () => Promise<void>;
		rerunSystemCheck: () => Promise<void>;
		setNerModelChoice: (value: string) => Promise<void>;
		setLocalAiUnloadTimeoutMs: (value: LocalAiUnloadTimeoutMs) => Promise<void>;
		setKeepLocalAiLoadedWhileActive: (enabled: boolean) => Promise<void>;
		setAutoWarmLocalAiOnActiveSupportedPage: (enabled: boolean) => Promise<void>;
	} = $props();

	let rerunInFlight = $state(false);

	async function handleRerun() {
		if (rerunInFlight) return;
		rerunInFlight = true;
		try {
			await rerunSystemCheck();
		} finally {
			rerunInFlight = false;
		}
	}

	let memoryLabel = $derived.by(() => {
		if (!$status) return t('checking');
		return typeof $status.browserMemoryGb === 'number'
			? t('browserMemoryGb', String($status.browserMemoryGb))
			: t('browserMemoryUnavailable');
	});

	let tierLabel = $derived.by(() => {
		if (!$status) return t('checkingCompatibility');
		if ($status.tier === 'critical') return t('criticalResourceRisk');
		if ($status.tier === 'warning') return t('resourceWarning');
		if ($status.tier === 'unknown') return t('compatibilityPartiallyUnknown');
		return t('noKnownResourceConcern');
	});

	let localAiLabel = $derived.by(() => {
		if (!$settings) return t('loadingSetting');
		if ($settings.nerProvider === 'off') return t('localAiDetectionOff');
		if ($settings.nerProvider === 'fixture') return t('localAiFixtureMode');
		return t('localAiDetectionOn');
	});

	let runtimeLabel = $derived.by(() => {
		const runtime = $status?.runtimeState ?? 'unknown';
		if ($warmupState === 'loading') return t('runtimeLoading');
		if ($warmupState === 'ready') return t('runtimeReady');
		if ($warmupState === 'failed') return t('runtimeFailed');
		if (runtime === 'not-loaded') return t('runtimeNotLoaded');
		if (runtime === 'unknown') return t('runtimeUnknown');
		return t('runtimeLabel', runtime);
	});

	let localAiEnabled = $derived($settings?.nerProvider !== 'off');
	let modelPickerDisabled = $derived(!$settings || !localAiEnabled || $warmupState === 'loading');
	let unloadTimeoutValue = $derived(String($settings?.localAiUnloadTimeoutMs ?? 'session'));
	let loadFailureMessage = $derived($status?.loadFailure?.message ?? null);
	let showRetry = $derived(
		($status?.localAiState === 'off-load-failure' || $warmupState === 'failed') && $warmupState !== 'loading',
	);

	const modelChoices = nerModelChoices();
	let modelChoiceValue = $derived(
		nerModelChoiceValue($settings?.nerModel ?? 'bardsai', $settings?.nerWebGpuDtype),
	);

	let webGpuDtypeHint = $derived.by(() => {
		const choice = $settings?.nerWebGpuDtype ?? 'q4f16';
		return choice === 'fp16'
			? t('dtypeFp16')
			: t('dtypeQ4f16');
	});

	function timeoutLabel(value: LocalAiUnloadTimeoutMs): string {
		if (value === null) return t('browserSession');
		return `${Math.round(value / 60000)} min`;
	}

	function parseTimeout(value: string): LocalAiUnloadTimeoutMs {
		return value === 'session' ? null : Number(value) as LocalAiUnloadTimeoutMs;
	}
</script>

<article class="card" id="system-compatibility-section" aria-live="polite">
	<CardHeading title={t('systemCompatibility')} hint={t('localAiResourceGuard')} />
	<div class="body">
		<div class="summary" data-tier={$status?.tier ?? 'loading'}>
			<span class="summary-title">{tierLabel}</span>
			<span class="summary-detail">{memoryLabel}</span>
		</div>

		<div class="local-ai-control">
			<p class="ai-notice" role="note">{@html t('aiTransparencyNotice')}</p>

			<div class="toggle-row">
				<div>
				<label for="local-ai-toggle">{t('localAiDetection')}</label>
				<p>
					{t('localAiDetectionHint')}
				</p>
				</div>
				<input
					id="local-ai-toggle"
					type="checkbox"
					checked={localAiEnabled}
					disabled={!$settings || $warmupState === 'loading'}
					onchange={(event) => setLocalAiDetection(event.currentTarget.checked)}
				/>
			</div>

			<label class="model-label" for="local-ai-model">{t('localAiModel')}</label>
			<select
				id="local-ai-model"
				value={modelChoiceValue}
				disabled={modelPickerDisabled}
				onchange={(event) => setNerModelChoice(event.currentTarget.value)}
			>
				{#each modelChoices as choice (choice.value)}
					<option value={choice.value}>{choice.label}</option>
				{/each}
			</select>
			<p class="hint">
				{webGpuDtypeHint}
				{t('quantizationHint')}
			</p>
			{#if $warmupState === 'loading'}
				<p class="hint">{t('loadingLocalAi')}</p>
			{/if}
			{#if showRetry}
				<div class="failure" role="status">
					<p class="failure-title">{t('localAiFailed')}</p>
					{#if loadFailureMessage}
						<p class="failure-detail">{loadFailureMessage}</p>
					{:else}
						<p class="failure-detail">{t('patternDetectionActive')}</p>
					{/if}
					<button type="button" class="retry" onclick={() => retryLocalAi()}>{t('retryLocalAi')}</button>
				</div>
			{/if}

			<div class="runtime-controls">
				<label class="model-label" for="local-ai-unload-timeout">{t('unloadAfterInactivity')}</label>
				<select
					id="local-ai-unload-timeout"
					value={unloadTimeoutValue}
					disabled={!$settings}
					onchange={(event) => setLocalAiUnloadTimeoutMs(parseTimeout(event.currentTarget.value))}
				>
					{#each LOCAL_AI_UNLOAD_TIMEOUT_CHOICES as timeout (String(timeout))}
						<option value={timeout === null ? 'session' : String(timeout)}>{timeoutLabel(timeout)}</option>
					{/each}
				</select>
				<label class="checkbox-row">
					<input
						type="checkbox"
						checked={$settings?.keepLocalAiLoadedWhileActive ?? true}
						disabled={!$settings}
						onchange={(event) => setKeepLocalAiLoadedWhileActive(event.currentTarget.checked)}
					/>
					<span>{t('keepLoadedWhileActive')}</span>
				</label>
				<label class="checkbox-row">
					<input
						type="checkbox"
						checked={$settings?.autoWarmLocalAiOnActiveSupportedPage ?? false}
						disabled={!$settings || !localAiEnabled}
						onchange={(event) => setAutoWarmLocalAiOnActiveSupportedPage(event.currentTarget.checked)}
					/>
					<span>{t('warmLocalAi')}</span>
				</label>
			</div>
		</div>

		<div class="grid">
			<div>
				<span class="label">{t('localAiStatus')}</span>
				<strong>{localAiLabel}</strong>
			</div>
			<div>
				<span class="label">{t('runtimeStatus')}</span>
				<strong>{runtimeLabel}</strong>
			</div>
			<div>
				<span class="label">{t('passiveWebGpu')}</span>
				<strong>{$status?.webGpu ?? 'checking'}</strong>
			</div>
		</div>

		{#if $status?.notes?.length}
			<ul class="notes" aria-label="Compatibility notes">
				{#each $status.notes as note (note)}
					<li>{note}</li>
				{/each}
			</ul>
		{:else}
			<p class="hint">{t('compatibilityCheckPending')}</p>
		{/if}

		<div class="actions">
			<button type="button" class="rerun" onclick={handleRerun} disabled={rerunInFlight}>
				{rerunInFlight ? t('reRunningSystemCheck') : t('reRunSystemCheck')}
			</button>
			<p class="hint">{t('reRunHint')}</p>
		</div>
	</div>
</article>

<style>
	.card { margin-bottom: 12px; overflow: hidden; border: var(--border-hairline); border-radius: var(--radius-lg); background: var(--color-card); }
	.body { padding: 14px; }
	.summary { display: flex; flex-direction: column; gap: 3px; padding: 12px; border-radius: var(--radius-md); background: var(--color-surface); border: var(--border-hairline); }
	.summary[data-tier='critical'] { border-color: rgb(239 68 68 / 55%); }
	.summary[data-tier='warning'], .summary[data-tier='unknown'] { border-color: rgb(245 158 11 / 55%); }
	.summary[data-tier='ok'] { border-color: rgb(34 197 94 / 45%); }
	.summary-title { font-size: 13px; font-weight: 600; }
	.summary-detail, .label, .hint, .notes { color: var(--color-muted); font-size: 12px; line-height: 1.5; }
	.local-ai-control { margin-top: 12px; padding: 12px; border: var(--border-hairline); border-radius: var(--radius-md); }
	.ai-notice { margin: 0 0 12px; padding: 8px 10px; border-radius: var(--radius-sm); background: var(--color-surface); border: var(--border-hairline); color: var(--color-muted); font-size: 12px; line-height: 1.5; }
	.toggle-row { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
	.toggle-row label, .model-label { display: block; font-size: 13px; font-weight: 600; }
	.toggle-row p { margin: 4px 0 0; color: var(--color-muted); font-size: 12px; line-height: 1.5; }
	input[type='checkbox'] { width: 18px; height: 18px; flex: 0 0 auto; accent-color: var(--color-accent); }
	.model-label { margin-top: 12px; }
	select { width: 100%; margin-top: 6px; padding: 8px; border: var(--border-hairline); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-ink); }
	select:disabled { opacity: 0.7; }
	.runtime-controls { margin-top: 12px; padding-top: 10px; border-top: var(--border-hairline); }
	.checkbox-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; color: var(--color-ink); font-size: 12px; line-height: 1.4; }
	.checkbox-row input { width: 16px; height: 16px; margin: 0; flex: 0 0 auto; accent-color: var(--color-accent); }
	.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px; }
	.grid > div { min-width: 0; }
	.label { display: block; margin-bottom: 2px; }
	strong { display: block; font-size: 12px; font-weight: 600; text-transform: capitalize; }
	.notes { margin: 12px 0 0; padding-left: 18px; }
	.notes li + li { margin-top: 4px; }
	.hint { margin: 12px 0 0; }
	.failure { margin-top: 12px; padding: 10px 12px; border-radius: var(--radius-md); border: 1px solid rgb(239 68 68 / 55%); background: rgb(239 68 68 / 8%); }
	.failure-title { margin: 0; font-size: 13px; font-weight: 600; color: rgb(220 38 38); }
	.failure-detail { margin: 4px 0 8px; font-size: 12px; line-height: 1.5; color: var(--color-muted); }
	.retry { padding: 6px 12px; border-radius: var(--radius-sm); border: var(--border-hairline); background: var(--color-surface); color: var(--color-ink); font-size: 12px; cursor: pointer; }
	.retry:hover { border-color: var(--color-accent); }
	.actions { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; padding-top: 12px; border-top: var(--border-hairline); align-items: flex-start; }
	.actions .hint { margin: 0; }
	.rerun { padding: 6px 12px; border-radius: var(--radius-sm); border: var(--border-hairline); background: var(--color-surface); color: var(--color-ink); font-size: 12px; cursor: pointer; }
	.rerun:hover:not(:disabled) { border-color: var(--color-accent); }
	.rerun:disabled { cursor: progress; opacity: 0.7; }
	@media (max-width: 640px) {
		.grid { grid-template-columns: 1fr; }
	}
</style>
