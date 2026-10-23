import { defaultSettings, mergeSettings, type DeepPartial, type Settings } from './defaults';

export type Preset = {
	id: string;
	name: string;
	description: string;
	patch: DeepPartial<Settings>;
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
	}
];

export function presetSettings(preset: Preset): Settings {
	return mergeSettings(defaultSettings(), preset.patch);
}

/** The preset the settings currently match, ignoring alt text and theme lock. */
export function matchPreset(settings: Settings): Preset | null {
	const comparable = (s: Settings) => JSON.stringify({ ...s, alt: '', theme: 'auto' });
	const current = comparable(settings);
	return PRESETS.find((preset) => comparable(presetSettings(preset)) === current) ?? null;
}
