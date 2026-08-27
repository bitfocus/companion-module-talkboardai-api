import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, baseUrlFrom, type ModuleConfig, type ModuleSecrets } from './config.js'
import { UpdateVariableDefinitions, type VariablesSchema } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions, type ActionsSchema } from './actions.js'
import { UpdateFeedbacks, type FeedbacksSchema } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { SUPPORTED_PROTOCOL, TalkBoardApi, TalkBoardApiError, type TalkBoardMacro } from './api.js'

export type ModuleSchema = {
	config: ModuleConfig
	secrets: ModuleSecrets
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: VariablesSchema
}

export { UpgradeScripts }

/** How long to keep asking TalkBoard what happened to a run before giving up.
 *  Generous because a multi-stage fade can legitimately ramp for a minute. */
const RUN_POLL_TIMEOUT_MS = 120_000
const RUN_POLL_INTERVAL_MS = 250

export default class ModuleInstance extends InstanceBase<ModuleSchema> {
	config!: ModuleConfig
	secrets!: ModuleSecrets

	/** Live macro list, mirrored from TalkBoard. Read by actions/feedbacks/presets. */
	macros: TalkBoardMacro[] = []
	/** Whether the last poll reached TalkBoard. */
	reachable = false
	/** The desk's connection state as TalkBoard reports it. */
	consoleStatus = 'disconnected'
	/** Macros with a run in flight — drives the macro_running feedback. */
	runningMacroIds = new Set<string>()

