# Particle Portrait

Turn a photo into an interactive, GPU-rendered particle portrait, then export it as a drop-in snippet for your own website.

**Live tool: [particle-portrait.chelvynkleden.com](https://particle-portrait.chelvynkleden.com/)**

Particles gather from dust, follow the cursor, tilt with parallax, scatter on scroll, and morph between several photos. Everything runs in the browser.

## Privacy

Your photo never leaves your device. There is no upload, no server-side processing and no account. Decoding, background removal and rendering all happen locally. Settings are kept in `localStorage` only.

## Features

- **Photo pipeline.** JPG, PNG, WebP and HEIC (iPhone photos) up to 15 MB. HEIC is decoded on-device by a decoder that loads only when needed. EXIF orientation is honored and the longest side is capped at 1024 px.
- **Background removal.** On-device person segmentation with [MediaPipe](https://ai.google.dev/edge/mediapipe) (Selfie Segmenter). The model and the WASM runtime are self-hosted, with no third-party CDN at runtime. It is optional: skip it if your photo already has a transparent background.
- **Live editor.** Density, sharpening, auto-levels, brightness, contrast, particle size, light and dark palettes, opacity, alignment, edge fade, intro, morph timing, cursor repel, tilt, scroll scatter, shimmer, dust and mobile behavior.
- **Presets.** Subtle, Bold, Ghost and Ink as starting points.
- **Share settings.** "Copy share link" puts your settings in the URL hash (`#s=...`). Anyone who opens it gets the same look to try on their own photo. The hash never reaches a server and your photo is never included.
- **Multi-photo morphing.** Add several portraits and the particles flow from one into the next.
- **Light and dark themes.** The engine follows `prefers-color-scheme`, a `dark` or `light` class, or `data-theme` on `<html>`.
- **Export.** A zip with the engine, your photo(s) and settings baked in, an `index.html` demo, framework snippets and a README. three.js can come from a CDN (plain HTML works with nothing else) or from npm (for bundlers).

## Using the exported portrait

Export from the tool, unzip, and the included README has the framework-specific snippets. In short:

```js
import { createPortrait } from './particle-portrait.js';

const portrait = createPortrait(document.querySelector('#hero'), {
	image: ['/me-1.png', '/me-2.png'], // PNGs with transparent background
	density: 200,
	mouseRepel: 90,
	theme: 'auto'
});

portrait.next();    // morph to the next photo
portrait.replay();  // play the intro again
portrait.destroy(); // remove the canvas, release listeners and WebGL resources
```

The full option list with types is in [`src/lib/engine/particle-portrait.d.ts`](src/lib/engine/particle-portrait.d.ts). The engine is a single file, [`particle-portrait.js`](src/lib/engine/particle-portrait.js), with no dependency besides [three.js](https://threejs.org/).

On screens ≤ 768 px you can scale the density down, or disable the engine and show the still image instead (`mobile: { enabled: false }`). The canvas gets an `aria-label` from the `alt` option.

## Tech stack

- [SvelteKit](https://svelte.dev/docs/kit) 3 and Svelte 5, TypeScript, Vite
- [three.js](https://threejs.org/) for rendering
- [@mediapipe/tasks-vision](https://www.npmjs.com/package/@mediapipe/tasks-vision) for background removal
- [heic-to](https://github.com/hoppergee/heic-to) (LGPL-3.0) to decode HEIC photos, loaded only when a HEIC file is chosen
- [JSZip](https://stuk.github.io/jszip/) for export, loaded only when you export
- [Bun](https://bun.sh/) as the package manager

## Project structure

```
src/
├── routes/                  # the tool's single page
└── lib/
    ├── engine/              # standalone particle engine (the part you ship)
    ├── pipeline/            # load, crop, segment, mask: photo to transparent PNG
    ├── settings/            # defaults, presets, localStorage persistence
    ├── export/              # zip, engine file builder, snippets, README template
    ├── components/          # editor UI: dropzone, preview, panel, controls
    └── styles/
scripts/copy-mediapipe.mjs   # copies the MediaPipe WASM runtime into static/
static/mediapipe/            # segmentation model (the WASM runtime is generated)
test/engine.html             # runs the engine standalone, without SvelteKit
```

## Getting started

Requires [Bun](https://bun.sh/) (or any Node package manager, adjusting the commands).

```sh
bun install       # also runs postinstall, which copies the MediaPipe WASM files
bun run dev       # http://localhost:5173
```

| Script | What it does |
|---|---|
| `bun run dev` | Start the dev server |
| `bun run build` | Production build |
| `bun run preview` | Preview the production build |
| `bun run check` | Type-check with `svelte-check` |
| `bun run test:engine` | Run the engine standalone on `http://localhost:5200/engine.html` |

## Deployment notes

`static/mediapipe/wasm/` is **gitignored** and generated by the `postinstall` script. Your build must run `postinstall` (do not install with `--ignore-scripts`), otherwise background removal fails with "Couldn't load the background removal model". Check that these URLs return `200` after deploying:

- `/mediapipe/wasm/vision_wasm_internal.js`
- `/mediapipe/wasm/vision_wasm_internal.wasm`
- `/mediapipe/wasm/vision_wasm_nosimd_internal.js`
- `/mediapipe/wasm/vision_wasm_nosimd_internal.wasm`
- `/mediapipe/selfie_segmenter.tflite`

The app currently uses `@sveltejs/adapter-auto`. For a predictable deploy, install the adapter for your host (for example `adapter-static` for a static host, or `adapter-node` for your own server).

## Browser support

A browser with WebGL and `createImageBitmap`. HEIC is decoded natively in Safari and by a bundled decoder elsewhere.

## License

Released under the [PolyForm Noncommercial License 1.0.0](LICENSE). The source is public: you can read it, run it, learn from it and modify it for personal, educational, research and other noncommercial use. You may **not** sell it, or use it in a commercial product or service.

## Contributing

Contributions are welcome: bug reports, ideas and pull requests. By submitting a pull request you agree that your contribution is licensed under the same terms as the project, and that the project owner may relicense it.
