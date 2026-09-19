#!/usr/bin/env node
/**
 * Diagnóstico read-only: quanto o desembrulho de DOMÍNIO PRÓPRIO está
 * entregando, e onde ele falha.
 *
 * Nasceu da decisão de 2026-09-13: um site (`oasisdeofertas.com.br`) devolve
 * casca vazia de 1.994 bytes porque monta tudo por JavaScript, e a pergunta
 * "vale perseguir esse tipo de site?" não podia ser respondida por palpite —
 * a resposta muda conforme quantos sites são assim e quantas clientes eles
 * afetam. Mesmo princípio do piso de miniatura, que nasceu de analogia (3000
 * bytes) e teve que cair para 800 no mesmo dia por falta de medição.
 *
 * Lê o `bot.log` (stream, nunca carrega o arquivo na memória) e agrega:
 *   - por SITE de origem: quantos links resolveram e quantos não;
 *   - por MOTIVO da falha (o site barra o servidor, página sem link no HTML,
 *     lentidão…), que é o que decide a ação — cada um pede conserto diferente;
 *   - quantas CONTAS cada site afeta (cruzando o jid do grupo com `Group`).
 *
 * Não escreve nada, não envia nada, não imprime segredo.
 *
 * Uso (no VPS, DENTRO do diretório do ambiente):
 *   cd ~/wabot && node scripts/diag-dominio-proprio.mjs
 *   cd ~/wabot && node scripts/diag-dominio-proprio.mjs --horas=24
 *   cd ~/wabot && node scripts/diag-dominio-proprio.mjs --sem-contas   # pula o banco
 */
import 'dotenv/config'
import { createReadStream, existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (nome, padrao) => {
  const hit = args.find(a => a.startsWith(`--${nome}=`))
  return hit ? hit.slice(nome.length + 3) : padrao
}
const horas = Number(opt('horas', 72)) || 72
const comContas = !args.includes('--sem-contas')
const desde = Date.now() - horas * 3600_000

const logDir = process.env.BOT_LOG_DIR || join(process.cwd(), 'logs')
const logPath = opt('log', join(logDir, 'bot.log'))
if (!existsSync(logPath)) {
  console.error(`bot.log não encontrado em ${logPath} — use --log=<caminho>`)
  process.exit(1)
}

const MSG_OK = 'Link de domínio próprio desembrulhado até a loja'
const MSG_FALHA = 'Link de domínio próprio NÃO resolveu até a loja'

const hostDe = (url) => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '(endereço ilegível)' } }

// site -> { ok, falhas, motivos: Map, lojas: Map, jids: Set }
const sites = new Map()
const pegaSite = (host) => {
  if (!sites.has(host)) sites.set(host, { ok: 0, falhas: 0, motivos: new Map(), lojas: new Map(), jids: new Set() })
  return sites.get(host)
}
const conta = (mapa, chave) => mapa.set(chave, (mapa.get(chave) || 0) + 1)

let linhas = 0
const rl = createInterface({ input: createReadStream(logPath), crlfDelay: Infinity })
for await (const linha of rl) {
  if (!linha.includes('domínio próprio')) continue
  let e
  try { e = JSON.parse(linha) } catch { continue }
  if (typeof e.time === 'number' && e.time < desde) continue
  linhas += 1

  if (e.msg === MSG_OK) {
    for (const r of e.resolvidos || []) {
      const s = pegaSite(hostDe(r.from))
      s.ok += 1
      conta(s.lojas, r.platform || '(loja desconhecida)')
      if (e.jid) s.jids.add(e.jid)
    }
  } else if (e.msg === MSG_FALHA) {
    for (const f of e.falhas || []) {
      const s = pegaSite(hostDe(f.url))
      s.falhas += 1
      conta(s.motivos, f.reason || '(sem motivo)')
      if (e.jid) s.jids.add(e.jid)
    }
  }
}

if (!sites.size) {
  console.log(`Nenhum link de domínio próprio nas últimas ${horas}h em ${logPath}.`)
  console.log('Se o robô acabou de reiniciar, é o esperado — o histórico começa do zero.')
  process.exit(0)
}

// Quantas CONTAS cada site afeta. Sem isso "3 sites falhando" pode ser uma
// cliente só ou trinta, e as duas situações pedem decisões opostas.
const contaPorJid = new Map()
if (comContas) {
  try {
    const { default: db } = await import('../src/db.js')
    const jids = [...new Set([...sites.values()].flatMap(s => [...s.jids]))]
    const grupos = await db.group.findMany({ where: { waJid: { in: jids } }, select: { waJid: true, userId: true } })
    for (const g of grupos) {
      if (!contaPorJid.has(g.waJid)) contaPorJid.set(g.waJid, new Set())
      contaPorJid.get(g.waJid).add(g.userId)
    }
  } catch (err) {
    // Erro engolido em diagnóstico vira conclusão errada (lição do
    // diag-assinatura-recusada). Diz que não mediu, em vez de mostrar zero.
    console.log(`⚠️  não consegui cruzar com as contas: ${err?.message}`)
  }
}
const contasDo = (s) => {
  if (!comContas) return null
  const u = new Set()
  for (const jid of s.jids) for (const id of contaPorJid.get(jid) || []) u.add(id)
  return u.size
}

const ordenado = [...sites.entries()].sort((a, b) => (b[1].ok + b[1].falhas) - (a[1].ok + a[1].falhas))
const totalOk = ordenado.reduce((n, [, s]) => n + s.ok, 0)
const totalFalha = ordenado.reduce((n, [, s]) => n + s.falhas, 0)

console.log(`\n===== DOMÍNIO PRÓPRIO — últimas ${horas}h (${logPath}) =====`)
console.log(`links vistos: ${totalOk + totalFalha} | resolveram: ${totalOk} | não resolveram: ${totalFalha}`)
if (totalOk + totalFalha > 0) {
  console.log(`taxa de sucesso: ${((totalOk / (totalOk + totalFalha)) * 100).toFixed(1)}%`)
}

console.log('\n--- por site de origem ---')
for (const [host, s] of ordenado) {
  const contas = contasDo(s)
  const quem = contas === null ? '' : ` | ${contas} conta(s)`
  console.log(`\n${host}  → ${s.ok} ok / ${s.falhas} falha(s)${quem}`)
  if (s.lojas.size) console.log(`   lojas: ${[...s.lojas].map(([k, v]) => `${k}=${v}`).join(', ')}`)
  if (s.motivos.size) console.log(`   motivos: ${[...s.motivos].map(([k, v]) => `${k}=${v}`).join(', ')}`)
}

console.log('\n--- por motivo de falha (é o motivo que decide a ação) ---')
const porMotivo = new Map()
for (const [host, s] of sites) {
  for (const [m, n] of s.motivos) {
    if (!porMotivo.has(m)) porMotivo.set(m, { total: 0, sites: new Set() })
    porMotivo.get(m).total += n
    porMotivo.get(m).sites.add(host)
  }
}
if (!porMotivo.size) console.log('(nenhuma falha na janela)')
for (const [m, v] of [...porMotivo].sort((a, b) => b[1].total - a[1].total)) {
  console.log(`${String(m).padEnd(32)} ${String(v.total).padStart(5)} link(s) em ${v.sites.size} site(s): ${[...v.sites].join(', ')}`)
}
console.log(`\n(linhas de log lidas: ${linhas})`)
process.exit(0)
