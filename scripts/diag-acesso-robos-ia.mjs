#!/usr/bin/env node
/**
 * Diagnóstico: os robôs de IA conseguem LER o site? (checagem no nível do WAF,
 * não só do robots.txt)
 *
 * Por que existe (RCA 2026-09-18): o robots.txt estava limpo e a checagem
 * mensal só olhava ele — enquanto a Cloudflare devolvia 403 para GPTBot e
 * ClaudeBot (bloqueio de "AI crawlers de treino", ligado por padrão). Pedir a
 * página com o User-Agent de cada robô é a única forma de enxergar isso.
 *
 * O que ele NÃO faz: não muda nada (read-only), não usa banco, não usa segredo.
 * Roda de qualquer máquina com internet. Regra de leitura em
 * src/ops/aiBotAccess.js — o script só coleta os status e imprime.
 *
 * Uso:
 *   node scripts/diag-acesso-robos-ia.mjs                         # https://espelhagrupos.com.br/
 *   node scripts/diag-acesso-robos-ia.mjs --url=https://... --caminho=/llms.txt
 *   node scripts/diag-acesso-robos-ia.mjs --json                  # saída para máquina
 *   node scripts/diag-acesso-robos-ia.mjs --treino-reprova        # bloqueio de treino também sai com exit 1
 *
 * Códigos de saída: 0 ok (ou só treino barrado), 1 robô de busca/clique barrado,
 * 2 site fora do ar ou sem medição. Pensado para entrar na checagem mensal do
 * AGENTS.md ao lado do `curl robots.txt | grep -c "Disallow: /$"`.
 */

import { AI_BOT_PROFILES, CONTROL_PROFILE, ACCESS_VERDICTS, classifyBotAccess, describeAccessVerdict } from '../src/ops/aiBotAccess.js'

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const baseUrl = String(arg('url', 'https://espelhagrupos.com.br')).replace(/\/$/, '')
const path = String(arg('caminho', '/'))
const timeoutMs = Number(arg('timeout', 15000))
const asJson = process.argv.includes('--json')
const trainingBlocks = process.argv.includes('--treino-reprova')
const target = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`

async function probe(profile) {
  try {
    const res = await fetch(target, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': profile.userAgent, Accept: 'text/html,*/*;q=0.8' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    // Lê e descarta o corpo para não deixar socket pendurado.
    await res.arrayBuffer().catch(() => null)
    return { ...profile, status: res.status, server: res.headers.get('server') || '', cfRay: res.headers.get('cf-ray') || '' }
  } catch (err) {
    return { ...profile, status: null, error: String(err?.cause?.code || err?.name || err?.message || err).slice(0, 80) }
  }
}

const control = await probe(CONTROL_PROFILE)
const bots = []
for (const profile of AI_BOT_PROFILES) {
  // Sequencial de propósito: 19 requisições em rajada do mesmo IP podem virar
  // 429 e contaminar a leitura.
  bots.push(await probe(profile))
}

const report = classifyBotAccess({ control, bots }, { trainingBlocks })

if (asJson) {
  console.log(JSON.stringify({ target, checkedAt: new Date().toISOString(), control, bots, report }, null, 2))
} else {
  console.log(`Acesso dos robôs de IA a ${target}\n`)
  const fmt = (b) => `${String(b.status ?? 'erro').padEnd(5)} ${b.name.padEnd(20)} ${String(b.role).padEnd(8)} ${b.owner}${b.error ? `  (${b.error})` : ''}`
  console.log(fmt(control))
  for (const b of bots) console.log(fmt(b))
  console.log('')
  console.log(`Veredito: ${report.verdict}`)
  console.log(describeAccessVerdict(report.verdict))
  if (report.blockedSearch.length || report.blockedClick.length) {
    console.log(`\nBarrados (busca/clique): ${[...report.blockedSearch, ...report.blockedClick].map((b) => `${b.name}=${b.status}`).join(', ')}`)
  }
  if (report.blockedTraining.length) {
    console.log(`Barrados (treino): ${report.blockedTraining.map((b) => `${b.name}=${b.status}`).join(', ')}`)
  }
  if (report.throttled.length) console.log(`Limitados (429): ${report.throttled.map((b) => b.name).join(', ')}`)
  if (report.unmeasured.length) console.log(`Sem medição: ${report.unmeasured.map((b) => `${b.name}=${b.status ?? b.error ?? '?'}`).join(', ')}`)
  console.log('\nLeitura: a requisição sai do SEU IP com o nome do robô emprestado. 200 e 403 para nomes diferentes')
  console.log('do mesmo IP provam regra por categoria (Cloudflare > Security > Bots > AI Crawl Control / WAF).')
  console.log('Um 200 não prova que o robô REAL passa; um 403 é prova forte de bloqueio.')
}

if (report.verdict === ACCESS_VERDICTS.SEARCH_BLOCKED) process.exit(1)
if (report.verdict === ACCESS_VERDICTS.SITE_DOWN || report.verdict === ACCESS_VERDICTS.NO_DATA) process.exit(2)
process.exit(0)
