<script lang="ts">
	import Dropzone from '#lib/components/Dropzone.svelte';
	import ExportBar from '#lib/components/ExportBar.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Preview from '#lib/components/Preview.svelte';
	import PrivacyNote from '#lib/components/PrivacyNote.svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import {
		PipelineError,
		processPhoto,
		type PipelineStep,
		type ProcessedPhoto
	} from '#lib/pipeline/index.ts';
	import { defaultSettings, type Settings } from '#lib/settings/defaults.ts';
	import { loadSettings, saveSettings } from '#lib/settings/storage.ts';

	const SITE_URL = 'https://particle.chelvynkleden.com';
	const TITLE = 'Particle Portrait — turn a photo into a Three.js particle portrait';
	const DESCRIPTION =
		'Upload a photo, turn it into a living Three.js particle portrait, and export a ready-to-use JavaScript file. Runs entirely in your browser.';

	const SAMPLES = ['/samples/sample-portrait.png', '/samples/sample-portrait-2.png'];
	const MAX_PHOTOS = 3;

	const STEPS = [
		{ n: '01', title: 'Upload', text: 'A portrait, straight from your laptop.' },
		{ n: '02', title: 'Cut out', text: 'Background removed right in the browser.' },
		{ n: '03', title: 'Tune', text: 'Density, size, motion, light and dark.' },
		{ n: '04', title: 'Export', text: 'One self-contained JavaScript file.' }
	];

	const STEP_LABELS: Record<PipelineStep | 'building', string> = {
		reading: 'Reading photo',
		'loading-model': 'Loading background model — first time only, about 14 MB',
		'removing-background': 'Removing background',
		encoding: 'Cropping and compressing',
		building: 'Building particles'
	};

	type PhotoEntry = { id: number; file: File; skip: boolean; photo: ProcessedPhoto };

	type Job =
		| { kind: 'processing'; name: string; done: string[]; current: string }
		| { kind: 'error'; message: string; file: File; skip: boolean; replace: number };

	let photos = $state<PhotoEntry[]>([]);
	let job = $state<Job | null>(null);
	let skipBackground = $state(false);
	let settings = $state<Settings>(defaultSettings());

	let run = 0;
	let nextId = 1;
	let settingsLoaded = false;
	let buildTimer: ReturnType<typeof setTimeout> | undefined;

	let editing = $derived(photos.length > 0);
	let sources = $derived(photos.length ? photos.map((entry) => entry.photo.dataUrl) : SAMPLES);
	let busy = $derived(job?.kind === 'processing');

	// Settings (never the photos) survive a refresh.
	$effect(() => {
		settings = loadSettings();
		settingsLoaded = true;
	});

	$effect(() => {
		const snapshot = $state.snapshot(settings);
		if (settingsLoaded) saveSettings(snapshot);
	});

	/** Processes `file` and appends it, or replaces the photo at `replace`. */
	async function process(file: File, skip: boolean, replace = -1) {
		const id = ++run;
		clearTimeout(buildTimer);

		const done: string[] = [];
		job = { kind: 'processing', name: file.name, done, current: STEP_LABELS.reading };
		try {
			const photo = await processPhoto(file, {
				skipBackgroundRemoval: skip,
				onStep: (step) => {
					if (id !== run || job?.kind !== 'processing') return;
					if (job.current === STEP_LABELS[step]) return;
					if (step !== 'reading') done.push(job.current);
					job = { kind: 'processing', name: file.name, done: [...done], current: STEP_LABELS[step] };
				}
			});
			if (id !== run) return;
			done.push(STEP_LABELS.encoding);
			job = { kind: 'processing', name: file.name, done: [...done], current: STEP_LABELS.building };

			const entry = { id: nextId++, file, skip, photo };
			photos =
				replace >= 0
					? photos.map((existing, index) => (index === replace ? entry : existing))
					: [...photos, entry];
			// The preview reports back once the particles show; don't hang if it can't (no WebGL).
			buildTimer = setTimeout(() => finish(id), 2000);
		} catch (error) {
			if (id !== run) return;
			if (!(error instanceof PipelineError)) console.error(error);
			job = {
				kind: 'error',
				message:
					error instanceof PipelineError
						? error.message
						: 'Something went wrong while processing this photo. Try another one.',
				file,
				skip,
				replace
			};
		}
	}

	function finish(id: number) {
		if (id !== run || job?.kind !== 'processing') return;
		clearTimeout(buildTimer);
		job = null;
	}

	function onPreviewShow() {
		if (job?.kind === 'processing' && job.current === STEP_LABELS.building) finish(run);
	}

	function removePhoto(index: number) {
		photos = photos.filter((_, i) => i !== index);
	}

	function startOver() {
		run++;
		clearTimeout(buildTimer);
		photos = [];
		job = null;
	}

	function formatKB(bytes: number) {
		return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	}

	function describe(photo: ProcessedPhoto) {
		const background = photo.hadAlpha
			? 'already transparent'
			: photo.backgroundRemoved
				? 'background removed'
				: 'background kept';
		return `${photo.width}×${photo.height} · ${formatKB(photo.bytes)} · ${background}`;
	}
