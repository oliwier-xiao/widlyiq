import { createReadStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

const EXPORT_DIR = path.join(process.cwd(), 'data', 'exports')
const FORMATS = {
  csv: 'text/csv; charset=utf-8',
  json: 'application/json; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const

export function GET(request: Request) {
  const format = new URL(request.url).searchParams.get('format') ?? 'csv'
  if (!(format in FORMATS)) {
    return Response.json({ error: `Nieznany format "${format}". Dostępne: csv, json, xlsx.` }, { status: 400 })
  }
  const file = path.join(EXPORT_DIR, `feature_matrix.${format}`)
  if (!existsSync(file)) {
    return Response.json({ error: 'Brak eksportu. Uruchom pipeline, żeby go wygenerować.' }, { status: 404 })
  }
  const stamp = statSync(file).mtime.toISOString().slice(0, 10)
  // The pipeline pre-renders every format, so this route only streams bytes and never blocks on Python.
  const body = Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>
  return new Response(body, {
    headers: {
      'content-type': FORMATS[format as keyof typeof FORMATS],
      'content-disposition': `attachment; filename="widlyiq_feature_matrix_${stamp}.${format}"`,
      'content-length': String(statSync(file).size),
      'cache-control': 'no-store',
    },
  })
}
