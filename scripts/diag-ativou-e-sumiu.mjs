// Lista (read-only) quem ATIVOU E SUMIU: teve envio real (MessageLog success),
// nunca pagou e hoje não está com o WhatsApp conectado. É a lista da conversa
// "o que faltou?" (docs/marketing/PENDENCIAS_UNIFICADAS_2026-09-28.md).
//
// Uso (na VPS, dentro do diretório do ambiente):
//   cd ~/wabot && node scripts/diag-ativou-e-sumiu.mjs
//   cd ~/wabot && node scripts/diag-ativou-e-sumiu.mjs --csv > ativou-e-sumiu.csv
import db from '../src/db.js'

const csv = process.argv.includes('--csv')

const MENSAGEM = (nome) =>
  `Oi, ${nome}! Aqui é a Flavia, do Espelha Grupos. Vi que o robô chegou a publicar ofertas para você e depois parou. Posso te fazer uma pergunta rápida? O que faltou para você continuar usando?`

const soDigitos = (v) => String(v || '').replace(/\D/g, '')
const comDdi = (v) => {
  const d = soDigitos(v)
  return d && !d.startsWith('55') && d.length <= 11 ? `55${d}` : d
}
const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0] || 'tudo bem'

async function main() {
  const envios = await db.messageLog.findMany({
    where: { status: 'success' },
    select: { userId: true },
    distinct: ['userId'],
  })
  const ids = envios.map((e) => e.userId)
  const [pagos, conectados] = await Promise.all([
    db.payment.findMany({ where: { userId: { in: ids }, status: 'approved' }, select: { userId: true }, distinct: ['userId'] }),
    db.waSession.findMany({ where: { userId: { in: ids }, status: 'connected' }, select: { userId: true } }),
  ])
  const excluir = new Set([...pagos.map((p) => p.userId), ...conectados.map((c) => c.userId)])
  const alvo = ids.filter((id) => !excluir.has(id))

  const users = await db.user.findMany({
    where: { id: { in: alvo } },
    select: { name: true, email: true, contactPhone: true, createdAt: true, waSession: { select: { phone: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const linhas = users.map((u) => {
    const fone = comDdi(u.waSession?.phone || u.contactPhone)
    const msg = MENSAGEM(primeiroNome(u.name))
    return {
      nome: u.name,
      telefone: fone,
      email: u.email,
      link: fone ? `https://wa.me/${fone}?text=${encodeURIComponent(msg)}` : '',
    }
  })

  if (csv) {
    const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`
    console.log('nome,telefone,email,link_whatsapp')
    for (const l of linhas) console.log([l.nome, l.telefone, l.email, l.link].map(q).join(','))
    return
  }
  console.log(`Ativou e sumiu: ${linhas.length} pessoas (${linhas.filter((l) => !l.telefone).length} sem telefone)\n`)
  for (const l of linhas) console.log(`${l.nome} | ${l.telefone || 'SEM TELEFONE'} | ${l.email}`)
  console.log(`\nMENSAGEM-MODELO:\n${MENSAGEM('<nome>')}`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect?.())
