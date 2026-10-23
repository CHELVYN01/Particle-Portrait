<script lang="ts">
	type ThemePref = 'auto' | 'light' | 'dark';

	// Must match the key read by the inline script in app.html.
	const STORAGE_KEY = 'pp:tool-theme';
	const ORDER: ThemePref[] = ['auto', 'light', 'dark'];

	let pref = $state<ThemePref>('auto');

	function readPref(): ThemePref {
		try {
			const value = localStorage.getItem(STORAGE_KEY);
			if (value === 'light' || value === 'dark') return value;
		} catch {}
		return 'auto';
	}

	function writePref(value: ThemePref) {
		try {
			if (value === 'auto') localStorage.removeItem(STORAGE_KEY);
			else localStorage.setItem(STORAGE_KEY, value);
		} catch {}
	}

	function cycle() {
		pref = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
		writePref(pref);
	}

	$effect(() => {
		pref = readPref();
	});

	$effect(() => {
		const media = window.matchMedia('(prefers-color-scheme: dark)');
		const apply = () => {
			const dark = pref === 'dark' || (pref === 'auto' && media.matches);
			// Both classes, so the engine's `theme: "auto"` reads the tool theme, not the OS.
			document.documentElement.classList.toggle('dark', dark);
			document.documentElement.classList.toggle('light', !dark);
		};
		apply();
		media.addEventListener('change', apply);
		return () => media.removeEventListener('change', apply);
	});
</script>

<button
	type="button"
	class="btn ghost"
	onclick={cycle}
	aria-label="Theme: {pref}. Click to change."
	title="Change theme"
>
	<span class="swatch" aria-hidden="true"></span>
	Theme / {pref}
</button>

<style>
	/* Half-filled square: reads as "light / dark" */
	.swatch {
		position: relative;
		width: 9px;
		height: 9px;
		border: 1px solid currentColor;
	}

	.swatch::after {
		content: '';
		position: absolute;
		inset: 0 50% 0 0;
		background: currentColor;
	}
</style>
