<script lang="ts">
	type Props = {
		label: string;
		value: string;
	};

	let { label, value = $bindable() }: Props = $props();

	const id = $props.id();
	let text = $state('');

	// Keep the text field in sync when the value changes elsewhere (picker, preset, reset).
	$effect(() => {
		text = value;
	});

	function normalize(input: string) {
		const hex = input.trim().replace(/^#?/, '#').toLowerCase();
		if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
		if (/^#[0-9a-f]{3}$/.test(hex)) return `#${[...hex.slice(1)].map((c) => c + c).join('')}`;
		return null;
	}

	function onInput(event: Event & { currentTarget: HTMLInputElement }) {
		text = event.currentTarget.value;
		const hex = normalize(text);
		if (hex) value = hex;
	}

	function onBlur() {
		text = value;
	}
</script>

<div class="color">
	<label class="mono" for={id}>{label}</label>
	<label class="swatch" style="background: {value}" title="Pick a color">
		<input class="visually-hidden" type="color" bind:value aria-label="{label} color picker" />
	</label>
	<input
		{id}
		class="hex mono"
		type="text"
		spellcheck="false"
		autocomplete="off"
		maxlength="7"
		value={text}
		oninput={onInput}
		onblur={onBlur}
	/>
</div>

<style>
	.color {
		display: grid;
		grid-template-columns: 1fr auto 76px;
		align-items: center;
		gap: 8px;
	}

	.swatch {
		position: relative;
		width: 22px;
		height: 22px;
		border: 1px solid var(--line-strong);
		cursor: pointer;
	}

	.swatch:hover {
		border-color: var(--fg);
	}

	.swatch:has(input:focus-visible) {
		outline: 1px solid var(--fg);
		outline-offset: 2px;
	}

	.hex {
		width: 100%;
		height: 26px;
		padding: 0 6px;
		border: 1px solid var(--line);
		background: var(--bg);
		text-transform: lowercase;
	}

	.hex:focus {
		border-color: var(--fg);
		outline: none;
	}
</style>
