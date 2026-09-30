#!/usr/bin/env node
/**
 * EXPERIMENTO (staging / conta de TESTE — nunca em produção sem OK): o código
 * de acesso do Mercado Livre morre num prazo fixo quando só o robô o usa? E
 * uma chamada periódica "de navegador" (GET da página do gerador de links,
 * guardando o Set-Cookie) mantém a sessão viva?
 *
 * Desenho (uma execução = um braço do experimento):
 *   --modo=so-sondagem   a cada N min faz só o POST createLink neutro (o que o
 *                        robô já faz). Mede quando vira 401 sem nenhuma renovação.
 *   --modo=manter-viva   a cada N min faz o GET da página do gerador de links
 *                        COM o jar e mescla os Set-Cookie no jar EM MEMÓRIA,
 *                        depois a sondagem. Se sobreviver bem além do prazo do
 *                        braço 1, a renovação vem dessa rota (fix: fazer isso no
 *                        robô e persistir o patch).
 * Rode o braço 1 e o braço 2 em momentos diferentes com um código recém-colado
 * de uma conta de TESTE, sem usar o ML no navegador durante o teste (senão a
 * hipótese H2 contamina a medição).
 *
 * Custo: 1–2 requests ao ML por intervalo (padrão 5 min = 12–24/h), zero RAM
 * extra (processo avulso, termina sozinho). Nunca grava no banco: o jar
 * renovado vive só na memória do processo.
 *
 * Uso:
 *   cd ~/wabot-staging && node scripts/exp-ml-manter-viva.mjs --email=teste@x --modo=so-sondagem [--intervalo=5] [--horas=4]
 */

import 'dotenv/config'
import db from '../src/db.js'
import { parseCredentialData } from '../src/credentialHealth.js'
import { checkMercadoLivreSession } from '../src/converters/mercadolivre.js'

const ML_MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
const LINKBUILDER_URL = 'https://www.mercadolivre.com.br/afiliados/linkbuilder'

function arg(name, fallback = null) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

function parseJar(cookieHeader) {
  const jar = new Map()
  for (const part of String(cookieHeader || '').split(';')) {
    const t = part.trim(); const eq = t.indexOf('=')
    if (eq > 0) jar.set(t.slice(0, eq), t.slice(eq + 1))
  }
  return jar
}
const serialize = jar => [...jar.entries()].filter(([, v]) => v !== '').map(([k, v]) => `${k}=${v}`).join('; ')

function mergeSetCookies(jar, lines) {
  const changed = []
  for (const line of lines) {
    const first = String(line).split(';')[0]; const eq = first.indexOf('=')
    if (eq <= 0) continue
    const name = first.slice(0, eq).trim(); const value = first.slice(eq + 1).trim()
    const del = value === '' || /;\s*max-age\s*=\s*0(\D|$)/i.test(line)
    if (del) continue
    if (jar.get(name) !== value) { jar.set(name, value); changed.push(name) }
  }
  return changed
}

function credsFromJar(base, jar) {
  return { ...base, cookie: serialize(jar), ssid: jar.get('ssid') || base.ssid, csrf: jar.get('_csrf') || base.csrf, id: jar.get('id') || base.id }
}

const stamp = () => new Date().toISOString().slice(11, 19)

async function main() {
  const email = arg('email'); const modo = arg('modo', 'so-sondagem')
  const intervaloMin = Number(arg('intervalo', 5)); const horas = Number(arg('horas', 4))
  if (!email || !['so-sondagem', 'manter-viva'].includes(modo)) {
    console.error('Uso: node scripts/exp-ml-manter-viva.mjs --email=teste@x --modo=so-sondagem|manter-viva [--intervalo=5] [--horas=4]')
    process.exit(1)
  }
  if (/prod\.db/.test(String(process.env.DATABASE_URL || ''))) {
    console.error('Recusado: DATABASE_URL aponta para prod.db. Este experimento é para staging/conta de teste.')
    process.exit(4)
  }
  const user = await db.user.findUnique({ where: { email }, include: { credentials: true } })
  const row = user?.credentials.find(c => c.platform === 'mercadolivre')
  if (!row) { console.error('Sem credencial do Mercado Livre para esse e-mail'); process.exit(3) }
  const base = parseCredentialData(row.data)
  await db.$disconnect()

  const jar = parseJar(base.cookie || `id=${base.id || ''}; _csrf=${base.csrf || ''}; ssid=${base.ssid || ''}`)
  const inicio = Date.now()
  console.log(`[${stamp()}] início | modo=${modo} | intervalo=${intervaloMin} min | teto=${horas} h | cookies no jar: ${[...jar.keys()].join(', ')}`)

  let rodada = 0
  while (Date.now() - inicio < horas * 3600 * 1000) {
    rodada++
    const vivoHa = Math.round((Date.now() - inicio) / 60000)
    if (modo === 'manter-viva') {
      try {
        const res = await fetch(LINKBUILDER_URL, {
          redirect: 'manual',
          headers: { 'User-Agent': ML_MOBILE_UA, Accept: 'text/html,*/*;q=0.8', 'Accept-Language': 'pt-BR,pt;q=0.9', Cookie: serialize(jar) },
          signal: AbortSignal.timeout(15000),
        })
        const lines = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
        const changed = mergeSetCookies(jar, lines)
        const loc = res.headers.get('location') || ''
        console.log(`[${stamp()}] +${vivoHa} min GET linkbuilder: status ${res.status}${loc ? ' → redirect' + (/login/i.test(loc) ? ' LOGIN' : '') : ''} | Set-Cookie ${lines.length} | rotacionou: ${changed.join(', ') || 'nada'}`)
      } catch (err) {
        console.log(`[${stamp()}] +${vivoHa} min GET linkbuilder: erro ${err?.message}`)
      }
    }
    const probe = await checkMercadoLivreSession(credsFromJar(base, jar))
    const changedByProbe = []
    if (probe.credentialPatch?.cookie) {
      const novo = parseJar(probe.credentialPatch.cookie)
      for (const [k, v] of novo) if (jar.get(k) !== v) { jar.set(k, v); changedByProbe.push(k) }
    }
    console.log(`[${stamp()}] +${vivoHa} min sondagem #${rodada}: alive=${probe.alive} (${probe.reason}) | rotacionou: ${changedByProbe.join(', ') || 'nada'}`)
    if (probe.alive === false) {
      console.log(`[${stamp()}] MORREU após ~${vivoHa} min no modo ${modo}. Fim.`)
      process.exit(0)
    }
    await new Promise(r => setTimeout(r, intervaloMin * 60 * 1000))
  }
  console.log(`[${stamp()}] teto de ${horas} h atingido com a sessão VIVA no modo ${modo}. Fim.`)
}

main().catch(err => { console.error('FALHA:', err?.message || err); process.exit(1) })
