import typesSource from '../engine/particle-portrait.d.ts?raw';
import { buildEngineFile, type EngineInput } from './build-engine-file';
import { buildZip, type ExportFile } from './build-zip';
import { indexHtml } from './templates/index-html';
import { readmeMd } from './templates/readme-md';

export {
	THREE_VERSION,
	buildEngineFile,
	type EngineInput,
	type EngineLanguage,
	type ThreeSource
} from './build-engine-file';
export { NPM_INSTALL, snippets, type Snippet, type SnippetId } from './snippets';

export const ENGINE_FILE = 'particle-portrait.js';
export const ENGINE_TS_FILE = 'particle-portrait.ts';
export const ZIP_FILE = 'particle-portrait.zip';
/** Target size for the exported .js, excluding three.js. */
export const SIZE_BUDGET = 100 * 1024;

export function exportFiles(input: EngineInput): ExportFile[] {
	const engine = buildEngineFile(input, 'js');
	return [
		{ name: ENGINE_FILE, content: engine.code },
		{ name: 'particle-portrait.d.ts', content: typesSource },
		// Its own folder: a .ts next to the .js would shadow it in TypeScript projects.
		{ name: `typescript/${ENGINE_TS_FILE}`, content: buildEngineFile(input, 'ts').code },
		{ name: 'index.html', content: indexHtml({ engineCode: engine.code, photoCount: input.images.length }) },
		{
			name: 'README.md',
			content: readmeMd({
				settings: input.settings,
				three: input.three,
				photoCount: input.images.length,
				bytes: engine.bytes
			})
		}
	];
}

export function exportZip(input: EngineInput) {
	return buildZip(exportFiles(input));
}

export function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.append(link);
	link.click();
	link.remove();
	// Give the browser a moment to start the download before revoking.
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadText(text: string, filename: string, type = 'text/javascript') {
	downloadBlob(new Blob([text], { type }), filename);
}
