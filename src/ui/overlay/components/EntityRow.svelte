<script lang="ts">
  import { t, entityTypeLabel } from '../../../shared/i18n';
  import { ENTITY_TYPES, type EntityType } from '../../../shared/message-types';
  import { truncate, type SpanState } from '../overlay-model';

  let {
    state,
    index,
    belowThreshold,
    onToggle,
    onRetype,
    onDismissClick,
  }: {
    state: SpanState;
    index: number;
    belowThreshold: boolean;
    onToggle: (i: number, enabled: boolean) => void;
    onRetype: (i: number, type: EntityType) => void;
    onDismissClick: (i: number, anchor: HTMLElement) => void;
  } = $props();
</script>

<div
  class={[
    'pg-entity-row',
    belowThreshold && 'pg-below-threshold',
    state.enabled && 'pg-entity-row-selected',
    state.whitelisted && 'pg-entity-row-whitelisted',
  ]}
>
  {#if state.whitelisted}
    <span class="pg-entity-checkbox" aria-hidden="true"></span>
  {:else}
    <label class="pg-entity-checkbox">
      <input
        type="checkbox"
        checked={state.enabled}
        onchange={(e) => onToggle(index, e.currentTarget.checked)}
      />
    </label>
  {/if}

  <span class="pg-entity-text" title={state.span.text}>{truncate(state.span.text, 24)}</span>

  {#if state.whitelisted}
    <!-- Disabled select so the layout box is identical to the real
         select in non-whitelisted rows (UA gives selects an intrinsic
         min-width a span can't match). -->
    <select class="pg-entity-type pg-entity-type-whitelisted" disabled aria-label={t('whitelisted')}>
      <option>{t('whitelisted')}</option>
    </select>
  {:else}
    <select
      class="pg-entity-type pg-pill-{state.entityType.toLowerCase()}"
      aria-label={t('entityTypeAria')}
      value={state.entityType}
      onchange={(e) => onRetype(index, e.currentTarget.value as EntityType)}
    >
      {#each ENTITY_TYPES as et (et)}
        <option value={et}>{entityTypeLabel(et)}</option>
      {/each}
    </select>
  {/if}

  <span class="pg-entity-score">{(state.span.score * 100).toFixed(0)}%</span>

  {#if state.whitelisted}
    <span class="pg-entity-dismiss" aria-hidden="true"></span>
  {:else}
    <button
      type="button"
      class="pg-entity-dismiss"
      title={t('notPii')}
      aria-label={t('markAsNotPii')}
      onclick={(e) => onDismissClick(index, e.currentTarget as HTMLElement)}
    >×</button>
  {/if}
</div>
