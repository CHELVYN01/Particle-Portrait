<script lang="ts">
	import ColorField from './controls/ColorField.svelte';
	import Segmented from './controls/Segmented.svelte';
	import Slider from './controls/Slider.svelte';
	import Toggle from './controls/Toggle.svelte';
	import { defaultSettings, type Settings } from '#lib/settings/defaults.ts';
	import { PRESETS, matchPreset, presetSettings } from '#lib/settings/presets.ts';
	import { encodeSettings } from '#lib/settings/share.ts';

	type Props = {
		settings: Settings;
		/** Morph controls only matter with more than one photo. */
		photoCount: number;
	};

	let { settings = $bindable(), photoCount }: Props = $props();

	let active = $derived(matchPreset(settings));
	let isDefault = $derived(JSON.stringify(settings) === JSON.stringify(defaultSettings()));

	let shareLabel = $state('Copy share link');
	let shareTimer: ReturnType<typeof setTimeout> | undefined;

	async function share() {
		const url = location.origin + location.pathname + encodeSettings($state.snapshot(settings) as Settings);
		try {
			await navigator.clipboard.writeText(url);
			shareLabel = 'Link copied';
		} catch {
			shareLabel = "Couldn't copy";
			console.error('Clipboard unavailable. Link:', url);
		}
		clearTimeout(shareTimer);
		shareTimer = setTimeout(() => (shareLabel = 'Copy share link'), 2500);
	}

	// Presets and reset keep the alt text and theme lock — those describe the site, not the look.
	function apply(next: Settings) {
		settings = { ...next, alt: settings.alt, theme: settings.theme };
	}
</script>

