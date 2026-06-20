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

/**
 * Decide se o supervisor deve, de fato, assumir o ciclo de vida das sessões
 * (fork/resume/health-monitor/consumo de comandos) com base em
 * `BOT_SUPERVISOR_MODE`.
 *
 * Por que existe (incidente real, staging "caindo toda hora"): só a API
 * (via src/manager.js) respeitava `BOT_SUPERVISOR_MODE`. O supervisor subia e
 * SEMPRE fazia fork()/resume das sessões, independente do modo. Em staging o
 * modo canônico é `inline` (a própria api-staging faz fork() dos workers) E o
 * `bot-supervisor-staging` fica de pé como app PM2. Resultado: api-staging e
 * bot-supervisor-staging davam fork() do MESMO worker, compartilhando o MESMO
 * AUTH_INFO_DIR → dois sockets Baileys com a mesma credencial → o WhatsApp só
 * aceita um device por registro → conflito/stream-error → flapping eterno
 * (sessão "caindo toda hora", risco de ban).
 *
 * Acoplando o supervisor à MESMA flag que a API já respeita, a dupla posse de
 * sessão vira impossível: como api-staging e bot-supervisor-staging carregam o
 * MESMO `.env`, a flag governa as duas pontas de forma consistente. Só em
 * `remote` o supervisor é dono das sessões; em qualquer outro valor ele fica em
 * standby (vivo, mas sem tocar em nenhuma sessão).
 *
 * @param {string|undefined} mode valor cru de BOT_SUPERVISOR_MODE
 * @returns {boolean} true só quando o modo é exatamente `remote`.
 */
export function supervisorManagesSessions(mode) {
  return String(mode ?? '').trim().toLowerCase() === 'remote'
}
