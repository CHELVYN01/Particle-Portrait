// Records the live preview to a video file, entirely in the browser.
// The engine's WebGL canvas is transparent, so each frame is composited onto the page
// background first (a transparent video would turn black in most players).

const MAX_SIDE = 1920;
const FPS = 60;

export type RecordedVideo = { blob: Blob; extension: 'mp4' | 'webm' };

export class RecordError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'RecordError';
	}
}

/** MP4 plays everywhere (social apps, phones); WebM is the fallback for browsers without it. */
function pickFormat(): { mimeType: string; extension: RecordedVideo['extension'] } | null {
	const candidates = [
		{ mimeType: 'video/mp4;codecs=avc1', extension: 'mp4' },
		{ mimeType: 'video/mp4', extension: 'mp4' },
		{ mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
		{ mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
		{ mimeType: 'video/webm', extension: 'webm' }
	] as const;
	return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate.mimeType)) ?? null;
}

export function canRecordVideo() {
	return (
		typeof MediaRecorder !== 'undefined' &&
		typeof HTMLCanvasElement !== 'undefined' &&
		'captureStream' in HTMLCanvasElement.prototype &&
		pickFormat() !== null
	);
}

type Options = {
	/** The engine canvas. Its drawing buffer must be preserved (`preserveDrawingBuffer`). */
	source: HTMLCanvasElement;
	/** Any CSS color, painted behind the particles. */
	background: string;
	seconds: number;
	onProgress?: (elapsed: number) => void;
};

export function recordVideo({ source, background, seconds, onProgress }: Options): Promise<RecordedVideo> {
	const format = pickFormat();
	if (!format) return Promise.reject(new RecordError("This browser can't record video."));
	if (!source.width || !source.height) {
		return Promise.reject(new RecordError('The preview is not ready yet.'));
	}

	// Even dimensions: most H.264 encoders reject odd ones.
	const scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height));
	const width = Math.max(2, Math.round((source.width * scale) / 2) * 2);
	const height = Math.max(2, Math.round((source.height * scale) / 2) * 2);

	const output = document.createElement('canvas');
	output.width = width;
	output.height = height;
	const ctx = output.getContext('2d');
	if (!ctx) return Promise.reject(new RecordError('This browser could not create a 2D canvas.'));

	const draw = () => {
		ctx.fillStyle = background;
		ctx.fillRect(0, 0, width, height);
		ctx.drawImage(source, 0, 0, width, height);
	};
	draw();

	const stream = output.captureStream(FPS);
	const recorder = new MediaRecorder(stream, {
		mimeType: format.mimeType,
		videoBitsPerSecond: 10_000_000
	});
	const chunks: Blob[] = [];
	recorder.ondataavailable = (event) => {
		if (event.data.size) chunks.push(event.data);
	};

	return new Promise((resolve, reject) => {
		let raf = 0;
		const started = performance.now();

		const finish = () => {
			cancelAnimationFrame(raf);
			for (const track of stream.getTracks()) track.stop();
		};

		recorder.onerror = () => {
			finish();
			reject(new RecordError('Recording failed. Try again.'));
		};
		recorder.onstop = () => {
			finish();
			const blob = new Blob(chunks, { type: format.mimeType.split(';')[0] });
			if (!blob.size) reject(new RecordError('Nothing was recorded. Keep this tab in front and try again.'));
			else resolve({ blob, extension: format.extension });
		};

		const tick = () => {
			const elapsed = (performance.now() - started) / 1000;
			draw();
			onProgress?.(Math.min(elapsed, seconds));
			if (elapsed >= seconds) {
				if (recorder.state !== 'inactive') recorder.stop();
				return;
			}
			raf = requestAnimationFrame(tick);
		};

		recorder.start(250);
		raf = requestAnimationFrame(tick);
	});
}

export function downloadVideo({ blob, extension }: RecordedVideo, name = 'particle-portrait') {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `${name}.${extension}`;
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
