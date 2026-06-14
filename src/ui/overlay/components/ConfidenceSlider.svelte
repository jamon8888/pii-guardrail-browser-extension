<script lang="ts">
  import { t } from '../../../shared/i18n';

  let {
    value,
    onChange,
  }: { value: number; onChange: (v: number) => void } = $props();
</script>

<div class="pg-threshold-row">
  <label class="pg-threshold-label" for="pg-threshold">{t('minConfidence')}</label>
  <input
    id="pg-threshold"
    type="range"
    class="pg-threshold-slider"
    min="0"
    max="100"
    value={Math.round(value * 100)}
    oninput={(e) => onChange(parseInt(e.currentTarget.value, 10) / 100)}
  />
  <span class="pg-threshold-value">{Math.round(value * 100)}%</span>
</div>
