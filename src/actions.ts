import type ModuleInstance from './main.js'

export type ActionsSchema = {
	run_macro: {
		options: {
			macroId: string
		}
	}
	run_macro_by_name: {
		options: {
			name: string
		}
	}
	stop_fades: { options: Record<string, never> }
	undo: { options: Record<string, never> }
}

export function UpdateActions(self: ModuleInstance): void {
	// Rebuilt every time the macro list changes, so the dropdown always shows
	// what the operator has actually saved.
	const choices = self.macros.map((m) => ({
		id: m.id,
		label: m.targets ? `${m.name} — ${m.targets}` : `${m.name} (${m.consoleType.toUpperCase()})`,
	}))

	self.setActionDefinitions({
		run_macro: {
			name: 'Run macro',
			options: [
				{
					id: 'macroId',
					type: 'dropdown',
					label: 'Macro',
					default: choices[0]?.id ?? '',
					choices: choices.length
						? choices
						: [{ id: '', label: '(no macros — save one in TalkBoard first)' }],
				},
			],
			callback: async (event) => {
				const id = event.options.macroId
				if (!id) {
					self.log('warn', 'Run macro: no macro selected')
					return
				}
				await self.fireMacroById(id)
			},
		},

		run_macro_by_name: {
			name: 'Run macro by name',
			description:
				'Matches the macro name as typed in TalkBoard (case-insensitive). Supports variables, so one button can fire whatever a custom variable currently names.',
			options: [
				{
					id: 'name',
					type: 'textinput',
					label: 'Macro name',
					default: '',
					useVariables: true,
				},
			],
			callback: async (event) => {
				// Companion resolves variables in option values before the
				// callback runs, so this is already the final string.
				const name = String(event.options.name ?? '').trim()
				if (!name) {
					self.log('warn', 'Run macro by name: name resolved to empty')
					return
				}
				await self.fireMacroByName(name)
			},
		},

		stop_fades: {
			name: 'Stop all fades',
			options: [],
			callback: async () => {
				await self.fireStopFades()
			},
		},

		undo: {
			name: 'Undo last change',
			options: [],
			callback: async () => {
				await self.fireUndo()
			},
		},
	})
}
