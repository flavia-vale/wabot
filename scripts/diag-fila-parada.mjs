#!/usr/bin/env node
/**
 * Diagnóstico read-only: "tem envio na fila e o grupo não recebe" +
 * "diz que faltou cadastrar a loja e a loja está cadastrada".
 *
 * As duas queixas têm CAUSAS DIFERENTES e a tela mostra as duas com a mesma
 * cara, então este script separa:
 *
 *  [1] O robô está de pé e conectado?
 *  [2] Cada linha "na fila": há quanto tempo espera e qual o motivo gravado.
 *  [3] Cada DESTINO: config de preservação efetiva + contador do dia/janela +
 *      a MESMA decisão que o robô toma agora (libera? por que não? até quando?)
 *  [4] Loja por loja: credencial cadastrada, campos faltando e sondagem AO VIVO
 *      (a da Shopee é a única que separa "chave recusada" de "não cadastrada").
 *  [5] Os motivos REAIS por trás de "faltou cadastrar a loja" na janela.
 *
 * Não escreve nada. Não imprime cookie, chave secreta nem token.
 *
 * Uso (no VPS, DENTRO do diretório do ambiente — o .env define o banco certo):
 *   cd ~/wabot && node scripts/diag-fila-parada.mjs <email|telefone|nome>
 *   cd ~/wabot && node scripts/diag-fila-parada.mjs cynthiatceles@gmail.com --hours=8
 */
import 'dotenv/config'

const args = process.argv.slice(2)
const who = args.find(a => !a.startsWith('--')) || null
function opt(name, fallback) {
  const hit = args.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const hours = Number(opt('hours', 8)) || 8
const sinceDate = new Date(Date.now() - hours * 3600_000)

const { default: db } = await import('../src/db.js')
const { resolveDestinationPreservation, HARD_DEFAULT_PRESERVATION } = await import('../src/core/preservationConfig.js')
const { decideDestination, parseQuietHours, tzDayBucket } = await import('../src/core/channelThrottle.js')
const { isChannelPaused, getHealth } = await import('../src/core/channelHealth.js')
const { parseCredentialData, validateCredentialData, describeMissingCredentials } = await import('../src/credentialHealth.js')

const line = (t) => console.log(`\n===== ${t} =====`)
const fmt = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) + 'Z' : '-')
const minsAgo = (d) => (d ? `${Math.round((Date.now() - new Date(d).getTime()) / 60000)}min` : '-')
const achados = []
const flag = (m) => { achados.push(m); console.log(`  ⚠ ${m}`) }

// ------------------------------------------------------------------ ambiente
line('AMBIENTE')
console.log({
  cwd: process.cwd(),
  APP_ENV: process.env.APP_ENV || null,
  DATABASE_URL: process.env.DATABASE_URL || null,
  BOT_SUPERVISOR_MODE: process.env.BOT_SUPERVISOR_MODE || '(ausente = inline)',
  QUEUE_BACKEND: process.env.QUEUE_BACKEND || '(ausente = memory)',
  agora: fmt(Date.now()),
  janela: `${hours}h (desde ${fmt(sinceDate)})`,
})

// ---------------------------------------------------------------------- 1
line('1. CONTA E SESSÃO')
const users = await db.user.findMany({
  where: who
    ? { OR: [{ email: { contains: who } }, { contactPhone: { contains: who } }, { name: { contains: who } }] }
    : {},
  select: { id: true, email: true, name: true, plan: true, accessExpiresAt: true },
  take: 5,
})
if (!users.length) {
  console.log('Nenhuma conta encontrada para', who)
  process.exit(1)
}
if (users.length > 1) console.log('Mais de uma conta bateu; usando a primeira:', users.map(u => u.email))
const user = users[0]
const userId = user.id
console.log({ email: user.email, nome: user.name, plano: user.plan, acessoAte: fmt(user.accessExpiresAt) })

const sess = await db.waSession.findFirst({ where: { userId }, select: { status: true, lifecycle: true, updatedAt: true, phone: true } }).catch(err => { console.log('  !! consulta da sessão FALHOU:', err?.message); return null })
console.log('sessão WhatsApp:', sess ? { status: sess.status, lifecycle: sess.lifecycle, ultimoSinal: `${minsAgo(sess.updatedAt)} atrás` } : '(sem linha)')
if (sess && sess.status !== 'connected') flag(`sessão WhatsApp não está conectada (status=${sess.status}) — nada sai enquanto isso.`)
if (sess && Date.now() - new Date(sess.updatedAt).getTime() > 10 * 60_000) {
  flag(`o robô não dá sinal de vida há ${minsAgo(sess.updatedAt)} — pode estar parado/reiniciando.`)
}

