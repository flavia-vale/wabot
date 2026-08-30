#!/usr/bin/env node
/**
 * Diagnóstico: as ofertas estão saindo COM IMAGEM depois deste deploy?
 *
 * Feito para rodar no VPS logo após uma subida que mexe no caminho da imagem
 * (modo de imagem por destino, marca d'água, card de preview, relay).
 *
 * NÃO GRAVA NADA. Só lê o banco e a lista de processos.
 *
 * Responde, nesta ordem:
 *
 *   0) O código novo está VALENDO nos bots? Em modo `remote` o deploy reinicia
 *      a API mas NÃO os bot-workers — o arquivo novo chega ao disco e os bots
 *      seguem com o módulo antigo em memória. Sem esta checagem, tudo abaixo
 *      pode estar medindo o código velho (ver "código novo não carregado pelos
 *      bots" no AGENTS.md).
 *   1) COMO as ofertas saíram na janela: foto, card, relay ou só texto.
 *   2) ANTES x DEPOIS do deploy, com a mesma medida — é isso que separa
 *      "sempre foi assim" de "quebrou agora".
 *   3) Quais ofertas PERDERAM a imagem: saíram como texto puro mesmo tendo
 *      foto na mensagem de origem. É o caso que é defeito nosso.
 *   4) Por destino, junto do que cada um tem configurado (formato da imagem e
 *      marca d'água) — é como se vê se o problema é só de quem usa marca.
 *   5) Sinais duráveis de imagem e erros de envio na janela.
 *
 * Uso (dentro do diretório do ambiente):
 *   cd ~/wabot          && node scripts/diag-ofertas-com-imagem.mjs
 *   cd ~/wabot-staging  && node scripts/diag-ofertas-com-imagem.mjs
 *
 *   --horas=24          janela total analisada (padrão 24)
 *   --deploy=<ISO>      momento do deploy; sem isso, usa o arquivo mais novo
 *                       de src/ (é o que o `git pull` do deploy reescreve)
 *   --destinos=8        quantos destinos listar no passo 4
 *   <email|nome>        limita a uma cliente (padrão: todas)
 */

import 'dotenv/config'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'

import db from '../src/db.js'
import { DELIVERY_KIND, rotuloDeliveryKind, ofertaPerdeuImagem } from '../src/core/deliveryKind.js'
import { computeCodeChangedAtMs } from '../src/ops/codeVersion.js'

const execFileAsync = promisify(execFile)
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function arg(nome, padrao) {
  const hit = process.argv.find(a => a.startsWith(`--${nome}=`))
  return hit ? hit.slice(nome.length + 3) : padrao
}
const horas = Math.max(1, Number(arg('horas', 24)) || 24)
const maxDestinos = Math.max(1, Number(arg('destinos', 8)) || 8)
const quem = process.argv.slice(2).find(a => !a.startsWith('--'))

const titulo = t => console.log(`\n${'─'.repeat(72)}\n${t}\n${'─'.repeat(72)}`)
const pct = (parte, total) => (total > 0 ? `${((parte / total) * 100).toFixed(1)}%` : '—')
const hora = ms => new Date(ms).toLocaleString('pt-BR')
const curto = (s, n) => (String(s ?? '').length > n ? `${String(s).slice(0, n - 1)}…` : String(s ?? ''))

// A oferta "chegou bonita" em tudo que não é texto puro.
const COM_IMAGEM = new Set(Object.values(DELIVERY_KIND).filter(k => k !== DELIVERY_KIND.TEXTO))

async function resolverUsuario() {
  if (!quem) return null
  const digitos = quem.replace(/\D+/g, '')
  const achados = await db.user.findMany({
    where: {
      OR: [
        { email: quem },
        { name: { contains: quem } },
        ...(digitos.length >= 8 ? [{ contactPhone: { contains: digitos.slice(-8) } }] : []),
      ],
    },
    select: { id: true, email: true, name: true },
    take: 5,
  })
  if (achados.length === 0) {
    console.error(`Nenhuma cliente encontrada para "${quem}".`)
    process.exit(1)
  }
  if (achados.length > 1) {
    console.error(`Mais de uma cliente bate com "${quem}":`)
    for (const u of achados) console.error(`  ${u.email} — ${u.name ?? ''}`)
    process.exit(1)
  }
  return achados[0]
}

