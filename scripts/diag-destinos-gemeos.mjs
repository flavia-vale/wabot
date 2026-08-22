#!/usr/bin/env node
/**
 * Diagnóstico: "a oferta chega num grupo de destino e NÃO chega no outro,
 * sendo que os dois espelham o mesmo grupo de origem".
 *
 * Esse sintoma já apareceu antes (RCA 2026-08-21) e tem VÁRIAS causas
 * possíveis que se parecem na tela. Este script não chuta: ele separa as
 * causas pela pergunta que realmente decide —
 *
 *     EXISTE uma linha de envio para o destino que ficou sem a oferta?
 *
 *   - NÃO existe linha  -> o robô nem tentou. É configuração:
 *                          o destino não está na lista de destinos daquele
 *                          grupo monitorado, ou o plano bloqueia canal, ou o
 *                          grupo não está ativo.
 *   - linha 'skipped'   -> o robô decidiu não enviar. O motivo está no
 *                          errorMsg (repetição, palavra bloqueada, política,
 *                          esperou demais na fila...).
 *   - linha 'queued'/'sending' -> está preso na FILA por causa da preservação
 *                          daquele destino (horário, cadência, teto diário).
 *   - linha 'error'     -> tentou e falhou de verdade.
 *   - linha 'success'   -> entregamos ao WhatsApp e mesmo assim não apareceu
 *                          no grupo. É o caso do RCA 2026-08-21 (o caminho de
 *                          repasse era aceito pelo Baileys e a mensagem se
 *                          perdia depois, na entrega). Aqui o script mostra o
 *                          formato de imagem e o botão de canal dos dois
 *                          destinos, que é o que diferenciava os gêmeos.
 *
 * Read-only: não grava nada, não envia nada, não imprime segredo.
 *
 * Uso (dentro do diretório do ambiente):
 *   cd ~/wabot && node scripts/diag-destinos-gemeos.mjs <email> [--hours=24]
 *   cd ~/wabot && node scripts/diag-destinos-gemeos.mjs <email> --hours=48 \
 *       --a="NOVO Grupo de ofertas" --b="Grupo de ofertas"
 *
 * Sem --a/--b ele compara TODOS os pares de destino do mesmo grupo monitorado.
 */

import 'dotenv/config'
import db from '../src/db.js'

function arg(name, fallback) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const who = process.argv.slice(2).find(a => !a.startsWith('--'))
const hours = Number(arg('hours', 24))
const nomeA = arg('a', null)
const nomeB = arg('b', null)
const desde = new Date(Date.now() - hours * 60 * 60 * 1000)

if (!who) {
  console.log('Informe o email (ou nome) da conta. Ex.: node scripts/diag-destinos-gemeos.mjs flavia.vale@usp.br')
  process.exit(1)
}

const user = await db.user.findFirst({
  where: { OR: [{ email: who }, { name: { contains: who } }] },
  select: { id: true, email: true, name: true },
})
if (!user) {
  console.log(`Conta não encontrada: ${who}`)
  await db.$disconnect()
  process.exit(1)
}

console.log(`\n=== Conta: ${user.name} <${user.email}> — últimas ${hours}h ===\n`)

const grupos = await db.group.findMany({
  where: { userId: user.id },
  select: {
    id: true, waJid: true, name: true, role: true, kind: true,
    imageMode: true, channelButtonJid: true, channelButtonName: true,
    operatingHoursEnabled: true, throttleEnabled: true,
    preservationPresetId: true,
  },
})
const porJid = new Map(grupos.map(g => [g.waJid, g]))
const destinos = grupos.filter(g => g.role !== 'monitor')
const monitores = grupos.filter(g => g.role === 'monitor')

// ── 1) A lista de destinos de cada monitorado (a causa nº1 de destino NOVO
//       que nunca recebe nada: ele simplesmente não está na lista).
const vinculos = await db.groupTarget.findMany({
  where: { userId: user.id },
  select: { monitorId: true, postId: true },
})
const destinosPorMonitor = new Map()
for (const v of vinculos) {
  if (!destinosPorMonitor.has(v.monitorId)) destinosPorMonitor.set(v.monitorId, new Set())
  destinosPorMonitor.get(v.monitorId).add(v.postId)
}

console.log('── Destinos de cada grupo monitorado ──')
console.log('(sem nenhum vínculo = envia para TODOS os destinos)\n')
for (const m of monitores) {
  const escolhidos = destinosPorMonitor.get(m.id)
  console.log(`  Monitorado: ${m.name}  [${m.waJid}]`)
  if (!escolhidos || escolhidos.size === 0) {
    console.log('    -> sem filtro: envia para TODOS os destinos')
  } else {
    for (const d of destinos) {
      const marca = escolhidos.has(d.id) ? '✓ recebe' : '✗ NÃO recebe'
      console.log(`    ${marca}  ${d.name}`)
    }
  }
  console.log('')
}

