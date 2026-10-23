export class PipelineError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PipelineError';
	}
}

export function createCanvas(width: number, height: number) {
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(width));
	canvas.height = Math.max(1, Math.round(height));
	return canvas;
}

/** Every pipeline step reads pixels back, so ask for a CPU-backed context. */
export function context2d(canvas: HTMLCanvasElement) {
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new PipelineError('This browser could not create a 2D canvas.');
	return ctx;
}

export function nextFrame() {
	return new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve)));
}
