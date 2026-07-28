#!/usr/bin/env node
/**
 * Diagnóstico: "tem SSID cadastrado mas a oferta sai com link longo".
 *
 * Responde, com DADO e não com suposição, em qual dos caminhos a conversão do
 * Mercado Livre está caindo. Os caminhos possíveis (src/converters/mercadolivre.js,
 * função `convert`) são:
 *
 *   1. credencial sem `ssid`/`cookie` de fato guardado  -> nem tenta a API
 *   2. link sem MLB (cupom/vitrine)                     -> pula a API de propósito
 *   3. cooldown ativo de 403/429                        -> pula a API por 15/5min
 *   4. API respondeu 401 (código venceu)                -> fallback + ml_ssid_expired
 *   5. API respondeu 403 / 429 / erro 111               -> fallback + warning próprio
 *   6. short link gerado mas apontou p/ outro produto   -> descartado, fallback SEM warning
 *   7. tudo certo                                       -> link curto /sec/
 *
 * Uso (no VPS, a partir do diretório do ambiente):
 *
 *   cd ~/wabot && node scripts/diag-ml-shortlink.mjs --email=alguem@dominio.com
 *   cd ~/wabot && node scripts/diag-ml-shortlink.mjs --email=... --convert=<url de produto ML>
 *
 * Sem `--convert` o script é read-only e NÃO fala com o Mercado Livre.
 * Com `--convert`, faz UMA conversão real (mesma chamada que o robô faz) e
 * persiste a rotação de cookie que o ML devolver — exatamente como o painel e o
 * worker fazem. Sem essa persistência a rotação seria descartada e a sessão
 * morreria mais cedo (mesma pegadinha documentada no probe da Amazon).
 *
 * NUNCA imprime valor de credencial: só presença, tamanho e 4 primeiros
 * caracteres do identificador, o suficiente para comparar com o painel.
 */

import 'dotenv/config'
import db from '../src/db.js'
import { parseCredentialData, validateCredentialData } from '../src/credentialHealth.js'
import { isEncryptionConfigured } from '../src/credentialCrypto.js'
import { persistCredentialPatch } from '../src/credentialPatch.js'
import { checkMercadoLivreSession, convert as convertMl } from '../src/converters/mercadolivre.js'
import { checkAmazonSession } from '../src/converters/amazon.js'

function arg(name) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}

function describeSecret(value) {
  const s = String(value ?? '')
  if (!s.trim()) return 'AUSENTE'
  return `presente (${s.length} caracteres, começa com "${s.slice(0, 4)}…")`
}

