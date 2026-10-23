import { nextFrame } from './canvas';
import { cropToSubject } from './crop';
import { hasMeaningfulAlpha } from './has-alpha';
import { loadImage } from './load-image';
import { applyMask } from './mask';
import { isSegmenterReady, loadSegmenter, segmentPerson } from './segment';
import { toDataUrl, type EncodedPortrait } from './to-data-url';

export { PipelineError } from './canvas';
export { MAX_FILE_BYTES, formatMB, validateFile } from './load-image';

export type PipelineStep = 'reading' | 'loading-model' | 'removing-background' | 'encoding';

export type ProcessOptions = {
	skipBackgroundRemoval?: boolean;
	onStep?: (step: PipelineStep) => void;
};

export type ProcessedPhoto = EncodedPortrait & {
	/** The photo already had a transparent background. */
	hadAlpha: boolean;
	backgroundRemoved: boolean;
};

/** File → small transparent PNG data URL, ready for the engine. Never leaves the device. */
export async function processPhoto(file: File, options: ProcessOptions = {}): Promise<ProcessedPhoto> {
	const onStep = options.onStep ?? (() => {});

	onStep('reading');
	const canvas = await loadImage(file);
	const hadAlpha = hasMeaningfulAlpha(canvas);

	let backgroundRemoved = false;
	if (!hadAlpha && !options.skipBackgroundRemoval) {
		if (!isSegmenterReady()) {
			onStep('loading-model');
			await loadSegmenter();
		}
		onStep('removing-background');
		await nextFrame(); // let the status paint before the (blocking) inference
		applyMask(canvas, await segmentPerson(canvas));
		backgroundRemoved = true;
	}

	onStep('encoding');
	await nextFrame();
	const encoded = await toDataUrl(cropToSubject(canvas));
	return { ...encoded, hadAlpha, backgroundRemoved };
}