	private api!: TalkBoardApi
	private pollTimer: NodeJS.Timeout | null = null
	private knownMacrosVersion = -1
	private destroyed = false

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig, _isFirstInit: boolean, secrets: ModuleSecrets): Promise<void> {
		this.config = config
		this.secrets = secrets
		this.api = new TalkBoardApi(
			() => baseUrlFrom(this.config),
			() => this.secrets?.token ?? '',
		)

		this.updateVariableDefinitions()
		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()

		this.updateStatus(InstanceStatus.Connecting)
		this.startPolling()
	}

	async destroy(): Promise<void> {
		this.destroyed = true
		this.stopPolling()
	}

	async configUpdated(config: ModuleConfig, secrets: ModuleSecrets): Promise<void> {
		this.config = config
		this.secrets = secrets
		// Force a full refresh — the address may now point at a different rig
		// with a completely different macro list.
		this.knownMacrosVersion = -1
		this.stopPolling()
		this.updateStatus(InstanceStatus.Connecting)
		this.startPolling()
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}
	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}
	updatePresets(): void {
		UpdatePresets(this)
	}
	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	// ─── Polling ──────────────────────────────────────────────────────────

	private startPolling(): void {
		const interval = Math.max(250, this.config.pollInterval || 1000)
		void this.poll()
		this.pollTimer = setInterval(() => void this.poll(), interval)
	}

	private stopPolling(): void {
		if (this.pollTimer) {
			clearInterval(this.pollTimer)
			this.pollTimer = null
		}
	}

	/** One tick: read /status, and refetch the macro list only if its version
	 *  moved. That's what keeps a 1 Hz poll cheap. */
	private async poll(): Promise<void> {
		if (this.destroyed) return
		try {
			const status = await this.api.status()

			if (status.protocol !== SUPPORTED_PROTOCOL) {
				this.setReachable(false)
				this.updateStatus(
					InstanceStatus.BadConfig,
					`TalkBoard speaks protocol ${status.protocol}, this module speaks ${SUPPORTED_PROTOCOL} — update one of them`,
				)
				return
			}

			this.setReachable(true)
			this.consoleStatus = status.console.status

			this.setVariableValues({
				console_status: status.console.status,
				console_type: status.console.type,
				console_model: status.console.model,
				macro_count: String(status.macroCount),
				talkboard_version: status.version,
			})

			// TalkBoard is up but the desk isn't — a warning, not a failure.
			// The distinction is the whole point: buttons should look different.
			this.updateStatus(
				status.console.status === 'connected'
					? InstanceStatus.Ok
					: InstanceStatus.UnknownWarning,
				status.console.status === 'connected'
					? undefined
					: `TalkBoard is running but the console is ${status.console.status}`,
			)

			if (status.macrosVersion !== this.knownMacrosVersion) {
				await this.refreshMacros(status.macrosVersion)
			}

			this.checkFeedbacks('talkboard_reachable', 'console_connected')
		} catch (e: unknown) {
			this.setReachable(false)
			const msg = e instanceof TalkBoardApiError ? e.message : String(e)
			this.updateStatus(
				e instanceof TalkBoardApiError && e.status === 401
					? InstanceStatus.BadConfig
					: InstanceStatus.ConnectionFailure,
				msg,
			)
			this.checkFeedbacks('talkboard_reachable', 'console_connected')
		}
	}

	private setReachable(next: boolean): void {
		if (this.reachable === next) return
		this.reachable = next
		if (!next) {
			this.consoleStatus = 'disconnected'
			// Nothing can still be running if we can't see TalkBoard; leaving
			// buttons lit would be a lie.
			if (this.runningMacroIds.size > 0) {
				this.runningMacroIds.clear()
				this.checkFeedbacks('macro_running')
			}
		}
	}

	private async refreshMacros(version: number): Promise<void> {
		const { macros } = await this.api.macros()
		this.macros = macros
		this.knownMacrosVersion = version
		// Dropdowns and presets are generated from this list, so all three
		// definition sets have to be rebuilt together.
		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
		this.log('debug', `macro list updated — ${macros.length} macro(s), version ${version}`)
	}

	// ─── Firing ───────────────────────────────────────────────────────────

	async fireMacroById(macroId: string): Promise<void> {
		const macro = this.macros.find((m) => m.id === macroId)
		const label = macro?.name ?? macroId
		try {
			const accepted = await this.api.runMacro(macroId)
			// A collapsed repeat is already tracked; don't double-register.
			if (!accepted.deduped) {
				await this.trackRun(accepted.runId, macroId, label)
			}
		} catch (e: unknown) {
			this.reportFailure(label, e)
		}
	}

	async fireMacroByName(name: string): Promise<void> {
		try {
			const accepted = await this.api.runMacroByName(name)
			const macro = this.macros.find((m) => m.name.toLowerCase() === name.toLowerCase())
			if (!accepted.deduped) {
				await this.trackRun(accepted.runId, macro?.id, name)
			}
		} catch (e: unknown) {
			this.reportFailure(name, e)
		}
	}

	async fireStopFades(): Promise<void> {
		try {
			await this.api.stopFades()
			this.setVariableValues({ last_result: 'Stopped all fades' })
		} catch (e: unknown) {
			this.reportFailure('Stop fades', e)
		}
	}

	async fireUndo(): Promise<void> {
		try {
			await this.api.undo()
			this.setVariableValues({ last_result: 'Undo requested' })
		} catch (e: unknown) {
			this.reportFailure('Undo', e)
		}
	}

	/** Follow a run to its conclusion so the button can show what happened.
	 *  Runs are accepted before they execute, so this is the only way to know. */
	private async trackRun(runId: string, macroId: string | undefined, label: string): Promise<void> {
		if (macroId) {
			this.runningMacroIds.add(macroId)
			this.checkFeedbacks('macro_running')
		}
		this.setVariableValues({ last_macro: label, last_result: 'running…' })

		const deadline = Date.now() + RUN_POLL_TIMEOUT_MS
		try {
			while (!this.destroyed && Date.now() < deadline) {
				await new Promise((r) => setTimeout(r, RUN_POLL_INTERVAL_MS))
				const rec = await this.api.getRun(runId)
				if (rec.state === 'pending') continue
				this.setVariableValues({
					last_result: rec.summary ?? (rec.state === 'ok' ? 'done' : 'failed'),
				})
				if (rec.state === 'error') {
					this.log('warn', `"${label}" failed: ${rec.summary ?? 'no detail'}`)
				}
				return
			}
			this.setVariableValues({ last_result: 'no result (timed out)' })
		} catch (e: unknown) {
			// The run itself may well have succeeded — only our tracking of it
			// failed. Say exactly that rather than claiming the macro failed.
			this.setVariableValues({
				last_result: `result unknown: ${e instanceof Error ? e.message : String(e)}`,
			})
		} finally {
			if (macroId) {
				this.runningMacroIds.delete(macroId)
				this.checkFeedbacks('macro_running')
			}
		}
	}

	private reportFailure(label: string, e: unknown): void {
		const msg = e instanceof TalkBoardApiError ? e.message : String(e)
		this.log('error', `"${label}" could not be sent: ${msg}`)
		this.setVariableValues({ last_macro: label, last_result: `failed: ${msg}` })
	}
}
