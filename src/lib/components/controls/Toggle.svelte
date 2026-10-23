<script lang="ts">
	type Props = {
		label: string;
		checked: boolean;
		hint?: string;
	};

	let { label, checked = $bindable(), hint }: Props = $props();
</script>

<label class="toggle">
	<input class="visually-hidden" type="checkbox" role="switch" bind:checked />
	<span class="switch" aria-hidden="true"><span class="knob"></span></span>
	<span class="text">
		<span class="mono label">{label}</span>
		{#if hint}
			<span class="hint">{hint}</span>
		{/if}
	</span>
</label>

<style>
	.toggle {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		cursor: pointer;
	}

	.switch {
		position: relative;
		flex: none;
		width: 26px;
		height: 14px;
		margin-top: 2px;
		border: 1px solid var(--fg);
		background: var(--bg);
		transition: background-color 120ms ease;
	}

	.knob {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 8px;
		height: 8px;
		background: var(--fg);
		transition: transform 120ms ease;
	}

	input:checked + .switch {
		background: var(--fg);
	}

	input:checked + .switch .knob {
		background: var(--bg);
		transform: translateX(12px);
	}

	.toggle:has(input:focus-visible) .switch {
		outline: 1px solid var(--fg);
		outline-offset: 2px;
	}

	.text {
		display: grid;
		gap: 2px;
	}

	.hint {
		color: var(--muted);
		font-size: 14px;
		line-height: 1.35;
	}
</style>
