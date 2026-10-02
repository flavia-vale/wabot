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
import { fileURLToPath } from 'url'
import fs from 'fs'

const execFileP = promisify(execFile)

const PM2_BIN = process.env.PM2_BIN || 'pm2'
const STAGING_DIR = process.env.STAGING_DIR || `${process.env.HOME || '/home/deploy'}/wabot-staging`
// Apps de staging gerenciados pelo botão. Default: os dois maiores consumidores
// de RAM (Next + API). Override via env para incluir supervisor/telegram.
const STAGING_APPS = (process.env.STAGING_PM2_APPS || 'api-staging visual-staging')
  .trim()
  .split(/\s+/)
  .filter(Boolean)

// P2-1 do plano anti-queda: depois de scripts/migrar-pm2-staging.sh o
// staging tem pm2 PRÓPRIO, apontado por este arquivo. Sem ele, o daemon é o
// mesmo da produção (padrão de hoje).
const STAGING_PM2_HOME_FILE = process.env.WABOT_STAGING_PM2_HOME_FILE || `${process.env.HOME || '/home/deploy'}/.wabot-staging-pm2-home`

export function resolveStagingPm2Env({ readFile = (f) => fs.readFileSync(f, 'utf8'), env = process.env } = {}) {
  let home = ''
  try { home = String(readFile(STAGING_PM2_HOME_FILE)).split('\n')[0].trim() } catch { home = '' }
  return home ? { ...env, PM2_HOME: home } : null
}

const SAFE_SAVE_SCRIPT = fileURLToPath(new URL('../../scripts/pm2-save-seguro.mjs', import.meta.url))

const NOT_FOUND_RE = /not found|doesn't exist|process or namespace/i

export function assertStagingControlAllowed(env = process.env) {
  if (String(env.APP_ENV || '').toLowerCase() === 'staging') {
    throw new Error('Controle de staging indisponível: este é o host de staging')
  }
}

export async function getStagingStatus({ exec = execFileP, pm2Env = resolveStagingPm2Env() } = {}) {
  let list = []
  const { stdout } = await exec(PM2_BIN, ['jlist'], pm2Env ? { env: pm2Env } : undefined)
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

export async function setStagingPower(action, { exec = execFileP, pm2Env = resolveStagingPm2Env() } = {}) {
  const envOpt = pm2Env ? { env: pm2Env } : {}
  assertStagingControlAllowed()
  const normalized = String(action || '').toLowerCase()
  if (normalized !== 'on' && normalized !== 'off') {
    throw new Error(`Ação inválida: ${action} (use 'on' ou 'off')`)
  }

  if (normalized === 'off') {
    // Para app por app para que um app já parado/inexistente não aborte o resto.
    for (const name of STAGING_APPS) {
      await exec(PM2_BIN, ['stop', name], pm2Env ? envOpt : undefined).catch((err) => {
        if (!NOT_FOUND_RE.test(err?.message || '')) throw err
      })
    }
  } else {
    await exec(PM2_BIN, ['start', 'ecosystem.config.cjs', '--only', STAGING_APPS.join(',')], { cwd: STAGING_DIR, ...envOpt })
  }
  // `pm2 save` PROTEGIDO (RCA 2026-10-01): este daemon é o mesmo da produção;
  // um save cru com produção fora do ar apagaria bot-supervisor/dashboard do
  // dump. Recusa do guarda não derruba o botão (o estado do staging já mudou).
  await exec(process.execPath, [SAFE_SAVE_SCRIPT], pm2Env ? envOpt : undefined).catch(() => {})
  return getStagingStatus({ exec, pm2Env })
}

export const __test = { STAGING_APPS, STAGING_DIR, PM2_BIN, SAFE_SAVE_SCRIPT }
