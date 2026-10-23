<script lang="ts">
	type Props = {
		label: string;
		value: number;
		min: number;
		max: number;
		step?: number;
		unit?: string;
		hint?: string;
	};

	let { label, value = $bindable(), min, max, step = 1, unit = '', hint }: Props = $props();

	const id = $props.id();
	let decimals = $derived(String(step).split('.')[1]?.length ?? 0);
	let fill = $derived(((value - min) / (max - min)) * 100);
</script>

<div class="slider">
	<label class="mono" for={id}>{label}</label>
	<output class="mono" for={id}>{value.toFixed(decimals)}{unit}</output>
	<input {id} type="range" {min} {max} {step} bind:value style="--fill: {fill}%" />
	{#if hint}
		<p class="hint">{hint}</p>
	{/if}
</div>

<style>
	.slider {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 4px 12px;
	}

	label {
		color: var(--fg);
	}

	output {
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	input {
		grid-column: 1 / -1;
		appearance: none;
		width: 100%;
		height: 18px;
		margin: 0;
		background: transparent;
		cursor: pointer;
	}

	/* Hairline track; the filled part is solid ink (hard stop, not a gradient). */
	input::-webkit-slider-runnable-track {
		height: 1px;
		background: linear-gradient(to right, var(--fg) var(--fill), var(--line-strong) var(--fill));
	}

	input::-moz-range-track {
		height: 1px;
		background: var(--line-strong);
	}

	input::-moz-range-progress {
		height: 1px;
		background: var(--fg);
	}

	input::-webkit-slider-thumb {
		appearance: none;
		width: 11px;
		height: 11px;
		margin-top: -5px;
		border: 1px solid var(--fg);
		border-radius: 0;
		background: var(--bg);
	}

	input::-moz-range-thumb {
		width: 9px;
		height: 9px;
		border: 1px solid var(--fg);
		border-radius: 0;
		background: var(--bg);
	}

	input:hover::-webkit-slider-thumb,
	input:focus-visible::-webkit-slider-thumb {
		background: var(--fg);
	}

	input:hover::-moz-range-thumb,
	input:focus-visible::-moz-range-thumb {
		background: var(--fg);
	}

	input:focus-visible {
		outline: 1px solid var(--fg);
		outline-offset: 2px;
	}

	.hint {
		grid-column: 1 / -1;
		color: var(--muted);
		font-size: 14px;
		line-height: 1.35;
	}
</style>
