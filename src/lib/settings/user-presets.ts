import { defaultSettings, mergeSettings, type Settings } from './defaults';
import type { Preset } from './presets';
import { settingsPatch } from './share';

// Presets saved by the user live in this browser only. Photos are never part of them.
const STORAGE_KEY = 'pp:presets:v1';
const FILE_APP = 'particle-portrait';

export const MAX_PRESETS = 24;
export const MAX_NAME = 32;

function isObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cleanName(name: unknown) {
	return typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : '';
}

function sameName(a: string, b: string) {
	return a.toLowerCase() === b.toLowerCase();
}

/** Builds a preset from untrusted data. Unknown keys and wrong types are dropped. */
function toPreset(raw: unknown): Preset | null {
	if (!isObject(raw)) return null;
	const name = cleanName(raw.name);
	if (!name) return null;
	const settings = mergeSettings(defaultSettings(), raw.patch);
	return {
		id: `user:${name.toLowerCase()}`,
		name,
		description: 'Saved by you',
		patch: settingsPatch(settings),
		custom: true
	};
}

/** Adds or replaces (same name, ignoring case) a preset made from the current settings. */
function withPreset(list: Preset[], name: string, patch: unknown): Preset[] {
	const preset = toPreset({ name, patch });
	if (!preset) return list;
	const index = list.findIndex((item) => sameName(item.name, preset.name));
	if (index >= 0) return list.map((item, i) => (i === index ? preset : item));
	return [...list, preset].slice(0, MAX_PRESETS);
}

export function loadUserPresets(): Preset[] {
	try {
		const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
		if (!Array.isArray(raw)) return [];
		return raw.reduce<Preset[]>((list, item) => withPreset(list, cleanName(isObject(item) ? item.name : ''), isObject(item) ? item.patch : {}), []);
	} catch {
		return [];
	}
}

export function saveUserPresets(list: Preset[]) {
	try {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify(list.map(({ name, patch }) => ({ name, patch })))
		);
	} catch {
		// Storage full or blocked: presets just won't survive a refresh.
	}
}

/** `settings` saved under `name`. Returns the new list, or null if the name is empty. */
export function addUserPreset(list: Preset[], name: string, settings: Settings): Preset[] | null {
	const clean = cleanName(name);
	if (!clean) return null;
	return withPreset(list, clean, settingsPatch(settings));
}

export function removeUserPreset(list: Preset[], id: string) {
	return list.filter((preset) => preset.id !== id);
}

/** The JSON text of a preset file. */
export function presetsToFile(list: Preset[]) {
	return JSON.stringify(
		{ app: FILE_APP, version: 1, presets: list.map(({ name, patch }) => ({ name, patch })) },
		null,
		2
	);
}

/** Merges the presets in a preset file into `list`. `added` is how many were read. */
export function presetsFromFile(list: Preset[], text: string): { list: Preset[]; added: number } | null {
	try {
		const data: unknown = JSON.parse(text);
		if (!isObject(data) || data.app !== FILE_APP || !Array.isArray(data.presets)) return null;
		let next = list;
		let added = 0;
		for (const item of data.presets.slice(0, MAX_PRESETS)) {
			if (!isObject(item)) continue;
			const name = cleanName(item.name);
			if (!name) continue;
			const merged = withPreset(next, name, item.patch);
			if (merged !== next) added++;
			next = merged;
		}
		return added ? { list: next, added } : null;
	} catch {
		return null;
	}
}
