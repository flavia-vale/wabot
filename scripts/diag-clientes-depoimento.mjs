#!/usr/bin/env node
// Quem pedir depoimento? — read-only, roda no diretório do ambiente.
//
//   cd ~/wabot && node scripts/diag-clientes-depoimento.mjs
//   cd ~/wabot && node scripts/diag-clientes-depoimento.mjs --top=15
//
// Lista só clientes ATUAIS PAGANTES (pagamento aprovado > 0 e acesso ainda
// válido), sem reembolso, ordenados por uma nota simples de "provavelmente
// satisfeita + usa muito". A nota é um palpite para priorizar a conversa, não
// prova de satisfação: quem decide é a resposta da cliente.
//
// Nota = envios com sucesso nos últimos 30 dias (teto 40 pts) +
//        renovou (2+ pagamentos aprovados: 30 pts) +
//        antiguidade do 1º pagamento (até 15 pts, 1 pt a cada 4 dias) +
//        conexão estável (sem eventos de queda/reconexão nos últimos 30 dias: 15 pts; 1-3: 7 pts).
import 'dotenv/config'
import db from '../src/db.js'

const DIA = 24 * 60 * 60 * 1000
const agora = Date.now()
const desde30 = new Date(agora - 30 * DIA)
const argTop = process.argv.find(a => a.startsWith('--top='))
const top = Math.max(1, Number(argTop?.split('=')[1]) || 20)

function nota({ envios30, pagamentos, diasDePagante, quedas30 }) {
  const usoPts = Math.min(40, Math.round((envios30 / 500) * 40))
  const renovouPts = pagamentos >= 2 ? 30 : 0
  const antiguidadePts = Math.min(15, Math.floor(diasDePagante / 4))
  const estabilidadePts = quedas30 === 0 ? 15 : quedas30 <= 3 ? 7 : 0
  return usoPts + renovouPts + antiguidadePts + estabilidadePts
}

async function main() {
  const pagos = await db.payment.findMany({
    where: { status: 'approved', amount: { gt: 0 }, user: { accessExpiresAt: { gt: new Date() } } },
    select: { userId: true, createdAt: true },
  })
  const porUsuario = new Map()
  for (const p of pagos) {
    const atual = porUsuario.get(p.userId) || { pagamentos: 0, primeiro: p.createdAt }
    atual.pagamentos += 1
    if (p.createdAt < atual.primeiro) atual.primeiro = p.createdAt
    porUsuario.set(p.userId, atual)
  }

  const reembolsados = new Set(
    (await db.refund.findMany({ select: { userId: true } })).map(r => r.userId),
  )
  const ids = [...porUsuario.keys()].filter(id => !reembolsados.has(id))

  const usuarios = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, contactPhone: true, plan: true, accessExpiresAt: true },
  })
  const envios = await db.messageLog.groupBy({
    by: ['userId'],
    where: { userId: { in: ids }, status: 'success', sentAt: { gte: desde30 } },
    _count: { _all: true },
  })
  const quedas = await db.waConnectionEvent.groupBy({
    by: ['userId'],
    where: { userId: { in: ids }, occurredAt: { gte: desde30 } },
    _count: { _all: true },
  })
  const enviosPorId = new Map(envios.map(e => [e.userId, e._count._all]))
  const quedasPorId = new Map(quedas.map(q => [q.userId, q._count._all]))

  const linhas = usuarios.map(u => {
    const info = porUsuario.get(u.id)
    const envios30 = enviosPorId.get(u.id) || 0
    const quedas30 = quedasPorId.get(u.id) || 0
    const diasDePagante = Math.floor((agora - info.primeiro.getTime()) / DIA)
    return {
      nota: nota({ envios30, pagamentos: info.pagamentos, diasDePagante, quedas30 }),
      nome: u.name,
      whatsapp: u.contactPhone || '(sem número)',
      plano: u.plan,
      envios30,
      pagamentos: info.pagamentos,
      diasDePagante,
      quedas30,
    }
  })

  linhas.sort((a, b) => b.nota - a.nota || b.envios30 - a.envios30)
  console.log(`\nPagantes atuais sem reembolso: ${linhas.length} · mostrando os ${Math.min(top, linhas.length)} de maior nota\n`)
  console.table(linhas.slice(0, top))
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => db.$disconnect?.())
