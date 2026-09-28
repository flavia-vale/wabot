import fs from 'node:fs'
import path from 'node:path'
import { resolvePublicCounter } from '../../src/domain/publicStats/publicCounters.js'

// Lê o arquivo gerado por `scripts/gerar-contadores-publicos.mjs` (1x por dia).
// Sem arquivo, arquivo velho ou número pequeno: devolve null e a home não
// mostra nada. Nunca inventa um valor de reserva.
export function getPublicCounter({ now = new Date(), file } = {}) {
  const target = file
    || process.env.PUBLIC_COUNTERS_FILE
    || path.join(process.cwd(), 'data', 'contadores-publicos.json')
  try {
    const snapshot = JSON.parse(fs.readFileSync(target, 'utf8'))
    return resolvePublicCounter(snapshot, { now })
  } catch {
    return null
  }
}
