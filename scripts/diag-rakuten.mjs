#!/usr/bin/env node
/**
 * Diagnóstico das contas Rakuten de uma cliente (docs/rca/afiliados-rakuten.md).
 *
 * SÓ LEITURA: não grava nada no banco, não imprime Client ID/Secret nem token.
 * Por padrão lê só o banco. Com --rakuten faz 2 chamadas leves à Rakuten por
 * conta (token + 1ª página do feed de ofertas) para conferir o que a Rakuten
 * devolve AGORA — gasta 2 das 100 chamadas/min da conta.
 *
 * O que ele responde:
 *   - status da conta, próxima atualização e as últimas execuções (com erros);
 *   - promoções ativas/vencidas por loja, quantas com cupom e com logo;
 *   - automações que usam a conta (ligadas/desligadas, último envio);
 *   - com --rakuten: os dados ainda valem? quantas ofertas o feed tem agora?
 *   - conversão de links: lojas aprovadas guardadas (com domínio?), o `id`
 *     dos links dela e um deep link de exemplo para testar à mão; com
 *     --rakuten, o formato REAL da lista de lojas aprovadas (Link Locator)
 *     — mais 1 chamada.
 *
 * Uso (dentro do diretório do ambiente):
 *   cd ~/wabot-staging && node scripts/diag-rakuten.mjs <email> [--rakuten]
 */

import 'dotenv/config'
import db from '../src/db.js'
import { createRakutenClient } from '../src/integrations/rakuten/client.js'
import { testRakutenCredentials } from '../src/integrations/rakuten/accountService.js'
import { decryptRakutenCreds } from '../src/integrations/rakuten/syncService.js'
import { extractCouponPage, translateCoupon } from '../src/integrations/rakuten/translate.js'
import { buildRakutenDeepLink, extractApprovedMerchants } from '../src/integrations/rakuten/storeMatcher.js'

const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const [email] = positional
const callRakuten = process.argv.includes('--rakuten')

if (!email) {
  console.error('uso: node scripts/diag-rakuten.mjs <email> [--rakuten]')
  process.exit(1)
}

const user = await db.user.findUnique({ where: { email }, select: { id: true, plan: true } })
if (!user) {
  console.log('cliente não encontrada')
  process.exit(0)
}

const now = new Date()
const accounts = await db.rakutenAccount.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } })
console.log(`plano=${user.plan} contas_rakuten=${accounts.length}`)

