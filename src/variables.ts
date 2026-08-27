import type ModuleInstance from './main.js'

export type VariablesSchema = {
	console_status: string
	console_type: string
	console_model: string
	macro_count: string
	last_macro: string
	last_result: string
	talkboard_version: string
}

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	self.setVariableDefinitions({
		console_status: { name: 'Console connection status' },
		console_type: { name: 'Console type' },
		console_model: { name: 'Console model' },
		macro_count: { name: 'Number of saved macros' },
		last_macro: { name: 'Last macro fired' },
		last_result: { name: 'Result of the last macro' },
		talkboard_version: { name: 'TalkBoard version' },
	})
}