/**
 * Passo 0. Um bot-worker que NASCEU ANTES do código mudar está rodando o
 * módulo antigo — o `fork()` carrega o arquivo uma vez e não recarrega.
 * Comparar o início de cada processo com o mtime mais novo de src/ responde
 * isso sem depender do Redis nem do modo (inline/remote).
 */
async function conferirCodigoNosBots(deployMs) {
  titulo('0) O código novo está valendo nos bots?')
  let linhas = []
  try {
    const { stdout } = await execFileAsync('ps', ['-eo', 'pid,etimes,args'], { maxBuffer: 4 * 1024 * 1024 })
    linhas = stdout.split('\n').slice(1)
      .map(l => l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/))
      .filter(m => m && m[3].includes('bot-worker') && m[3].includes(RAIZ))
      .map(m => ({ pid: Number(m[1]), nasceuMs: Date.now() - Number(m[2]) * 1000 }))
  } catch (err) {
    console.log(`Não deu para ler a lista de processos (${err?.message}). Pulando.`)
    return
  }

  if (linhas.length === 0) {
    console.log(`Nenhum bot-worker rodando a partir de ${RAIZ}.`)
    console.log('Sem worker de pé, nada é espelhado — resolva isso antes de olhar o resto.')
    return
  }

  // Folga de 60s: no deploy normal o pull e o restart são quase simultâneos.
  const velhos = linhas.filter(w => w.nasceuMs < deployMs - 60_000)
  console.log(`Bots de pé: ${linhas.length}   |   nasceram antes do código mudar: ${velhos.length}`)
  console.log(`Código mudou em:  ${hora(deployMs)}`)
  console.log(`Bot mais antigo:  ${hora(Math.min(...linhas.map(w => w.nasceuMs)))}`)
  if (velhos.length > 0) {
    console.log('')
    console.log('⚠️  ATENÇÃO: esses bots ainda rodam o código ANTERIOR ao deploy.')
    console.log('   Tudo abaixo mede o comportamento VELHO deles — não conclua nada sobre')
    console.log('   a subida antes de reiniciar. Isso reconecta TODAS as sessões:')
    console.log(`     cd ${RAIZ} && pm2 restart bot-supervisor --update-env && pm2 save`)
  } else {
    console.log('✅ Todos os bots nasceram depois da mudança — estão com o código novo.')
  }
}

function contarPorKind(linhas) {
  const contagem = new Map()
  for (const l of linhas) {
    const k = l.deliveryKind ?? '(não registrado)'
    contagem.set(k, (contagem.get(k) ?? 0) + 1)
  }
  return contagem
}

function imprimirKinds(contagem, total) {
  if (total === 0) { console.log('Nenhum envio na janela.'); return }
  const ordenado = [...contagem.entries()].sort((a, b) => b[1] - a[1])
  for (const [kind, n] of ordenado) {
    const rotulo = kind === '(não registrado)' ? 'Não registrado (envio que não é oferta espelhada)' : rotuloDeliveryKind(kind)
    console.log(`  ${String(n).padStart(6)}  ${pct(n, total).padStart(7)}   ${rotulo}`)
  }
}

function resumo(linhas) {
  const registradas = linhas.filter(l => l.deliveryKind)
  const comImagem = registradas.filter(l => COM_IMAGEM.has(l.deliveryKind)).length
  return { registradas: registradas.length, comImagem }
}

