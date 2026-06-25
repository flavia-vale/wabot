// Liga/desliga os apps PM2 de staging a partir do host de produção, para
// economizar RAM enquanto staging não está em uso (staging e prod dividem o
// mesmo VPS — ver AGENTS.md "Ambientes e portas").
//
// Segurança/robustez:
//   - A ação é validada contra um allowlist ('on'/'off'); nada controlado pelo
//     usuário chega ao exec. Os argumentos do pm2 são fixos (sem shell, sem
//     interpolação de string) — usa execFile, não exec.
//   - Só roda no host de PRODUÇÃO (APP_ENV != staging): um box de staging não
//     deve controlar a si mesmo.
//   - O "on" sobe do diretório de staging (cwd) para o pm2 resolver o
//     ecosystem.config.cjs e o .env CERTOS — senão cai na pegadinha #9 do
//     AGENTS.md (supervisor/api lendo o .env do ambiente errado).

import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileP = promisify(execFile)

const PM2_BIN = process.env.PM2_BIN || 'pm2'
const STAGING_DIR = process.env.STAGING_DIR || `${process.env.HOME || '/home/deploy'}/wabot-staging`
// Apps de staging gerenciados pelo botão. Default: os dois maiores consumidores
// de RAM (Next + API). Override via env para incluir supervisor/telegram.
const STAGING_APPS = (process.env.STAGING_PM2_APPS || 'api-staging visual-staging')
  .trim()
  .split(/\s+/)
  .filter(Boolean)

const NOT_FOUND_RE = /not found|doesn't exist|process or namespace/i

export function assertStagingControlAllowed(env = process.env) {
  if (String(env.APP_ENV || '').toLowerCase() === 'staging') {
    throw new Error('Controle de staging indisponível: este é o host de staging')
  }
}

export async function getStagingStatus({ exec = execFileP } = {}) {
  let list = []
  const { stdout } = await exec(PM2_BIN, ['jlist'])
  try { list = JSON.parse(stdout) } catch { list = [] }
  const apps = STAGING_APPS.map((name) => {
    const proc = Array.isArray(list) ? list.find((p) => p?.name === name) : null
    const status = proc?.pm2_env?.status || 'stopped'
    const memBytes = proc?.monit?.memory || 0
    return {
      name,
      status,
      online: status === 'online',
      memoryMB: memBytes ? Math.round(memBytes / 1048576) : 0,
      cpu: proc?.monit?.cpu ?? 0,
    }
  })
  return {
    on: apps.some((a) => a.online),
    apps,
    totalMemoryMB: apps.reduce((sum, a) => sum + a.memoryMB, 0),
    stagingDir: STAGING_DIR,
  }
}

export async function setStagingPower(action, { exec = execFileP } = {}) {
  assertStagingControlAllowed()
  const normalized = String(action || '').toLowerCase()
  if (normalized !== 'on' && normalized !== 'off') {
    throw new Error(`Ação inválida: ${action} (use 'on' ou 'off')`)
  }

  if (normalized === 'off') {
    // Para app por app para que um app já parado/inexistente não aborte o resto.
    for (const name of STAGING_APPS) {
      await exec(PM2_BIN, ['stop', name]).catch((err) => {
        if (!NOT_FOUND_RE.test(err?.message || '')) throw err
      })
    }
  } else {
    await exec(PM2_BIN, ['start', 'ecosystem.config.cjs', '--only', STAGING_APPS.join(',')], { cwd: STAGING_DIR })
  }
  await exec(PM2_BIN, ['save']).catch(() => {})
  return getStagingStatus({ exec })
}

export const __test = { STAGING_APPS, STAGING_DIR, PM2_BIN }