const client = createRakutenClient()
for (const account of accounts) {
  console.log(`\n== ${account.label} (SID ${account.sid}) id=${account.id}`)
  console.log(`status=${account.status} sync=${account.syncEnabled ? 'ligado' : 'desligado'} ultimo=${account.lastSyncAt?.toISOString() ?? '-'} (${account.lastSyncStatus ?? '-'}) proximo=${account.nextSyncAt?.toISOString() ?? 'NÃO AGENDADO'}`)
  if (account.statusDetail) console.log(`aviso: ${account.statusDetail}`)

  const runs = await db.rakutenSyncRun.findMany({ where: { accountId: account.id }, orderBy: { startedAt: 'desc' }, take: 5 })
  for (const run of runs) {
    const errors = JSON.parse(run.errorsJson || '[]').map((item) => item.message).join(' | ')
    console.log(`  run ${run.startedAt.toISOString()} ${run.trigger} ${run.status} pag=${run.pages} +${run.inserted} ~${run.updated} ign=${run.skipped} venc=${run.expired}${errors ? ` erros: ${errors}` : ''}`)
  }

  const byStore = await db.rakutenPromotion.groupBy({ by: ['advertiserName', 'status'], where: { accountId: account.id }, _count: { _all: true } })
  for (const row of byStore) console.log(`  loja=${row.advertiserName} ${row.status}=${row._count._all}`)
  const active = { accountId: account.id, status: 'active' }
  const next24h = await db.rakutenPromotion.count({ where: { ...active, endDate: { lte: new Date(now.getTime() + 86_400_000) } } })
  const withCoupon = await db.rakutenPromotion.count({ where: { ...active, couponCode: { not: null } } })
  const withLogo = await db.rakutenPromotion.count({ where: { ...active, logoUrl: { not: null } } })
  const total = await db.rakutenPromotion.count({ where: active })
  // Sem logo a oferta sai sem foto e o WhatsApp monta a prévia abrindo o link
  // de rastreio a partir do servidor (clique vindo da VPS).
  console.log(`  ativas=${total} vencem_em_24h=${next24h} com_cupom=${withCoupon} com_logo=${withLogo} sem_logo=${total - withLogo}`)

  const automations = await db.offerAutomation.findMany({ where: { userId: user.id, source: 'rakuten', rakutenAccountId: account.id }, select: { id: true, enabled: true, lastSentAt: true, publicationMode: true } })
  for (const item of automations) console.log(`  automação ${item.id} ${item.enabled ? 'ligada' : 'desligada'} ${item.publicationMode} ultimo_envio=${item.lastSentAt?.toISOString() ?? '-'}`)

  // Conversão de links: sem id dos links ou sem loja com domínio, nada converte.
  const programmes = await db.rakutenProgramme.findMany({ where: { accountId: account.id }, orderBy: { advertiserId: 'asc' } })
  const withDomain = programmes.filter((row) => JSON.parse(row.domainsJson || '[]').length)
  console.log(`  conversao: link_id=${account.linkId ?? 'NÃO (sem promoção no sync ainda)'} lojas_aprovadas=${programmes.length} com_dominio=${withDomain.length}`)
  for (const row of programmes.slice(0, 10)) console.log(`  loja_aprovada ${row.advertiserId} ${row.name} dominios=${row.domainsJson}`)
  if (account.linkId && withDomain[0]) {
    // Abrir este link no navegador (NUNCA pelo servidor) deve cair na página
    // da loja e contar clique para ela: confirma o formato do deep link.
    const page = withDomain[0].storeUrl || `https://${JSON.parse(withDomain[0].domainsJson)[0]}/`
    console.log(`  deep_link_exemplo=${buildRakutenDeepLink({ linkId: account.linkId, advertiserId: withDomain[0].advertiserId, destinationUrl: page })}`)
  }

  if (!callRakuten) continue
  const creds = decryptRakutenCreds(account)
  const test = await testRakutenCredentials({ client, creds })
  console.log(`  rakuten: conexao=${test.ok ? 'ok' : test.reason}`)
  if (!test.ok) continue
  try {
    const parsed = extractCouponPage(await client.listCoupons(creds, { page: 1, pageSize: 50 }))
    const results = (parsed?.items ?? []).map(translateCoupon)
    console.log(`  rakuten: total=${parsed?.total ?? '?'} paginas=${parsed?.totalPages ?? '?'} amostra=${results.length} validas=${results.filter((r) => r.ok).length}`)
    for (const result of results.filter((r) => r.ok).slice(0, 3)) console.log(`  rakuten: ${result.record.advertiserName} | ${result.record.endDate?.toISOString() ?? '-'} | cupom=${result.record.couponCode ? 'sim' : 'não'}`)
  } catch (error) {
    console.log(`  rakuten: erro=${error.code || error.message}`)
  }
  try {
    const raw = await client.listApprovedMerchants(creds)
    const merchants = extractApprovedMerchants(raw)
    console.log(`  rakuten: lojas_aprovadas_lidas=${merchants ? merchants.length : 'FORMATO DESCONHECIDO'} amostra=${merchants?.slice(0, 5).map((m) => `${m.advertiserId}:${m.name}`).join(' | ') || '-'}`)
    if (!merchants?.length) console.log(`  rakuten: resposta_crua=${String(raw).replace(/\s+/g, ' ').slice(0, 400)}`)
  } catch (error) {
    console.log(`  rakuten: lojas_aprovadas erro=${error.code || error.message}`)
  }
}

await db.$disconnect()
