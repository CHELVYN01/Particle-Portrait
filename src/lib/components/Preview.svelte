<script lang="ts">
	// Live preview: the real engine (same source as the export).
	import { untrack } from 'svelte';
	import Segmented from './controls/Segmented.svelte';
	import {
		createPortrait,
		type Portrait,
		type PortraitOptionsInput
	} from '#lib/engine/particle-portrait.js';
	import { defaultSettings, type Settings } from '#lib/settings/defaults.ts';

	type PreviewTheme = 'auto' | 'light' | 'dark';
	type Device = 'desktop' | 'tablet' | 'mobile';

	type Props = {
		sources: string[];
		/** Panel settings; without them the engine defaults are used (landing sample). */
		settings?: Settings;
		label?: string;
		/** Show the theme / device toolbar and FPS readout. */
		tools?: boolean;
		/** Fires when a portrait starts showing (after the particles are built). */
		onshow?: (index: number) => void;
	};

	let { sources, settings, label = 'Sample', tools = false, onshow }: Props = $props();

	const DEVICE_WIDTH: Record<Device, string> = { desktop: '100%', tablet: '768px', mobile: '390px' };
	// Changing these re-samples the photo, so slider drags are debounced.
	const RESAMPLE_KEYS = ['density', 'sharpen', 'edgeFade', 'autoLevels'] as const;

	let stage: HTMLElement | undefined = $state();
	let portrait: Portrait | null = $state(null);
	let count = $state(0);
	let current = $state(0);
	let fps = $state(0);
	let motion = $state(true);
	let previewTheme = $state<PreviewTheme>('auto');
	let device = $state<Device>('desktop');

	// What the engine gets: the settings, as a visitor on `device` would see them.
	let options = $derived.by((): PortraitOptionsInput => {
		// Snapshot reads every nested field, so a colour or opacity change re-runs this too.
		// Without settings (landing sample), reset to the engine defaults.
		const next: PortraitOptionsInput = settings ? $state.snapshot(settings) : defaultSettings();
		if (!settings) return next;
		// The tool itself runs on a laptop, so apply the phone scaling by hand.
		if (device === 'mobile') {
			next.density = Math.round(settings.density * settings.mobile.densityScale);
		}
		next.theme = settings.theme !== 'auto' ? settings.theme : previewTheme;
		return next;
	});

	let stillOnly = $derived(tools && device === 'mobile' && settings?.mobile.enabled === false);
	let frameTheme = $derived(
		settings && settings.theme !== 'auto' ? settings.theme : previewTheme
	);

	$effect(() => {
		if (!stage) return;
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
		const onMotion = () => (motion = !reducedMotion.matches);
		onMotion();
		reducedMotion.addEventListener('change', onMotion);

		const instance = createPortrait(stage, {
			...untrack(() => options),
			image: untrack(() => sources),
			alt: 'Particle portrait preview',
			onShow: (index) => {
				current = index;
				count = instance.count;
				untrack(() => onshow)?.(index);
			}
		});
		portrait = instance;

		return () => {
			reducedMotion.removeEventListener('change', onMotion);
			instance.destroy();
			portrait = null;
		};
	});

	// Swap images in place (no new canvas); the engine re-samples and replays the intro.
	$effect(() => {
		const image = sources;
		untrack(() => portrait)?.update({ image });
	});

	let resampleTimer: ReturnType<typeof setTimeout> | undefined;
	let appliedResample = '';

	$effect(() => {
		const next = options;
		const instance = untrack(() => portrait);
		if (!instance) return;
		const resample = JSON.stringify(RESAMPLE_KEYS.map((key) => next[key]));
		clearTimeout(resampleTimer);
		if (resample === appliedResample) {
			instance.update(next);
			return;
		}
		// Apply everything else now; re-sampling settings once the slider settles.
		const live = { ...next };
		for (const key of RESAMPLE_KEYS) delete live[key];
		instance.update(live);
		resampleTimer = setTimeout(() => {
			appliedResample = resample;
			instance.update(next);
		}, 140);
		return () => clearTimeout(resampleTimer);
	});

	// FPS readout (the whole page's frame rate, which is what the engine gets).
	$effect(() => {
		if (!tools) return;
		let frames = 0;
		let since = performance.now();
		let raf = requestAnimationFrame(function loop(now) {
			frames++;
			if (now - since >= 500) {
				fps = Math.round((frames * 1000) / (now - since));
				frames = 0;
				since = now;
			}
			raf = requestAnimationFrame(loop);
		});
		return () => cancelAnimationFrame(raf);
	});
</script>

