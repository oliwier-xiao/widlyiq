import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { ANCHORS, type Anchor } from '@/shared/lib/stages'

const ROOT = process.cwd()
const SOURCES = [
  'python_etl/ingestors.py', 'python_etl/cleaning.py', 'python_etl/features.py', 'python_etl/model.py',
  'python_etl/database.py', 'python_etl/run_pipeline.py', 'src/shared/db/sqlite.ts', 'src/shared/db/run.ts',
]
const MAX_LINES = 70

function blockAround(lines: string[], hit: number): [number, number] {
  const indent = (s: string) => s.length - s.trimStart().length
  const opensBlock = (s: string | undefined) => s !== undefined && /^\s*(def |class |export function |function )/.test(s)
  // An anchor written above a function belongs to that function; one written inside belongs to its enclosing def.
  let head = hit + 1
  if (!opensBlock(lines[head])) {
    head = hit
    while (head > 0 && !opensBlock(lines[head])) head -= 1
  }
  const start = Math.min(head, hit)
  const base = indent(lines[head])
  let end = head + 1
  while (end < lines.length) {
    const l = lines[end]
    if (l.trim() && indent(l) <= base && !/^\s*[)}\]]/.test(l)) break
    end += 1
  }
  if (lines[end]?.trim() === '}' || /^\s*[)}\]]/.test(lines[end - 1] ?? '')) end = Math.min(end + 1, lines.length)
  return [start, Math.min(end, start + MAX_LINES)]
}

export async function GET(request: Request) {
  const anchor = new URL(request.url).searchParams.get('anchor') as Anchor | null
  if (!anchor || !ANCHORS.includes(anchor)) {
    return Response.json({ error: 'Nieznana kotwica.' }, { status: 400 })
  }
  // Fixed file list: the anchor picks a snippet, it never names a path.
  for (const rel of SOURCES) {
    const text = await readFile(path.join(ROOT, rel), 'utf8').catch(() => null)
    if (!text) continue
    const lines = text.split('\n')
    const hit = lines.findIndex((l) => l.includes(`# [${anchor}]`) || l.includes(`// [${anchor}]`))
    if (hit < 0) continue
    const [start, end] = blockAround(lines, hit)
    return Response.json({
      anchor,
      file: rel,
      anchorLine: hit + 1,
      startLine: start + 1,
      lines: lines.slice(start, end),
      totalLines: lines.length,
    })
  }
  return Response.json({ error: `Kotwica [${anchor}] nie występuje w kodzie.` }, { status: 404 })
}
