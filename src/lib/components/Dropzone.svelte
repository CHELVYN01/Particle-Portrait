<script lang="ts">
	import { MAX_FILE_BYTES, formatMB, validateFile } from '#lib/pipeline/index.ts';

	type Props = {
		onfile: (file: File) => void;
		title?: string;
		/** Smaller box, e.g. for adding another photo. */
		compact?: boolean;
	};

	let { onfile, title = 'Drop a photo here', compact = false }: Props = $props();

	const id = $props.id();
	let dragging = $state(false);
	let error = $state('');
	// dragenter/dragleave fire for every child element; count them so the state doesn't flicker.
	let dragDepth = 0;

	function take(files: FileList | null | undefined) {
		const file = files?.[0];
		if (!file) return;
		error = validateFile(file);
		if (!error) onfile(file);
	}

	function onDragEnter(event: DragEvent) {
		event.preventDefault();
		dragDepth++;
		dragging = true;
	}

	function onDragOver(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
	}

	function onDragLeave() {
		dragDepth = Math.max(0, dragDepth - 1);
		if (dragDepth === 0) dragging = false;
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragDepth = 0;
		dragging = false;
		take(event.dataTransfer?.files);
	}

	function onChange(event: Event & { currentTarget: HTMLInputElement }) {
		take(event.currentTarget.files);
		// Reset so choosing the same file again still fires `change`.
		event.currentTarget.value = '';
	}
</script>

<div class="wrap">
	<label
		class="dropzone"
		class:compact
		class:dragging
		class:invalid={!!error}
		ondragenter={onDragEnter}
		ondragover={onDragOver}
		ondragleave={onDragLeave}
		ondrop={onDrop}
	>
		<input
			class="visually-hidden"
			type="file"
			accept="image/*,.heic,.heif"
			aria-describedby="{id}-hint{error ? ` ${id}-error` : ''}"
			onchange={onChange}
		/>

		{#if !compact}
			<span class="crosshair" aria-hidden="true"></span>
		{/if}
		<span class="title">{dragging ? 'Release to upload' : title}</span>
		<span class="action mono">or click to browse</span>
		<span class="hint mono" id="{id}-hint">
			JPG · PNG · WebP · HEIC — max {formatMB(MAX_FILE_BYTES)} — front-facing works best
		</span>
	</label>

	{#if error}
		<p class="error mono" id="{id}-error" role="alert">Error — {error}</p>
	{/if}
</div>

<style>
	.wrap {
		display: grid;
		gap: 10px;
	}

	.dropzone {
		position: relative;
		display: grid;
		justify-items: center;
		align-content: center;
		gap: 10px;
		min-height: 240px;
		padding: 32px 20px;
		border: 1px solid var(--line-strong);
		background: var(--bg);
		text-align: center;
		cursor: pointer;
		transition:
			border-color 120ms ease,
			background-color 120ms ease;
	}

	/* Corner ticks */
	.dropzone::before,
	.dropzone::after {
		content: '';
		position: absolute;
		width: 12px;
		height: 12px;
		border: 0 solid var(--fg);
		pointer-events: none;
	}

	.dropzone::before {
		top: -1px;
		left: -1px;
		border-top-width: 1px;
		border-left-width: 1px;
	}

	.dropzone::after {
		right: -1px;
		bottom: -1px;
		border-right-width: 1px;
		border-bottom-width: 1px;
	}

	.dropzone:hover,
	.dropzone.dragging {
		border-color: var(--fg);
		background: var(--surface);
	}

	.dropzone.dragging {
		border-style: dashed;
	}

	.dropzone:has(input:focus-visible) {
		outline: 1px solid var(--fg);
		outline-offset: 3px;
	}

	.dropzone.invalid {
		border-color: var(--fg);
	}

	.dropzone.compact {
		min-height: 0;
		gap: 8px;
		padding: 20px 16px;
	}

	.dropzone.compact .title {
		font-size: 20px;
	}

	.crosshair {
		position: relative;
		width: 28px;
		height: 28px;
		margin-bottom: 6px;
	}

	.crosshair::before,
	.crosshair::after {
		content: '';
		position: absolute;
		background: var(--fg);
	}

	.crosshair::before {
		top: 50%;
		left: 0;
		right: 0;
		height: 1px;
	}

	.crosshair::after {
		left: 50%;
		top: 0;
		bottom: 0;
		width: 1px;
	}

	.title {
		font-size: clamp(24px, 3vw, 30px);
		line-height: 1.15;
		letter-spacing: -0.01em;
	}

	.action {
		padding: 6px 10px;
		border: 1px solid var(--fg);
	}

	.dropzone:hover .action {
		background: var(--fg);
		color: var(--bg);
	}

	.hint {
		max-width: 34ch;
		margin-top: 6px;
		color: var(--muted);
		text-transform: none;
		letter-spacing: 0.02em;
	}

	.error {
		padding: 10px 12px;
		border: 1px solid var(--fg);
		text-transform: none;
		letter-spacing: 0.02em;
	}
</style>
