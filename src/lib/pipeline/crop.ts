import { PipelineError, context2d, createCanvas } from './canvas';

const ALPHA_THRESHOLD = 24;
const PADDING = 0.04; // of the subject's longest side
const MIN_SUBJECT_SHARE = 0.01; // of the image area

/** Crops to the visible subject's bounding box plus a little padding. */
export function cropToSubject(canvas: HTMLCanvasElement) {
	const { width, height } = canvas;
	const { data } = context2d(canvas).getImageData(0, 0, width, height);

	let minX = width;
	let minY = height;
	let maxX = -1;
	let maxY = -1;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (data[(y * width + x) * 4 + 3] <= ALPHA_THRESHOLD) continue;
			if (x < minX) minX = x;
			if (x > maxX) maxX = x;
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
		}
	}

	const boxWidth = maxX - minX + 1;
	const boxHeight = maxY - minY + 1;
	if (maxX < 0 || boxWidth * boxHeight < width * height * MIN_SUBJECT_SHARE) {
		throw new PipelineError(
			"We couldn't find a person in this photo. Try a clearer, front-facing portrait, or skip background removal."
		);
	}

	const pad = Math.round(Math.max(boxWidth, boxHeight) * PADDING);
	const left = Math.max(0, minX - pad);
	const top = Math.max(0, minY - pad);
	const right = Math.min(width, maxX + 1 + pad);
	const bottom = Math.min(height, maxY + 1 + pad);

	const out = createCanvas(right - left, bottom - top);
	context2d(out).drawImage(canvas, left, top, out.width, out.height, 0, 0, out.width, out.height);
	return out;
}
