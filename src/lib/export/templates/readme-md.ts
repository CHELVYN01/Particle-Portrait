import type { Settings } from '../../settings/defaults';
import { THREE_VERSION, type ThreeSource } from '../build-engine-file';
import { NPM_INSTALL, snippets } from '../snippets';

type OptionDoc = { key: string; type: string; text: string };

const OPTION_DOCS: OptionDoc[] = [
	{ key: 'image', type: 'string | string[]', text: 'PNG data URL or URL with a transparent background. Several = morph between them. Defaults to the embedded photos.' },
	{ key: 'density', type: 'number', text: 'Sample width in px (120–360). Higher is finer and heavier.' },
	{ key: 'sharpen', type: 'number', text: 'Unsharp mask strength (0–3).' },
	{ key: 'autoLevels', type: 'boolean', text: "Stretch each photo's tones to full black-to-white." },
	{ key: 'brightness', type: 'number', text: '-0.5–0.5.' },
	{ key: 'contrast', type: 'number', text: '0.5–2.' },
	{ key: 'pointSize', type: 'number', text: 'Particle size multiplier.' },
	{ key: 'theme', type: '"auto" | "light" | "dark"', text: '`auto` follows a `dark` / `light` class or `data-theme` on `<html>`, else the OS setting.' },
	{ key: 'colors', type: '{ light, dark: { main, shadow } }', text: 'Any CSS colors. `main` for bright tones, `shadow` for dark ones.' },
	{ key: 'opacity', type: '{ light, dark }', text: '0–1 per theme.' },
	{ key: 'align', type: '"left" | "center" | "right"', text: 'Horizontal position. Always bottom-aligned.' },
	{ key: 'fill', type: 'number', text: 'Portrait height relative to the container (0.5–1.2).' },
	{ key: 'edgeFade', type: 'number', text: "Dissolve the photo's hard crop at the sides and bottom (0–1)." },
	{ key: 'intro', type: '{ enabled, duration }', text: 'Particles gather from dust on load. Seconds.' },
	{ key: 'morph', type: '{ auto, hold, duration }', text: 'With several photos: seconds between morphs and per morph.' },
	{ key: 'mouseRepel', type: 'number', text: 'Repel radius around the cursor in px. 0 = off.' },
	{ key: 'tilt', type: 'number', text: 'Parallax tilt toward the cursor in degrees. 0 = off.' },
	{ key: 'scrollScatter', type: 'boolean', text: 'Particles drift apart as the portrait scrolls out of view.' },
	{ key: 'shimmer', type: 'number', text: 'Subtle jitter and twinkle. 0 = off.' },
	{ key: 'dust', type: 'number', text: 'Loose floating particles. 0 = off.' },
	{ key: 'mobile', type: '{ enabled, densityScale }', text: 'Screens ≤ 768px. `enabled: false` shows the still image instead.' },
	{ key: 'alt', type: 'string', text: 'Read by screen readers (`aria-label`).' },
	{ key: 'onReady', type: '() => void', text: 'Called after the first frame.' },
	{ key: 'onShow', type: '(index) => void', text: 'Called when a photo starts showing.' }
];

function valueOf(settings: Settings, key: string) {
	if (key === 'image') return 'embedded';
	if (key === 'onReady' || key === 'onShow') return '—';
	const value = (settings as Record<string, unknown>)[key];
	return `\`${JSON.stringify(value)}\``;
}

function cell(text: string) {
	return text.replaceAll('|', '\\|');
}

