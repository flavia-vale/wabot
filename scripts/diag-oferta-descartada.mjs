#!/usr/bin/env node
/**
 * Diagnóstico read-only, complemento de diag-fila-parada.mjs. Responde três
 * perguntas que a tela não separa:
 *
 *  [1] Entra mais oferta do que o destino aceita? (chegada x vazão x descarte
 *      por idade, hora a hora, por destino). Fila que só cresce nao e lentidao:
 *      e teto de envio menor que a entrada.
 *  [2] "faltou cadastrar a loja" com a loja cadastrada: QUAIS links falharam —
 *      cupom ou produto — e a conversao REPETIDA AO VIVO com a credencial real
 *      da conta. Sem repetir ao vivo nao da para separar "a loja recusou" de
 *      "nao tentamos converter".
 *  [3] Quando o robo reiniciou e quantos envios em voo isso derrubou.
 *
 * Nao escreve nada. Nao imprime cookie, chave secreta nem token.
 *
 * Uso (no VPS, DENTRO do diretorio do ambiente):
 *   cd ~/wabot && node scripts/diag-oferta-descartada.mjs <email> --hours=24
 *   cd ~/wabot && node scripts/diag-oferta-descartada.mjs <email> --no-live
 */
import 'dotenv/config'

const args = process.argv.slice(2)
const who = args.find(a => !a.startsWith('--')) || null
function opt(name, fallback) {
  const hit = args.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const hours = Number(opt('hours', 24)) || 24
const live = !args.includes('--no-live')
const sinceDate = new Date(Date.now() - hours * 3600_000)

const { default: db } = await import('../src/db.js')
const { decryptCredential } = await import('../src/credentialCrypto.js')

const line = (t) => console.log(`\n===== ${t} =====`)
const fmt = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 16) + 'Z' : '-')
const hora = (d) => new Date(d).toISOString().slice(0, 13) + 'h'

line('AMBIENTE')
console.log({
  cwd: process.cwd(),
  APP_ENV: process.env.APP_ENV || null,
  COUPON_LINK_CONVERT: process.env.COUPON_LINK_CONVERT || '(ausente = DESLIGADO)',
  SHEIN_SHORTLINK_ENABLED: process.env.SHEIN_SHORTLINK_ENABLED || '(ausente = ligado)',
  janela: `${hours}h desde ${fmt(sinceDate)}`,
})

const user = await db.user.findFirst({
  where: who ? { OR: [{ email: { contains: who } }, { contactPhone: { contains: who } }, { name: { contains: who } }] } : {},
  select: { id: true, email: true, name: true },
})
if (!user) { console.log('Nenhuma conta encontrada para', who); process.exit(1) }
const userId = user.id
console.log('conta:', { email: user.email, nome: user.name })

// ---------------------------------------------------------------------- 1
line(`1. ENTRA MAIS DO QUE SAI? (por destino, ${hours}h)`)
const destinos = await db.group.findMany({
  where: { userId, role: 'post' },
  select: { waJid: true, name: true, burstCap: true, burstWindowSec: true, preservationPreset: true, preservationPresetId: true },
})
const defaultPreset = await db.preservationPreset.findFirst({ where: { userId, isDefault: true } })
for (const d of destinos) {
  const rows = await db.messageLog.findMany({
    where: { userId, destGroup: d.waJid, sentAt: { gte: sinceDate } },
    select: { status: true, errorMsg: true, sentAt: true },
  })
  const enviados = rows.filter(r => r.status === 'success').length
  const expirados = rows.filter(r => String(r.errorMsg || '').startsWith('skip:queue_expired')).length
  const perdidosPorRestart = rows.filter(r => String(r.errorMsg || '') === 'error:worker_restart').length
  const cap = d.burstCap ?? d.preservationPreset?.burstCap ?? defaultPreset?.burstCap ?? null
  const win = d.burstWindowSec ?? d.preservationPreset?.burstWindowSec ?? defaultPreset?.burstWindowSec ?? null
  const tetoHora = cap != null && win ? (cap * 3600) / win : null
  console.log(`\n-- ${d.name}`)
  console.log('   teto de envio configurado:', tetoHora != null ? `${cap} a cada ${win}s = ${tetoHora.toFixed(1)} por hora` : '(não resolvido)')
  console.log('   na janela:', {
    chegaram: rows.length,
    enviados,
    descartadosPorEsperarDemais: expirados,
    perdidosPorReinicioDoRobo: perdidosPorRestart,
    chegadaPorHora: (rows.length / hours).toFixed(1),
    saidaPorHora: (enviados / hours).toFixed(1),
  })
  if (tetoHora != null && rows.length / hours > tetoHora) {
    console.log(`   ⚠ CHEGA ${(rows.length / hours).toFixed(1)}/h E O TETO É ${tetoHora.toFixed(1)}/h — a fila só cresce; o excedente vira espera e depois descarte.`)
  }
}

