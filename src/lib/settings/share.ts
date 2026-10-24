import { defaultSettings, mergeSettings, type Settings } from './defaults';

// Settings travel in the URL hash, so they never reach a server. Photos are never included.
const PREFIX = '#s=v1.';
const MAX_PAYLOAD = 4000;

// Like presets, a shared look leaves the site-specific fields to the receiver.
const LOCAL_KEYS = ['alt', 'theme'] as const;

function isObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Only what differs from `base`, so links stay short. */
function diff(base: unknown, value: unknown): unknown {
	if (isObject(base) && isObject(value)) {
		const out: Record<string, unknown> = {};
		for (const key of Object.keys(value)) {
			const changed = diff(base[key], value[key]);
			if (changed !== undefined) out[key] = changed;
		}
		return Object.keys(out).length ? out : undefined;
	}
	return base === value ? undefined : value;
}

function toBase64Url(text: string) {
	const bytes = new TextEncoder().encode(text);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64Url(payload: string) {
	const binary = atob(payload.replaceAll('-', '+').replaceAll('_', '/'));
	return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

/** The hash (including `#`) that reproduces `settings`. */
export function encodeSettings(settings: Settings) {
	const defaults = defaultSettings();
	const shared = { ...settings };
	for (const key of LOCAL_KEYS) delete (shared as Partial<Settings>)[key];
	return PREFIX + toBase64Url(JSON.stringify(diff(defaults, shared) ?? {}));
}

/** Settings from a share hash, or null when `hash` is not a valid share link. */
export function decodeSettings(hash: string): Settings | null {
	if (!hash.startsWith(PREFIX)) return null;
	const payload = hash.slice(PREFIX.length);
	if (!payload || payload.length > MAX_PAYLOAD) return null;
	try {
		const parsed: unknown = JSON.parse(fromBase64Url(payload));
		if (!isObject(parsed)) return null;
		for (const key of LOCAL_KEYS) delete parsed[key];
		// mergeSettings ignores unknown keys and wrong types; the engine clamps ranges.
		return mergeSettings(defaultSettings(), parsed);
	} catch {
		return null;
	}
}