function linkKindOf(url) {
  const s = String(url || '')
  if (/mercadolivre\.com\/sec\//i.test(s) || /meli\.la/i.test(s)) return 'CURTO (afiliado)'
  if (/partner_id=/i.test(s)) return 'LONGO (partner_id)'
  if (/amzn\.to/i.test(s)) return 'CURTO (amzn.to)'
  if (/[?&]tag=/i.test(s)) return 'LONGO (?tag=)'
  return 'outro'
}

async function main() {
  const email = arg('email')
  if (!email) {
    console.error('Uso: node scripts/diag-ml-shortlink.mjs --email=alguem@dominio.com [--convert=<url ML>]')
    process.exit(1)
  }

  console.log('='.repeat(72))
  console.log(`AMBIENTE: APP_ENV=${process.env.APP_ENV || '(vazio)'}  NODE_ENV=${process.env.NODE_ENV || '(vazio)'}`)
  console.log(`DATABASE_URL=${process.env.DATABASE_URL || '(vazio)'}`)
  console.log(`CREDENTIAL_ENCRYPTION_KEY configurada: ${isEncryptionConfigured() ? 'SIM' : 'NÃO (credencial cifrada ficaria ilegível!)'}`)
  console.log('='.repeat(72))

  const user = await db.user.findUnique({
    where: { email },
    include: { credentials: true },
  })
  if (!user) {
    console.error(`Usuário não encontrado: ${email}`)
    process.exit(2)
  }
  console.log(`\nUSUÁRIO: ${user.email}  (id=${user.id})`)

  // ---- 1. O que está REALMENTE guardado --------------------------------
  for (const platform of ['mercadolivre', 'amazon']) {
    const row = user.credentials.find(c => c.platform === platform)
    console.log(`\n--- CREDENCIAL ${platform.toUpperCase()} ---`)
    if (!row) {
      console.log('nenhuma linha cadastrada')
      continue
    }
    const cifrada = typeof row.data === 'string' && row.data.startsWith('v1:')
    const data = parseCredentialData(row.data)
    const camposLidos = Object.keys(data)
    console.log(`guardada cifrada: ${cifrada ? 'sim' : 'não (texto puro/legado)'}`)
    console.log(`decifrou e virou JSON: ${camposLidos.length ? 'sim' : 'NÃO — nenhum campo legível!'}`)
    console.log(`campos presentes: ${camposLidos.join(', ') || '(nenhum)'}`)
    console.log(`etiqueta (tag): ${data.tag ? `"${data.tag}"` : 'AUSENTE'}`)
    if (platform === 'mercadolivre') {
      console.log(`ssid: ${describeSecret(data.ssid)}`)
      console.log(`cookie (jar): ${describeSecret(data.cookie)}`)
      console.log(`csrf: ${data.csrf ? 'presente' : 'ausente'} | id: ${data.id ? 'presente' : 'ausente'}`)
      console.log(`vitrineUrl: ${data.vitrineUrl || '(não cadastrada)'}`)
    } else {
      console.log(`cookie completo: ${describeSecret(data.cookie)}`)
      for (const k of ['ubid-acbbr', 'at-acbbr', 'x-acbbr']) console.log(`${k}: ${describeSecret(data[k])}`)
    }
    console.log(`modo sem código de acesso (cookielessMode): ${data.cookielessMode === true ? 'LIGADO' : 'desligado'}`)
    const v = validateCredentialData(platform, data)
    console.log(`validação: status=${v.status} configured=${v.configured} faltando=[${v.missing.join(', ')}]`)
  }

  // ---- 2. A sessão está viva AGORA? ------------------------------------
  const mlRow = user.credentials.find(c => c.platform === 'mercadolivre')
  const mlData = mlRow ? parseCredentialData(mlRow.data) : null
  if (mlData?.ssid || mlData?.cookie) {
    console.log('\n--- SONDAGEM AO VIVO (Mercado Livre) ---')
    const probe = await checkMercadoLivreSession(mlData)
    const { credentialPatch, ...publico } = probe
    console.log(JSON.stringify(publico))
    console.log(publico.alive === true
      ? '=> o código de acesso do ML está VÁLIDO agora'
      : publico.alive === false
        ? '=> o código de acesso do ML VENCEU (é essa a causa do link longo)'
        : `=> indeterminado (${publico.reason}) — não prova que venceu`)
    if (credentialPatch) {
      await persistCredentialPatch({ userId: user.id, platform: 'mercadolivre', patch: credentialPatch })
      console.log('(rotação de cookie devolvida pelo ML foi persistida)')
    }
  }

  const amazonRow = user.credentials.find(c => c.platform === 'amazon')
  const amazonData = amazonRow ? parseCredentialData(amazonRow.data) : null
  if (amazonData?.cookie || amazonData?.['at-acbbr']) {
    console.log('\n--- SONDAGEM AO VIVO (Amazon) ---')
    const probe = await checkAmazonSession(amazonData)
    const { credentialPatch, ...publico } = probe
    console.log(JSON.stringify(publico))
    if (credentialPatch) {
      await persistCredentialPatch({ userId: user.id, platform: 'amazon', patch: credentialPatch })
      console.log('(rotação de cookie devolvida pela Amazon foi persistida)')
    }
  }

  // ---- 3. Histórico: quantas ofertas saíram curtas vs longas ------------
  console.log('\n--- ÚLTIMOS 7 DIAS (MessageLog do Mercado Livre) ---')
  const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const logs = await db.messageLog.findMany({
    // destGroup='warning' são linhas de aviso, não envios — ficam de fora da
    // contagem curto/longo (senão inflam a coluna "outro").
    where: { userId: user.id, platform: 'mercadolivre', sentAt: { gte: desde }, destGroup: { not: 'warning' } },
    select: { convertedUrl: true, status: true, errorMsg: true, sentAt: true },
    orderBy: { sentAt: 'desc' },
    take: 2000,
  })
  const porDia = new Map()
  for (const l of logs) {
    const dia = l.sentAt.toISOString().slice(0, 10)
    const atual = porDia.get(dia) || { curto: 0, longo: 0, outro: 0 }
    const tipo = linkKindOf(l.convertedUrl)
    if (tipo.startsWith('CURTO')) atual.curto++
    else if (tipo.startsWith('LONGO')) atual.longo++
    else atual.outro++
    porDia.set(dia, atual)
  }
  if (!porDia.size) console.log('(nenhuma oferta do ML nos últimos 7 dias)')
  for (const [dia, c] of [...porDia.entries()].sort()) {
    console.log(`${dia}: curto=${c.curto}  longo=${c.longo}  outro=${c.outro}`)
  }

  const avisos = await db.messageLog.groupBy({
    by: ['errorMsg'],
    where: { userId: user.id, destGroup: 'warning', sentAt: { gte: desde } },
    _count: { errorMsg: true },
  }).catch(() => [])
  console.log('\n--- AVISOS REGISTRADOS (7 dias) ---')
  if (!avisos.length) console.log('(nenhum aviso)')
  for (const a of avisos) console.log(`${a.errorMsg}: ${a._count.errorMsg}x`)

  // ---- 4. Conversão real, ponta a ponta ---------------------------------
  const urlParaConverter = arg('convert')
  if (urlParaConverter) {
    console.log('\n--- CONVERSÃO AO VIVO (mesma chamada que o robô faz) ---')
    console.log(`entrada: ${urlParaConverter}`)
    const creds = { ...mlData, userId: user.id }
    Object.defineProperty(creds, '__onCredentialPatch', {
      enumerable: false,
      value: async (platform, patch) => persistCredentialPatch({ userId: user.id, platform, patch }),
    })
    try {
      const resultado = await convertMl(urlParaConverter, creds)
      console.log(`saída: ${resultado?.url ?? '(null — nada seria enviado)'}`)
      console.log(`tipo do link: ${linkKindOf(resultado?.url)}`)
      console.log(`linkKind: ${resultado?.linkKind ?? '-'} | aviso: ${resultado?.warning ?? 'nenhum'}`)
    } catch (err) {
      console.log(`erro classificado: ${err?.mlFailureType || '-'} | ${err?.message}`)
    }
  } else {
    console.log('\n(rode de novo com --convert=<url de produto ML> para ver a conversão real ponta a ponta)')
  }

  await db.$disconnect()
}

main().catch(async (err) => {
  console.error('FALHA NO DIAGNÓSTICO:', err)
  await db.$disconnect().catch(() => {})
  process.exit(1)
})