</script>

<svelte:head>
	<title>{TITLE}</title>
	<meta name="description" content={DESCRIPTION} />
	<link rel="canonical" href="{SITE_URL}/" />

	<!-- Link previews (WhatsApp, X, Threads, LinkedIn, Slack…). Crawlers need absolute URLs. -->
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Particle Portrait" />
	<meta property="og:url" content="{SITE_URL}/" />
	<meta property="og:title" content={TITLE} />
	<meta property="og:description" content={DESCRIPTION} />
	<meta property="og:image" content="{SITE_URL}/og.jpg" />
	<meta property="og:image:type" content="image/jpeg" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="A face made of thousands of white particles next to the words: Turn a photo into a living particle portrait." />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={TITLE} />
	<meta name="twitter:description" content={DESCRIPTION} />
	<meta name="twitter:image" content="{SITE_URL}/og.jpg" />
</svelte:head>

{#snippet jobCard()}
	{#if job?.kind === 'processing'}
		<div class="card" role="status" aria-live="polite">
			<p class="mono muted">Processing — {job.name}</p>
			<ol class="progress">
				{#each job.done as step (step)}
					<li class="mono"><span class="tick" aria-hidden="true">✓</span>{step}</li>
				{/each}
				<li class="mono current"><span class="tick pulse" aria-hidden="true">■</span>{job.current}</li>
			</ol>
		</div>
	{:else if job?.kind === 'error'}
		{@const failed = job}
		<div class="card" role="alert">
			<p class="mono muted">Couldn't process {failed.file.name}</p>
			<p class="card-text">{failed.message}</p>
			<div class="actions">
				{#if !failed.skip}
					<button type="button" class="btn" onclick={() => process(failed.file, true, failed.replace)}>
						Skip background removal
					</button>
				{:else}
					<button type="button" class="btn" onclick={() => process(failed.file, true, failed.replace)}>
						Try again
					</button>
				{/if}
				<button type="button" class="btn ghost" onclick={() => (job = null)}>Dismiss</button>
			</div>
		</div>
	{/if}
{/snippet}

{#snippet skipToggle()}
	<label class="skip">
		<input type="checkbox" bind:checked={skipBackground} />
		<span>
			<span class="skip-title">Skip background removal</span>
			<span class="mono muted skip-hint">For photos already on a plain background, or when the cut-out goes wrong.</span>
		</span>
	</label>
{/snippet}

<div class="shell">
	<header class="header">
		<a class="wordmark" href="/" aria-label="Particle Portrait, home">
			Particle <em>Portrait</em>
		</a>
		<div class="header-meta">
			<span class="mono muted hide-sm">Client-side · v0.1</span>
			<ThemeToggle />
		</div>
	</header>

	<main class="main">
		<section class="preview" aria-label="Preview">
			<Preview
				{sources}
				settings={editing ? settings : undefined}
				label={editing ? 'Your portrait' : 'Sample'}
				tools={editing}
				onshow={onPreviewShow}
			/>
		</section>

		{#if editing}
			<section class="panel" aria-labelledby="editor-title">
				<div class="editor-head">
					<h2 id="editor-title">Tune your portrait</h2>
					<button type="button" class="btn ghost" onclick={startOver}>Start over</button>
				</div>
				<p class="mono muted note">Changes apply live and are saved in this browser. Your photos are not.</p>

				<section class="group" aria-labelledby="group-photos">
					<div class="group-head">
						<h3 id="group-photos" class="mono">Photos</h3>
						<span class="mono muted">{photos.length} / {MAX_PHOTOS}</span>
					</div>

					<ul class="photos">
						{#each photos as entry, index (entry.id)}
							<li class="photo">
								<img class="thumb" src={entry.photo.dataUrl} alt="" />
								<div class="photo-info">
									<p class="photo-name">{entry.file.name}</p>
									<p class="mono muted photo-meta">{describe(entry.photo)}</p>
									<div class="photo-actions">
										{#if !entry.photo.hadAlpha}
											<button
												type="button"
												class="link mono"
												disabled={busy}
												onclick={() => process(entry.file, !entry.skip, index)}
											>
												{entry.skip ? 'Remove background' : 'Keep background'}
											</button>
										{/if}
										<button type="button" class="link mono" disabled={busy} onclick={() => removePhoto(index)}>
											Remove
										</button>
									</div>
								</div>
							</li>
						{/each}
					</ul>

					{@render jobCard()}

					{#if !busy && photos.length < MAX_PHOTOS}
						<Dropzone compact title="Add a photo to morph to" onfile={(file) => process(file, skipBackground)} />
						{@render skipToggle()}
					{/if}
				</section>

				<Panel bind:settings photoCount={photos.length} />

				<ExportBar images={photos.map((entry) => entry.photo.dataUrl)} {settings} />

				<PrivacyNote />
			</section>
		{:else}
			<section class="panel" aria-labelledby="hero-title">
				<p class="eyebrow mono">Three.js · Particle portrait generator</p>

				<h1 id="hero-title">Turn a photo into a <em>living</em> particle portrait.</h1>

				<p class="lede">
					Upload a portrait. It becomes thousands of particles that gather from dust, drift away
					from the cursor and follow light and dark mode. Export it as one JavaScript file for your
					own site.
				</p>

				{#if job}
					{@render jobCard()}
				{/if}
				{#if !busy}
					<Dropzone onfile={(file) => process(file, skipBackground)} />
					{@render skipToggle()}
				{/if}

				<PrivacyNote />

				<ol class="steps">
					{#each STEPS as step (step.n)}
						<li>
							<span class="mono step-n">{step.n}</span>
							<span class="step-title">{step.title}</span>
							<span class="step-text">{step.text}</span>
						</li>
					{/each}
				</ol>
			</section>
		{/if}
	</main>

	<footer class="footer">
		<span class="mono muted">Made by <a href="https://chelvynkleden.com">chelvynkleden.com</a></span>
		<span class="mono muted">Exports are MIT licensed</span>
	</footer>
</div>

<style>
	.shell {
		display: grid;
		grid-template-rows: var(--header-h) 1fr auto;
		min-height: 100dvh;
	}

	/* Header */
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 0 var(--gutter);
		border-bottom: 1px solid var(--line);
		background: var(--bg);
	}

	.wordmark {
		font-size: 20px;
		letter-spacing: -0.01em;
		text-decoration: none;
	}

	.header-meta {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.muted {
		color: var(--muted);
	}

	/* Main: preview left, panel right */
	.main {
		display: grid;
		grid-template-columns: minmax(0, 1.25fr) minmax(360px, 1fr);
	}

	.preview {
		position: sticky;
		top: 0;
		height: calc(100dvh - var(--header-h));
		border-right: 1px solid var(--line);
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 24px;
		max-width: 560px;
		padding: clamp(32px, 6vh, 72px) var(--gutter) 48px;
		background: var(--bg);
	}

	.eyebrow {
		color: var(--muted);
	}

	h1 {
		font-size: clamp(38px, 4.4vw, 60px);
		font-weight: 400;
		line-height: 1.02;
		letter-spacing: -0.025em;
		text-wrap: balance;
	}

	.lede {
		max-width: 46ch;
		color: var(--muted);
		font-size: 18px;
		text-wrap: pretty;
	}

	/* Editor */
	.editor-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	h2 {
		font-size: clamp(30px, 3vw, 40px);
		font-weight: 400;
		line-height: 1.05;
		letter-spacing: -0.02em;
	}

	.note {
		margin-top: -14px;
		text-transform: none;
		letter-spacing: 0.02em;
	}

	.group {
		display: grid;
		gap: 16px;
		padding-top: 20px;
		border-top: 1px solid var(--line);
	}

	.group-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	h3 {
		font-weight: 500;
	}

	.photos {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.photo {
		display: grid;
		grid-template-columns: 56px minmax(0, 1fr);
		gap: 12px;
		padding: 8px;
		border: 1px solid var(--line-strong);
	}

	.thumb {
		width: 56px;
		height: 68px;
		object-fit: contain;
		object-position: 50% 100%;
		background: var(--surface);
		filter: grayscale(1);
	}

	.photo-info {
		display: grid;
		align-content: start;
		gap: 2px;
		min-width: 0;
	}

	.photo-name {
		overflow: hidden;
		font-size: 17px;
		line-height: 1.3;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.photo-meta {
		text-transform: none;
		letter-spacing: 0.02em;
	}

	.photo-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 14px;
		margin-top: 4px;
	}

	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--fg);
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}

	.link:disabled {
		opacity: 0.4;
		cursor: default;
	}

	/* Skip background removal */
	.skip {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		margin-top: -8px;
		cursor: pointer;
	}

	.skip input {
		appearance: none;
		flex: none;
		width: 14px;
		height: 14px;
		margin: 5px 0 0;
		border: 1px solid var(--fg);
		background: var(--bg);
		cursor: pointer;
	}

	.skip input:checked {
		background: var(--fg);
		box-shadow: inset 0 0 0 2px var(--bg);
	}

	.skip > span {
		display: grid;
		gap: 2px;
	}

	.skip-title {
		font-size: 16px;
	}

	.skip-hint {
		text-transform: none;
		letter-spacing: 0.02em;
	}

	/* Status / error card */
	.card {
		display: grid;
		justify-items: start;
		gap: 6px;
		padding: 20px;
		border: 1px solid var(--fg);
		background: var(--bg);
	}

	.card-text {
		font-size: 17px;
		line-height: 1.4;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 8px;
	}

	.progress {
		display: grid;
		gap: 6px;
		margin-top: 6px;
		padding: 0;
		list-style: none;
	}

	.progress li {
		display: flex;
		gap: 10px;
		color: var(--muted);
		text-transform: none;
		letter-spacing: 0.02em;
	}

	.progress li.current {
		color: var(--fg);
	}

	.tick {
		width: 12px;
		text-align: center;
	}

	.pulse {
		animation: pulse 900ms ease-in-out infinite alternate;
	}

	@keyframes pulse {
		from {
			opacity: 1;
		}
		to {
			opacity: 0.2;
		}
	}

	/* Landing steps */
	.steps {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--line);
		border-left: 1px solid var(--line);
	}

	.steps li {
		display: grid;
		gap: 4px;
		padding: 14px 14px 16px;
		border-right: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
		background: var(--bg);
	}

	.step-n {
		color: var(--muted);
	}

	.step-title {
		font-size: 20px;
		line-height: 1.2;
	}

	.step-text {
		color: var(--muted);
		font-size: 15px;
		line-height: 1.4;
	}

	/* Footer */
	.footer {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 8px 16px;
		padding: 14px var(--gutter);
		border-top: 1px solid var(--line);
		background: var(--bg);
	}

	/* Narrow screens: preview on top, panel below */
	@media (max-width: 899px) {
		.main {
			grid-template-columns: minmax(0, 1fr);
		}

		.preview {
			position: static;
			height: auto;
			border-right: 0;
			border-bottom: 1px solid var(--line);
		}

		.panel {
			max-width: none;
			padding-top: 32px;
		}
	}

	@media (max-width: 480px) {
		.hide-sm {
			display: none;
		}

		.steps {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
