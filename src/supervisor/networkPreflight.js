/**
 * Pré-checagem de REDE para um servidor secundário (MN-08). PURA: recebe o que
 * foi medido/lido e devolve veredictos em linguagem leiga.
 *
 * Quando um segundo servidor entra, o Redis e o banco deixam de ser "locais":
 * passam a aceitar conexão de outra máquina. Aberto errado, qualquer pessoa na
 * internet alcança os dados das clientes e os logins do WhatsApp. Aqui se
 * confere, do lado do servidor secundário, se o que ele vai usar é seguro e
 * rápido o bastante.
 */

import { isPrivateAddress } from '../api/metrics.js'

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export const LATENCY_WARN_MS = 2
export const LATENCY_FAIL_MS = 5
export const SKEW_WARN_MS = 250
export const SKEW_FAIL_MS = 1000

function parseUrl(raw) {
  try { return new URL(String(raw)) } catch { return null }
}

/** p50/p99 de uma lista de tempos (ms). Lista vazia → null (não medido). */
export function percentiles(samples) {
  const xs = (samples ?? []).map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  if (!xs.length) return null
  const at = p => xs[Math.min(xs.length - 1, Math.ceil((p / 100) * xs.length) - 1)]
  return { p50: at(50), p99: at(99), n: xs.length }
}

/**
 * @param {Object} m
 * @param {boolean} m.secondNode           este servidor NÃO é o principal?
 * @param {string}  [m.redisUrl]
 * @param {string}  [m.databaseUrl]
 * @param {number[]} [m.latenciesMs]       tempos de PING ao Redis
 * @param {number|null} [m.clockSkewMs]    hora local − hora do Redis
 */
export function evaluateNetwork(m) {
  const out = []
  const add = (level, code, message) => out.push({ level, code, message })

  const redis = parseUrl(m.redisUrl)
  if (!redis) {
    add('fail', 'redis_url_missing', 'O endereço do Redis (REDIS_URL) está ausente ou inválido neste servidor.')
  } else {
    const loop = LOOPBACK.has(redis.hostname)
    if (loop && m.secondNode) {
      add('fail', 'redis_loopback', 'Este servidor aponta para um Redis local. O segundo servidor precisa usar o MESMO Redis do principal — com um Redis por servidor, comandos e proteção contra mensagem duplicada deixam de valer entre eles.')
    } else if (!loop) {
      if (!redis.password) add('fail', 'redis_no_password', 'O Redis fora deste servidor está sem senha. Sem senha, quem alcançar a porta controla as filas e os robôs.')
      if (!isPrivateAddress(redis.hostname) && redis.protocol !== 'rediss:') {
        add('warn', 'redis_not_private', 'O endereço do Redis não parece ser de rede privada e não usa TLS (rediss://). Dados trafegariam sem proteção — use rede privada (VPN) ou TLS.')
      }
    }
  }

  const db = parseUrl(m.databaseUrl)
  if (m.databaseUrl !== undefined) {
    if (!db) {
      add('fail', 'database_url_missing', 'O endereço do banco (DATABASE_URL) está ausente ou inválido.')
    } else if (db.protocol === 'file:' && m.secondNode) {
      add('fail', 'database_sqlite_local', 'O banco deste servidor é um arquivo local (SQLite). O segundo servidor não enxergaria as mesmas contas — é preciso migrar para um banco que os dois acessem.')
    } else if (db.protocol.startsWith('postgres')) {
      if (LOOPBACK.has(db.hostname) && m.secondNode) {
        add('fail', 'database_loopback', 'O banco aponta para este próprio servidor. O segundo servidor precisa usar o mesmo banco do principal.')
      } else if (!LOOPBACK.has(db.hostname) && !isPrivateAddress(db.hostname)) {
        const ssl = db.searchParams.get('sslmode')
        if (!['require', 'verify-ca', 'verify-full'].includes(String(ssl))) {
          add('fail', 'database_no_tls', 'O banco está fora da rede privada e sem conexão cifrada (sslmode=require). Dados das clientes trafegariam sem proteção.')
        }
      }
    }
  }

  const lat = percentiles(m.latenciesMs)
  if (!lat) {
    add('warn', 'latency_unknown', 'Não consegui medir a velocidade até o Redis.')
  } else if (lat.p99 > LATENCY_FAIL_MS) {
    add('fail', 'latency_high', `O Redis responde devagar daqui (p99 ${lat.p99.toFixed(1)} ms; limite ${LATENCY_FAIL_MS} ms). Cada envio dos robôs depende dele — servidores longe um do outro deixam as ofertas lentas.`)
  } else if (lat.p99 > LATENCY_WARN_MS) {
    add('warn', 'latency_borderline', `O Redis está um pouco lento daqui (p99 ${lat.p99.toFixed(1)} ms). Acompanhe.`)
  } else {
    add('ok', 'latency_ok', `Velocidade até o Redis boa (p99 ${lat.p99.toFixed(1)} ms).`)
  }

  const skew = m.clockSkewMs
  if (skew === null || skew === undefined || !Number.isFinite(Number(skew))) {
    add('warn', 'skew_unknown', 'Não consegui comparar o relógio deste servidor com o do Redis.')
  } else if (Math.abs(skew) > SKEW_FAIL_MS) {
    add('fail', 'skew_high', `O relógio deste servidor difere ${Math.round(Math.abs(skew))} ms do relógio do Redis. Ajuste o horário automático (NTP) antes de seguir — relógios diferentes fazem pedidos serem tratados como velhos.`)
  } else if (Math.abs(skew) > SKEW_WARN_MS) {
    add('warn', 'skew_borderline', `Relógio com ${Math.round(Math.abs(skew))} ms de diferença do Redis. Confira o NTP.`)
  } else {
    add('ok', 'skew_ok', 'Relógio em dia com o Redis.')
  }

  const fails = out.filter(i => i.level === 'fail').length
  return { ok: fails === 0, fails, items: out }
}

/**
 * Linhas de `ss -ltn` que expõem a porta em TODAS as interfaces. Entrada: texto
 * da saída; devolve as portas expostas dentre as pedidas.
 */
export function findExposedPorts(ssOutput, ports = [6379, 5432]) {
  const exposed = new Set()
  for (const line of String(ssOutput ?? '').split('\n')) {
    const m = line.match(/\s(0\.0\.0\.0|\*|\[::\]|::):(\d+)\s/)
    if (m && ports.includes(Number(m[2]))) exposed.add(Number(m[2]))
  }
  return [...exposed].sort((a, b) => a - b)
}
