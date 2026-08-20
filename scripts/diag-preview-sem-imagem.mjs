#!/usr/bin/env node
/**
 * Diagnóstico: por que a oferta está saindo SEM FOTO (card de preview vazio).
 *
 * Toda oferta espelhada sai no modo "preview" (card clicável). O card só
 * aparece quando o robô consegue uma FOTO do produto; sem foto,
 * `buildManualLinkPreview` devolve `null` e a mensagem vai como texto puro —
 * que é exatamente o "sem imagem" que a cliente vê.
 *
 * Este script NÃO grava nada. Ele responde três perguntas, nesta ordem:
 *
 *   1) O robô está avisando? Conta as linhas novas
 *      "Card de preview sem imagem" no bot.log, por etapa e por loja.
 *   2) Desde quando? Conta o sinal durável `ops_preview_card_no_image`
 *      (AnalyticsEvent) por dia — funciona mesmo depois de o log rotacionar.
 *   3) É a loja? Repete AO VIVO, a partir deste servidor, a busca de foto dos
 *      últimos envios reais (fetchProductImage -> download -> normalize) e diz
 *      em qual etapa a foto se perde, loja por loja.
 *
 * O passo 3 é o que separa as duas causas possíveis: loja bloqueando o robô
 * (foto não vem) versus problema nosso depois de já ter a foto.
 *
 * ATENÇÃO: o passo 3 faz requisição de verdade às lojas (só leitura de página
 * pública/foto). Use --no-live para pular.
 *
 * Uso (dentro do diretório do ambiente):
 *   cd ~/wabot && node scripts/diag-preview-sem-imagem.mjs [<email|nome>] [--days=3] [--sample=8] [--no-live]
 */

import 'dotenv/config'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import db from '../src/db.js'
import { getLogsBaseDir } from '../src/paths.js'
import { fetchProductImage, fetchImageBuffer, normalizeImageForWhatsApp } from '../src/converters/imageScrapers.js'

function arg(name, fallback) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const who = process.argv.slice(2).find(a => !a.startsWith('--'))
const days = Number(arg('days', 3))
const sampleSize = Number(arg('sample', 8))
const live = !process.argv.includes('--no-live')
const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

let user = null
if (who) {
  const onlyDigits = who.replace(/\D+/g, '')
  const matches = await db.user.findMany({
    where: {
      OR: [
        { email: who },
        { name: { contains: who } },
        ...(onlyDigits.length >= 8 ? [{ contactPhone: { contains: onlyDigits.slice(-8) } }] : []),
      ],
    },
    select: { id: true, email: true, name: true },
    take: 10,
  })
  if (matches.length === 0) {
    console.error(`Nenhum cliente encontrado para: ${who}`)
    process.exit(1)
  }
  if (matches.length > 1) {
    console.error(`Mais de um cliente bate com "${who}" — rode de novo com o e-mail exato:`)
    for (const m of matches) console.error(`  ${m.email}  (${m.name})`)
    process.exit(1)
  }
  user = matches[0]
}

console.log(`\n=== Card de preview sem imagem — últimos ${days} dia(s) ===`)
console.log(user ? `Cliente: ${user.name} <${user.email}>` : 'Escopo: TODAS as contas deste ambiente')

// ---------------------------------------------------------------- 1) bot.log
const logFile = join(getLogsBaseDir(), 'bot.log')
console.log(`\n[1] Avisos no log (${logFile})`)
if (!existsSync(logFile)) {
  console.log('    bot.log não encontrado neste ambiente.')
} else {
  const lines = readFileSync(logFile, 'utf8').split('\n')
  const porEtapa = new Map()
  const porLoja = new Map()
  let total = 0
  for (const line of lines) {
    if (!line.includes('Card de preview sem imagem')) continue
    let row
    try { row = JSON.parse(line) } catch { continue }
    if (row.time && row.time < since.getTime()) continue
    total++
    porEtapa.set(row.stage || '?', (porEtapa.get(row.stage || '?') || 0) + 1)
    porLoja.set(row.platform || '?', (porLoja.get(row.platform || '?') || 0) + 1)
  }
  if (!total) {
    console.log('    Nenhum aviso na janela. Duas leituras possíveis:')
    console.log('    - o card está saindo COM foto (o "sem imagem" é outra coisa); ou')
    console.log('    - os bot-workers ainda rodam código antigo, sem esse aviso.')
    console.log('      Confira com: ps -eo pid,etime,cmd | grep bot-worker | grep -v grep')
  } else {
    console.log(`    ${total} oferta(s) saíram sem foto.`)
    console.log('    Por etapa:')
    for (const [k, v] of [...porEtapa].sort((a, b) => b[1] - a[1])) console.log(`      ${String(v).padStart(5)}  ${k}`)
    console.log('    Por loja:')
    for (const [k, v] of [...porLoja].sort((a, b) => b[1] - a[1])) console.log(`      ${String(v).padStart(5)}  ${k}`)
  }
}

