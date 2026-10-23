<script lang="ts">
	import Segmented from './controls/Segmented.svelte';
	import type { Settings } from '#lib/settings/defaults.ts';

	type ExportModule = typeof import('#lib/export/index.ts');
	type ThreeSource = import('#lib/export/index.ts').ThreeSource;
	type SnippetId = import('#lib/export/index.ts').SnippetId;

	type Props = {
		/** PNG data URLs of the user's photos. */
		images: string[];
		settings: Settings;
	};

	let { images, settings }: Props = $props();

	const THREE_KEY = 'pp:export:three';

	// The export code (engine source, templates) loads with the editor, JSZip only on export.
	let mod = $state<ExportModule | null>(null);
	let three = $state<ThreeSource>('cdn');
	let tab = $state<SnippetId>('html');
	let busy = $state(false);
	let status = $state('');
	let statusTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		import('#lib/export/index.ts').then((loaded) => (mod = loaded));
		try {
			if (localStorage.getItem(THREE_KEY) === 'npm') three = 'npm';
		} catch {}
	});

	$effect(() => {
		const value = three;
		try {
			localStorage.setItem(THREE_KEY, value);
		} catch {}
	});

	let input = $derived({ images, settings: $state.snapshot(settings) as Settings, three });
	let engine = $derived(mod ? mod.buildEngineFile(input) : null);
	let list = $derived(mod ? mod.snippets(three) : []);
	let snippet = $derived(list.find((item) => item.id === tab) ?? null);
	let overBudget = $derived(!!mod && !!engine && engine.bytes > mod.SIZE_BUDGET);

	function say(message: string) {
		status = message;
		clearTimeout(statusTimer);
		statusTimer = setTimeout(() => (status = ''), 3000);
	}

	function formatKB(bytes: number) {
		return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	}

	async function copy(text: string, what: string) {
		try {
			await navigator.clipboard.writeText(text);
			say(`${what} copied`);
		} catch {
			say(`Couldn't copy — select the text and copy it manually`);
		}
	}

	async function exportZip() {
		if (!mod || busy) return;
		busy = true;
		status = 'Building ZIP…';
		try {
			mod.downloadBlob(await mod.exportZip(input), mod.ZIP_FILE);
			say(`${mod.ZIP_FILE} downloaded`);
		} catch (error) {
			console.error(error);
			say('Export failed. Try again.');
		} finally {
			busy = false;
		}
	}

	function downloadJs() {
		if (!mod || !engine) return;
		mod.downloadText(engine.code, mod.ENGINE_FILE);
		say(`${mod.ENGINE_FILE} downloaded`);
	}

	function downloadTs() {
		if (!mod) return;
		mod.downloadText(mod.buildEngineFile(input, 'ts').code, mod.ENGINE_TS_FILE, 'text/plain');
		say(`${mod.ENGINE_TS_FILE} downloaded`);
	}
</script>

