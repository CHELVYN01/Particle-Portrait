import engineSource from '../engine/particle-portrait.js?raw';
import typesSource from '../engine/particle-portrait.d.ts?raw';
import type { Settings } from '../settings/defaults';

// Keep in sync with the `three` version in package.json.
export const THREE_VERSION = '0.180.0';
export const THREE_CDN = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;

/** `cdn`: import three from jsDelivr (plain HTML). `npm`: bare `"three"` (bundlers). */
export type ThreeSource = 'cdn' | 'npm';

/** `js`: plain JavaScript (pair with the .d.ts). `ts`: one TypeScript file with the types inline. */
export type EngineLanguage = 'js' | 'ts';

export type EngineInput = {
	images: string[];
	settings: Settings;
	three: ThreeSource;
};

const THREE_IMPORT = 'import * as THREE from "three";';
const OPTIONS_PLACEHOLDER = '/*__PP_OPTIONS__*/ {}';
const IMAGES_PLACEHOLDER = '/*__PP_IMAGES__*/ []';
const CREATE_SIGNATURE = 'export function createPortrait(container, options = {}) {';
const DEFAULTS_EXPORT = 'export const DEFAULT_OPTIONS = DEFAULTS;';

/**
 * Drops comment-only lines, blank lines and indentation. Newlines stay, so
 * statements and GLSL are untouched; it just saves ~30% of the engine's weight.
 */
function compact(source: string) {
	const out: string[] = [];
	let inBlock = false;
	for (const line of source.split('\n')) {
		const text = line.trim();
		if (inBlock) {
			if (text.includes('*/')) inBlock = false;
			continue;
		}
		if (!text || text.startsWith('//')) continue;
		if (text.startsWith('/*')) {
			if (!text.includes('*/')) inBlock = true;
			continue;
		}
		out.push(text);
	}
	return out.join('\n');
}

let compacted: string | null = null;

function compactEngine() {
	if (compacted) return compacted;
	compacted = compact(engineSource);
	for (const marker of [THREE_IMPORT, OPTIONS_PLACEHOLDER, IMAGES_PLACEHOLDER, CREATE_SIGNATURE, DEFAULTS_EXPORT]) {
		if (!compacted.includes(marker)) throw new Error(`Engine source is missing "${marker}"`);
	}
	return compacted;
}

let inlineTypes: string | null = null;

/** The .d.ts minus its header and the two declarations the .ts implements itself. */
function typesForTs() {
	if (inlineTypes) return inlineTypes;
	inlineTypes = typesSource
		.replace(/^\/\*\*[\s\S]*?\*\/\s*/, '')
		.replace(/\/\*\* The engine's default options[^\n]*\n/, '')
		.replace(/export const DEFAULT_OPTIONS[^\n]*\n/, '')
		.replace(/export function createPortrait[^\n]*\n?/, '')
		.trim();
	return inlineTypes;
}

function header({ images, three }: EngineInput, language: EngineLanguage) {
	const date = new Date().toISOString().slice(0, 10);
	const photos = `${images.length} photo${images.length === 1 ? '' : 's'}`;
	const requires =
		three === 'cdn'
			? ` * three.js ${THREE_VERSION} is imported from jsDelivr — no install needed.`
			: ` * Requires three.js: npm install three@${THREE_VERSION}`;
	const file = language === 'ts' ? 'particle-portrait.ts' : 'particle-portrait.js';
	const importPath = language === 'ts' ? './particle-portrait' : './particle-portrait.js';
	const typesNote =
		language === 'ts'
			? `
 *
 * TypeScript: the public API (createPortrait, Portrait, PortraitOptions…) is
 * fully typed. The engine body is plain JavaScript, hence @ts-nocheck above.`
			: '';
	return `/*!
 * ${file} — a living particle portrait, rendered with three.js.
 * Made with https://particle-portrait.chelvynkleden.com
 * License: PolyForm Noncommercial 1.0.0 (https://polyformproject.org/licenses/noncommercial/1.0.0)
 * Free for noncommercial use. Commercial use needs permission.
 * Required Notice: Copyright (c) 2026 Chelvyn Kleden (https://particle-portrait.chelvynkleden.com)
 *
 * Generated ${date} · ${photos} embedded.
${requires}
 *
 * Usage:
 *   import { createPortrait } from "${importPath}";
 *
 *   const portrait = createPortrait(document.getElementById("portrait"));
 *   portrait.destroy(); // when the element is removed
 *
 * The container needs a size (e.g. height: 600px); the canvas fills it.
 * Your settings are baked in below (EMBEDDED_OPTIONS). Edit them there, or
 * override any of them per call: createPortrait(el, { density: 200 }).
 * All options and framework examples: README.md${typesNote}
 */
`;
}

/** The engine with the user's photos and settings baked in, as .js or .ts. */
export function buildEngineFile(input: EngineInput, language: EngineLanguage = 'js') {
	const options = JSON.stringify(input.settings, null, 2);
	const threeImport = input.three === 'cdn' ? `import * as THREE from "${THREE_CDN}";` : THREE_IMPORT;

	let body = compactEngine()
		.replace(THREE_IMPORT, () => (language === 'ts' ? `${threeImport}\n\n${typesForTs()}\n` : threeImport))
		.replace(OPTIONS_PLACEHOLDER, () => options)
		.replace(IMAGES_PLACEHOLDER, () => JSON.stringify(input.images));

	if (language === 'ts') {
		body = body
			.replace(
				CREATE_SIGNATURE,
				'export function createPortrait(container: HTMLElement, options: PortraitOptionsInput = {}): Portrait {'
			)
			.replace(DEFAULTS_EXPORT, 'export const DEFAULT_OPTIONS: Readonly<PortraitOptions> = DEFAULTS;');
	}

	// @ts-nocheck must come before any statement; the header is only a comment.
	const code = (language === 'ts' ? '// @ts-nocheck\n' : '') + header(input, language) + body;
	return { code, bytes: new Blob([code]).size };
}