<div class="panel">
	<section class="group" aria-labelledby="group-presets">
		<div class="group-head">
			<h3 id="group-presets" class="mono">Presets</h3>
			<span class="mono muted">{active ? active.name : 'Custom'}</span>
		</div>
		<div class="presets">
			{#each PRESETS as preset (preset.id)}
				<button
					type="button"
					class="preset"
					aria-pressed={active?.id === preset.id}
					onclick={() => apply(presetSettings(preset))}
				>
					<span class="preset-name">{preset.name}</span>
					<span class="preset-text">{preset.description}</span>
				</button>
			{/each}
		</div>
		<div class="row">
			<button type="button" class="btn ghost" disabled={isDefault} onclick={() => apply(defaultSettings())}>
				Reset to defaults
			</button>
			<button type="button" class="btn ghost" onclick={share} aria-live="polite">{shareLabel}</button>
		</div>
		<p class="hint">The link carries these settings only. Your photo is never included.</p>
	</section>

	<section class="group" aria-labelledby="group-particles">
		<h3 id="group-particles" class="mono">Particles</h3>
		<Slider
			label="Density"
			bind:value={settings.density}
			min={120}
			max={360}
			step={10}
			unit=" px"
			hint="Sample width. Higher is finer and heavier."
		/>
		<Slider label="Point size" bind:value={settings.pointSize} min={0.5} max={2.5} step={0.05} unit="×" />
		<Slider label="Sharpen" bind:value={settings.sharpen} min={0} max={3} step={0.1} />
		<Toggle
			label="Auto levels"
			bind:checked={settings.autoLevels}
			hint="Stretch the photo's tones to full black-to-white. Helps dark or flat photos."
		/>
		<Slider label="Brightness" bind:value={settings.brightness} min={-0.5} max={0.5} step={0.01} />
		<Slider label="Contrast" bind:value={settings.contrast} min={0.5} max={2} step={0.05} unit="×" />
	</section>

	<section class="group" aria-labelledby="group-layout">
		<h3 id="group-layout" class="mono">Layout</h3>
		<Segmented
			label="Align"
			bind:value={settings.align}
			options={[
				{ value: 'left', label: 'Left' },
				{ value: 'center', label: 'Center' },
				{ value: 'right', label: 'Right' }
			]}
		/>
		<Slider
			label="Fill"
			bind:value={settings.fill}
			min={0.5}
			max={1.2}
			step={0.01}
			hint="Portrait height relative to its container."
		/>
		<Slider
			label="Edge fade"
			bind:value={settings.edgeFade}
			min={0}
			max={1}
			step={0.05}
			hint="Dissolves the photo's hard crop at the sides and bottom."
		/>
	</section>

	<section class="group" aria-labelledby="group-color">
		<h3 id="group-color" class="mono">Color</h3>
		<Segmented
			label="Site theme"
			bind:value={settings.theme}
			options={[
				{ value: 'auto', label: 'Follow site' },
				{ value: 'light', label: 'Always light' },
				{ value: 'dark', label: 'Always dark' }
			]}
		/>
		<div class="palette">
			<p class="mono muted">Light theme</p>
			<ColorField label="Main" bind:value={settings.colors.light.main} />
			<ColorField label="Shadow" bind:value={settings.colors.light.shadow} />
			<Slider label="Opacity" bind:value={settings.opacity.light} min={0} max={1} step={0.05} />
		</div>
		<div class="palette">
			<p class="mono muted">Dark theme</p>
			<ColorField label="Main" bind:value={settings.colors.dark.main} />
			<ColorField label="Shadow" bind:value={settings.colors.dark.shadow} />
			<Slider label="Opacity" bind:value={settings.opacity.dark} min={0} max={1} step={0.05} />
		</div>
	</section>

	<section class="group" aria-labelledby="group-motion">
		<h3 id="group-motion" class="mono">Motion</h3>
		<Toggle label="Intro" bind:checked={settings.intro.enabled} hint="Particles gather from dust on load." />
		{#if settings.intro.enabled}
			<Slider label="Intro duration" bind:value={settings.intro.duration} min={1} max={6} step={0.1} unit=" s" />
		{/if}
		<Slider
			label="Cursor repel"
			bind:value={settings.mouseRepel}
			min={0}
			max={200}
			step={5}
			unit=" px"
			hint="Radius around the cursor. 0 turns it off."
		/>
		<Slider label="Tilt" bind:value={settings.tilt} min={0} max={15} step={1} unit="°" />
		<Slider label="Shimmer" bind:value={settings.shimmer} min={0} max={2} step={0.05} />
		<Slider label="Dust" bind:value={settings.dust} min={0} max={600} step={10} />
		<Toggle
			label="Scatter on scroll"
			bind:checked={settings.scrollScatter}
			hint="Particles drift apart as the portrait scrolls out of view."
		/>
	</section>

	{#if photoCount > 1}
		<section class="group" aria-labelledby="group-morph">
			<h3 id="group-morph" class="mono">Morph</h3>
			<Toggle label="Auto morph" bind:checked={settings.morph.auto} hint="Cycle through the photos on its own." />
			<Slider label="Hold" bind:value={settings.morph.hold} min={1} max={15} step={0.5} unit=" s" />
			<Slider label="Morph duration" bind:value={settings.morph.duration} min={0.8} max={5} step={0.1} unit=" s" />
		</section>
	{/if}

	<section class="group" aria-labelledby="group-mobile">
		<h3 id="group-mobile" class="mono">Mobile visitors</h3>
		<Toggle
			label="Run on phones"
			bind:checked={settings.mobile.enabled}
			hint="Screens up to 768px. Off shows the still image instead."
		/>
		{#if settings.mobile.enabled}
			<Slider
				label="Density on phones"
				bind:value={settings.mobile.densityScale}
				min={0.3}
				max={1}
				step={0.05}
				unit="×"
			/>
		{/if}
	</section>

	<section class="group" aria-labelledby="group-a11y">
		<h3 id="group-a11y" class="mono">Accessibility</h3>
		<label class="field">
			<span class="mono">Alt text</span>
			<input type="text" bind:value={settings.alt} placeholder="Portrait of …" />
			<span class="hint">Read by screen readers instead of the animation.</span>
		</label>
	</section>
</div>

<style>
	.panel {
		display: grid;
	}

	.group {
		display: grid;
		gap: 16px;
		padding: 20px 0 24px;
		border-top: 1px solid var(--line);
	}

	.group-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	h3 {
		font-weight: 500;
		color: var(--fg);
	}

	.muted {
		color: var(--muted);
	}

	.presets {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		border-top: 1px solid var(--line-strong);
		border-left: 1px solid var(--line-strong);
	}

	.preset {
		display: grid;
		gap: 2px;
		padding: 10px 12px 12px;
		border: 0;
		border-right: 1px solid var(--line-strong);
		border-bottom: 1px solid var(--line-strong);
		background: var(--bg);
		text-align: left;
		cursor: pointer;
	}

	.preset:hover {
		background: var(--surface);
	}

	.preset[aria-pressed='true'] {
		background: var(--fg);
		color: var(--bg);
	}

	.preset-name {
		font-size: 18px;
		line-height: 1.2;
	}

	.preset-text {
		font-size: 14px;
		line-height: 1.3;
		opacity: 0.7;
	}

	.btn:disabled {
		opacity: 0.4;
		cursor: default;
		background: transparent;
		color: var(--fg);
	}

	.palette {
		display: grid;
		gap: 10px;
		padding: 12px;
		border: 1px solid var(--line);
	}

	.field {
		display: grid;
		gap: 6px;
	}

	.field input {
		height: 34px;
		padding: 0 10px;
		border: 1px solid var(--line-strong);
		background: var(--bg);
		font-size: 16px;
	}

	.field input:focus {
		border-color: var(--fg);
		outline: none;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.row .btn {
		flex: 1;
	}

	.hint {
		color: var(--muted);
		font-size: 14px;
		line-height: 1.35;
	}
</style>
