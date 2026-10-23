import { context2d } from './canvas';

/**
 * True when the image already has a real cut-out (e.g. a transparent PNG), so
 * background removal can be skipped. A few stray transparent pixels don't count.
 */
export function hasMeaningfulAlpha(canvas: HTMLCanvasElement) {
	const { data } = context2d(canvas).getImageData(0, 0, canvas.width, canvas.height);
	let transparent = 0;
	for (let i = 3; i < data.length; i += 4) {
		if (data[i] < 128) transparent++;
	}
	const share = transparent / (canvas.width * canvas.height);
	return share > 0.02 && share < 0.98;
}
