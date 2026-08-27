import type { ModuleSchema } from './main.js'
import type ModuleInstance from './main.js'
import type { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'

const WHITE = 0xffffff
const BLACK = 0x000000

export function UpdatePresets(self: ModuleInstance): void {
	const presets: CompanionPresetDefinitions<ModuleSchema> = {}

	// One ready-made button per saved macro. The operator drags it onto the
	// grid and it works — no action wiring, no feedback wiring.
	for (const macro of self.macros) {
		presets[`macro_${macro.id}`] = {
			type: 'simple',
			name: macro.name,
			style: {
				text: macro.name,
				size: 'auto',
				color: WHITE,
				bgcolor: BLACK,
				show_topbar: false,
			},
			steps: [
				{
					down: [{ actionId: 'run_macro', options: { macroId: macro.id } }],
					up: [],
				},
			],
			feedbacks: [
				// Lit while the macro runs, so a multi-stage fade shows progress
				// rather than the button snapping back instantly.
				{
					feedbackId: 'macro_running',
					options: { macroId: macro.id },
					style: { bgcolor: 0x664400, color: WHITE },
				},
				// Dark when the desk isn't there — a button that looks armed
				// while the console is unplugged is worse than one that looks dead.
				{
					feedbackId: 'console_connected',
					options: {},
					style: { bgcolor: 0x003300, color: WHITE },
				},
			],
		}
	}

	presets['stop_fades'] = {
		type: 'simple',
		name: 'Stop all fades',
		style: { text: 'STOP\\nFADES', size: 'auto', color: WHITE, bgcolor: 0x660000, show_topbar: false },
		steps: [{ down: [{ actionId: 'stop_fades', options: {} }], up: [] }],
		feedbacks: [],
	}

	presets['undo'] = {
		type: 'simple',
		name: 'Undo',
		style: { text: 'UNDO', size: 'auto', color: WHITE, bgcolor: 0x333333, show_topbar: false },
		steps: [{ down: [{ actionId: 'undo', options: {} }], up: [] }],
		feedbacks: [],
	}

	const structure: CompanionPresetSection[] = [
		{
			id: 'macros',
			name: 'Macros',
			definitions: [
				{
					id: 'saved_macros',
					name: 'Saved macros',
					description: 'One button per macro saved in TalkBoard',
					type: 'simple',
					presets: self.macros.map((m) => `macro_${m.id}`),
				},
			],
		},
		{
			id: 'utility',
			name: 'Utility',
			definitions: [
				{
					id: 'utility_buttons',
					name: 'Utility',
					description: 'Stop running fades, or undo the last change',
					type: 'simple',
					presets: ['stop_fades', 'undo'],
				},
			],
		},
	]

	self.setPresetDefinitions(structure, presets)
}
