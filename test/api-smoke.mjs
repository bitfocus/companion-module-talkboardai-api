// Drives the built TalkBoardApi against a stub that speaks the exact wire
// format the Rust side is asserted to emit (see the
// `serves_over_a_real_socket_with_the_keys_the_module_parses` test).
//
// Run: node test/api-smoke.mjs

import { createServer } from 'node:http'
import assert from 'node:assert/strict'
import { TalkBoardApi, TalkBoardApiError } from '../dist/api.js'

const TOKEN = 'smoke-token'
let sawOriginHeader = false
const seen = []

const server = createServer((req, res) => {
	seen.push(`${req.method} ${req.url}`)
	if (req.headers.origin) sawOriginHeader = true

	const send = (code, obj) => {
		res.writeHead(code, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify(obj))
	}

	if (req.headers.authorization !== `Bearer ${TOKEN}`) {
		return send(401, { error: 'missing or invalid bearer token' })
	}

	switch (`${req.method} ${req.url}`) {
		case 'GET /api/v1/status':
			return send(200, {
				app: 'talkboard',
				protocol: 1,
				version: '1.0.5',
				tier: 'pro',
				console: { type: 'x32', model: 'X32', status: 'connected' },
				macroCount: 2,
				macrosVersion: 7,
			})
		case 'GET /api/v1/macros':
			return send(200, {
				version: 7,
				macros: [
					{ id: 'm1', name: 'Walk In', consoleType: 'x32', hasFade: true, stageCount: 2 },
					{
						id: 'm2',
						name: 'Hall B Changeover',
						consoleType: 'ql5',
						hasFade: false,
						stageCount: 0,
						targets: 'Hall B',
					},
				],
			})
		case 'POST /api/v1/macros/m1/run':
			return send(202, { runId: 'run-1' })
		case 'POST /api/v1/macros/ghost/run':
			return send(404, { error: 'unknown macro id', id: 'ghost' })
		case 'POST /api/v1/macros/run': {
			let body = ''
			req.on('data', (c) => (body += c))
			req.on('end', () => {
				const { name } = JSON.parse(body || '{}')
				if (String(name).toLowerCase().trim() === 'walk in') return send(202, { runId: 'run-2' })
				return send(404, { error: 'unknown macro name', name })
			})
			return
		}
		case 'GET /api/v1/runs/run-1':
			return send(200, { runId: 'run-1', state: 'ok', summary: 'Ran 6 commands.', createdAt: 1 })
		case 'POST /api/v1/fades/stop':
			return send(202, { runId: 'run-3' })
		case 'POST /api/v1/undo':
			return send(202, { runId: 'run-4' })
		default:
			return send(404, { error: 'no such endpoint' })
	}
})

await new Promise((r) => server.listen(0, '127.0.0.1', r))
const { port } = server.address()
const base = `http://127.0.0.1:${port}`

let failures = 0
const check = async (label, fn) => {
	try {
		await fn()
		console.log(`  ✓ ${label}`)
	} catch (e) {
		failures++
		console.log(`  ✗ ${label}\n      ${e.message}`)
	}
}

const api = new TalkBoardApi(
	() => base,
	() => TOKEN,
)

console.log('TalkBoardApi smoke tests')

await check('status parses every field the module reads', async () => {
	const s = await api.status()
	assert.equal(s.app, 'talkboard')
	assert.equal(s.protocol, 1)
	assert.equal(s.macrosVersion, 7)
	assert.equal(s.console.status, 'connected')
	assert.equal(s.macroCount, 2)
})

await check('macros parse, including the optional targets label', async () => {
	const { version, macros } = await api.macros()
	assert.equal(version, 7)
	assert.equal(macros.length, 2)
	assert.equal(macros[0].stageCount, 2)
	assert.equal(macros[1].targets, 'Hall B')
	assert.equal(macros[0].targets, undefined)
})

await check('run by id returns a runId', async () => {
	assert.equal((await api.runMacro('m1')).runId, 'run-1')
})

await check('run by name matches case-insensitively', async () => {
	assert.equal((await api.runMacroByName('  WALK IN ')).runId, 'run-2')
})

await check('a 404 surfaces the server error text', async () => {
	await assert.rejects(
		() => api.runMacro('ghost'),
		(e) => e instanceof TalkBoardApiError && e.status === 404 && /unknown macro id/.test(e.message),
	)
})

await check('run result reads back', async () => {
	const r = await api.getRun('run-1')
	assert.equal(r.state, 'ok')
	assert.equal(r.summary, 'Ran 6 commands.')
})

await check('stop fades and undo both accepted', async () => {
	assert.ok((await api.stopFades()).runId)
	assert.ok((await api.undo()).runId)
})

await check('a bad token is reported as a config problem, not a network one', async () => {
	const bad = new TalkBoardApi(
		() => base,
		() => 'wrong',
	)
	await assert.rejects(
		() => bad.status(),
		(e) => e instanceof TalkBoardApiError && e.status === 401 && /Token rejected/.test(e.message),
	)
})

await check('an unreachable host fails as a connection error, not a crash', async () => {
	// Port 1 on loopback: nothing listens, connection refused immediately.
	const dead = new TalkBoardApi(
		() => 'http://127.0.0.1:1',
		() => TOKEN,
	)
	await assert.rejects(
		() => dead.status(),
		(e) => e instanceof TalkBoardApiError && e.status === undefined,
	)
})

await check('missing configuration is caught before any request', async () => {
	const unset = new TalkBoardApi(
		() => null,
		() => TOKEN,
	)
	await assert.rejects(() => unset.status(), /No TalkBoard address configured/)

	const noToken = new TalkBoardApi(
		() => base,
		() => '',
	)
	await assert.rejects(() => noToken.status(), /No token configured/)
})

await check('the client never sends an Origin header (TalkBoard rejects those)', async () => {
	assert.equal(sawOriginHeader, false)
})

server.close()
console.log(failures === 0 ? `\nAll passed (${seen.length} requests)` : `\n${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
