// Guarda anti-SSRF / open-redirect compartilhada.
//
// Motivação: endpoints que fazem o servidor buscar uma URL fornecida pelo
// usuário (ex.: /api/link-conversion/scrape-offer) ou que redirecionam para
// uma URL armazenada (ex.: GET /r/:hash) podem ser abusados para alcançar
// recursos internos da VPS (127.0.0.1, Redis, metadata de nuvem 169.254.169.254)
// ou para phishing usando o domínio oficial como fachada.
//
// Esta guarda bloqueia esquemas não-http(s) e hosts internos/privados. A
// checagem estrutural (`isSafePublicUrl`) é síncrona e determinística (boa
// para validar input cedo). A checagem com DNS (`assertPublicUrl`) é
// best-effort: se a resolução falhar (rede restrita/offline) ela NÃO bloqueia,
// já que o fetch subsequente falharia de qualquer forma — evita regressão em
// ambientes sem DNS sem abrir mão do bloqueio determinístico de IP literal.

import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'

const BLOCKED_HOSTNAMES = new Set(['localhost', 'ip6-localhost', 'ip6-loopback'])
const BLOCKED_TLD_SUFFIXES = ['.local', '.internal', '.localhost', '.localdomain']

export function isPrivateIpv4(ip) {
  const parts = String(ip).split('.').map(Number)
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false
  const [a, b] = parts
  if (a === 0) return true // "this" network
  if (a === 10) return true // RFC1918
  if (a === 127) return true // loopback
  if (a === 169 && b === 254) return true // link-local + metadata de nuvem
  if (a === 172 && b >= 16 && b <= 31) return true // RFC1918
  if (a === 192 && b === 168) return true // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT (RFC6598)
  if (a >= 224) return true // multicast / reservado
  return false
}

export function isPrivateIpv6(ip) {
  const lower = String(ip).toLowerCase().replace(/^\[|\]$/g, '')
  if (lower === '::1' || lower === '::') return true // loopback / unspecified
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true // ULA (fc00::/7)
  if (lower.startsWith('fe80')) return true // link-local
  const mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/) // IPv4-mapped
  if (mapped) return isPrivateIpv4(mapped[1])
  return false
}

export function isBlockedIp(ip) {
  const version = isIP(ip)
  if (version === 4) return isPrivateIpv4(ip)
  if (version === 6) return isPrivateIpv6(ip)
  return false
}

export function isBlockedHostname(hostname) {
  // `new URL().hostname` devolve IPv6 entre colchetes (ex.: "[::1]"); remove
  // os colchetes e o ponto final (FQDN absoluto) antes de classificar.
  const host = String(hostname ?? '').trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (!host) return true
  if (BLOCKED_HOSTNAMES.has(host)) return true
  if (BLOCKED_TLD_SUFFIXES.some(suffix => host.endsWith(suffix))) return true
  if (isIP(host) && isBlockedIp(host)) return true
  return false
}

// Checagem estrutural síncrona: exige http(s) e host não obviamente interno.
export function isSafePublicUrl(value) {
  let parsed
  try {
    parsed = new URL(String(value ?? ''))
  } catch {
    return false
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  return !isBlockedHostname(parsed.hostname)
}

// Checagem completa: estrutural + resolução DNS (best-effort).
// Lança Error com code 'SSRF_BLOCKED' quando o destino é interno/privado.
export async function assertPublicUrl(value, { resolveDns = true } = {}) {
  if (!isSafePublicUrl(value)) {
    const err = new Error('URL bloqueada por política de segurança (host interno/privado ou esquema inválido)')
    err.code = 'SSRF_BLOCKED'
    throw err
  }
  const hostname = new URL(String(value)).hostname
  if (!resolveDns || isIP(hostname)) return true

  let addresses = []
  try {
    addresses = await lookup(hostname, { all: true })
  } catch {
    return true // fail-open: sem DNS o fetch falharia mesmo; não bloqueia legítimo
  }
  for (const { address } of addresses) {
    if (isBlockedIp(address)) {
      const err = new Error('URL bloqueada por política de segurança (host resolve para IP interno)')
      err.code = 'SSRF_BLOCKED'
      throw err
    }
  }
  return true
}