// ── 2) Config dos destinos (o que diferenciava os gêmeos no RCA 2026-08-21).
console.log('── Configuração de cada destino ──\n')
for (const d of destinos) {
  console.log(`  ${d.name}  [${d.waJid}]`)
  console.log(`    tipo: ${d.kind} | formato de imagem gravado: ${d.imageMode || '(nenhum)'} | botão "Ver canal": ${d.channelButtonJid ? 'SIM' : 'não'}`)
  console.log(`    preservação: preset=${d.preservationPresetId || '(nenhum)'} horário=${d.operatingHoursEnabled ?? 'herda'} cadência=${d.throttleEnabled ?? 'herda'}`)
}
console.log('')

// ── 3) O que realmente aconteceu com cada oferta, destino a destino.
const linhas = await db.messageLog.findMany({
  where: { userId: user.id, sentAt: { gte: desde }, destGroup: { not: 'conversion' } },
  select: {
    id: true, sentAt: true, sourceGroup: true, destGroup: true,
    originalUrl: true, convertedUrl: true, status: true, errorMsg: true, dedupHits: true,
  },
  orderBy: { sentAt: 'asc' },
  take: 100000,
})

// Agrupa por (grupo de origem + oferta). A oferta é identificada pelo link
// convertido quando existe, senão pelo link original — é o mesmo critério que
// a dedup usa, então casa as linhas gêmeas corretamente.
const ofertas = new Map()
for (const l of linhas) {
  const chave = `${l.sourceGroup}|${l.convertedUrl || l.originalUrl || l.id}`
  if (!ofertas.has(chave)) ofertas.set(chave, { sourceGroup: l.sourceGroup, url: l.convertedUrl || l.originalUrl, porDestino: new Map() })
  ofertas.get(chave).porDestino.set(l.destGroup, l)
}