// ------------------------------------------------------- 2) sinal durável
console.log('\n[2] Histórico no banco (ops_preview_card_no_image), por dia')
const eventos = await db.analyticsEvent.findMany({
  where: {
    event: 'ops_preview_card_no_image',
    createdAt: { gte: new Date(Date.now() - Math.max(days, 14) * 24 * 60 * 60 * 1000) },
    ...(user ? { userId: user.id } : {}),
  },
  select: { createdAt: true, metadata: true },
  take: 20000,
}).catch(() => [])
if (!eventos.length) {
  console.log('    Nenhum registro (sinal novo — só passa a existir depois do deploy que o criou).')
} else {
  const porDia = new Map()
  for (const e of eventos) {
    const dia = e.createdAt.toISOString().slice(0, 10)
    porDia.set(dia, (porDia.get(dia) || 0) + 1)
  }
  for (const [dia, n] of [...porDia].sort()) console.log(`    ${dia}  ${String(n).padStart(5)}`)
}

// --------------------------------------------------------- 3) teste ao vivo
console.log('\n[3] Teste ao vivo: a loja devolve foto para este servidor?')
if (!live) {
  console.log('    pulado (--no-live)')
} else {
  const rows = await db.messageLog.findMany({
    where: {
      status: 'success',
      sentAt: { gte: since },
      ...(user ? { userId: user.id } : {}),
    },
    orderBy: { sentAt: 'desc' },
    select: { platform: true, originalUrl: true, convertedUrl: true },
    take: 3000,
  })
  const porPlataforma = new Map()
  for (const r of rows) {
    const plat = String(r.platform || '').split('+')[0]
    if (!['amazon', 'shopee', 'mercadolivre'].includes(plat)) continue
    const url = r.originalUrl || r.convertedUrl
    if (!url) continue
    const lista = porPlataforma.get(plat) || []
    if (lista.length < sampleSize) lista.push(url)
    porPlataforma.set(plat, lista)
  }
  if (!porPlataforma.size) {
    console.log('    Nenhum envio de loja conhecida na janela para testar.')
  }
  for (const [plat, urls] of porPlataforma) {
    let comFoto = 0
    const falhas = new Map()
    for (const url of urls) {
      let etapa = 'ok'
      try {
        const imageUrl = await fetchProductImage(plat, url, {})
        if (!imageUrl) etapa = 'loja_nao_devolveu_foto'
        else {
          const fetched = await fetchImageBuffer(imageUrl, url)
          if (!fetched?.buffer) etapa = 'download_sem_bytes'
          else {
            const norm = await normalizeImageForWhatsApp(fetched.buffer)
            if (!norm?.jpegThumbnail) etapa = 'normalize_falhou'
          }
        }
      } catch (err) {
        etapa = `erro:${err?.message?.slice(0, 60)}`
      }
      if (etapa === 'ok') comFoto++
      else falhas.set(etapa, (falhas.get(etapa) || 0) + 1)
    }
    console.log(`    ${plat.padEnd(14)} ${comFoto}/${urls.length} com foto`)
    for (const [k, v] of [...falhas].sort((a, b) => b[1] - a[1])) console.log(`        ${String(v).padStart(3)}  ${k}`)
  }
  console.log('\n    Leitura: 0/N com foto numa loja = a loja parou de entregar a foto')
  console.log('    para este servidor (bloqueio/anti-robô ou mudança de página).')
}

await db.$disconnect()
