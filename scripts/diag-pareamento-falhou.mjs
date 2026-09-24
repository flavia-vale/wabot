// Diagnóstico read-only do grupo "pediu a conexão do WhatsApp e NÃO conseguiu"
// (`pairing_failed` em src/domain/admin/funnel.js). Medição de 2026-09-23
// (scripts/diag-funil-ativacao.mjs, 30 dias) achou 13 contas nesse balde — o
// único, dos oito motivos de parada, que é obstáculo NOSSO em vez de falta de
// interesse: leitura do QR, servidor sem vaga ou recusa do WhatsApp.
//
// "Pediu a conexão" e "conectou" são a MESMA definição usada pelo funil
// (src/domain/admin/funnel.js#classifyStallReason): tem linha de WaSession
// (pediu) e nunca teve AnalyticsEvent 'whatsapp_connected' nem
// WaSession.status='connected' (conectou). Duplicar essa regra aqui e ela
// discordar do painel/funil é o mesmo erro que o AGENTS.md já descreve para
// outros diagnósticos — por isso ela não é reimplementada, é a mesma consulta.
//
// O que este script acrescenta é o PORQUÊ: cruza `WaConnectionEvent` (código
// de fechamento do WhatsApp, tipo do evento) dessas contas. Isso cobre falha
// DEPOIS que o socket chegou a abrir (QR lido e caiu, 405/428/500, recusa,
// loop de reconexão). NÃO cobre a recusa no CLIQUE em conectar (teto de vagas
// do servidor — `WA_CAPACITY_LIMIT`/`WA_SESSION_MISPLACED`, ver
// "Limite de robôs" no AGENTS.md): essa é só logada em bot.log pela API
// (`req.log.error` em src/api/routes/session.js), nunca gravada em tabela —
// por isso o script sinaliza separadamente quem tem ZERO WaConnectionEvent
// apesar de ter WaSession, que é o padrão que aponta para esse caso.
//
// Nada é escrito. Só leitura.
//
// Uso (na VPS, DENTRO do diretório do ambiente):
//   cd ~/wabot && node scripts/diag-pareamento-falhou.mjs
//   cd ~/wabot && node scripts/diag-pareamento-falhou.mjs --dias 30
//   cd ~/wabot && node scripts/diag-pareamento-falhou.mjs --dias 30 --listar

import db from '../src/db.js'

const args = process.argv.slice(2)
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d
}
const dias = Number(flag('dias', '30'))
const listar = args.includes('--listar')
const desde = new Date(Date.now() - dias * 864e5)

async function main() {
  const usuarios = await db.user.findMany({
    where: { createdAt: { gte: desde } },
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!usuarios.length) {
    console.log('Nenhum cadastro no período. Tente --dias 90.')
    return
  }
  const ids = usuarios.map((u) => u.id)

  const [sessoes, conexoesOk] = await Promise.all([
    db.waSession.findMany({ where: { userId: { in: ids } }, select: { userId: true, status: true } }),
    db.analyticsEvent.findMany({
      where: { event: 'whatsapp_connected', userId: { in: ids } },
      select: { userId: true },
      distinct: ['userId'],
    }),
  ])

  const pediuConexao = new Set(sessoes.map((s) => s.userId))
  const jaConectou = new Set(conexoesOk.map((c) => c.userId))
  for (const s of sessoes) if (s.status === 'connected') jaConectou.add(s.userId)

  const falharam = usuarios.filter((u) => pediuConexao.has(u.id) && !jaConectou.has(u.id))

  console.log(`\n${'='.repeat(74)}`)
  console.log(`PEDIU CONEXÃO E NÃO CONSEGUIU — ${falharam.length} de ${usuarios.length} cadastros (${dias} dias)`)
  console.log('='.repeat(74))

  if (!falharam.length) {
    console.log('\nNenhuma conta neste balde no período. Nada a investigar aqui agora.')
    return
  }

  const eventos = await db.waConnectionEvent.findMany({
    where: { userId: { in: falharam.map((u) => u.id) } },
    select: { userId: true, type: true, code: true, occurredAt: true },
    orderBy: { occurredAt: 'asc' },
  })
  const eventosPorUsuario = new Map()
  for (const ev of eventos) {
    if (!eventosPorUsuario.has(ev.userId)) eventosPorUsuario.set(ev.userId, [])
    eventosPorUsuario.get(ev.userId).push(ev)
  }

  const semEventoNenhum = falharam.filter((u) => !eventosPorUsuario.has(u.id))
  const comEvento = falharam.filter((u) => eventosPorUsuario.has(u.id))

  // Placar por combinação (tipo + código), só de quem TEM histórico — é o
  // padrão técnico que se repete entre as contas, não o motivo de uma só.
  const placar = new Map()
  for (const u of comEvento) {
    for (const ev of eventosPorUsuario.get(u.id)) {
      const chave = `${ev.type}${ev.code ? `:${ev.code}` : ''}`
      placar.set(chave, (placar.get(chave) || 0) + 1)
    }
  }

  console.log(`\n  ${comEvento.length} tiveram algum evento de conexão registrado (socket chegou a abrir e caiu).`)
  console.log(`  ${semEventoNenhum.length} não têm NENHUM WaConnectionEvent — sessão criada e nada mais: padrão`)
  console.log('  de recusa no clique (teto de vagas do servidor ou conta fora do shard).')
  console.log('  Esse motivo só aparece no bot.log da API (req.log.error em session.js),')
  console.log('  nunca em tabela — confira lá, filtrando por "Não foi possível ligar o robô".')

  if (placar.size) {
    console.log('\n-- Padrão técnico entre quem TEM histórico (tipo:código, contagem de eventos) --\n')
    const linhas = [...placar.entries()].sort((a, b) => b[1] - a[1])
    for (const [chave, n] of linhas) console.log(`  ${String(n).padStart(4)}  ${chave}`)
  }

  if (listar) {
    console.log('\n-- Contas para falar (nome, e-mail, cadastro, último evento) --\n')
    for (const u of falharam) {
      const evs = eventosPorUsuario.get(u.id) || []
      const ultimo = evs[evs.length - 1]
      const resumo = ultimo ? `${ultimo.type}${ultimo.code ? `:${ultimo.code}` : ''} em ${ultimo.occurredAt.toISOString()}` : 'sem evento nenhum (recusa no clique?)'
      console.log(`  ${u.email.padEnd(38)} ${u.createdAt.toISOString().slice(0, 10)}  ${resumo}`)
    }
  } else {
    console.log('\n  Rode com --listar para pegar os e-mails e cruzar com o bot.log.')
  }
}

main()
  .catch((err) => {
    console.error('\nFalhou:', err?.message || err)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
