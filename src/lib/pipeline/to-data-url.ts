import { context2d, createCanvas } from './canvas';

export const OUTPUT_WIDTH = 280;

export type EncodedPortrait = {
	dataUrl: string;
	bytes: number;
	width: number;
	height: number;
};

/**
 * Downscales to OUTPUT_WIDTH and encodes a grayscale + alpha PNG. The engine
 * only reads luminance, and dropping the colour channels roughly halves the
 * file compared to canvas.toDataURL().
 */
export async function toDataUrl(canvas: HTMLCanvasElement): Promise<EncodedPortrait> {
	const scaled = downscale(canvas, OUTPUT_WIDTH);
	const { width, height } = scaled;
	const { data } = context2d(scaled).getImageData(0, 0, width, height);

	const pixels = new Uint8Array(width * height * 2);
	for (let i = 0; i < width * height; i++) {
		const alpha = data[i * 4 + 3];
		// Fully transparent pixels get gray 0 so they compress to nothing.
		pixels[i * 2] = alpha
			? Math.round(0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2])
			: 0;
		pixels[i * 2 + 1] = alpha;
	}

	try {
		const png = await encodeGrayAlphaPng(pixels, width, height);
		return { dataUrl: `data:image/png;base64,${toBase64(png)}`, bytes: png.length, width, height };
	} catch {
		// No CompressionStream: fall back to the browser's (larger) RGBA PNG.
		const dataUrl = scaled.toDataURL('image/png');
		return { dataUrl, bytes: Math.round(((dataUrl.length - 22) * 3) / 4), width, height };
	}
}

/** Halves in steps for a clean downscale; never upscales. */
function downscale(canvas: HTMLCanvasElement, targetWidth: number) {
	let current = canvas;
	while (current.width > targetWidth) {
		const width = Math.max(targetWidth, Math.ceil(current.width / 2));
		const next = createCanvas(width, (current.height * width) / current.width);
		const ctx = context2d(next);
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(current, 0, 0, next.width, next.height);
		current = next;
	}
	return current;
}

// ---------------------------------------------------------------- PNG

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c >>> 0;
	}
	return table;
})();

function crc32(bytes: Uint8Array) {
	let c = 0xffffffff;
	for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array) {
	const out = new Uint8Array(12 + data.length);
	const view = new DataView(out.buffer);
	view.setUint32(0, data.length);
	for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
	out.set(data, 8);
	view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
	return out;
}

function paeth(a: number, b: number, c: number) {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Per-row adaptive filtering (smallest sum of absolute differences wins). */
function filterRows(pixels: Uint8Array, width: number, height: number, bpp: number) {
	const stride = width * bpp;
	const out = new Uint8Array((stride + 1) * height);
	const candidates = Array.from({ length: 5 }, () => new Uint8Array(stride));
	const zero = new Uint8Array(stride);

	for (let y = 0; y < height; y++) {
		const row = pixels.subarray(y * stride, (y + 1) * stride);
		const up = y ? pixels.subarray((y - 1) * stride, y * stride) : zero;
		let best = 0;
		let bestScore = Infinity;
		for (let f = 0; f < 5; f++) {
			const cand = candidates[f];
			let score = 0;
			for (let i = 0; i < stride; i++) {
				const a = i >= bpp ? row[i - bpp] : 0;
				const b = up[i];
				const c = i >= bpp ? up[i - bpp] : 0;
				const predictor =
					f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c);
				const value = (row[i] - predictor) & 0xff;
				cand[i] = value;
				score += value < 128 ? value : 256 - value;
			}
			if (score < bestScore) {
				bestScore = score;
				best = f;
			}
		}
		out[y * (stride + 1)] = best;
		out.set(candidates[best], y * (stride + 1) + 1);
	}
	return out;
}

async function zlib(data: Uint8Array) {
	const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream('deflate'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function encodeGrayAlphaPng(pixels: Uint8Array, width: number, height: number) {
	const header = new Uint8Array(13);
	const view = new DataView(header.buffer);
	view.setUint32(0, width);
	view.setUint32(4, height);
	header[8] = 8; // bit depth
	header[9] = 4; // colour type: grayscale + alpha
	const parts = [
		new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
		chunk('IHDR', header),
		chunk('IDAT', await zlib(filterRows(pixels, width, height, 2))),
		chunk('IEND', new Uint8Array(0))
	];
	const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

function toBase64(bytes: Uint8Array) {
	let binary = '';
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(binary);
}
