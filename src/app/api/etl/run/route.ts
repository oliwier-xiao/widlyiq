import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const VENV_PYTHON = path.join(ROOT, '.venv', 'bin', 'python')
const TIMEOUT_MS = 5 * 60 * 1000
const state = globalThis as unknown as { widlyiqRunning?: boolean }

function pythonBinary(): string {
  return process.env.WIDLYIQ_PYTHON ?? (existsSync(VENV_PYTHON) ? VENV_PYTHON : 'python3')
}

function line(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(payload)}\n`)
}

export async function POST(request: Request) {
  // A null or non-object body must not reach a property read: that is an empty 500 with no log.
  const body: unknown = await request.json().catch(() => null)
  const requested = body !== null && typeof body === 'object' ? (body as { mode?: unknown }).mode : undefined
  const mode = requested === 'snapshot' ? 'snapshot' : 'live'

  if (state.widlyiqRunning) {
    return Response.json({ error: 'busy' }, { status: 409 })
  }
  state.widlyiqRunning = true

  const child = spawn(pythonBinary(), ['-m', 'python_etl.run_pipeline', '--mode', mode, '--events'], {
    cwd: ROOT,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  })
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM') }, TIMEOUT_MS)
  let stderrTail = ''
  let sawError = false

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // A failed spawn fires both 'error' and 'close'; the stream must close once and take no writes after that.
      let closed = false
      const send = (chunk: Uint8Array) => { if (!closed) controller.enqueue(chunk) }
      const finish = () => {
        if (closed) return
        closed = true
        clearTimeout(timer)
        state.widlyiqRunning = false
        controller.close()
      }
      child.stdout.on('data', (chunk: Buffer) => {
        if (chunk.includes('"event": "error"')) sawError = true
        send(new Uint8Array(chunk))
      })
      child.stderr.on('data', (chunk: Buffer) => {
        stderrTail = (stderrTail + chunk.toString('utf8')).slice(-1500)
      })
      child.on('error', (err) => {
        sawError = true
        send(line({ event: 'error', kind: 'spawn', message: err.message }))
        finish()
      })
      child.on('close', (code) => {
        if (timedOut) {
          send(line({ event: 'error', kind: 'timeout', message: `przerwany po ${TIMEOUT_MS / 60000} min` }))
        } else if (code !== 0 && !sawError) {
          send(line({ event: 'error', kind: 'crash', message: stderrTail.trim().split('\n').at(-1) || `kod wyjścia ${code}` }))
        }
        finish()
      })
    },
    // The run keeps going if the tab closes: the database commits atomically, so a finished run is never wasted.
    cancel() {},
  })

  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' },
  })
}
