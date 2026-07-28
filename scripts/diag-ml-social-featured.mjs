#!/usr/bin/env node
/**
 * Diagnóstico: a URL de produto que montamos a partir de uma vitrine
 * `/social/<handle>?ref=...` está correta, ou estamos FABRICANDO um endereço
 * que pode não existir (404)?
 *
 * Contexto (src/converters/mercadolivre.js, `extractFeaturedSocialProduct`):
 *   - se o card destacado traz `product_id` -> usamos /p/<id>  (catálogo, seguro)
 *   - senão, pegamos o campo `id` e FABRICAMOS produto.mercadolivre.com.br/<id>-x-_JM
 *     ("-x-" é um slug inventado por nós; o endereço real do ML tem o nome do
 *     produto no meio)
 *
 * Este script busca o MESMO HTML que o robô busca e mostra o que existe de fato
 * dentro do card destacado — inclusive se o ML já entrega a URL pronta
 * (`permalink`), que seria melhor do que fabricar.
 *
 * Não usa credencial, não grava nada, não imprime dado pessoal.
 *
 * Uso:
 *   cd ~/wabot && node scripts/diag-ml-social-featured.mjs --url='https://meli.la/22w3xKB'
 */

import axios from 'axios'
import { extractFeaturedSocialProduct } from '../src/converters/mercadolivre.js'

const ML_BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

function arg(name) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}

async function resolveShort(url) {
  // Segue redirects manualmente para mostrar onde o meli.la realmente cai.
  let atual = url
  for (let i = 0; i < 6; i++) {
    const res = await axios.get(atual, {
      maxRedirects: 0,
      validateStatus: () => true,
      timeout: 10000,
      headers: { 'User-Agent': ML_BROWSER_UA, 'Accept-Language': 'pt-BR,pt;q=0.9' },
    })
    const proximo = res.headers?.location
    if (!proximo) return { url: atual, status: res.status, html: typeof res.data === 'string' ? res.data : '' }
    atual = new URL(proximo, atual).toString()
    console.log(`   redirect ${res.status} -> ${atual.slice(0, 120)}${atual.length > 120 ? '…' : ''}`)
  }
  return { url: atual, status: 0, html: '' }
}

async function main() {
  const entrada = arg('url')
  if (!entrada) {
    console.error("Uso: node scripts/diag-ml-social-featured.mjs --url='https://meli.la/XXXX'")
    process.exit(1)
  }

  console.log(`ENTRADA: ${entrada}`)
  const { url: destino, status, html } = await resolveShort(entrada)
  console.log(`\nDESTINO FINAL: ${destino}`)
  console.log(`status: ${status} | tamanho do HTML: ${html.length} bytes`)

  const muro = /suspicious-traffic|account-verification/i.test(html)
  console.log(`caiu no muro anti-robô do ML? ${muro ? 'SIM (resultado não vale)' : 'não'}`)
  console.log(`tem card destacado ("card-featured")? ${/card-featured/i.test(html) ? 'sim' : 'NÃO'}`)

  const primeiroPolycard = html.match(/"polycards"\s*:\s*\[\s*\{[\s\S]*?"metadata"\s*:\s*\{([\s\S]*?)\}/i)?.[1]
  if (!primeiroPolycard) {
    console.log('\nNão achei o bloco do card destacado no HTML.')
  } else {
    console.log('\n--- CAMPOS DO CARD DESTACADO ---')
    const chaves = [...primeiroPolycard.matchAll(/"([a-z_]+)"\s*:/gi)].map(m => m[1])
    console.log(`campos disponíveis: ${[...new Set(chaves)].join(', ')}`)
    for (const campo of ['product_id', 'id', 'permalink', 'url', 'item_id']) {
      const valor = primeiroPolycard.match(new RegExp(`"${campo}"\\s*:\\s*"([^"]+)"`, 'i'))?.[1]
      console.log(`${campo}: ${valor ?? '(não existe)'}`)
    }
  }

  const montada = extractFeaturedSocialProduct(html)
  console.log(`\n--- O QUE O ROBÔ USA HOJE ---`)
  console.log(`URL montada: ${montada ?? '(nenhuma — trataria como vitrine/cupom)'}`)
  if (montada && /-x-_JM/.test(montada)) {
    console.log('=> ATENÇÃO: esse endereço foi FABRICADO por nós (slug "-x-"), não veio do ML.')
    console.log('   Se o campo `permalink` existir acima, ele é o endereço verdadeiro e deveria ser usado.')
  }

  // Confere se o endereço montado responde (a partir DESTE servidor).
  if (montada) {
    const res = await axios.get(montada, {
      maxRedirects: 5,
      validateStatus: () => true,
      timeout: 12000,
      headers: { 'User-Agent': ML_BROWSER_UA, 'Accept-Language': 'pt-BR,pt;q=0.9' },
    }).catch(err => ({ status: `erro: ${err.message}`, data: '' }))
    const corpo = typeof res.data === 'string' ? res.data : ''
    const muro2 = /suspicious-traffic|account-verification/i.test(corpo)
    const naoExiste = /Parece que esta página não existe|Esta página não está disponível/i.test(corpo)
    console.log(`\nabrindo a URL montada: status=${res.status}${muro2 ? ' (muro anti-robô — inconclusivo)' : ''}`)
    if (!muro2) console.log(`página diz "não existe"? ${naoExiste ? 'SIM (404 confirmado)' : 'não'}`)
  }
}

main().catch(err => { console.error('FALHA:', err.message); process.exit(1) })
