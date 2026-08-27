import type { SomeCompanionConfigField } from '@companion-module/base'

export type ModuleConfig = {
	/** "host:port" from the Bonjour picker, or null when the user chose Manual. */
	bonjour_host: string | null
	host: string
	port: number
	/** How often to poll /status, in ms. The macro list is only refetched when
	 *  the version counter changes, so this stays cheap. */
	pollInterval: number
}

export type ModuleSecrets = {
	token: string
}

/** TalkBoard shows this in Settings → Companion Link. */
export const DEFAULT_PORT = 8730

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'intro',
			width: 12,
			label: 'Companion Link',
			value:
				'In TalkBoard, open Settings → Companion Link, switch it on, and copy the token here. ' +
				'Your saved macros then appear in the "Run macro" action below.',
		},
		{
			type: 'bonjour-device',
			id: 'bonjour_host',
			label: 'TalkBoard',
			width: 12,
		},
		// Bonjour is blocked on plenty of show networks, so the manual fields
		// stay available — just hidden while a discovered device is selected.
		{
			type: 'textinput',
			id: 'host',
			label: 'Address',
			width: 8,
			default: '127.0.0.1',
			isVisibleExpression: '$(options:bonjour_host) == null',
			disableAutoExpression: true,
		},
		{
			type: 'number',
			id: 'port',
			label: 'Port',
			width: 4,
			min: 1,
			max: 65535,
			default: DEFAULT_PORT,
			isVisibleExpression: '$(options:bonjour_host) == null',
			disableAutoExpression: true,
		},
		{
			type: 'secret-text',
			id: 'token',
			label: 'Token',
			width: 12,
			description: 'From TalkBoard: Settings → Companion Link → Copy',
		},
		{
			type: 'number',
			id: 'pollInterval',
			label: 'Poll interval (ms)',
			width: 4,
			min: 250,
			max: 10000,
			default: 1000,
			description: 'How often to check TalkBoard for changes. 1000 is plenty.',
		},
	]
}

/** Resolve the base URL from either the Bonjour selection or the manual fields. */
export function baseUrlFrom(config: ModuleConfig): string | null {
	const picked = config.bonjour_host
	if (picked) {
		// Companion hands back "10.0.0.7:8730".
		return `http://${picked}`
	}
	const host = (config.host ?? '').trim()
	if (!host) return null
	const port = config.port || DEFAULT_PORT
	return `http://${host}:${port}`
}