// ── 3b) PERDAS POR DESTINO.
//
// Correção de um falso negativo do próprio script (achado em produção
// 2026-08-22): quando a dedup bloqueia um envio, o robô NÃO cria linha nova —
// ele soma no contador `dedupHits` da linha antiga (`registerDedupBlock`,
// bot-worker.js). Ou seja, uma oferta bloqueada por repetição fica invisível na
// comparação linha-a-linha acima, que pode então dizer "nenhuma diferença"
// enquanto centenas de ofertas estão sendo descartadas.
//
// Aqui a conta é por DESTINO e olha as perdas de frente. Um destino que
// "recebe as mesmas ofertas" que o gêmeo pode, ainda assim, estar perdendo
// muita coisa — só que os dois perdem igual.
console.log('── Perdas por destino (o que NÃO chegou, e por quê) ──\n')
const perdas = new Map()
for (const l of linhas) {
  const acc = perdas.get(l.destGroup) || { enviadas: 0, repeticoesBloqueadas: 0, presas: 0, porMotivo: new Map() }
  if (l.status === 'success') acc.enviadas += 1
  // dedupHits conta as repetições bloqueadas AGREGADAS nesta linha — inclusive
  // em linhas de sucesso (a oferta saiu uma vez e foi barrada N vezes depois).
  acc.repeticoesBloqueadas += Number(l.dedupHits || 0)
  if (['queued', 'sending'].includes(l.status)) acc.presas += 1
  if (l.status === 'skipped' || l.status === 'error') {
    const motivo = String(l.errorMsg || 'sem motivo').split(':').slice(0, 2).join(':')
    acc.porMotivo.set(motivo, (acc.porMotivo.get(motivo) || 0) + 1)
  }
  perdas.set(l.destGroup, acc)
}
for (const [jid, acc] of perdas) {
  const nome = porJid.get(jid)?.name || jid
  console.log(`  ${nome}`)
  console.log(`    entregues ao WhatsApp: ${acc.enviadas} | repetições bloqueadas: ${acc.repeticoesBloqueadas} | presas na fila agora: ${acc.presas}`)
  for (const [motivo, n] of [...acc.porMotivo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    console.log(`      ${String(n).padStart(5)}x  ${motivo}`)
  }
}
console.log('')

// ── 3c) Rastrear UMA oferta específica (--url=<trecho>), quando a cliente
//       aponta um caso concreto. Casa por trecho do link, em qualquer destino.
const urlFiltro = arg('url', null)
if (urlFiltro) {
  console.log(`── Rastreando ofertas cujo link contém "${urlFiltro}" ──\n`)
  const achadas = linhas.filter(l => `${l.originalUrl || ''} ${l.convertedUrl || ''}`.includes(urlFiltro))
  if (!achadas.length) {
    console.log('  Nenhuma linha de envio com esse link na janela.')
    console.log('  Isso é informação: a oferta não chegou a virar envio para NENHUM destino')
    console.log('  (conversão falhou, palavra bloqueada, ou a mensagem nem foi processada).')
  }
  for (const l of achadas) {
    const nome = porJid.get(l.destGroup)?.name || l.destGroup
    console.log(`  ${l.sentAt.toISOString().slice(5, 16).replace('T', ' ')}  ${nome.padEnd(32)} ${l.status}${l.errorMsg ? ` | ${l.errorMsg}` : ''}${l.dedupHits ? ` | +${l.dedupHits} bloqueadas` : ''}`)
  }
  console.log('')
}

const paresPedidos = (nomeA && nomeB)
  ? [[destinos.find(d => d.name === nomeA), destinos.find(d => d.name === nomeB)]]
  : []
if (nomeA && nomeB) {
  const [a, b] = paresPedidos[0]
  if (!a || !b) {
    console.log(`Não achei um dos destinos pelo nome exato. Nomes cadastrados:`)
    for (const d of destinos) console.log(`  - ${d.name}`)
    await db.$disconnect()
    process.exit(1)
  }
}
const pares = paresPedidos.length
  ? paresPedidos
  : destinos.flatMap((a, i) => destinos.slice(i + 1).map(b => [a, b]))

for (const [a, b] of pares) {
  console.log(`\n=== "${a.name}"  vs  "${b.name}" ===\n`)
  const diffs = []
  for (const oferta of ofertas.values()) {
    const la = oferta.porDestino.get(a.waJid)
    const lb = oferta.porDestino.get(b.waJid)
    if (!la && !lb) continue
    const okA = la?.status === 'success'
    const okB = lb?.status === 'success'
    if (okA === okB) continue
    diffs.push({ oferta, la, lb })
  }

  if (!diffs.length) {
    console.log('  Nenhuma diferença: nas últimas horas os dois receberam as mesmas ofertas.')
    continue
  }

  const motivos = new Map()
  for (const { oferta, la, lb } of diffs) {
    const faltou = la?.status === 'success' ? b : a
    const linhaFaltante = la?.status === 'success' ? lb : la
    let motivo
    if (!linhaFaltante) motivo = 'NAO_TENTOU (nenhuma linha de envio)'
    else if (linhaFaltante.status === 'success') motivo = 'ambos success'
    else if (['queued', 'sending'].includes(linhaFaltante.status)) motivo = `PRESO_NA_FILA (${linhaFaltante.status})`
    else motivo = `${linhaFaltante.status}: ${linhaFaltante.errorMsg || '(sem motivo gravado)'}`
    const chave = `${faltou.name} -> ${motivo}`
    motivos.set(chave, (motivos.get(chave) || 0) + 1)
  }

  console.log(`  ${diffs.length} oferta(s) chegaram num e não no outro. Motivos:\n`)
  for (const [motivo, n] of [...motivos.entries()].sort((x, y) => y[1] - x[1])) {
    console.log(`    ${String(n).padStart(4)}x  ${motivo}`)
  }

  console.log('\n  Amostra (até 10):\n')
  for (const { oferta, la, lb } of diffs.slice(0, 10)) {
    const hora = (la || lb).sentAt.toISOString().slice(5, 16).replace('T', ' ')
    console.log(`    ${hora}  ${String(oferta.url || '').slice(0, 60)}`)
    for (const [rot, linha] of [[a.name, la], [b.name, lb]]) {
      if (!linha) { console.log(`        ${rot.padEnd(28)} -> NENHUMA LINHA (o robô nem tentou)`); continue }
      console.log(`        ${rot.padEnd(28)} -> ${linha.status}${linha.errorMsg ? ` | ${linha.errorMsg}` : ''}${linha.dedupHits ? ` | +${linha.dedupHits} repetições bloqueadas` : ''}`)
    }
  }
}

console.log('\n── Como ler ──')
console.log('  ATENÇÃO: "nenhuma diferença" na comparação acima NÃO significa que está tudo bem.')
console.log('  Repetição bloqueada não cria linha nova (soma em dedupHits), então dois destinos')
console.log('  podem estar perdendo MUITA oferta e ainda assim parecerem iguais. Leia "Perdas por destino".')
console.log('  NENHUMA LINHA        -> configuração: destino fora da lista do monitorado, plano, ou grupo inativo.')
console.log('  PRESO_NA_FILA        -> preservação daquele destino (horário/cadência/teto). Não é perda, é espera.')
console.log('  skip:...             -> decisão do robô; o texto depois de "skip:" diz qual.')
console.log('  error:... / timeout: -> tentou e falhou.')
console.log('  ambos success        -> entregamos ao WhatsApp nos dois e mesmo assim sumiu num deles:')
console.log('                          é o caso do RCA 2026-08-21 — comparar acima o "botão Ver canal" e o')
console.log('                          "formato de imagem" dos dois destinos, que era o que diferenciava.')

await db.$disconnect()
