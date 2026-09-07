#!/usr/bin/env node
// Quem está ocupando as vagas de robô — read-only, roda no diretório do ambiente.
//
//   cd ~/wabot && node scripts/diag-vagas-robos.mjs
//   cd ~/wabot && node scripts/diag-vagas-robos.mjs --dias=7   # janela dos eventos
//
// POR QUE ESTE SCRIPT EXISTE (2026-09-07)
// ---------------------------------------
// O servidor recusa ligar robô ao bater `MAX_SESSIONS_PER_PROCESS`. Quando isso
// acontece, NENHUMA cliente nova conecta — e quem desligou o próprio robô perde
// a vaga para outra conta. Em produção o teto encheu de madrugada (30/30, 239
// recusas) e ninguém sabia QUEM estava lá dentro.
//
// A pergunta que ele responde não é "quantas sessões existem" (isso o banco já
// diz), é: **quantas vagas estão sendo gastas com conta que não deveria estar
// disputando** — plano vencido, conta bloqueada, cliente que desligou de
// propósito, sessão que o robô insiste em ressuscitar sem nunca conectar.
//
// Read-only: só faz `findMany`/`groupBy`. NÃO para sessão, não escreve nada, não
// toca no supervisor. Parar uma sessão continua sendo decisão humana
// (`node scripts/parar-sessao.mjs <email>`).
//
// A regra de "esta sessão seria ressuscitada?" é IMPORTADA de
// `src/core/sessionResurrectionPolicy.js` — a mesma que o supervisor usa. Não
// reescrever aqui: script e servidor discordando é pior que não ter script.
import 'dotenv/config'
import db from '../src/db.js'
import { shouldResurrectSession, resolveIncludeReconnecting } from '../src/core/sessionResurrectionPolicy.js'
import { MANUAL_STOP_EVENT } from '../src/email/accountActivity.js'

const args = process.argv.slice(2)
const dias = Number((args.find(a => a.startsWith('--dias=')) || '--dias=7').split('=')[1]) || 7
const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)
const agora = new Date()
const TETO = Math.max(1, Number(process.env.MAX_SESSIONS_PER_PROCESS || 20))
const INCLUI_RECONECTANDO = resolveIncludeReconnecting()

// Em que balde cada sessão cai. A ordem importa: o primeiro motivo que se
// aplica é o que decide a AÇÃO, e acesso/bloqueio vêm antes do estado técnico
// (mesma lição de `describeDisconnectReason`: o código gravado é o da queda
// anterior e contaria história errada).
function classificar({ sessao, user, parouSozinha }) {
  const bloqueada = user?.status === 'banned' || user?.status === 'suspended'
  const vencida = user?.accessExpiresAt && user.accessExpiresAt < agora
  const ressuscitavel = shouldResurrectSession({
    status: sessao.status,
    lifecycle: sessao.lifecycle,
    includeReconnecting: INCLUI_RECONECTANDO,
  })

  if (sessao.status === 'connected') return { balde: 'conectada', gastaVaga: true, ressuscitavel }
  if (bloqueada) return { balde: 'conta bloqueada', gastaVaga: ressuscitavel, ressuscitavel }
  if (vencida) return { balde: 'plano vencido', gastaVaga: ressuscitavel, ressuscitavel }
  if (parouSozinha) return { balde: 'ela desligou de propósito', gastaVaga: ressuscitavel, ressuscitavel }
  if (ressuscitavel) return { balde: 'tentando reconectar (gasta vaga)', gastaVaga: true, ressuscitavel }
  return { balde: 'parada, sem tentar', gastaVaga: false, ressuscitavel }
}

function idade(data) {
  if (!data) return 'nunca'
  const h = (Date.now() - new Date(data).getTime()) / 3_600_000
  if (h < 48) return `${h.toFixed(0)}h`
  return `${(h / 24).toFixed(0)}d`
}

