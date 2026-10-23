// Copies the MediaPipe vision wasm runtime into static/ so the tool self-hosts it
// (no third-party CDN at runtime). Runs on postinstall; output is gitignored.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const from = fileURLToPath(new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url));
const to = fileURLToPath(new URL('../static/mediapipe/wasm/', import.meta.url));

// FilesetResolver.forVisionTasks() loads the SIMD build, or the no-SIMD one on older browsers.
const FILES = [
	'vision_wasm_internal.js',
	'vision_wasm_internal.wasm',
	'vision_wasm_nosimd_internal.js',
	'vision_wasm_nosimd_internal.wasm'
];

if (!existsSync(from)) {
	console.warn('[copy-mediapipe] @mediapipe/tasks-vision is not installed, skipping.');
	process.exit(0);
}

mkdirSync(to, { recursive: true });
for (const file of FILES) copyFileSync(from + file, to + file);
console.log(`[copy-mediapipe] copied ${FILES.length} files to static/mediapipe/wasm/`);
