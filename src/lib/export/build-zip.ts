export type ExportFile = { name: string; content: string };

/** JSZip is loaded only when someone actually exports. */
export async function buildZip(files: ExportFile[]): Promise<Blob> {
	const { default: JSZip } = await import('jszip');
	const zip = new JSZip();
	for (const file of files) zip.file(file.name, file.content);
	return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
}
