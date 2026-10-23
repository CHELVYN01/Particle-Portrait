import { THREE_CDN } from '../build-engine-file';

/**
 * A demo that opens straight from disk. Browsers block module imports from
 * file://, so the engine is inlined here; on a real site, import the .js file.
 */
export function indexHtml({ engineCode, photoCount }: { engineCode: string; photoCount: number }) {
	// The demo always loads three from the CDN, whichever import the .js file uses.
	const engine = engineCode
		.replace('import * as THREE from "three";', `import * as THREE from "${THREE_CDN}";`)
		.replaceAll('</script', '<\\/script');
	const nextButton = photoCount > 1 ? '\n      <button type="button" data-action="next">Next photo</button>' : '';

	return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Particle portrait — demo</title>
    <style>
      :root {
        --bg: #ffffff;
        --fg: #0a0a0a;
        --muted: #6e6e6e;
        color-scheme: light;
      }
      :root.dark {
        --bg: #0a0a0a;
        --fg: #f2f2f2;
        --muted: #8a8a8a;
        color-scheme: dark;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; height: 100%; }
      body {
        display: grid;
        grid-template-rows: auto 1fr;
        background: var(--bg);
        color: var(--fg);
        font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 16px;
        border-bottom: 1px solid color-mix(in srgb, var(--fg) 15%, transparent);
      }
      p { margin: 0; color: var(--muted); }
      nav { display: flex; flex-wrap: wrap; gap: 6px; }
      button {
        padding: 6px 10px;
        border: 1px solid var(--fg);
        background: var(--bg);
        color: var(--fg);
        font: inherit;
        cursor: pointer;
      }
      button:hover, button[aria-pressed="true"] { background: var(--fg); color: var(--bg); }
      #portrait { min-height: 420px; }
    </style>
  </head>
  <body>
    <header>
      <p>particle-portrait.js — demo. On your site, import the file instead (see README.md).</p>
      <nav>
        <button type="button" data-theme="auto" aria-pressed="true">Auto</button>
        <button type="button" data-theme="light" aria-pressed="false">Light</button>
        <button type="button" data-theme="dark" aria-pressed="false">Dark</button>
        <button type="button" data-action="replay">Replay intro</button>${nextButton}
      </nav>
    </header>
    <main id="portrait"></main>

    <script type="module">
${engine}

const media = matchMedia("(prefers-color-scheme: dark)");
let theme = "auto";

function applyTheme() {
  const dark = theme === "dark" || (theme === "auto" && media.matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.classList.toggle("light", !dark);
  for (const button of document.querySelectorAll("[data-theme]")) {
    button.setAttribute("aria-pressed", String(button.dataset.theme === theme));
  }
}

media.addEventListener("change", applyTheme);
applyTheme();

const portrait = createPortrait(document.getElementById("portrait"));

document.querySelector("nav").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.theme) {
    theme = button.dataset.theme;
    applyTheme();
  }
  if (button.dataset.action === "replay") portrait.replay();
  if (button.dataset.action === "next") portrait.next();
});
    </script>
  </body>
</html>
`;
}
