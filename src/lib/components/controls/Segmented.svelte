<script lang="ts" generics="T extends string">
	type Props = {
		label: string;
		options: { value: T; label: string }[];
		value: T;
		/** Hide the label visually (still announced). */
		compact?: boolean;
	};

	let { label, options, value = $bindable(), compact = false }: Props = $props();
</script>

<div class="segmented" class:compact>
	<span class="mono label" class:visually-hidden={compact}>{label}</span>
	<div class="options" role="radiogroup" aria-label={label}>
		{#each options as option (option.value)}
			<button
				type="button"
				role="radio"
				class="mono"
				aria-checked={option.value === value}
				onclick={() => (value = option.value)}
			>
				{option.label}
			</button>
		{/each}
	</div>
</div>

<style>
	.segmented {
		display: grid;
		gap: 6px;
	}

	.options {
		display: flex;
		border: 1px solid var(--line-strong);
	}

	button {
		flex: 1;
		min-height: 28px;
		padding: 0 10px;
		border: 0;
		border-left: 1px solid var(--line-strong);
		background: var(--bg);
		color: var(--muted);
		cursor: pointer;
		white-space: nowrap;
	}

	button:first-child {
		border-left: 0;
	}

	button:hover {
		color: var(--fg);
	}

	button[aria-checked='true'] {
		background: var(--fg);
		color: var(--bg);
	}

	button:focus-visible {
		outline: 1px solid var(--fg);
		outline-offset: 2px;
	}
</style>
