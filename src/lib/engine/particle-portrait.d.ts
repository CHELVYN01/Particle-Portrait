/**
 * particle-portrait.js — types
 * Made with https://particle.chelvynkleden.com · MIT License
 */

export type PortraitTheme = 'auto' | 'light' | 'dark';

export interface PortraitPalette {
	/** Color of the brightest-reading particles. Any CSS color. */
	main: string;
	/** Color the shadows fall into. Any CSS color. */
	shadow: string;
}

export interface PortraitOptions {
	/** PNG data URL or URL with a transparent background, or several to morph between. */
	image: string | string[] | null;
	/** Sample width in px. 120–360. */
	density: number;
	/** Unsharp mask strength. 0–3. */
	sharpen: number;
	/** Stretch each photo's tones to full black-to-white (helps dark or flat photos). */
	autoLevels: boolean;
	/** -0.5–0.5. */
	brightness: number;
	/** 0.5–2. */
	contrast: number;
	/** Particle size multiplier. */
	pointSize: number;
	/** `auto` follows `prefers-color-scheme` and a `dark` / `light` class or `data-theme` on `<html>`. */
	theme: PortraitTheme;
	colors: { light: PortraitPalette; dark: PortraitPalette };
	/** 0–1 per theme. */
	opacity: { light: number; dark: number };
	align: 'left' | 'center' | 'right';
	/** Portrait height relative to the container. 0.5–1.2. */
	fill: number;
	/** Dissolve the photo's hard crop at the sides and bottom. 0–1. */
	edgeFade: number;
	/** Gather from dust on load. `duration` in seconds. */
	intro: { enabled: boolean; duration: number };
	/** With several images: `hold` seconds between morphs, `duration` seconds per morph. */
	morph: { auto: boolean; hold: number; duration: number };
	/** Cursor repel radius in px. 0 = off. */
	mouseRepel: number;
	/** Parallax tilt toward the cursor, in degrees. 0 = off. */
	tilt: number;
	/** Scatter the particles as the portrait scrolls out of view. */
	scrollScatter: boolean;
	/** Subtle jitter and twinkle. 0 = off. */
	shimmer: number;
	/** Loose floating particles. 0 = off. */
	dust: number;
	/** On screens ≤ 768px: `enabled: false` shows the still image instead of running the engine. */
	mobile: { enabled: boolean; densityScale: number };
	/** `aria-label` of the canvas and `alt` of the fallback image. */
	alt: string;
	/** Called once, after the first frame is drawn. */
	onReady: (() => void) | null;
	/** Called when a portrait starts showing (intro or morph), with its index. */
	onShow: ((index: number) => void) | null;
}

type DeepPartial<T> = {
	[K in keyof T]?: T[K] extends (...args: never[]) => unknown
		? T[K]
		: T[K] extends string[] | string | null
			? T[K]
			: T[K] extends object
				? DeepPartial<T[K]>
				: T[K];
};

export type PortraitOptionsInput = DeepPartial<PortraitOptions>;

/** The engine's default options (read-only). */
export const DEFAULT_OPTIONS: Readonly<PortraitOptions>;

export interface Portrait {
	/** Change options. Only re-samples when image, density, sharpen, edgeFade, autoLevels or mobile scaling change. */
	update(options: PortraitOptionsInput): void;
	setTheme(theme: PortraitTheme): void;
	/** Morph to the portrait at `index`. Queued if a transition is running. */
	show(index: number): void;
	/** Morph to the next portrait. */
	next(): void;
	/** Play the gather-from-dust intro again. */
	replay(): void;
	/** Index of the portrait currently shown (or being morphed to). */
	readonly index: number;
	/** Particle count of the current portrait. */
	readonly count: number;
	/** Removes the canvas and releases every listener, observer and WebGL resource. */
	destroy(): void;
}

export function createPortrait(container: HTMLElement, options?: PortraitOptionsInput): Portrait;
