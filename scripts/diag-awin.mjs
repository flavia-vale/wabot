#!/usr/bin/env node
/**
 * Diagnóstico das contas Awin de uma cliente (docs/rca/afiliados-awin.md).
 *
 * SÓ LEITURA: não grava nada no banco, não imprime o código de acesso.
 * Por padrão lê só o banco. Com --awin faz 2 chamadas leves à Awin por conta
 * (GET /accounts e a 1ª página de promoções, 10 itens) para conferir o que a
 * Awin devolve AGORA — gasta 2 das 20 chamadas/min do token.
 *
 * O que ele responde:
 *   - status da conta, próxima atualização e as últimas execuções (com erros);
 *   - promoções ativas/vencidas por loja e quantas vencem nas próximas 24h;
 *   - automações que usam a conta (ligadas/desligadas, último envio);
 *   - com --awin: o código ainda vale? a conta é desse código? chaves da
 *     resposta, total, e se o link da promoção sai com o número da conta.
 *
 * Uso (dentro do diretório do ambiente):
 *   cd ~/wabot-staging && node scripts/diag-awin.mjs <email> [--awin]
 */

import 'dotenv/config'
import db from '../src/db.js'
import { decryptCredential } from '../src/credentialCrypto.js'
import { createAwinClient } from '../src/integrations/awin/client.js'
import { testAwinCredentials } from '../src/integrations/awin/accountService.js'
import { extractPromotionPage, trackingHasPublisher } from '../src/integrations/awin/translate.js'

const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const [email] = positional
const callAwin = process.argv.includes('--awin')

if (!email) {
  console.error('uso: node scripts/diag-awin.mjs <email> [--awin]')
  process.exit(1)
}

const user = await db.user.findUnique({ where: { email }, select: { id: true, plan: true } })
if (!user) {
  console.log('cliente não encontrada')
  process.exit(0)
}

const now = new Date()
const accounts = await db.awinAccount.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } })
console.log(`plano=${user.plan} contas_awin=${accounts.length}`)

const client = createAwinClient()
for (const account of accounts) {
  console.log(`\n== ${account.label} (conta ${account.publisherId}) id=${account.id}`)
  console.log(`status=${account.status} sync=${account.syncEnabled ? 'ligado' : 'desligado'} ultimo=${account.lastSyncAt?.toISOString() ?? '-'} (${account.lastSyncStatus ?? '-'}) proximo=${account.nextSyncAt?.toISOString() ?? 'NÃO AGENDADO'}`)
  if (account.statusDetail) console.log(`aviso: ${account.statusDetail}`)

  const runs = await db.awinSyncRun.findMany({ where: { accountId: account.id }, orderBy: { startedAt: 'desc' }, take: 5 })
  for (const run of runs) {
    const errors = JSON.parse(run.errorsJson || '[]').map((item) => item.message).join(' | ')
    console.log(`  run ${run.startedAt.toISOString()} ${run.trigger} ${run.status} pag=${run.pages} +${run.inserted} ~${run.updated} ign=${run.skipped} venc=${run.expired}${errors ? ` erros: ${errors}` : ''}`)
  }

  const byStore = await db.awinPromotion.groupBy({ by: ['advertiserName', 'status'], where: { accountId: account.id }, _count: { _all: true } })
  for (const row of byStore) console.log(`  loja=${row.advertiserName} ${row.status}=${row._count._all}`)
  const next24h = await db.awinPromotion.count({ where: { accountId: account.id, status: 'active', endDate: { lte: new Date(now.getTime() + 86_400_000) } } })
  console.log(`  ativas que vencem em 24h: ${next24h}`)
  // Link curto e foto: só existem nas promoções que já foram enviadas.
  const tried = await db.awinPromotion.count({ where: { accountId: account.id, enrichedAt: { not: null } } })
  const withShort = await db.awinPromotion.count({ where: { accountId: account.id, shortUrl: { not: null } } })
  const withImage = await db.awinPromotion.count({ where: { accountId: account.id, imageUrl: { not: null } } })
  console.log(`  enviadas_com_busca=${tried} link_curto=${withShort} com_foto=${withImage}`)
  // Conversão de links: lojas aprovadas (vêm do sync) e links guardados.
  const lojas = await db.awinProgramme.findMany({ where: { accountId: account.id }, select: { name: true, domainsJson: true }, orderBy: { name: 'asc' } })
  console.log(`  lojas_aprovadas=${lojas.length}${lojas.length ? ' ' + lojas.map((row) => row.name).join(' | ') : ''}`)
  const semDominio = lojas.filter((row) => row.domainsJson === '[]').map((row) => row.name)
  if (semDominio.length) console.log(`  lojas_sem_site (não convertem): ${semDominio.join(' | ')}`)
  const linksGuardados = await db.awinLink.count({ where: { accountId: account.id } })
  const linksCurtos = await db.awinLink.count({ where: { accountId: account.id, shortUrl: { not: null } } })
  console.log(`  links_convertidos_guardados=${linksGuardados} curtos=${linksCurtos} longos=${linksGuardados - linksCurtos}`)
  const noImage = await db.awinPromotion.groupBy({ by: ['advertiserName'], where: { accountId: account.id, enrichedAt: { not: null }, imageUrl: null }, _count: { _all: true } })
  for (const row of noImage) console.log(`  sem_foto loja=${row.advertiserName} n=${row._count._all}`)

  const automations = await db.offerAutomation.findMany({ where: { userId: user.id, source: 'awin', awinAccountId: account.id }, select: { id: true, enabled: true, lastSentAt: true, publicationMode: true } })
  for (const item of automations) console.log(`  automação ${item.id} ${item.enabled ? 'ligada' : 'desligada'} ${item.publicationMode} ultimo_envio=${item.lastSentAt?.toISOString() ?? '-'}`)

  if (!callAwin) continue
  const token = decryptCredential(account.tokenEncrypted)
  const test = await testAwinCredentials({ client, token, publisherId: account.publisherId })
  console.log(`  awin: conexao=${test.ok ? 'ok' : test.reason}`)
  if (!test.ok) continue
  try {
    const body = await client.listPromotions(token, account.publisherId, { filters: { type: 'promotion', status: 'active', membership: 'joined', regionCodes: ['BR'] }, page: 1, pageSize: 10 })
    const parsed = extractPromotionPage(body)
    console.log(`  awin: chaves=${Object.keys(body || {}).join(',')} total=${parsed?.total ?? '?'} amostra=${parsed?.items.length ?? 0}`)
    const withId = (parsed?.items ?? []).filter((item) => trackingHasPublisher(item.urlTracking, account.publisherId)).length
    console.log(`  awin: links com o número da conta=${withId}/${parsed?.items.length ?? 0}`)
    for (const item of (parsed?.items ?? []).slice(0, 3)) console.log(`  awin: ${item.advertiser?.name} | ${item.startDate} | ${item.endDate}`)
  } catch (error) {
    console.log(`  awin: erro=${error.code || error.message}`)
  }
}

await db.$disconnect()
