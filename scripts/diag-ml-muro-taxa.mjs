#!/usr/bin/env node
/**
 * Diagnóstico: o muro anti-robô do Mercado Livre é PERMANENTE, por FREQUÊNCIA
 * ou por REPUTAÇÃO do IP?
 *
 * Por que a pergunta existe: em 2026-08 mediu-se que a página de produto do ML
 * responde 200 com ~39KB e SEM `og:image` (muro `suspicious-traffic`) para o IP
 * do servidor de produção. Mas observou-se também que staging (mesmo IP, mesmo
 * código, pouco tráfego) entregava foto, e que num teste em produção 4 de 8
 * links devolveram foto. Isso SUGERE intermitência — e ninguém mediu. Enquanto
 * não se mede, não dá para saber se vale a pena espaçar as chamadas, se o
 * bloqueio passa sozinho, ou se a página está fechada para sempre.
 *
 * Este script NÃO grava nada e NÃO manda mensagem. Ele só lê páginas públicas
 * de produto do ML a partir deste servidor e classifica cada resposta em:
 *
 *   ok      -> a página veio com og:image (a foto está acessível)
 *   muro    -> 200 + marcador de suspicious-traffic/account-verification
 *   sem_og  -> respondeu, sem muro, mas sem og:image (página diferente do
 *              esperado — ex.: anúncio removido)
 *   erro    -> rede/timeout/status != 200
 *
 * Uso (dentro do diretório do ambiente):
 *   # uma amostra agora, com links reais que a conta publicou:
 *   cd ~/wabot && node scripts/diag-ml-muro-taxa.mjs --sample=10
 *
 *   # amostragem ao longo do dia (é ISTO que responde a pergunta):
 *   cd ~/wabot && node scripts/diag-ml-muro-taxa.mjs --sample=6 --repetir=24 --intervalo=30
 *
 * `--repetir=24 --intervalo=30` = 24 rodadas espaçadas de 30min = 12h de
 * cobertura. Rode em `nohup`/`screen` e leia o resumo final: se a taxa de `ok`
 * variar com a hora, o bloqueio é por frequência/reputação e vale espaçar; se
 * ficar em 0% o tempo inteiro, a página está fechada e a foto tem que vir de
 * outra fonte (vitrine ou API — ver resolveMercadoLivreImage).
 */

import 'dotenv/config'
import db from '../src/db.js'

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

function arg(name, fallback) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const sampleSize = Math.max(1, Number(arg('sample', 8)))
const repeticoes = Math.max(1, Number(arg('repetir', 1)))
const intervaloMin = Math.max(1, Number(arg('intervalo', 30)))
const days = Number(arg('days', 7))

// Só links de PRODUTO DIRETO interessam: os `meli.la` de vitrine já têm fonte
// de foto própria (e comprovadamente não bloqueada), então incluí-los aqui
// mascararia a taxa que queremos medir.
const LINK_PRODUTO_DIRETO_RE = /mercadolivre\.com\.br\/(p\/MLB\d+|.*MLB-?\d+)/i

async function coletarLinks() {
  const desde = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const linhas = await db.messageLog.findMany({
    where: { platform: { contains: 'mercadolivre' }, sentAt: { gte: desde } },
    select: { originalUrl: true, convertedUrl: true },
    orderBy: { sentAt: 'desc' },
    take: 2000,
  }).catch(() => [])

  const vistos = new Set()
  const urls = []
  for (const linha of linhas) {
    for (const url of [linha.originalUrl, linha.convertedUrl]) {
      if (!url || !LINK_PRODUTO_DIRETO_RE.test(url)) continue
      const limpa = url.split('?')[0]
      if (vistos.has(limpa)) continue
      vistos.add(limpa)
      urls.push(limpa)
    }
  }
  return urls
}

async function classificar(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    })
    const html = await res.text().catch(() => '')
    if (res.status !== 200) return { estado: 'erro', detalhe: `HTTP ${res.status}`, bytes: html.length }
    // O muro responde 200 — por isso a classificação lê o CORPO, nunca o status.
    if (/suspicious-traffic|\/gz\/account-verification/i.test(html)) {
      return { estado: 'muro', detalhe: 'suspicious-traffic', bytes: html.length }
    }
    if (/og:image/i.test(html)) return { estado: 'ok', detalhe: 'og:image presente', bytes: html.length }
    return { estado: 'sem_og', detalhe: 'sem og:image', bytes: html.length }
  } catch (err) {
    return { estado: 'erro', detalhe: err?.message || 'falha de rede', bytes: 0 }
  }
}

const historico = []

async function rodada(numero, urls) {
  const amostra = urls.slice(0, sampleSize)
  const contagem = { ok: 0, muro: 0, sem_og: 0, erro: 0 }
  for (const url of amostra) {
    const r = await classificar(url)
    contagem[r.estado] += 1
    console.log(`   ${r.estado.padEnd(6)} ${String(r.bytes).padStart(7)}B  ${url.slice(0, 78)}`)
    // Espaça as leituras: rajada é justamente o que dispara anti-robô, e
    // medir com rajada mediria o nosso próprio comportamento.
    await new Promise(r => setTimeout(r, 2000))
  }
  const total = amostra.length || 1
  const taxaOk = ((contagem.ok / total) * 100).toFixed(0)
  const hora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  historico.push({ hora, ...contagem, taxaOk })
  console.log(`\n   [rodada ${numero}/${repeticoes} — ${hora}] com foto: ${contagem.ok}/${total} (${taxaOk}%)  muro: ${contagem.muro}  sem_og: ${contagem.sem_og}  erro: ${contagem.erro}\n`)
}

const urls = await coletarLinks()
if (!urls.length) {
  console.log('Nenhum link de produto DIRETO do Mercado Livre encontrado nos envios recentes.')
  console.log('Isso por si só é informação: as ofertas de ML desta base estão vindo por vitrine (meli.la),')
  console.log('que tem fonte de foto própria e não é afetada pelo muro.')
  await db.$disconnect()
  process.exit(0)
}

console.log(`Links de produto direto do ML disponíveis: ${urls.length} (usando ${Math.min(sampleSize, urls.length)} por rodada)\n`)

for (let i = 1; i <= repeticoes; i += 1) {
  await rodada(i, urls)
  if (i < repeticoes) {
    console.log(`   ... aguardando ${intervaloMin}min até a próxima rodada\n`)
    await new Promise(r => setTimeout(r, intervaloMin * 60 * 1000))
  }
}

console.log('\n=== RESUMO ===')
for (const h of historico) console.log(`${h.hora}  com foto: ${String(h.taxaOk).padStart(3)}%  (ok=${h.ok} muro=${h.muro} sem_og=${h.sem_og} erro=${h.erro})`)

const taxas = historico.map(h => Number(h.taxaOk))
const min = Math.min(...taxas)
const max = Math.max(...taxas)
console.log(`\nVariação da taxa com foto: ${min}% a ${max}%`)
if (max === 0) {
  console.log('LEITURA: a página do produto ficou fechada em TODAS as rodadas.')
  console.log('  -> não adianta espaçar chamadas; a foto tem que vir da vitrine ou da API do ML.')
} else if (max - min >= 20) {
  console.log('LEITURA: a taxa VARIOU bastante entre rodadas — sinal de bloqueio por frequência/reputação,')
  console.log('  não de porta fechada. Vale testar espaçar as leituras da página.')
} else {
  console.log('LEITURA: taxa estável entre rodadas. Repita com mais rodadas cobrindo horários diferentes')
  console.log('  antes de concluir qualquer coisa sobre frequência.')
}

await db.$disconnect()