<section class="group" aria-labelledby="group-export">
	<div class="group-head">
		<h3 id="group-export" class="mono">Export</h3>
		<span class="mono muted">{engine ? formatKB(engine.bytes) : '…'}</span>
	</div>

	<p class="text">
		One JavaScript file with your {images.length === 1 ? 'photo' : `${images.length} photos`} and these
		settings built in.
	</p>

	<Segmented
		label="three.js"
		bind:value={three}
		options={[
			{ value: 'cdn', label: 'From CDN' },
			{ value: 'npm', label: 'From npm' }
		]}
	/>
	<p class="hint">
		{#if three === 'cdn'}
			Imports three.js {mod?.THREE_VERSION ?? ''} from jsDelivr. Works in plain HTML, nothing to install.
		{:else}
			<code>import * as THREE from "three"</code> — for bundlers (Vite, Next.js…). Run
			<code>{mod?.NPM_INSTALL ?? 'npm install three'}</code>.
		{/if}
	</p>

	<div class="size mono" class:warn={overBudget}>
		<span>particle-portrait.js</span>
		<span>{engine ? formatKB(engine.bytes) : '…'} / {mod ? formatKB(mod.SIZE_BUDGET) : '100 KB'}</span>
	</div>
	{#if overBudget}
		<p class="hint">
			Over the 100 KB target — each photo adds about 60 KB. It still works; fewer photos load faster.
		</p>
	{/if}

	<div class="actions">
		<button type="button" class="btn primary" disabled={!mod || busy} onclick={exportZip}>
			{busy ? 'Exporting…' : 'Export ZIP'}
		</button>
		<button type="button" class="btn" disabled={!engine} onclick={downloadJs}>Download .js</button>
		<button type="button" class="btn" disabled={!mod} onclick={downloadTs}>Download .ts</button>
		<button
			type="button"
			class="btn ghost"
			onclick={() => copy(JSON.stringify($state.snapshot(settings), null, 2), 'Options JSON')}
		>
			Copy options (JSON)
		</button>
	</div>
	<p class="mono muted files">
		ZIP: particle-portrait.js · .d.ts · typescript/particle-portrait.ts · index.html · README.md
	</p>

	<div class="snippets">
		<div class="tabs" role="tablist" aria-label="Snippet framework">
			{#each list as item (item.id)}
				<button
					type="button"
					role="tab"
					class="tab mono"
					id="tab-{item.id}"
					aria-selected={item.id === tab}
					aria-controls="snippet-panel"
					onclick={() => (tab = item.id)}
				>
					{item.label}
				</button>
			{/each}
		</div>

		{#if snippet}
			<div class="snippet" id="snippet-panel" role="tabpanel" aria-labelledby="tab-{snippet.id}">
				<div class="snippet-head">
					<span class="mono muted">{snippet.file}</span>
					<button type="button" class="btn ghost small" onclick={() => copy(snippet.code, 'Snippet')}>
						Copy snippet
					</button>
				</div>
				{#if snippet.bundler && three === 'cdn'}
					<p class="hint note">
						Bundlers can't import from a URL — switch three.js to <strong>From npm</strong> above.
					</p>
				{:else if snippet.bundler}
					<p class="hint note">First: <code>{mod?.NPM_INSTALL}</code></p>
				{/if}
				<pre><code>{snippet.code}</code></pre>
			</div>
		{/if}
	</div>

	<p class="mono status" role="status" aria-live="polite">{status}</p>
</section>

<style>
	.group {
		display: grid;
		gap: 14px;
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

	.muted {
		color: var(--muted);
	}

	.text {
		font-size: 17px;
		line-height: 1.4;
	}

	.hint {
		margin-top: -6px;
		color: var(--muted);
		font-size: 14px;
		line-height: 1.4;
	}

	code {
		font-family: var(--font-mono);
		font-size: 12px;
	}

	.size {
		display: flex;
		justify-content: space-between;
		padding: 8px 10px;
		border: 1px solid var(--line-strong);
		text-transform: none;
	}

	.size.warn {
		border-color: var(--fg);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.btn.primary {
		background: var(--fg);
		color: var(--bg);
	}

	.btn.primary:hover {
		background: transparent;
		color: var(--fg);
	}

	.btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.btn.small {
		min-height: 28px;
		padding: 0 10px;
	}

	.files {
		margin-top: -6px;
		text-transform: none;
		letter-spacing: 0.02em;
	}

	.snippets {
		border: 1px solid var(--line-strong);
	}

	.tabs {
		display: flex;
		overflow-x: auto;
		border-bottom: 1px solid var(--line-strong);
	}

	.tab {
		flex: none;
		min-height: 32px;
		padding: 0 12px;
		border: 0;
		border-right: 1px solid var(--line);
		background: transparent;
		color: var(--muted);
		cursor: pointer;
	}

	.tab:hover {
		color: var(--fg);
	}

	.tab[aria-selected='true'] {
		background: var(--fg);
		color: var(--bg);
	}

	.snippet {
		display: grid;
		gap: 10px;
		padding: 12px;
	}

	.snippet-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.note {
		margin: 0;
	}

	pre {
		max-height: 320px;
		margin: 0;
		padding: 12px;
		overflow: auto;
		background: var(--surface);
		border: 1px solid var(--line);
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.55;
		tab-size: 2;
	}

	.status {
		min-height: 1.6em;
		text-transform: none;
		letter-spacing: 0.02em;
	}
</style>