async function main() {
  const usuario = await resolverUsuario()
  // Sem --deploy, o corte é o arquivo mais novo dentro de src/: o `git pull` do
  // deploy só reescreve o que mudou, então esse é o momento em que o código
  // novo chegou ao disco deste servidor.
  const deployArg = arg('deploy')
  const deployMs = deployArg ? Date.parse(deployArg) : await computeCodeChangedAtMs()
  if (!Number.isFinite(deployMs)) {
    console.error(`--deploy não é uma data válida: ${deployArg}`)
    process.exit(1)
  }
  const desde = new Date(Date.now() - horas * 60 * 60 * 1000)

  console.log(`Ambiente:  ${RAIZ}   (APP_ENV=${process.env.APP_ENV ?? '—'}, modo=${process.env.BOT_SUPERVISOR_MODE ?? 'inline'})`)
  console.log(`Janela:    últimas ${horas}h — desde ${hora(desde.getTime())}`)
  console.log(`Cliente:   ${usuario ? `${usuario.email}` : 'todas'}`)

  await conferirCodigoNosBots(deployMs)

  const where = {
    sentAt: { gte: desde },
    status: 'success',
    ...(usuario ? { userId: usuario.id } : {}),
  }
  const envios = await db.messageLog.findMany({
    where,
    select: {
      userId: true, platform: true, destGroup: true, sentAt: true,
      deliveryKind: true, originImageBytes: true, convertedUrl: true,
    },
    orderBy: { sentAt: 'desc' },
    take: 20_000,
  })

  titulo(`1) Como as ofertas saíram (${envios.length} envios com sucesso)`)
  imprimirKinds(contarPorKind(envios), envios.length)
  const geral = resumo(envios)
  if (geral.registradas > 0) {
    console.log('')
    console.log(`Ofertas espelhadas com imagem: ${geral.comImagem}/${geral.registradas}  (${pct(geral.comImagem, geral.registradas)})`)
  }

  titulo('2) Antes x depois do deploy')
  console.log(`Corte: ${hora(deployMs)}`)
  const antes = envios.filter(l => l.sentAt.getTime() < deployMs)
  const depois = envios.filter(l => l.sentAt.getTime() >= deployMs)
  for (const [rotulo, grupo] of [['ANTES', antes], ['DEPOIS', depois]]) {
    const r = resumo(grupo)
    console.log('')
    console.log(`${rotulo} — ${grupo.length} envios`)
    if (r.registradas === 0) {
      console.log('  Nenhuma oferta espelhada registrada nesta metade.')
      if (rotulo === 'DEPOIS') console.log('  (Deploy recente demais? Espere acumular envio ou aumente --horas.)')
      continue
    }
    console.log(`  com imagem: ${r.comImagem}/${r.registradas}  (${pct(r.comImagem, r.registradas)})`)
    imprimirKinds(contarPorKind(grupo.filter(l => l.deliveryKind)), r.registradas)
  }
  const rAntes = resumo(antes)
  const rDepois = resumo(depois)
  if (rAntes.registradas >= 20 && rDepois.registradas >= 20) {
    const pAntes = rAntes.comImagem / rAntes.registradas
    const pDepois = rDepois.comImagem / rDepois.registradas
    const delta = (pDepois - pAntes) * 100
    console.log('')
    if (delta <= -5) console.log(`🔴 PIOROU ${Math.abs(delta).toFixed(1)} pontos depois do deploy.`)
    else if (delta >= 5) console.log(`🟢 MELHOROU ${delta.toFixed(1)} pontos depois do deploy.`)
    else console.log(`⚪ Sem mudança relevante (${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pontos).`)
  } else {
    console.log('')
    console.log('⚪ Amostra pequena de um dos lados (< 20 ofertas) — não dá para comparar ainda.')
  }

  titulo('3) Ofertas que PERDERAM a imagem (a origem tinha foto e saiu texto puro)')
  const perdidas = envios.filter(ofertaPerdeuImagem)
  console.log(`${perdidas.length} na janela — ${perdidas.filter(l => l.sentAt.getTime() >= deployMs).length} depois do deploy.`)
  if (perdidas.length > 0) {
    console.log('')
    console.log('  quando               loja           bytes da origem  destino')
    for (const l of perdidas.slice(0, 15)) {
      console.log(`  ${hora(l.sentAt.getTime()).padEnd(20)} ${curto(l.platform, 14).padEnd(14)} ${String(l.originImageBytes).padStart(15)}  ${curto(l.destGroup, 26)}`)
    }
    if (perdidas.length > 15) console.log(`  … e mais ${perdidas.length - 15}.`)
    console.log('')
    console.log('  Esse é o caso em que a foto EXISTIA e se perdeu no caminho — defeito nosso.')
  }

  titulo(`4) Por destino (os ${maxDestinos} com mais oferta sem imagem)`)
  const porDestino = new Map()
  for (const l of envios) {
    if (!l.deliveryKind) continue
    const chave = `${l.userId}|${l.destGroup}`
    const atual = porDestino.get(chave) ?? { userId: l.userId, jid: l.destGroup, total: 0, texto: 0 }
    atual.total++
    if (l.deliveryKind === DELIVERY_KIND.TEXTO) atual.texto++
    porDestino.set(chave, atual)
  }
  const destinos = [...porDestino.values()].sort((a, b) => (b.texto - a.texto) || (b.total - a.total)).slice(0, maxDestinos)
  if (destinos.length === 0) {
    console.log('Nenhuma oferta espelhada registrada na janela.')
  } else {
    const configs = await db.group.findMany({
      where: { role: 'post', OR: destinos.map(d => ({ userId: d.userId, waJid: d.jid })) },
      select: { userId: true, waJid: true, name: true, imageMode: true, watermarkText: true },
    })
    const porChave = new Map(configs.map(c => [`${c.userId}|${c.waJid}`, c]))
    console.log('  sem img/total   formato configurado      marca d\'água   destino')
    for (const d of destinos) {
      const cfg = porChave.get(`${d.userId}|${d.jid}`)
      const marca = cfg?.watermarkText ? `"${curto(cfg.watermarkText, 12)}"` : '—'
      const nome = cfg?.name ?? d.jid
      console.log(`  ${`${d.texto}/${d.total}`.padStart(13)}   ${curto(cfg?.imageMode ?? '(destino apagado)', 22).padEnd(22)}  ${marca.padEnd(14)} ${curto(nome, 24)}`)
    }
    console.log('')
    console.log('  Se só os destinos COM marca d\'água aparecem aqui, o problema é da marca.')
    console.log('  Se aparecem todos, é do caminho da imagem em geral.')
  }

  titulo('5) Sinais de imagem e erros de envio na janela')
  const SINAIS = [
    ['ops_preview_card_no_image', 'card ficou sem foto (virou texto puro)'],
    ['ops_preview_card_origin_fallback', 'card salvo com a foto da origem'],
    ['ops_monitored_thumbnail_dropped', 'miniatura pequena demais, descartada'],
    ['ops_store_photo_over_origin', 'trocou a foto da origem pela da loja'],
    ['ops_ml_anti_bot_wall', 'Mercado Livre barrou o servidor'],
  ]
  const sinais = await db.analyticsEvent.groupBy({
    by: ['event'],
    where: { event: { in: SINAIS.map(s => s[0]) }, createdAt: { gte: desde }, ...(usuario ? { userId: usuario.id } : {}) },
    _count: { event: true },
  }).catch(err => { console.log(`  (não deu para ler os sinais: ${err?.message})`); return [] })
  const contagemSinal = new Map(sinais.map(s => [s.event, s._count.event]))
  for (const [evento, explicacao] of SINAIS) {
    console.log(`  ${String(contagemSinal.get(evento) ?? 0).padStart(6)}  ${explicacao}`)
  }

  const falhas = await db.messageLog.groupBy({
    by: ['errorMsg'],
    where: { sentAt: { gte: desde }, status: { in: ['error', 'skipped'] }, ...(usuario ? { userId: usuario.id } : {}) },
    _count: { errorMsg: true },
    orderBy: { _count: { errorMsg: 'desc' } },
    take: 8,
  }).catch(err => { console.log(`  (não deu para ler os erros de envio: ${err?.message})`); return [] })
  console.log('')
  if (falhas.length === 0) {
    console.log('  Nenhum envio com erro ou pulado na janela.')
  } else {
    console.log('  Envios que não saíram (top 8):')
    for (const f of falhas) console.log(`  ${String(f._count.errorMsg).padStart(6)}  ${curto(f.errorMsg ?? '(sem motivo)', 58)}`)
  }

  console.log('')
}

try {
  await main()
} finally {
  await db.$disconnect().catch(() => {})
}