<figure class="stage" class:tools>
	<div
		class="frame theme-{frameTheme}"
		class:framed={device !== 'desktop'}
		style="--frame-width: {tools ? DEVICE_WIDTH[device] : '100%'}"
	>
		<div class="canvas" class:hidden={stillOnly} bind:this={stage}></div>
		{#if stillOnly}
			<div class="still">
				<img src={sources[current] ?? sources[0]} alt="" />
				<p class="mono">Phones see this still image (Run on phones is off)</p>
			</div>
		{/if}
	</div>

	<div class="label top-left">
		<span class="mono">Fig.</span>
		{#each sources as src, index (src)}
			<button
				type="button"
				class="fig mono"
				class:active={index === current}
				aria-pressed={index === current}
				aria-label="Show portrait {index + 1}"
				onclick={() => portrait?.show(index)}
			>
				{String(index + 1).padStart(2, '0')}
			</button>
		{/each}
		<span class="mono">— {label}</span>
	</div>

	<div class="label top-right">
		<span class="mono readout">
			{count ? `${count.toLocaleString('en-US')} particles` : 'Loading'}{tools && fps ? ` · ${fps} fps` : ''}
		</span>
		{#if motion && count}
			<button type="button" class="btn ghost replay" onclick={() => portrait?.replay()}>Replay</button>
		{/if}
	</div>

	{#if tools}
		<div class="toolbar">
			<Segmented
				label="Preview theme"
				compact
				bind:value={previewTheme}
				options={[
					{ value: 'auto', label: 'Auto' },
					{ value: 'light', label: 'Light' },
					{ value: 'dark', label: 'Dark' }
				]}
			/>
			<Segmented
				label="Preview width"
				compact
				bind:value={device}
				options={[
					{ value: 'desktop', label: 'Desktop' },
					{ value: 'tablet', label: 'Tablet' },
					{ value: 'mobile', label: 'Mobile' }
				]}
			/>
		</div>
	{:else}
		<figcaption class="label bottom-left mono">Move your cursor through it</figcaption>
	{/if}
</figure>

<style>
	.stage {
		position: relative;
		height: 100%;
		min-height: 360px;
		margin: 0;
		overflow: hidden;
	}

	.frame {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: min(100%, var(--frame-width));
		transform: translateX(-50%);
		color: var(--fg);
		transition: width 200ms ease;
	}

	.stage.tools .frame {
		top: 48px;
		bottom: 56px;
	}

	.frame.framed {
		border-left: 1px solid var(--line-strong);
		border-right: 1px solid var(--line-strong);
	}

	/* Simulate the visitor's site theme, independent of the tool theme. */
	.frame.theme-light {
		--bg: #ffffff;
		--fg: #0a0a0a;
		--muted: #6b6b6b;
		--line-strong: rgba(10, 10, 10, 0.42);
		background: var(--bg);
	}

	.frame.theme-dark {
		--bg: #0a0a0a;
		--fg: #f2f2f2;
		--muted: #8c8c8c;
		--line-strong: rgba(242, 242, 242, 0.42);
		background: var(--bg);
	}

	.canvas {
		position: absolute;
		inset: 0;
	}

	.canvas.hidden {
		visibility: hidden;
	}

	.still {
		position: absolute;
		inset: 0;
		display: grid;
		grid-template-rows: 1fr auto;
		justify-items: center;
	}

	.still img {
		align-self: end;
		max-width: 92%;
		max-height: 88%;
		object-fit: contain;
		filter: grayscale(1);
	}

	.still p {
		padding: 10px;
		color: var(--muted);
		text-align: center;
	}

	.label {
		position: absolute;
		color: var(--muted);
	}

	.top-left {
		top: 10px;
		left: var(--gutter);
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.fig {
		min-height: 28px;
		padding: 0 4px;
		border: 0;
		border-bottom: 1px solid transparent;
		background: transparent;
		color: var(--muted);
		cursor: pointer;
	}

	.fig:hover {
		color: var(--fg);
	}

	.fig.active {
		color: var(--fg);
		border-bottom-color: var(--fg);
	}

	.top-right {
		top: 10px;
		right: var(--gutter);
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.readout {
		font-variant-numeric: tabular-nums;
	}

	.replay {
		min-height: 28px;
		padding: 0 10px;
		background: var(--bg);
		color: var(--fg);
	}

	.bottom-left {
		bottom: 16px;
		left: var(--gutter);
	}

	.toolbar {
		position: absolute;
		left: var(--gutter);
		right: var(--gutter);
		bottom: 12px;
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 8px;
	}

	@media (max-width: 899px) {
		.stage {
			min-height: 0;
			height: min(60vh, 480px);
		}
	}
</style>
