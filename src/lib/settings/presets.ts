import { defaultSettings, mergeSettings, type DeepPartial, type Settings } from './defaults';

export type Preset = {
	id: string;
	name: string;
	description: string;
	patch: DeepPartial<Settings>;
	/** Saved by the user (in this browser), not shipped with the tool. */
	custom?: boolean;
};

export const PRESETS: Preset[] = [
	{
		id: 'subtle',
		name: 'Subtle',
		description: 'Quiet and light. Sits behind text.',
		patch: {
			density: 140,
			pointSize: 0.9,
			contrast: 0.9,
			opacity: { light: 0.7, dark: 0.75 },
			shimmer: 0.5,
			mouseRepel: 60,
			tilt: 2,
			dust: 80
		}
	},
	{
		id: 'bold',
		name: 'Bold',
		description: 'Dense, punchy, reacts hard.',
		patch: {
			density: 210,
			pointSize: 1.35,
			contrast: 1.25,
			sharpen: 1.4,
			mouseRepel: 130,
			tilt: 7,
			dust: 220
		}
	},
	{
		id: 'ghost',
		name: 'Ghost',
		description: 'Faint, airy, mostly dust.',
		patch: {
			density: 160,
			pointSize: 0.8,
			brightness: 0.1,
			contrast: 0.8,
			opacity: { light: 0.45, dark: 0.55 },
			shimmer: 1.6,
			dust: 320,
			colors: {
				light: { main: '#3a3a3a', shadow: '#a0a0a0' },
				dark: { main: '#e6e6e6', shadow: '#5c5c5c' }
			}
		}
	},
	{
		id: 'ink',
		name: 'Ink',
		description: 'Crisp, high contrast, still.',
		patch: {
			density: 240,
			pointSize: 1.1,
			sharpen: 1.8,
			contrast: 1.4,
			shimmer: 0.2,
			tilt: 0,
			dust: 0,
			colors: {
				light: { main: '#000000', shadow: '#3d3d3d' },
				dark: { main: '#ffffff', shadow: '#b5b5b5' }
			}
		}
	},
	{
		id: 'ascii',
		name: 'ASCII',
		description: 'Built from text characters.',
		patch: {
			shape: 'ascii',
			density: 130,
			sharpen: 1.4,
			contrast: 1.2,
			shimmer: 0.4,
			dust: 60
		}
	},
	{
		id: 'sketch',
		name: 'Sketch',
		description: 'Pen hatching, like an engraving.',
		patch: {
			shape: 'line',
			density: 200,
			sharpen: 1.6,
			contrast: 1.2,
			shimmer: 0.3,
			dust: 40
		}
	},
	{
		id: 'color',
		name: 'Color',
		description: "Round dots in the photo's own colors.",
		patch: {
			colorMode: 'photo',
			shape: 'circle',
			density: 200,
			pointSize: 1.1,
			contrast: 1.1,
			shimmer: 0.6,
			dust: 100
		}
	}
];

export function presetSettings(preset: Preset): Settings {
	return mergeSettings(defaultSettings(), preset.patch);
}

/** The preset the settings currently match, ignoring alt text and theme lock. */
export function matchPreset(settings: Settings, saved: Preset[] = []): Preset | null {
	const comparable = (s: Settings) => JSON.stringify({ ...s, alt: '', theme: 'auto' });
	const current = comparable(settings);
	return [...PRESETS, ...saved].find((preset) => comparable(presetSettings(preset)) === current) ?? null;
}
