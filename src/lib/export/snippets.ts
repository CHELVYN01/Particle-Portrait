import { THREE_CDN, THREE_VERSION, type ThreeSource } from './build-engine-file';

export type SnippetId = 'html' | 'react' | 'next' | 'vue' | 'svelte';

export type Snippet = {
	id: SnippetId;
	label: string;
	/** Markdown code fence language. */
	language: string;
	/** Where the code goes, e.g. "components/Portrait.jsx". */
	file: string;
	/** Needs a bundler, so three should come from npm. */
	bundler: boolean;
	code: string;
};

const SIZE = 'width: 100%; height: 600px';

function html(three: ThreeSource) {
	// A bare "three" import needs an import map in plain HTML.
	const importMap =
		three === 'npm'
			? `<script type="importmap">
  { "imports": { "three": "${THREE_CDN}" } }
</script>
`
			: '';
	return `<div id="portrait" style="${SIZE}"></div>

${importMap}<script type="module">
  import { createPortrait } from "./particle-portrait.js";

  createPortrait(document.getElementById("portrait"));
</script>`;
}

const REACT_BODY = `import { useEffect, useRef } from "react";
import { createPortrait } from "./particle-portrait.js";

export function Portrait() {
  const ref = useRef(null);

  useEffect(() => {
    const portrait = createPortrait(ref.current);
    return () => portrait.destroy();
  }, []);

  return <div ref={ref} style={{ width: "100%", height: 600 }} />;
}`;

const VUE = `<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { createPortrait } from "./particle-portrait.js";

const el = ref(null);
let portrait;

onMounted(() => {
  portrait = createPortrait(el.value);
});

onBeforeUnmount(() => portrait?.destroy());
</script>

<template>
  <div ref="el" style="${SIZE}" />
</template>`;

const SVELTE = `<script>
  import { onMount } from "svelte";
  import { createPortrait } from "./particle-portrait.js";

  let el;

  onMount(() => {
    const portrait = createPortrait(el);
    return () => portrait.destroy();
  });
</script>

<div bind:this={el} style="${SIZE}"></div>`;

export function snippets(three: ThreeSource): Snippet[] {
	return [
		{ id: 'html', label: 'HTML', language: 'html', file: 'index.html', bundler: false, code: html(three) },
		{ id: 'react', label: 'React', language: 'jsx', file: 'Portrait.jsx', bundler: true, code: REACT_BODY },
		{
			id: 'next',
			label: 'Next.js',
			language: 'jsx',
			file: 'components/Portrait.jsx',
			bundler: true,
			code: `"use client";\n\n${REACT_BODY}`
		},
		{ id: 'vue', label: 'Vue', language: 'vue', file: 'Portrait.vue', bundler: true, code: VUE },
		{ id: 'svelte', label: 'Svelte', language: 'svelte', file: 'Portrait.svelte', bundler: true, code: SVELTE }
	];
}

export const NPM_INSTALL = `npm install three@${THREE_VERSION}`;