async function main() {
  console.log(`\nAmbiente: ${process.env.APP_ENV || 'não declarado'} · banco: ${process.env.DATABASE_URL || 'não declarado'}`)
  console.log(`Teto de robôs ligados ao mesmo tempo: ${TETO}\n`)

  const sessoes = await db.waSession.findMany({
    select: { userId: true, status: true, lifecycle: true, lastHeartbeatAt: true, lastDisconnectCode: true, updatedAt: true },
  })
  if (!sessoes.length) {
    console.log('Nenhuma sessão registrada neste banco.')
    return
  }

  const userIds = sessoes.map(s => s.userId)
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, status: true, plan: true, accessExpiresAt: true },
  })
  const userById = new Map(users.map(u => [u.id, u]))

  // "Ela desligou de propósito" = pedido manual de parada SEM conexão depois.
  // Mesma leitura de `wasStoppedByUser` (email/accountActivity.js): desligar o
  // robô é escolha, não problema.
  const eventos = await db.waConnectionEvent.findMany({
    where: { userId: { in: userIds }, occurredAt: { gte: desde }, type: { in: [MANUAL_STOP_EVENT, 'connect', 'whatsapp_connected'] } },
    select: { userId: true, type: true, occurredAt: true },
    orderBy: { occurredAt: 'asc' },
  }).catch(() => [])
  const ultimaParada = new Map()
  const ultimaConexao = new Map()
  for (const ev of eventos) {
    if (ev.type === MANUAL_STOP_EVENT) ultimaParada.set(ev.userId, ev.occurredAt)
    else ultimaConexao.set(ev.userId, ev.occurredAt)
  }

  const baldes = new Map()
  const detalhe = []
  for (const sessao of sessoes) {
    const user = userById.get(sessao.userId)
    const parada = ultimaParada.get(sessao.userId)
    const conexao = ultimaConexao.get(sessao.userId)
    const parouSozinha = Boolean(parada) && (!conexao || conexao < parada)
    const { balde, gastaVaga } = classificar({ sessao, user, parouSozinha })
    const atual = baldes.get(balde) || { total: 0, gastaVaga: 0 }
    atual.total += 1
    if (gastaVaga) atual.gastaVaga += 1
    baldes.set(balde, atual)
    detalhe.push({ balde, gastaVaga, sessao, user })
  }

  console.log('Onde estão as sessões (e quantas disputam vaga com cliente nova):\n')
  const ordem = [...baldes.entries()].sort((a, b) => b[1].total - a[1].total)
  for (const [balde, n] of ordem) {
    console.log(`  ${balde.padEnd(34)} ${String(n.total).padStart(4)}   disputando vaga: ${n.gastaVaga}`)
  }

  const disputando = detalhe.filter(d => d.gastaVaga).length
  const conectadas = detalhe.filter(d => d.sessao.status === 'connected').length
  const desperdicio = detalhe.filter(d => d.gastaVaga && d.sessao.status !== 'connected')

  console.log(`\n  ${'TOTAL disputando vaga'.padEnd(34)} ${String(disputando).padStart(4)}   de ${TETO} vagas`)
  console.log(`  ${'destas, de fato conectadas'.padEnd(34)} ${String(conectadas).padStart(4)}`)
  console.log(`  ${'vaga gasta SEM estar conectada'.padEnd(34)} ${String(desperdicio.length).padStart(4)}  <- o que dá para recuperar\n`)

  if (!desperdicio.length) {
    console.log('Nenhuma vaga sendo gasta por conta parada — o teto está sendo ocupado por cliente de verdade.')
    console.log('Nesse caso, aceitar mais gente exige subir o teto (mudança de RAM: avisar antes).\n')
    return
  }

  console.log(`Quem está gastando vaga sem estar conectada (janela de eventos: ${dias} dias):\n`)
  console.log(`  ${'motivo'.padEnd(34)} ${'conta'.padEnd(34)} ${'sem sinal há'.padEnd(13)} último código`)
  for (const d of desperdicio.sort((a, b) => a.balde.localeCompare(b.balde)).slice(0, 60)) {
    const conta = (d.user?.email || d.sessao.userId).slice(0, 33)
    console.log(`  ${d.balde.padEnd(34)} ${conta.padEnd(34)} ${idade(d.sessao.lastHeartbeatAt).padEnd(13)} ${d.sessao.lastDisconnectCode || '-'}`)
  }
  if (desperdicio.length > 60) console.log(`  ... e mais ${desperdicio.length - 60}`)

  console.log('\nPara liberar uma vaga (decisão humana, uma conta por vez):')
  console.log('  node scripts/parar-sessao.mjs <email>')
  console.log('Isso marca a sessão como parada de propósito — não gera aviso de robô caído.\n')
}

main()
  .catch(err => { console.error('Falhou:', err?.message || err); process.exitCode = 1 })
  .finally(() => db.$disconnect().catch(() => {}))