// ---------------------------------------------------------------------- 2
line(`2. "FALTOU CADASTRAR A LOJA": o que de fato falhou`)
const falhas = await db.messageLog.findMany({
  where: { userId, status: 'skipped', errorMsg: 'skip:no_valid_conversions', sentAt: { gte: sinceDate } },
  select: { platform: true, originalUrl: true, messageText: true, sourceGroup: true, sentAt: true },
  orderBy: { sentAt: 'desc' },
  take: 400,
})
console.log('linhas na janela:', falhas.length)
const porPlataforma = new Map()
for (const f of falhas) porPlataforma.set(f.platform, (porPlataforma.get(f.platform) || 0) + 1)
console.log('por loja:', Object.fromEntries(porPlataforma))

// Sucesso da MESMA loja na mesma janela: se há sucesso, a credencial funciona e
// o problema é o TIPO de link, não a loja.
for (const [plat] of porPlataforma) {
  const ok = await db.messageLog.count({ where: { userId, platform: { contains: plat }, status: 'success', sentAt: { gte: sinceDate } } })
  console.log(`   ${plat}: ${ok} envio(s) com SUCESSO na mesma janela`)
  if (ok > 0) console.log(`   → a loja ${plat} está convertendo normalmente; o que falha é um TIPO de link específico.`)
}

const ehCupom = (u = '', t = '') => /cupom|voucher|promo|campaign|\/m\/|coupon/i.test(`${u} ${t}`)
const amostra = falhas.slice(0, 12)
console.log('\namostra das mensagens que falharam:')
for (const f of amostra) {
  console.log(`  ${fmt(f.sentAt)} ${f.platform} ${ehCupom(f.originalUrl, f.messageText) ? '[parece CUPOM]' : '[parece produto]'} ${String(f.originalUrl).slice(0, 110)}`)
}
const nCupom = falhas.filter(f => ehCupom(f.originalUrl, f.messageText)).length
console.log(`\nclassificação: ${nCupom} de ${falhas.length} parecem link de cupom/campanha (o resto parece produto).`)

if (live && falhas.length) {
  console.log('\nrepetindo a conversão AO VIVO com a credencial real da conta:')
  const rowsCred = await db.credential.findMany({ where: { userId } })
  const credenciais = {}
  for (const c of rowsCred) {
    try { credenciais[c.platform] = JSON.parse(decryptCredential(c.data)) } catch { /* ilegível */ }
  }
  const vistos = new Set()
  const alvos = falhas.filter(f => f.originalUrl && !vistos.has(f.originalUrl) && vistos.add(f.originalUrl)).slice(0, 6)
  for (const f of alvos) {
    const plat = String(f.platform).split('+')[0]
    try {
      const mod = await import(`../src/converters/${plat}.js`)
      if (typeof mod.convert !== 'function') { console.log(`  ${plat}: conversor sem convert()`); continue }
      const out = await mod.convert(f.originalUrl, credenciais[plat] || {})
      const link = typeof out === 'string' ? out : (out?.url ?? out?.converted ?? null)
      console.log(`  ${plat} ${String(f.originalUrl).slice(0, 80)}`)
      console.log(`     -> ${link ? `CONVERTEU: ${String(link).slice(0, 90)}` : 'DEVOLVEU VAZIO (é isto que vira "faltou cadastrar a loja")'}`)
      if (out && typeof out === 'object') console.log('     detalhes:', { linkKind: out.linkKind, warning: out.warning, passthrough: out.passthrough })
    } catch (err) {
      console.log(`  ${plat} ${String(f.originalUrl).slice(0, 80)}`)
      console.log(`     -> LANÇOU ERRO: ${err?.message}`)
    }
  }
}

