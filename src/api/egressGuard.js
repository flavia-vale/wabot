// Trava de saída da API: nenhuma conexão para endereço interno (auditoria
// 2026-09-23, OWASP A10).
//
// O "Criar oferta" (/api/link-conversion/scrape-offer) busca QUALQUER link que
// a cliente cola. A rota confere o link de entrada, mas os raspadores seguem
// redirecionamento sozinhos (`redirect: 'follow'`) e ainda buscam a imagem que
// a página indicar — uma página pública que redirecionasse para
// http://169.254.169.254/ ou 127.0.0.1:6379 era buscada, e o título/preço/foto
// voltavam para quem pediu. Conferir link a link espalharia a regra por dezenas
// de `fetch`; aqui ela fica num ponto só: a CONEXÃO. Todo `fetch` do processo
// da API passa pelo dispatcher global, que recusa endereço interno depois da
// resolução de DNS (o que também fecha a troca de DNS entre conferir e buscar)
// e em IP escrito direto no link.
//
// Só é instalada no boot da API (src/api/server.js). Os robôs têm processo
// próprio e não são afetados. Escape hatch: EGRESS_GUARD=off.
import dns from 'node:dns'
import { isIP } from 'node:net'
import { Agent, buildConnector, setGlobalDispatcher } from 'undici'
import { isBlockedIp } from '../core/ssrfGuard.js'

function blockedError(target) {
  const err = new Error(`Conexão de saída para endereço interno bloqueada (${target})`)
  err.code = 'SSRF_BLOCKED'
  return err
}

export function createSafeLookup(lookup = dns.lookup) {
  return function safeLookup(hostname, options, callback) {
    const opts = typeof options === 'function' ? {} : (options ?? {})
    const cb = typeof options === 'function' ? options : callback
    lookup(hostname, { ...opts, all: true }, (err, addresses) => {
      if (err) return cb(err)
      const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: isIP(addresses) }]
      if (!list.length) return cb(Object.assign(new Error(`Sem endereço para ${hostname}`), { code: 'ENOTFOUND' }))
      const blocked = list.find(entry => isBlockedIp(entry.address))
      if (blocked) return cb(blockedError(`${hostname} -> ${blocked.address}`))
      if (opts.all) return cb(null, list)
      return cb(null, list[0].address, list[0].family)
    })
  }
}

export function createGuardedConnector({ lookup = dns.lookup, connector } = {}) {
  const base = connector ?? buildConnector({ lookup: createSafeLookup(lookup) })
  return function guardedConnect(options, callback) {
    // IP escrito direto no link não passa pelo DNS: confere aqui.
    const host = String(options?.hostname ?? '').replace(/^\[|\]$/g, '')
    if (isIP(host) && isBlockedIp(host)) return callback(blockedError(host), null)
    return base(options, callback)
  }
}

export function isEgressGuardEnabled(env = process.env) {
  return String(env.EGRESS_GUARD ?? '').trim().toLowerCase() !== 'off'
}

export function installEgressGuard({ env = process.env, log } = {}) {
  if (!isEgressGuardEnabled(env)) {
    log?.warn?.('EGRESS_GUARD=off — conexões de saída para endereço interno NÃO estão bloqueadas')
    return false
  }
  setGlobalDispatcher(new Agent({ connect: createGuardedConnector() }))
  return true
}
