import { PipelineError, context2d, createCanvas } from './canvas';

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_SIDE = 1024;

export function formatMB(bytes: number) {
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** iPhone photos. Browsers often report these with an empty or unusual type, so check the name too. */
function isHeicFile(file: File) {
	return /^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

/** Returns an error message, or an empty string if the file can be processed. */
export function validateFile(file: File) {
	if (!file.type.startsWith('image/') && !isHeicFile(file)) {
		return `"${file.name}" is not a supported image. Use JPG, PNG, WebP or HEIC.`;
	}
	if (file.size > MAX_FILE_BYTES) {
		return `This photo is ${formatMB(file.size)}. The maximum is ${formatMB(MAX_FILE_BYTES)}.`;
	}
	return '';
}

/**
 * Browsers other than Safari can't open HEIC, so decode it in-page. The decoder is large
 * and only needed here, so it's fetched on demand. Still fully on-device.
 */
async function decodeHeic(file: File) {
	const unreadable = new PipelineError(
		`Couldn't read "${file.name}". It may be damaged, or in a format this browser can't open. Try a JPG or PNG.`
	);
	if (!isHeicFile(file)) throw unreadable;
	try {
		const { heicTo } = await import('heic-to');
		return await heicTo({ blob: file, type: 'bitmap' });
	} catch (error) {
		console.error(error);
		throw unreadable;
	}
}

/** Decodes the file (honouring EXIF orientation) onto a canvas, longest side ≤ MAX_SIDE. */
export async function loadImage(file: File) {
	const problem = validateFile(file);
	if (problem) throw new PipelineError(problem);

	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	} catch {
		bitmap = await decodeHeic(file);
	}

	const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
	const canvas = createCanvas(bitmap.width * scale, bitmap.height * scale);
	const ctx = context2d(canvas);
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close();
	return canvas;
}