// --------------------------------------------------------------------- 2b
line('2b. A LOJA ESTÁ LIGADA NO GRUPO DE ORIGEM?')
// Uma origem pode ter lista própria de lojas permitidas (allowedPlatforms).
// Loja fora da lista faz o robô NEM tentar converter — e a linha saía como
// "faltou cadastrar a loja", com o cadastro perfeito.
const porOrigem = new Map()
for (const f of falhas) porOrigem.set(f.sourceGroup, (porOrigem.get(f.sourceGroup) || 0) + 1)
const origens = await db.group.findMany({
  where: { userId, role: 'monitor' },
  select: { waJid: true, name: true, allowedPlatforms: true },
})
const botConfig = await db.botConfig.findUnique({ where: { userId }, select: { platforms: true } })
console.log('lista global de lojas da conta:', botConfig?.platforms || '(não definida)')
for (const [jid, n] of [...porOrigem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
  const g = origens.find(o => o.waJid === jid)
  const lista = (g?.allowedPlatforms || '').trim() || botConfig?.platforms || ''
  const ligadas = lista.split(',').filter(Boolean)
  console.log(`\n-- ${g?.name || jid}: ${n} falha(s)`)
  console.log('   lojas ligadas nesta origem:', ligadas.join(', ') || '(nenhuma)')
  console.log('   fonte da lista:', g?.allowedPlatforms?.trim() ? 'escolha própria deste grupo' : 'lista global da conta')
  for (const plat of porPlataforma.keys()) {
    const base = String(plat).split('+')[0]
    if (ligadas.length && !ligadas.includes(base)) {
      console.log(`   ⚠ ${base} está DESLIGADA nesta origem — o robô nem tenta converter, e a linha saía como "faltou cadastrar a loja".`)
    }
  }
}

// ---------------------------------------------------------------------- 3
line('3. REINÍCIOS DO ROBÔ (envios em vôo perdidos)')
const restarts = await db.messageLog.findMany({
  where: { userId, errorMsg: 'error:worker_restart', sentAt: { gte: sinceDate } },
  select: { sentAt: true },
  orderBy: { sentAt: 'asc' },
})
console.log('envios perdidos por reinício na janela:', restarts.length)
const porHora = new Map()
for (const r of restarts) porHora.set(hora(r.sentAt), (porHora.get(hora(r.sentAt)) || 0) + 1)
for (const [h, n] of porHora) console.log(`  ${h}  ${n} envio(s) perdido(s)`)
const eventos = await db.waConnectionEvent.findMany({
  where: { userId, occurredAt: { gte: sinceDate } },
  select: { occurredAt: true, type: true, code: true, lifecycle: true },
  orderBy: { occurredAt: 'desc' },
  take: 20,
}).catch(err => { console.log('  !! eventos de conexão FALHOU:', err?.message); return [] })
console.log('\núltimos eventos de conexão do WhatsApp:')
for (const e of eventos) console.log(`  ${fmt(e.occurredAt)}  ${e.type}  code=${e.code ?? '-'}  ${e.lifecycle ?? ''}`)

await db.$disconnect().catch(() => {})