// ---------------------------------------------------------------------- 2
line('2. O QUE ESTÁ NA FILA')
const pend = await db.messageLog.findMany({
  where: { userId, status: { in: ['queued', 'sending'] } },
  select: { id: true, status: true, destGroup: true, sourceGroup: true, platform: true, errorMsg: true, sentAt: true },
  orderBy: { sentAt: 'asc' },
  take: 200,
})
console.log(`total pendente: ${pend.length} (queued=${pend.filter(p => p.status === 'queued').length}, sending=${pend.filter(p => p.status === 'sending').length})`)
const porMotivo = new Map()
for (const p of pend) {
  const k = `${p.status} | ${p.errorMsg || '(sem motivo gravado)'}`
  porMotivo.set(k, (porMotivo.get(k) || 0) + 1)
}
for (const [k, n] of [...porMotivo.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${n}x  ${k}`)
if (pend.length) {
  const maisVelho = pend[0]
  console.log('mais antigo:', { desde: fmt(maisVelho.sentAt), esperando: minsAgo(maisVelho.sentAt), destino: maisVelho.destGroup, motivo: maisVelho.errorMsg })
}
const semMotivo = pend.filter(p => p.status === 'queued' && !p.errorMsg && Date.now() - new Date(p.sentAt).getTime() > 15 * 60_000)
if (semMotivo.length) {
  flag(`${semMotivo.length} envio(s) esperando há mais de 15min SEM motivo gravado — isso não é preservação segurando; é job que sumiu da fila em memória (reinício do robô) ou fila sem consumidor.`)
}

// ---------------------------------------------------------------------- 3
line('3. DESTINO POR DESTINO: o robô libera o envio AGORA?')
const destinos = await db.group.findMany({
  where: { userId, role: 'post' },
  select: {
    id: true, name: true, waJid: true, kind: true,
    preservationPresetId: true, operatingHoursEnabled: true, operatingHoursJson: true,
    throttleEnabled: true, minIntervalSec: true, burstCap: true, burstWindowSec: true,
    dailyCap: true, queueMaxAgeMin: true, preservationPreset: true,
  },
})
const defaultPreset = await db.preservationPreset.findFirst({ where: { userId, isDefault: true } }).catch(err => { console.log('  !! preset padrão FALHOU:', err?.message); return null })
const now = Date.now()
for (const g of destinos) {
  const dest = resolveDestinationPreservation(g, { preset: g.preservationPreset, defaultPreset })
  const throttle = await db.channelThrottle.findUnique({ where: { groupId: g.id } }).catch(err => { console.log('  !! contador do destino FALHOU:', err?.message); return null })
  const health = await getHealth(g.id, { db }).catch(err => { console.log('  !! saúde do destino FALHOU:', err?.message); return null })
  const paused = isChannelPaused(health, now) ? health : false
  const decisao = decideDestination({ now, throttle, isPaused: paused, dest })
  const tz = parseQuietHours(dest.operatingHoursJson).tz
  const naFila = pend.filter(p => p.destGroup === g.waJid).length
  console.log(`\n-- ${g.name} (${g.kind}) ${g.waJid}`)
  console.log('   preservação:', {
    intervaloMin: `${dest.minIntervalSec}s`,
    burst: `${dest.burstCap} a cada ${dest.burstWindowSec}s`,
    tetoDia: dest.dailyCap ?? '(sem teto)',
    horario: dest.operatingHoursEnabled ? dest.operatingHoursJson : '(24h)',
    descarteFila: `${dest.queueMaxAgeMin}min`,
    fonte: g.preservationPreset ? 'preset do grupo' : (defaultPreset ? 'preset padrão da conta' : 'padrão embutido'),
  })
  console.log('   contadores:', throttle ? {
    ultimoEnvio: `${minsAgo(throttle.lastPostAt)} atrás (${fmt(throttle.lastPostAt)})`,
    hoje: `${throttle.postsToday} (bucket ${throttle.dayBucket} / hoje ${tzDayBucket(now, tz)})`,
    janelaBurst: `${throttle.postsInBurstWindow} desde ${fmt(throttle.burstWindowStart)}`,
  } : '(nunca enviou)')
  console.log('   na fila para este destino:', naFila)
  if (decisao.allow) {
    console.log('   ✅ LIBERA o envio agora')
    if (naFila > 0) flag(`${g.name}: ${naFila} envio(s) parados mas a preservação LIBERA — o gargalo não é a preservação.`)
  } else {
    const espera = Math.round(((decisao.deferUntil ?? now) - now) / 60000)
    console.log(`   ⛔ SEGURA: ${decisao.reason} — libera em ~${espera}min (${fmt(decisao.deferUntil)})`)
    flag(`${g.name}: segurando por ${decisao.reason}, libera em ~${espera}min.`)
  }
}

// ---------------------------------------------------------------------- 4
line('4. LOJAS CADASTRADAS (e a chave ainda é aceita?)')
const creds = await db.credential.findMany({ where: { userId }, select: { platform: true, data: true } })
console.log('lojas com linha no banco:', creds.map(c => c.platform).join(', ') || '(nenhuma)')
if (!creds.length) flag('nenhuma loja cadastrada — TODA oferta cai em "faltou cadastrar a loja".')
for (const c of creds) {
  const parsed = parseCredentialData(c.data) || {}
  const validation = validateCredentialData(c.platform, parsed)
  const campos = Object.keys(parsed).filter(k => parsed[k] !== '' && parsed[k] != null)
  console.log(`\n-- ${c.platform} `)
  console.log('   campos preenchidos:', campos.join(', ') || '(nenhum)')
  console.log('   validação:', { status: validation?.status, completa: validation?.configured, faltando: validation?.missing, invalidos: validation?.invalid })
  if (!validation?.configured) flag(`${c.platform}: cadastro incompleto — ${describeMissingCredentials(validation)}`)
  if (validation?.invalid?.length) flag(`${c.platform}: campo preenchido com conteúdo que não serve — ${validation.invalid.join(' | ')}`)
  if (c.platform === 'shopee') {
    try {
      const { checkShopeeSession } = await import('../src/converters/shopee.js')
      const probe = await checkShopeeSession(parsed)
      console.log('   sondagem ao vivo:', probe)
      if (probe.alive === false) flag('SHOPEE: a chave está cadastrada mas a Shopee RECUSOU (nenhuma oferta de Shopee é publicada enquanto isso).')
      if (probe.alive === null && probe.configured) console.log('   (indeterminado — rede/limite; não conclui nada)')
    } catch (err) {
      console.log('   sondagem falhou:', err?.message)
    }
  }
}

// ---------------------------------------------------------------------- 5
line(`5. O QUE ESTÁ POR TRÁS DE "faltou cadastrar a loja" (últimas ${hours}h)`)
const skips = await db.messageLog.groupBy({
  by: ['platform', 'errorMsg'],
  where: { userId, status: { in: ['skipped', 'error'] }, sentAt: { gte: sinceDate } },
  _count: { _all: true },
}).catch(err => { console.log('  !! groupBy FALHOU:', err?.message); return [] })
for (const s of skips.sort((a, b) => b._count._all - a._count._all).slice(0, 25)) {
  console.log(`  ${String(s._count._all).padStart(5)}x  ${s.platform}  ${s.errorMsg}`)
}
console.log('\nmotivos detalhados gravados pelo robô (conversão):')
const issues = await db.messageLog.findMany({
  where: { userId, sentAt: { gte: sinceDate }, destGroup: 'conversion' },
  select: { platform: true, errorMsg: true, sentAt: true },
  orderBy: { sentAt: 'desc' },
  take: 15,
}).catch(err => { console.log('  !! consulta de motivos FALHOU:', err?.message); return [] })
if (!issues.length) console.log('  (nenhuma linha em destGroup=conversion nesta janela)')
for (const i of issues) console.log(`  ${fmt(i.sentAt)}  ${i.platform}  ${i.errorMsg}`)

// ---------------------------------------------------------------------- 6
line('6. O QUE O ROBÔ REGISTROU NO LOG (últimas linhas)')
// Separa "está esperando a janela do destino" (Defer longo / Smart delay) de
// "nem está tentando" (nenhuma linha de envio no período) — as duas aparecem
// iguais na tela e pedem correções opostas.
try {
  const { getLogsBaseDir } = await import('../src/paths.js')
  const { existsSync, readFileSync } = await import('fs')
  const { join } = await import('path')
  const logFile = opt('log', null) || join(getLogsBaseDir(), 'bot.log')
  if (!existsSync(logFile)) {
    console.log(`  bot.log não encontrado em ${logFile} — passe --log=/caminho/bot.log`)
  } else {
    const linhas = readFileSync(logFile, 'utf8').split('\n').slice(-40000)
    const conta = (re) => linhas.filter(l => re.test(l)).length
    const ultima = (re) => { for (let i = linhas.length - 1; i >= 0; i--) if (re.test(linhas[i])) return linhas[i].slice(0, 400); return null }
    console.log('  ocorrências no fim do log (todas as contas do ambiente):', {
      mensagemEnviada: conta(/"Mensagem enviada"/),
      deferLongo: conta(/Defer longo/),
      smartDelay: conta(/Smart delay antes do envio/),
      janelaCurtaThrottle: conta(/aguardando janela curta de throttle/),
      filaCheia: conta(/queue_full|Fila de envios cheia/),
      workerReiniciou: conta(/worker_restart|markInterruptedSendLogs/),
    })
    for (const [rotulo, re] of [
      ['último "Mensagem enviada"', /"Mensagem enviada"/],
      ['último "Defer longo"', /Defer longo/],
      ['último "Smart delay"', /Smart delay antes do envio/],
    ]) console.log(`  ${rotulo}: ${ultima(re) ?? '(nenhum)'}`)
  }
} catch (err) {
  console.log('  leitura do log falhou:', err?.message)
}

// ------------------------------------------------------------------ veredito
line('VEREDITO')
if (!achados.length) console.log('Nenhum problema conclusivo encontrado nesta janela.')
else achados.forEach((a, i) => console.log(`${i + 1}. ${a}`))

await db.$disconnect().catch(() => {})
