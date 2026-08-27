import type ModuleInstance from './main.js'

export type FeedbacksSchema = {
	talkboard_reachable: { type: 'boolean'; options: Record<string, never> }
	console_connected: { type: 'boolean'; options: Record<string, never> }
	macro_running: {
		type: 'boolean'
		options: {
			macroId: string
		}
	}
}

export function UpdateFeedbacks(self: ModuleInstance): void {
	const choices = self.macros.map((m) => ({ id: m.id, label: m.name }))

	self.setFeedbackDefinitions({
		talkboard_reachable: {
			name: 'TalkBoard is reachable',
			type: 'boolean',
			defaultStyle: { bgcolor: 0x000000, color: 0xffffff },
			options: [],
			callback: () => self.reachable,
		},

		// The distinction that matters at a show: TalkBoard can be running
		// perfectly while the console is unplugged. A button that looks armed
		// in that state is worse than one that looks dead.
		console_connected: {
			name: 'Console is connected',
			type: 'boolean',
			defaultStyle: { bgcolor: 0x003300, color: 0xffffff },
			options: [],
			callback: () => self.consoleStatus === 'connected',
		},

		macro_running: {
			name: 'Macro is running',
			description:
				'True from the moment the macro is fired until TalkBoard reports its result — so a multi-stage fade stays lit while it ramps.',
			type: 'boolean',
			defaultStyle: { bgcolor: 0x664400, color: 0xffffff },
			options: [
				{
					id: 'macroId',
					type: 'dropdown',
					label: 'Macro',
					default: choices[0]?.id ?? '',
					choices: choices.length ? choices : [{ id: '', label: '(no macros)' }],
				},
			],
			callback: (feedback) => self.runningMacroIds.has(feedback.options.macroId),
		},
	})
}
