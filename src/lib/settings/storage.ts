import { defaultSettings, mergeSettings, type Settings } from './defaults';

// Settings only — the photo is never stored.
const STORAGE_KEY = 'pp:settings:v1';

export function loadSettings(): Settings {
	const base = defaultSettings();
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? mergeSettings(base, JSON.parse(raw)) : base;
	} catch {
		return base;
	}
}

export function saveSettings(settings: Settings) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// Storage full or blocked: settings just won't survive a refresh.
	}
}
