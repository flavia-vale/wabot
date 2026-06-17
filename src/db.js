import { PrismaClient } from '@prisma/client'
import { recordOperationalSignal } from './observability/operationalSignals.js'

const prisma = new PrismaClient()

// Instrumenta SQLITE_BUSY ("database is locked") de forma central: é o gatilho
// nº 1 de escala da auditoria (WABOT-010). O WAL + busy_timeout reduzem a
// ocorrência, mas quando ela acontece queremos CONTAR (não só logar), para o
// gatilho de cutover Postgres ser objetivo. Apenas observa e re-lança — não
// altera o comportamento de erro de nenhuma query.
prisma.$use(async (params, next) => {
  try {
    return await next(params)
  } catch (err) {
    const message = String(err?.message ?? '')
    if (/SQLITE_BUSY|database is locked/i.test(message)) {
      recordOperationalSignal('sqlite_busy', { model: params?.model ?? 'raw', action: params?.action ?? 'unknown' })
    }
    throw err
  }
})

/**
 * PRAGMAs aplicados em todo boot. SQLite + Prisma defaultam para rollback
 * journal (não-WAL) e busy_timeout=0 — o que em concorrência razoável já
 * causa SQLITE_BUSY ("database is locked"). Aplicar WAL + busy_timeout
 * resolve isso para até dezenas de writers concorrentes, sem custo real.
 *
 * Notas:
 *  - journal_mode=WAL é persistente no arquivo do DB; setar em todo boot
 *    é idempotente. Cria os arquivos auxiliares <db>-wal e <db>-shm.
 *  - busy_timeout é PER-CONNECTION. Como Prisma SQLite usa pool de 1
 *    conexão por default, basta setar uma vez no boot.
 *  - synchronous=NORMAL é o companion recomendado de WAL (fsync menos
 *    frequente; ainda crash-safe contra falha de processo, perde só em
 *    falha de energia/SO).
 *  - foreign_keys=ON já é default do Prisma em SQLite — não duplico.
 *
 * Falhas são logadas mas não bloqueiam boot — a API tolera DB indisponível
 * no startup (modo degradado), então PRAGMA também não deve bloquear.
 */
async function applySqlitePragmas(client) {
  if (process.env.DB_SKIP_PRAGMAS === '1') return
  const pragmas = [
    'PRAGMA journal_mode = WAL',
    'PRAGMA busy_timeout = 5000',
    'PRAGMA synchronous = NORMAL',
    'PRAGMA temp_store = MEMORY',
  ]
  for (const stmt of pragmas) {
    try {
      // $queryRawUnsafe devolve resultado (útil para confirmar que
      // journal_mode virou 'wal'); $executeRawUnsafe não retorna nada.
      await client.$queryRawUnsafe(stmt)
    } catch (err) {
      // Não derrubo o processo — DBs não-SQLite (ou indisponíveis) caem aqui.
      // Loga via console pra não criar ciclo de import com logger.js.
      console.warn(`[db] PRAGMA falhou: ${stmt} -> ${err.message}`)
    }
  }
}

// Promise exposta para que importadores possam aguardar se precisarem
// garantir que os PRAGMAs já foram aplicados antes de uma query crítica.
// Em boot normal, os PRAGMAs terminam em ~1-5ms e a primeira query da
// rota já vê o ambiente configurado.
export const ready = applySqlitePragmas(prisma)

export default prisma
