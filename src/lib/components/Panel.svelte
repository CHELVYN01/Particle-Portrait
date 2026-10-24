<script lang="ts">
	import ColorField from './controls/ColorField.svelte';
	import Segmented from './controls/Segmented.svelte';
	import Slider from './controls/Slider.svelte';
	import Toggle from './controls/Toggle.svelte';
	import { defaultSettings, type Settings } from '#lib/settings/defaults.ts';
	import { PRESETS, matchPreset, presetSettings } from '#lib/settings/presets.ts';
	import { encodeSettings } from '#lib/settings/share.ts';
	import {
		MAX_NAME,
		MAX_PRESETS,
		addUserPreset,
		loadUserPresets,
		presetsFromFile,
		presetsToFile,
		removeUserPreset,
		saveUserPresets
	} from '#lib/settings/user-presets.ts';
	import type { Preset } from '#lib/settings/presets.ts';

	type Props = {
		settings: Settings;
		/** Morph controls only matter with more than one photo. */
		photoCount: number;
	};

	let { settings = $bindable(), photoCount }: Props = $props();

	let saved = $state<Preset[]>([]);
	let active = $derived(matchPreset(settings, saved));
	let isDefault = $derived(JSON.stringify(settings) === JSON.stringify(defaultSettings()));

	let naming = $state(false);
	let newName = $state('');
	let armedDelete = $state('');
	let armTimer: ReturnType<typeof setTimeout> | undefined;
	let presetNote = $state('');
	let noteTimer: ReturnType<typeof setTimeout> | undefined;
	let importInput: HTMLInputElement | undefined = $state();

	$effect(() => {
		saved = loadUserPresets();
	});

	function note(message: string) {
		presetNote = message;
		clearTimeout(noteTimer);
		noteTimer = setTimeout(() => (presetNote = ''), 3500);
	}

	function commit(list: Preset[]) {
		saved = list;
		saveUserPresets(list);
	}

	function startNaming() {
		newName = '';
		naming = true;
	}

	function savePreset() {
		const replaces = saved.some((item) => item.name.toLowerCase() === newName.trim().toLowerCase());
		if (!replaces && saved.length >= MAX_PRESETS) {
			note(`You can keep up to ${MAX_PRESETS} presets. Delete one first.`);
			return;
		}
		const next = addUserPreset(saved, newName, $state.snapshot(settings) as Settings);
		if (!next) return;
		commit(next);
		note(replaces ? 'Preset updated' : 'Preset saved');
		naming = false;
	}

	function removePreset(id: string) {
		// First click arms the button, second deletes.
		if (armedDelete !== id) {
			armedDelete = id;
			clearTimeout(armTimer);
			armTimer = setTimeout(() => (armedDelete = ''), 3000);
			return;
		}
		armedDelete = '';
		commit(removeUserPreset(saved, id));
	}

	function exportPresets() {
		const blob = new Blob([presetsToFile(saved)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'particle-portrait-presets.json';
		document.body.append(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 10_000);
	}

	async function importPresets(event: Event & { currentTarget: HTMLInputElement }) {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		if (!file) return;
		if (file.size > 256 * 1024) return note("That file is too big to be a preset file.");
		const result = presetsFromFile(saved, await file.text());
		if (!result) return note("That isn't a Particle Portrait preset file.");
		commit(result.list);
		note(`${result.added} preset${result.added === 1 ? '' : 's'} imported`);
	}

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
			{#each [...PRESETS, ...saved] as preset (preset.id)}
				<div class="preset-cell">
					<button
						type="button"
						class="preset"
						aria-pressed={active?.id === preset.id}
						onclick={() => apply(presetSettings(preset))}
					>
						<span class="preset-name">{preset.name}</span>
						<span class="preset-text">{preset.description}</span>
					</button>
					{#if preset.custom}
						<button
							type="button"
							class="preset-delete mono"
							class:armed={armedDelete === preset.id}
							aria-label={armedDelete === preset.id ? `Confirm: delete preset ${preset.name}` : `Delete preset ${preset.name}`}
							onclick={() => removePreset(preset.id)}
						>
							{armedDelete === preset.id ? 'Delete?' : '×'}
						</button>
					{/if}
				</div>
			{/each}
		</div>

		{#if naming}
			<form
				class="name-form"
				onsubmit={(event) => {
					event.preventDefault();
					savePreset();
				}}
			>
				<input
					type="text"
					bind:value={newName}
					maxlength={MAX_NAME}
					placeholder="Preset name"
					aria-label="Preset name"
					onkeydown={(event) => event.key === 'Escape' && (naming = false)}
					{@attach (node) => node.focus()}
				/>
				<button type="submit" class="btn" disabled={!newName.trim()}>Save</button>
				<button type="button" class="btn ghost" onclick={() => (naming = false)}>Cancel</button>
			</form>
		{:else}
			<div class="row">
				<button type="button" class="btn ghost" onclick={startNaming}>Save as preset</button>
				<button type="button" class="btn ghost" disabled={!saved.length} onclick={exportPresets}>
					Export presets
				</button>
				<button type="button" class="btn ghost" onclick={() => importInput?.click()}>Import presets</button>
			</div>
		{/if}
		<input
			bind:this={importInput}
			type="file"
			accept="application/json,.json"
			class="visually-hidden"
			tabindex="-1"
			aria-hidden="true"
			onchange={importPresets}
		/>
		<p class="hint" role="status" aria-live="polite">
			{presetNote || 'Saved presets stay in this browser. Same name replaces a preset. Your photo is never saved.'}
		</p>
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
		<Segmented
			label="Shape"
			columns={3}
			bind:value={settings.shape}
			options={[
				{ value: 'square', label: 'Square' },
				{ value: 'circle', label: 'Circle' },
				{ value: 'diamond', label: 'Diamond' },
				{ value: 'plus', label: 'Plus' },
				{ value: 'line', label: 'Line' },
				{ value: 'ascii', label: 'ASCII' }
			]}
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
		<Segmented
			label="Particle color"
			bind:value={settings.colorMode}
			options={[
				{ value: 'palette', label: 'Palette' },
				{ value: 'photo', label: 'Photo colors' }
			]}
		/>
		{#if settings.colorMode === 'photo'}
			<p class="hint">Particles keep the colors of your photo. The palette below then only tints the floating dust.</p>
			<Slider
				label="Color strength"
				bind:value={settings.colorStrength}
				min={0.5}
				max={2.5}
				step={0.1}
				unit="×"
				hint="Raise it if pale areas such as skin look washed out."
			/>
		{/if}
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
		<Segmented
			label="Cursor effect"
			bind:value={settings.mouseMode}
			options={[
				{ value: 'repel', label: 'Repel' },
				{ value: 'attract', label: 'Attract' }
			]}
		/>
		<Slider
			label="Cursor radius"
			bind:value={settings.mouseRepel}
			min={0}
			max={200}
			step={5}
			unit=" px"
			hint="Radius around the cursor. 0 turns it off."
		/>
		<Segmented
			label="Click effect"
			bind:value={settings.click}
			options={[
				{ value: 'off', label: 'Off' },
				{ value: 'burst', label: 'Burst' },
				{ value: 'ripple', label: 'Ripple' }
			]}
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

	.preset-cell {
		position: relative;
		display: grid;
	}

	.preset-delete {
		position: absolute;
		top: 6px;
		right: 6px;
		min-width: 22px;
		height: 22px;
		padding: 0 6px;
		border: 1px solid transparent;
		background: transparent;
		color: var(--muted);
		cursor: pointer;
	}

	.preset-delete:hover,
	.preset-delete.armed {
		border-color: var(--fg);
		color: var(--fg);
	}

	.name-form {
		display: flex;
		gap: 8px;
	}

	.name-form input {
		flex: 1;
		min-width: 0;
		min-height: 36px;
		padding: 0 10px;
		border: 1px solid var(--line-strong);
		background: transparent;
		color: var(--fg);
		font-family: inherit;
		font-size: 16px;
	}

	.name-form input:focus {
		border-color: var(--fg);
		outline: none;
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
