// Diagnóstico read-only (P1-4): quais lojas NÃO suportadas as clientes estão
// tentando espelhar, e quantas vezes cada uma.
//
// Responde a pergunta que o Planejador e o Trends não decidem (Temu: +900% num
// termo, −90% no outro — artefato de balde): quantas ofertas de cada loja que
// ainda não convertemos chegaram de verdade aos grupos monitorados.
//
// Lê o evento `ops_unsupported_store_daily` de `AnalyticsEvent`: UMA linha por
// (dia, domínio) com `{ domain, day, count }`. Não existe URL, caminho, query,
// texto nem conta gravada — por desenho (src/observability/unsupportedStoreSignal.js).
// As linhas somem sozinhas depois de 30 dias.
//
// Nada é escrito. Só leitura.
//
// Uso (na VPS, DENTRO do diretório do ambiente):
//   cd ~/wabot && node scripts/diag-lojas-nao-suportadas.mjs
//   cd ~/wabot && node scripts/diag-lojas-nao-suportadas.mjs --dias 7
//   cd ~/wabot && node scripts/diag-lojas-nao-suportadas.mjs --dominio temu.com
//
// Leitura:
//   - vazio logo depois do deploy → normal, o contador começa do zero;
//   - vazio depois de dias com o robô recebendo → conferir `ANALYTICS_ENABLED`
//     no .env (se `false`, nada é contado) e o uptime do `bot-supervisor`
//     (em modo remote o código só vale depois do restart dele);
//   - site com cara de "site do grupo" (não é loja) aparece também: é link de
//     domínio próprio que não resolveu até a loja — ver diag-dominio-proprio.mjs.

import db from '../src/db.js'

const EVENTO = 'ops_unsupported_store_daily'
const args = process.argv.slice(2)
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d
}
const dias = Math.max(1, Math.min(30, Number(flag('dias', '30')) || 30))
const filtroDominio = flag('dominio')
const desde = new Date(Date.now() - dias * 864e5)

function parse(ev) {
  try { return JSON.parse(ev.metadata || '{}') } catch { return {} }
}

try {
  const linhas = await db.analyticsEvent.findMany({
    where: { event: EVENTO, createdAt: { gte: desde } },
    select: { metadata: true },
    orderBy: { createdAt: 'asc' },
    take: 5000,
  })

  const porDominio = new Map() // domínio -> { total, dias: Map(dia -> count) }
  for (const ev of linhas) {
    const { domain, day, count } = parse(ev)
    if (!domain || !day || !(Number(count) > 0)) continue
    if (filtroDominio && domain !== filtroDominio) continue
    const item = porDominio.get(domain) || { total: 0, dias: new Map() }
    item.total += Number(count)
    item.dias.set(day, (item.dias.get(day) || 0) + Number(count))
    porDominio.set(domain, item)
  }

  console.log(`Lojas não suportadas — últimos ${dias} dia(s)${filtroDominio ? ` — só ${filtroDominio}` : ''}`)
  if (!porDominio.size) {
    console.log('Nenhum registro. Ver "Leitura" no topo do script antes de concluir que é zero.')
  } else {
    const ranking = [...porDominio.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 30)
    const total = ranking.reduce((s, [, v]) => s + v.total, 0)
    console.log(`${'domínio'.padEnd(28)} ${'ofertas'.padStart(8)} ${'dias c/ oferta'.padStart(15)}  ${'média/dia'.padStart(9)}`)
    for (const [dominio, v] of ranking) {
      const media = (v.total / v.dias.size).toFixed(1)
      console.log(`${dominio.padEnd(28)} ${String(v.total).padStart(8)} ${String(v.dias.size).padStart(15)}  ${media.padStart(9)}`)
    }
    console.log(`Total: ${total} oferta(s) com link de loja não suportada.`)
    if (filtroDominio) {
      const [, v] = ranking[0] || [null, null]
      if (v) for (const [dia, n] of [...v.dias.entries()].sort()) console.log(`  ${dia}  ${n}`)
    }
  }
} catch (err) {
  // Erro de leitura é IMPRESSO, nunca vira "nenhum registro".
  console.error('Falha ao ler AnalyticsEvent:', err?.message || err)
  process.exitCode = 1
} finally {
  await db.$disconnect().catch(() => {})
}
