// Quem conectou o WhatsApp e NUNCA cadastrou etiqueta de afiliada de loja
// nenhuma — com telefone, para falar por WhatsApp.
//
// Por que esse grupo importa: sem etiqueta cadastrada o robô se RECUSA a
// publicar (`skip:no_valid_conversions`, `src/bot-worker.js`), para não dar a
// comissão da venda ao afiliado do grupo de origem. Do lado de fora isso
// parece "o robô não funciona" — a pessoa fez a parte difícil (parear o
// WhatsApp), acha que testou o produto, e nunca viu uma oferta sair.
//
// Medido em 2026-08: 22 pessoas nesse estado, 32% de quem não pagou. É a maior
// caixa isolada do funil de ativação.
//
// ATENÇÃO — a saída tem DADO PESSOAL (nome, telefone, e-mail) de cliente.
// Não colar em chat público, issue, print ou qualquer lugar fora do seu
// controle. Nada é escrito: só leitura.
//
// Uso (na VPS, DENTRO do diretório do ambiente):
//   cd ~/wabot && node scripts/diag-sem-etiqueta.mjs
//   cd ~/wabot && node scripts/diag-sem-etiqueta.mjs --dias 180
//   cd ~/wabot && node scripts/diag-sem-etiqueta.mjs --so-com-telefone
//   cd ~/wabot && node scripts/diag-sem-etiqueta.mjs --csv > /tmp/sem-etiqueta.csv

import db from '../src/db.js'

const args = process.argv.slice(2)
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d
}
const dias = Number(flag('dias', '120'))
const soComTelefone = args.includes('--so-com-telefone')
const csv = args.includes('--csv')
const desde = new Date(Date.now() - dias * 864e5)

// O telefone é gravado como veio do cadastro. Para abrir conversa no WhatsApp
// o link precisa de dígitos com DDI. Sem DDI e com cara de número brasileiro
// (10 ou 11 dígitos), assume 55 — é o único DDI que faz sentido aqui, e o link
// errado é visível na hora, não silencioso.
function linkWhatsApp(telefone) {
  const digitos = String(telefone || '').replace(/\D/g, '')
  if (!digitos) return null
  const comDdi = digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos
  if (comDdi.length < 12 || comDdi.length > 15) return null
  return `https://wa.me/${comDdi}`
}

function diasDesde(data) {
  return Math.floor((Date.now() - new Date(data).getTime()) / 864e5)
}

async function main() {
  const usuarios = await db.user.findMany({
    where: { createdAt: { gte: desde } },
    select: { id: true, name: true, email: true, contactPhone: true, createdAt: true, status: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!usuarios.length) {
    console.log('Nenhum cadastro no período. Tente --dias 365.')
    return
  }

  const ids = usuarios.map((u) => u.id)

  const [sessoes, credenciais, pagamentos] = await Promise.all([
    db.waSession.findMany({ where: { userId: { in: ids } }, select: { userId: true }, distinct: ['userId'] }),
    db.credential.findMany({ where: { userId: { in: ids } }, select: { userId: true }, distinct: ['userId'] }),
    db.payment.findMany({ where: { userId: { in: ids }, status: 'approved' }, select: { userId: true }, distinct: ['userId'] }),
  ])

  const pareou = new Set(sessoes.map((s) => s.userId))
  const temEtiqueta = new Set(credenciais.map((c) => c.userId))
  const pagou = new Set(pagamentos.map((p) => p.userId))

  // O recorte: fez a parte difícil (pareou) e parou antes da etiqueta.
  // Pagante fica de fora — se paga e não tem etiqueta é outro assunto, e a
  // conversa com quem já é cliente não é esta.
  const alvo = usuarios.filter(
    (u) => pareou.has(u.id) && !temEtiqueta.has(u.id) && !pagou.has(u.id) && u.status !== 'banned'
  )

  const comTelefone = alvo.filter((u) => linkWhatsApp(u.contactPhone))
  const lista = soComTelefone ? comTelefone : alvo

  if (csv) {
    console.log('nome,telefone,link_whatsapp,email,dias_desde_cadastro')
    for (const u of lista) {
      const campos = [
        u.name || '',
        u.contactPhone || '',
        linkWhatsApp(u.contactPhone) || '',
        u.email || '',
        diasDesde(u.createdAt),
      ]
      console.log(campos.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    }
    return
  }

  console.log(`\n${'='.repeat(78)}`)
  console.log(`CONECTOU O WHATSAPP E NUNCA CADASTROU ETIQUETA — últimos ${dias} dias`)
  console.log('='.repeat(78))
  console.log(`\n  Cadastros no período .................. ${usuarios.length}`)
  console.log(`  Chegaram a parear o WhatsApp ......... ${pareou.size}`)
  console.log(`  Desses, cadastraram etiqueta ......... ${[...pareou].filter((id) => temEtiqueta.has(id)).length}`)
  console.log(`  >>> PARARAM NA ETIQUETA (não pagantes) ${alvo.length}`)
  console.log(`  Com telefone utilizável .............. ${comTelefone.length}`)

  if (!lista.length) {
    console.log('\n  Ninguém nesse estado no período. Boa notícia.\n')
    return
  }

  console.log(`\n${'-'.repeat(78)}`)
  console.log('  ⚠  DADO PESSOAL DE CLIENTE — não colar fora do seu controle')
  console.log('-'.repeat(78) + '\n')

  for (const u of lista) {
    const link = linkWhatsApp(u.contactPhone)
    console.log(`  ${u.name || '(sem nome)'}`)
    console.log(`    telefone : ${u.contactPhone || '— não cadastrou —'}`)
    if (link) console.log(`    whatsapp : ${link}`)
    console.log(`    e-mail   : ${u.email}`)
    console.log(`    cadastrou: há ${diasDesde(u.createdAt)} dias`)
    console.log('')
  }

  const semTelefone = alvo.length - comTelefone.length
  console.log('-'.repeat(78))
  if (semTelefone > 0) {
    console.log(`\n  ${semTelefone} pessoa(s) sem telefone utilizável — para essas, só e-mail.`)
    console.log('  Use o e-mail "Seu robô está pronto, falta só a etiqueta da loja"')
    console.log('  na aba E-mails do painel admin.')
  }
  console.log(`
  Antes de escrever, lembre do que essa pessoa está vendo: ela conectou o
  WhatsApp, achou que tinha terminado, e nenhuma oferta saiu. Para ela o
  produto não funciona. Ela não sabe que o robô está segurando a publicação
  de propósito, para não entregar a comissão dela para outra pessoa.
`)
}

main()
  .catch((err) => {
    console.error('\nFalhou:', err?.message || err)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
