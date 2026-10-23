import type { ImageSegmenter } from '@mediapipe/tasks-vision';
import { PipelineError } from './canvas';
import { resizeMask } from './mask';

// Self-hosted in static/ (see scripts/copy-mediapipe.mjs). Loaded only when needed.
const WASM_PATH = '/mediapipe/wasm';
const MODEL_PATH = '/mediapipe/selfie_segmenter.tflite';

let segmenter: Promise<ImageSegmenter> | null = null;
let ready = false;

export function isSegmenterReady() {
	return ready;
}

export function loadSegmenter() {
	segmenter ??= (async () => {
		const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
		const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
		const instance = await ImageSegmenter.createFromOptions(fileset, {
			baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'CPU' },
			runningMode: 'IMAGE',
			outputConfidenceMasks: true,
			outputCategoryMask: false
		});
		ready = true;
		return instance;
	})().catch((error: unknown) => {
		segmenter = null;
		console.error(error);
		throw new PipelineError(
			"Couldn't load the background removal model. Check your connection and try again, or skip background removal."
		);
	});
	return segmenter;
}

/** Person confidence (0–1) per pixel of `canvas`. */
export async function segmentPerson(canvas: HTMLCanvasElement) {
	const instance = await loadSegmenter();
	const result = instance.segment(canvas);
	try {
		const masks = result.confidenceMasks;
		if (!masks?.length) {
			throw new PipelineError('Background removal returned nothing. Try skipping it for this photo.');
		}
		const mask = masks[0];
		const values = mask.getAsFloat32Array().slice();
		// Multi-class models put background first; flip so 1 = person.
		if (masks.length > 1) invert(values);
		orientToPerson(values, mask.width, mask.height);
		return resizeMask(values, mask.width, mask.height, canvas.width, canvas.height);
	} finally {
		result.close();
	}
}

function invert(values: Float32Array) {
	for (let i = 0; i < values.length; i++) values[i] = 1 - values[i];
}

/**
 * Guards against a mask that reads as "background = 1": the top edge and the
 * upper sides of a portrait are almost always background.
 */
function orientToPerson(values: Float32Array, width: number, height: number) {
	let sum = 0;
	let n = 0;
	for (let x = 0; x < width; x++) {
		sum += values[x];
		n++;
	}
	for (let y = 0; y < Math.floor(height * 0.4); y++) {
		sum += values[y * width] + values[y * width + width - 1];
		n += 2;
	}
	if (sum / n > 0.5) invert(values);
}
