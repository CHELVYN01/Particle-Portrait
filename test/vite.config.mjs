// Plain Vite (no SvelteKit) for test/engine.html — proves the engine runs standalone.
// Run: bun run test:engine
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
	root: here('.'),
	publicDir: here('../static'),
	resolve: {
		alias: { '@engine': here('../src/lib/engine') }
	},
	server: {
		port: 5200,
		open: '/engine.html'
	}
});