export function readmeMd({
	settings,
	three,
	photoCount,
	bytes
}: {
	settings: Settings;
	three: ThreeSource;
	photoCount: number;
	bytes: number;
}) {
	const list = snippets(three);
	const html = list.find((snippet) => snippet.id === 'html')!;
	const frameworks = list.filter((snippet) => snippet.bundler);
	const photos = `${photoCount} photo${photoCount === 1 ? '' : 's'}`;
	const kb = Math.round(bytes / 1024);

	const threeNote =
		three === 'cdn'
			? `\`particle-portrait.js\` imports three.js ${THREE_VERSION} from jsDelivr, so plain HTML needs nothing else.

**Using a bundler (React, Next.js, Vue, Svelte, Vite…)?** Most bundlers can't import from a URL. Open \`particle-portrait.js\`, change the first import to \`import * as THREE from "three";\` and run \`${NPM_INSTALL}\` — or export again with "three.js from npm".`
			: `\`particle-portrait.js\` imports \`three\` as a package. Install it once:

\`\`\`sh
${NPM_INSTALL}
\`\`\`

In plain HTML (no bundler), map \`three\` with an import map — the HTML example below shows how.`;

	const frameworkSections = frameworks
		.map(
			(snippet) => `### ${snippet.label}

\`${snippet.file}\`

\`\`\`${snippet.language}
${snippet.code}
\`\`\``
		)
		.join('\n\n');

	const rows = OPTION_DOCS.map(
		(doc) => `| \`${doc.key}\` | ${cell(doc.type)} | ${cell(valueOf(settings, doc.key))} | ${cell(doc.text)} |`
	).join('\n');

	return `# Particle portrait

A living particle portrait for your website, rendered with three.js. ${photos} and your settings are built into \`particle-portrait.js\` (${kb} KB).

Made with [particle.chelvynkleden.com](https://particle.chelvynkleden.com).

## What's in this folder

| File | |
|---|---|
| \`particle-portrait.js\` | The portrait. Copy it into your project. |
| \`particle-portrait.d.ts\` | Types, for TypeScript projects. Keep it next to the \`.js\` file. |
| \`typescript/particle-portrait.ts\` | The same portrait as one TypeScript file, types included. Use it *instead of* the \`.js\` + \`.d.ts\`. |
| \`index.html\` | A demo that opens straight from disk. |
| \`README.md\` | This file. |

## three.js

${threeNote}

## Quick start (HTML)

\`\`\`html
${html.code}
\`\`\`

The container needs a size — the canvas fills it. Module scripts don't run from \`file://\`, so serve your page (for example \`npx serve .\`); \`index.html\` in this folder is the exception, it inlines the engine.

## Frameworks

Always call \`destroy()\` when the component unmounts — it frees the WebGL context. The module is safe to import during server rendering; only \`createPortrait()\` touches the browser.

${frameworkSections}

## TypeScript

Two ways, pick one:

- **\`.js\` + \`.d.ts\`** (simplest): copy both files side by side. Imports are typed automatically.
- **\`typescript/particle-portrait.ts\`**: one file, types inline. Copy it alone — don't keep the \`.js\` next to it.

\`\`\`tsx
import { useEffect, useRef } from "react";
import { createPortrait, type PortraitOptionsInput } from "./particle-portrait";

const options: PortraitOptionsInput = { theme: "dark", mouseRepel: 120 };

export function Portrait() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const portrait = createPortrait(ref.current, options);
    return () => portrait.destroy();
  }, []);

  return <div ref={ref} style={{ width: "100%", height: 600 }} />;
}
\`\`\`

The \`.ts\` file starts with \`// @ts-nocheck\`: the public API is fully typed, the engine body inside is plain JavaScript. If your linter bans that comment (\`@typescript-eslint/ban-ts-comment\`), use the \`.js\` + \`.d.ts\` pair instead.

## Options

Your settings are the defaults, baked into \`EMBEDDED_OPTIONS\` near the top of \`particle-portrait.js\`. Change them there, or override any of them per call:

\`\`\`js
createPortrait(el, {
  density: 200,
  theme: "dark",
  colors: { dark: { main: "#ffffff" } },
});
\`\`\`

Nested objects merge, so you only pass what changes.

| Option | Type | Your value | |
|---|---|---|---|
${rows}

## API

\`\`\`js
const portrait = createPortrait(element, options);

portrait.update({ density: 220 }); // change options live
portrait.setTheme("dark");         // "auto" | "light" | "dark"
portrait.show(1);                  // morph to a photo
portrait.next();
portrait.replay();                 // play the intro again
portrait.index;                    // current photo
portrait.count;                    // particles
portrait.destroy();
\`\`\`

## Good to know

- Rendering pauses when the portrait is off-screen or the tab is hidden.
- \`prefers-reduced-motion: reduce\` shows a still portrait: no intro, cursor, scroll or shimmer.
- Without WebGL, the embedded photo is shown as a plain image.
- Phones get fewer particles (\`mobile.densityScale\`).

## License

MIT — free to use, modify and ship. Credit is kept in the file header; no watermark.
`;
}
