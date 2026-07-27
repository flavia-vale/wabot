#!/usr/bin/env node
// Submete as URLs indexáveis do site para o IndexNow (Bing, Yandex, DuckDuckGo,
// Naver — e, indiretamente, IAs que puxam o índice do Bing como ChatGPT/Copilot).
//
// O Google NÃO usa IndexNow: para o Google o caminho é sitemap + rastreamento
// natural (ver docs/deploy/seo-search-console-submission.md). Este script cobre
// os motores que aceitam IndexNow.
//
// Uso:
//   node scripts/indexnow-submit.mjs            # submete todas as rotas indexáveis
//   node scripts/indexnow-submit.mjs --dry-run  # só imprime o payload, não envia
//   INDEXNOW_KEY=<chave> node scripts/indexnow-submit.mjs   # sobrescreve a chave
//
// Requisitos:
//   - A chave precisa estar acessível publicamente em https://<host>/<key>.txt
//     (arquivo commitado em dashboard/public/<key>.txt). Sem isso o IndexNow
//     rejeita o envio (403 key not found).
//
// Custo (política de memória do repo): processo one-off, sob demanda. NÃO é um
// serviço long-running, NÃO abre PM2/worker/Redis nem cache em memória. Faz um
// único POST HTTP e sai. `fetch` é nativo (Node >= 18), sem dependência nova.

import { getIndexableSeoRoutes } from '../lib/seo-registry.mjs'
import { getSiteUrl } from '../lib/site-url.js'

// Chave default (também presente em dashboard/public/<KEY>.txt). Sobrescrevível
// por env INDEXNOW_KEY para rotação sem redeploy do código.
const DEFAULT_INDEXNOW_KEY = 'fa4326c71e4b5b768c893e56db7e045d'
const ENDPOINT = 'https://api.indexnow.org/indexnow'

const dryRun = process.argv.includes('--dry-run')
const key = (process.env.INDEXNOW_KEY || DEFAULT_INDEXNOW_KEY).trim()

const siteUrl = getSiteUrl()
const host = new URL(siteUrl).host
const keyLocation = `${siteUrl}/${key}.txt`

const urlList = getIndexableSeoRoutes()
  .map((route) => `${siteUrl}${route.path === '/' ? '' : route.path}`)
  // dedup defensivo (o registry não deveria ter paths repetidos, mas garante)
  .filter((url, index, all) => all.indexOf(url) === index)

const payload = { host, key, keyLocation, urlList }

function summarize() {
  console.log(`IndexNow → ${ENDPOINT}`)
  console.log(`  host:        ${host}`)
  console.log(`  keyLocation: ${keyLocation}`)
  console.log(`  urls:        ${urlList.length}`)
}

async function main() {
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) {
    console.error(`ERRO: INDEXNOW_KEY inválida ("${key}"). Use 8–128 chars [a-zA-Z0-9-].`)
    process.exit(1)
  }
  if (urlList.length === 0) {
    console.error('ERRO: nenhuma rota indexável encontrada — nada a submeter.')
    process.exit(1)
  }

  summarize()

  if (dryRun) {
    console.log('\n--dry-run: payload abaixo, nada enviado.\n')
    console.log(JSON.stringify(payload, null, 2))
    return
  }

  let res
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error(`ERRO de rede ao submeter ao IndexNow: ${err.message}`)
    process.exit(1)
  }

  // IndexNow: 200 (aceito) e 202 (aceito, em processamento) são sucesso.
  // 400 chave malformada; 403 chave não encontrada em keyLocation;
  // 422 host/URL não bate com a chave; 429 rate limit.
  const body = await res.text().catch(() => '')
  if (res.status === 200 || res.status === 202) {
    console.log(`\nOK: ${urlList.length} URLs submetidas (HTTP ${res.status}).`)
    return
  }

  console.error(`\nFALHA: HTTP ${res.status}${body ? ` — ${body.slice(0, 300)}` : ''}`)
  if (res.status === 403) {
    console.error(`Dica: confirme que ${keyLocation} está acessível e contém exatamente "${key}".`)
  }
  process.exit(1)
}

main()
