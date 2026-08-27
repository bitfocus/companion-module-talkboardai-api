// Thin HTTP client for the TalkBoard Link API.
//
// Every call carries the bearer token and NO Origin header — TalkBoard
// rejects anything that looks browser-originated, which is fine here because
// a Companion module is server-side Node.

/** Wire protocol this module speaks. TalkBoard reports its own in /status;
 *  a mismatch means one side needs updating and we say so rather than
 *  failing in some confusing downstream way. */
export const SUPPORTED_PROTOCOL = 1

export interface TalkBoardStatus {
	app: string
	protocol: number
	version: string
	tier: string
	console: { type: string; model: string; status: string }
	macroCount: number
	macrosVersion: number
}

export interface TalkBoardMacro {
	id: string
	name: string
	consoleType: string
	hasFade: boolean
	stageCount: number
	targets?: string
	hotkey?: string
}

export interface RunAccepted {
	runId: string
	deduped?: boolean
}

export interface RunRecord {
	runId: string
	state: 'pending' | 'ok' | 'error'
	summary?: string
	createdAt: number
}

export class TalkBoardApiError extends Error {
	constructor(
		message: string,
		readonly status?: number,
	) {
		super(message)
		this.name = 'TalkBoardApiError'
	}
}

export class TalkBoardApi {
	constructor(
		private readonly getBaseUrl: () => string | null,
		private readonly getToken: () => string,
		private readonly timeoutMs = 4000,
	) {}

	private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
		const base = this.getBaseUrl()
		if (!base) throw new TalkBoardApiError('No TalkBoard address configured')

		const token = this.getToken()
		if (!token) throw new TalkBoardApiError('No token configured')

		let res: Response
		try {
			res = await fetch(`${base}${path}`, {
				method,
				headers: {
					Authorization: `Bearer ${token}`,
					...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
				},
				body: body !== undefined ? JSON.stringify(body) : undefined,
				signal: AbortSignal.timeout(this.timeoutMs),
			})
		} catch (e: unknown) {
			// Connection refused / DNS / timeout — TalkBoard isn't running or
			// isn't reachable. Distinct from an HTTP error, and the caller
			// surfaces it differently.
			throw new TalkBoardApiError(e instanceof Error ? e.message : String(e))
		}

		if (res.status === 401) {
			throw new TalkBoardApiError('Token rejected — check it matches TalkBoard', 401)
		}
		if (!res.ok) {
			let detail = ''
			try {
				const j = (await res.json()) as { error?: string }
				if (j?.error) detail = ` — ${j.error}`
			} catch {
				// Non-JSON error body; the status alone is enough.
			}
			throw new TalkBoardApiError(`HTTP ${res.status}${detail}`, res.status)
		}

		return (await res.json()) as T
	}

	status(): Promise<TalkBoardStatus> {
		return this.request<TalkBoardStatus>('GET', '/api/v1/status')
	}

	macros(): Promise<{ version: number; macros: TalkBoardMacro[] }> {
		return this.request<{ version: number; macros: TalkBoardMacro[] }>('GET', '/api/v1/macros')
	}

	runMacro(id: string): Promise<RunAccepted> {
		return this.request<RunAccepted>('POST', `/api/v1/macros/${encodeURIComponent(id)}/run`)
	}

	runMacroByName(name: string): Promise<RunAccepted> {
		return this.request<RunAccepted>('POST', '/api/v1/macros/run', { name })
	}

	getRun(runId: string): Promise<RunRecord> {
		return this.request<RunRecord>('GET', `/api/v1/runs/${encodeURIComponent(runId)}`)
	}

	stopFades(): Promise<RunAccepted> {
		return this.request<RunAccepted>('POST', '/api/v1/fades/stop')
	}

	undo(): Promise<RunAccepted> {
		return this.request<RunAccepted>('POST', '/api/v1/undo')
	}
}
