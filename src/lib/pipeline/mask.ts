import { context2d } from './canvas';

const FEATHER_RADIUS = 1; // px per box-blur pass; two passes ≈ a 1–2px feather

/** Bilinear resize of a single-channel mask. */
export function resizeMask(
	src: Float32Array,
	srcWidth: number,
	srcHeight: number,
	width: number,
	height: number
) {
	if (srcWidth === width && srcHeight === height) return src;
	const out = new Float32Array(width * height);
	for (let y = 0; y < height; y++) {
		const sy = Math.min(srcHeight - 1, Math.max(0, ((y + 0.5) * srcHeight) / height - 0.5));
		const y0 = Math.floor(sy);
		const y1 = Math.min(srcHeight - 1, y0 + 1);
		const fy = sy - y0;
		for (let x = 0; x < width; x++) {
			const sx = Math.min(srcWidth - 1, Math.max(0, ((x + 0.5) * srcWidth) / width - 0.5));
			const x0 = Math.floor(sx);
			const x1 = Math.min(srcWidth - 1, x0 + 1);
			const fx = sx - x0;
			const top = src[y0 * srcWidth + x0] * (1 - fx) + src[y0 * srcWidth + x1] * fx;
			const bottom = src[y1 * srcWidth + x0] * (1 - fx) + src[y1 * srcWidth + x1] * fx;
			out[y * width + x] = top * (1 - fy) + bottom * fy;
		}
	}
	return out;
}

/** Writes the person mask into the canvas alpha, with a soft 1–2px edge. */
export function applyMask(canvas: HTMLCanvasElement, person: Float32Array) {
	const { width, height } = canvas;
	let alpha = new Float32Array(width * height);
	for (let i = 0; i < alpha.length; i++) {
		// Tighten the model's soft confidence into a clean edge.
		const t = Math.min(1, Math.max(0, (person[i] - 0.3) / 0.4));
		alpha[i] = t * t * (3 - 2 * t);
	}
	alpha = boxBlur(boxBlur(alpha, width, height, FEATHER_RADIUS), width, height, FEATHER_RADIUS);

	const ctx = context2d(canvas);
	const image = ctx.getImageData(0, 0, width, height);
	const data = image.data;
	for (let i = 0; i < alpha.length; i++) {
		// Drop faint specks left in the background.
		const a = alpha[i] < 0.06 ? 0 : alpha[i];
		data[i * 4 + 3] = Math.round(data[i * 4 + 3] * a);
	}
	ctx.putImageData(image, 0, 0);
}

function boxBlur(src: Float32Array, width: number, height: number, radius: number) {
	const size = radius * 2 + 1;
	const tmp = new Float32Array(src.length);
	const out = new Float32Array(src.length);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let sum = 0;
			for (let k = -radius; k <= radius; k++) {
				sum += src[y * width + Math.min(width - 1, Math.max(0, x + k))];
			}
			tmp[y * width + x] = sum / size;
		}
	}
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let sum = 0;
			for (let k = -radius; k <= radius; k++) {
				sum += tmp[Math.min(height - 1, Math.max(0, y + k)) * width + x];
			}
			out[y * width + x] = sum / size;
		}
	}
	return out;
}
