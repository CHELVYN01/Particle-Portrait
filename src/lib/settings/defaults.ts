import { DEFAULT_OPTIONS, type PortraitOptions } from '#lib/engine/particle-portrait.js';

/** Everything the panel edits — the engine options minus the photos and callbacks. */
export type Settings = Omit<PortraitOptions, 'image' | 'onReady' | 'onShow'>;

export type DeepPartial<T> = {
	[K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export function defaultSettings(): Settings {
	const { image: _image, onReady: _onReady, onShow: _onShow, ...settings } = DEFAULT_OPTIONS;
	return structuredClone(settings);
}

function isObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Returns `base` with values from `patch` applied — only for keys `base` already
 * has, and only when the type matches. Safe for untrusted input (localStorage).
 */
export function mergeSettings<T>(base: T, patch: unknown): T {
	if (!isObject(base) || !isObject(patch)) return base;
	const out: Record<string, unknown> = { ...base };
	for (const key of Object.keys(base)) {
		const current = base[key];
		const next = patch[key];
		if (next === undefined) continue;
		if (isObject(current)) out[key] = mergeSettings(current, next);
		else if (typeof next === typeof current) out[key] = next;
	}
	return out as T;
}
