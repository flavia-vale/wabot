/**
 * Guard de consistência de ambiente do bot-supervisor.
 *
 * Por que existe (incidente real 2026-06): o `ecosystem.config.cjs` contém os
 * apps de PROD e de STAGING no mesmo arquivo, e os `script` são caminhos
 * RELATIVOS (`src/supervisor/index.js`). O PM2 resolve o script e o `.env`
 * (via dotenv) a partir do `cwd` de onde o `pm2 start` foi invocado. Se o
 * `bot-supervisor-staging` for iniciado de dentro de `~/wabot` (diretório de
 * produção) — direto ou porque um `pm2 restart` perpetuou um registro antigo —
 * ele carrega o `.env` do PROD (`REDIS_URL=.../0`) e passa a consumir a fila de
 * comandos na Redis DB ERRADA. Sintoma: processo "online e saudável", mas
 * `supervisor-commands:active=0` e `wait` só cresce; a API estoura todo comando
 * com "no finish notification arrived" porque ninguém drena a fila do `/1`.
 *
 * Este guard transforma essa falha silenciosa num fail-fast no boot.
 *
 * Convenções canônicas (AGENTS.md):
 *  - staging  → cwd termina em `-staging` e Redis DB `/1`.
 *  - produção → cwd `~/wabot` (sem `-staging`) e Redis DB `/0`.
 */

const STAGING_CWD_RE = /-staging(?:[/\\]|$)/
const REDIS_DB_RE = /\/(\d+)(?:\?|$)/

/**
 * Verifica se APP_ENV, o diretório de trabalho e (quando disponível) a Redis DB
 * são mutuamente consistentes. Função pura para ser testável — quem chama
 * decide o que fazer com `{ ok:false }` (no boot: log fatal + process.exit).
 *
 * @param {{ appEnv?: string, cwd?: string, redisUrl?: string }} input
 * @returns {{ ok: boolean, reason?: string }}
 */
export function checkSupervisorEnvConsistency({ appEnv, cwd, redisUrl } = {}) {
  const env = String(appEnv ?? 'production').toLowerCase()
  const dir = String(cwd ?? '')
  const isStagingEnv = env === 'staging'
  const cwdIsStaging = STAGING_CWD_RE.test(dir)

  if (isStagingEnv && !cwdIsStaging) {
    return {
      ok: false,
      reason:
        `APP_ENV=staging mas o cwd '${dir}' não é um diretório de staging ` +
        `(esperado terminar em '-staging'). O dotenv carregaria o .env do ` +
        `ambiente errado e o supervisor consumiria a fila na Redis DB errada. ` +
        `Corrija com: pm2 delete bot-supervisor-staging && cd ~/wabot-staging && ` +
        `pm2 start ecosystem.config.cjs --only bot-supervisor-staging.`,
    }
  }

  if (!isStagingEnv && cwdIsStaging) {
    return {
      ok: false,
      reason:
        `APP_ENV=${env} (não-staging) mas o cwd '${dir}' é um diretório de ` +
        `staging. Processo de produção iniciado no diretório errado — carregaria ` +
        `o .env de staging e falaria com a Redis DB de staging.`,
    }
  }

  // Checagem secundária pela Redis DB, apenas quando a URL traz índice de DB.
  // Pega o caso em que o cwd está certo mas o .env aponta para a DB cruzada
  // (ex.: REDIS_URL de staging editado para /0 por engano).
  const match = REDIS_DB_RE.exec(String(redisUrl ?? ''))
  if (match) {
    const dbIndex = match[1]
    if (isStagingEnv && dbIndex === '0') {
      return {
        ok: false,
        reason:
          `APP_ENV=staging mas REDIS_URL aponta para a Redis DB 0 (produção). ` +
          `Provável .env de produção carregado — o supervisor consumiria a fila ` +
          `de comandos de produção em vez da de staging.`,
      }
    }
    if (!isStagingEnv && dbIndex === '1') {
      return {
        ok: false,
        reason:
          `APP_ENV=${env} mas REDIS_URL aponta para a Redis DB 1 (staging). ` +
          `Provável .env de staging carregado num processo de produção.`,
      }
    }
  }

  return { ok: true }
}
