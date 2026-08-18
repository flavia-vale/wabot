// Diagnóstico read-only do FUNIL DE ATIVAÇÃO: onde as pessoas param entre
// criar a conta e pagar.
//
// Contexto (2026-08): o diag de origem mostrou 62 cadastros em 90 dias e
// apenas 3 pagantes (5%). O gargalo não é atrair — é converter. Este script
// responde a pergunta que falta: DOS QUE NÃO PAGARAM, ATÉ ONDE CHEGARAM?
//
// Mede o estado REAL nas tabelas, não o evento de analytics. Motivo: evento
// pode faltar (foi adicionado depois, falhou em vôo, o usuário bloqueou o
// script). A tabela é o que aconteceu de fato. Onde o evento ajuda, ele entra
// como complemento, nunca como fonte única.
//
// Etapas, na ordem em que o produto exige:
//
//   1. cadastrou            User
//   2. conectou o WhatsApp  WaSession.status = connected (ou já esteve)
//   3. cadastrou credencial Credential (etiqueta de afiliada de alguma loja)
//   4. configurou origem    Group role=monitor
//   5. configurou destino   Group role=post
//   6. enviou alguma coisa  MessageLog
//   7. iniciou checkout     AnalyticsEvent 'checkout_started'
//   8. pagou                Payment status=approved
//
// Nada é escrito. Só leitura.
//
// Uso (na VPS, DENTRO do diretório do ambiente):
//   cd ~/wabot && node scripts/diag-funil-ativacao.mjs
//   cd ~/wabot && node scripts/diag-funil-ativacao.mjs --dias 30
//   cd ~/wabot && node scripts/diag-funil-ativacao.mjs --listar   (quem parou onde)

import db from '../src/db.js'

const args = process.argv.slice(2)
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d
}
const dias = Number(flag('dias', '90'))
const listar = args.includes('--listar')
const desde = new Date(Date.now() - dias * 864e5)

const pct = (n, t) => (t ? `${((n / t) * 100).toFixed(0)}%` : '0%')

async function main() {
  const usuarios = await db.user.findMany({
    where: { createdAt: { gte: desde } },
    select: { id: true, email: true, name: true, plan: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!usuarios.length) {
    console.log('Nenhum cadastro no período. Tente --dias 180.')
    return
  }

  const ids = usuarios.map((u) => u.id)
  const total = usuarios.length

  // Estado real, uma consulta por etapa. `distinct` no userId para contar
  // PESSOAS, não linhas — um usuário com 40 envios conta uma vez.
  const [sessoes, credenciais, grupos, envios, checkouts, pagamentos] = await Promise.all([
    db.waSession.findMany({ where: { userId: { in: ids } }, select: { userId: true, status: true } }),
    db.credential.findMany({ where: { userId: { in: ids } }, select: { userId: true, platform: true }, distinct: ['userId'] }),
    db.group.findMany({ where: { userId: { in: ids } }, select: { userId: true, role: true } }),
    db.messageLog.findMany({ where: { userId: { in: ids } }, select: { userId: true }, distinct: ['userId'] }),
    db.analyticsEvent.findMany({ where: { event: 'checkout_started', userId: { in: ids } }, select: { userId: true }, distinct: ['userId'] }),
    db.payment.findMany({ where: { userId: { in: ids }, status: 'approved' }, select: { userId: true } }),
  ])

  const comSessao = new Set(sessoes.map((s) => s.userId))
  const conectadoAgora = new Set(sessoes.filter((s) => s.status === 'connected').map((s) => s.userId))
  const comCredencial = new Set(credenciais.map((c) => c.userId))
  const comMonitor = new Set(grupos.filter((g) => g.role === 'monitor').map((g) => g.userId))
  const comDestino = new Set(grupos.filter((g) => g.role === 'post').map((g) => g.userId))
  const comEnvio = new Set(envios.map((m) => m.userId))
  const comCheckout = new Set(checkouts.map((c) => c.userId))
  const pagantes = new Set(pagamentos.map((p) => p.userId))

  const etapas = [
    ['1. Criou a conta', new Set(ids)],
    ['2. Chegou a parear o WhatsApp', comSessao],
    ['3. Cadastrou credencial de loja', comCredencial],
    ['4. Configurou grupo de ORIGEM', comMonitor],
    ['5. Configurou grupo de DESTINO', comDestino],
    ['6. Teve algum envio registrado', comEnvio],
    ['7. Iniciou o checkout', comCheckout],
    ['8. PAGOU', pagantes],
  ]

  console.log(`\n${'='.repeat(74)}`)
  console.log(`FUNIL DE ATIVAÇÃO — ${total} cadastros nos últimos ${dias} dias`)
  console.log('='.repeat(74))
  console.log('\n  etapa                                   pessoas    % do topo   perda')
  console.log('  --------------------------------------  -------    ---------   -----')

  // Calcula todas as perdas ANTES de imprimir para marcar só a MAIOR. Marcar
  // toda queda acima de um limiar dilui o sinal: com três marcas na tela,
  // ninguém sabe por onde começar.
  const perdas = []
  let anterior = total
  for (const [, conjunto] of etapas) {
    perdas.push(anterior - conjunto.size)
    anterior = conjunto.size
  }
  const maiorPerda = Math.max(...perdas)
  const idxMaior = perdas.indexOf(maiorPerda)

  etapas.forEach(([nome, conjunto], i) => {
    const n = conjunto.size
    const perda = perdas[i]
    const marca = i === idxMaior && maiorPerda > 0 ? '  <== MAIOR QUEDA' : ''
    // Delta NEGATIVO significa que a etapa tem MAIS gente que a anterior — ou
    // seja, as etapas não são uma sequência obrigatória (dá para configurar
    // grupo sem ter salvado credencial). Mostrar "—" nesse caso escondia o
    // fato e fazia o funil parecer mais linear do que é.
    const delta = perda > 0 ? `-${perda}` : perda < 0 ? `+${-perda}` : '—'
    console.log(
      `  ${nome.padEnd(38)}  ${String(n).padStart(5)}    ${pct(n, total).padStart(7)}   ${delta.padStart(4)}${marca}`
    )
  })

  if (perdas.some((p) => p < 0)) {
    console.log(`
  Nota: onde aparece "+", a etapa tem MAIS gente que a anterior. As etapas não
  são uma sequência obrigatória — dá para configurar grupo sem ter salvado
  credencial, por exemplo. Leia cada linha como "quantos chegaram até aqui",
  não como "quantos passaram pela linha de cima".`)
  }

  console.log(`\n  Conectados AGORA (sessão viva): ${conectadoAgora.size}`)

  // ------------------------------------------------------- onde pararam ---
  console.log(`\n${'='.repeat(74)}`)
  console.log('ONDE PARARAM OS QUE NÃO PAGARAM')
  console.log('='.repeat(74) + '\n')

  const parou = new Map()
  const exemplos = new Map()
  for (const u of usuarios) {
    if (pagantes.has(u.id)) continue
    let rotulo
    if (!comSessao.has(u.id)) rotulo = 'nunca tentou parear o WhatsApp'
    else if (!comCredencial.has(u.id)) rotulo = 'pareou, mas não cadastrou credencial'
    else if (!comMonitor.has(u.id)) rotulo = 'tem credencial, sem grupo de ORIGEM'
    else if (!comDestino.has(u.id)) rotulo = 'tem origem, sem grupo de DESTINO'
    else if (!comEnvio.has(u.id)) rotulo = 'configurou tudo, nunca enviou'
    else if (!comCheckout.has(u.id)) rotulo = 'ENVIOU e não foi para o checkout'
    else rotulo = 'foi ao checkout e não pagou'

    parou.set(rotulo, (parou.get(rotulo) || 0) + 1)
    if (!exemplos.has(rotulo)) exemplos.set(rotulo, [])
    if (exemplos.get(rotulo).length < 5) exemplos.get(rotulo).push(u)
  }

  const naoPagaram = total - pagantes.size
  for (const [rotulo, n] of [...parou.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  (${pct(n, naoPagaram).padStart(4)})  ${rotulo}`)
  }

  console.log(`\n  Total que não pagou: ${naoPagaram} de ${total}`)

  if (listar) {
    console.log(`\n${'='.repeat(74)}`)
    console.log('EXEMPLOS POR ETAPA (até 5 de cada) — para conversar com eles')
    console.log('='.repeat(74))
    for (const [rotulo, lista] of exemplos) {
      console.log(`\n-- ${rotulo}`)
      for (const u of lista) {
        console.log(`   ${new Date(u.createdAt).toISOString().slice(0, 10)}  ${u.email}  (${u.name})`)
      }
    }
  }

  // ------------------------------------------------------------ leitura ---
  const semPareamento = parou.get('nunca tentou parear o WhatsApp') || 0
  const enviouNaoPagou = parou.get('ENVIOU e não foi para o checkout') || 0

  console.log(`\n${'='.repeat(74)}`)
  console.log('COMO LER')
  console.log('='.repeat(74))
  console.log(`
  A etapa marcada com "MAIOR QUEDA" é onde o produto está perdendo mais gente.

  Duas leituras mudam a ação:

  * Muita gente parando ANTES de parear o WhatsApp (${semPareamento} aqui) é
    problema de ONBOARDING ou de expectativa: a pessoa criou conta e não
    entendeu o que fazer, ou não estava pronta para conectar um número.
    Se conserta com produto e comunicação, não com mais tráfego.

  * Gente que ENVIOU e mesmo assim não pagou (${enviouNaoPagou} aqui) é o grupo
    mais valioso para conversar: ela viu o produto funcionar e mesmo assim
    não comprou. O motivo dela vale mais que qualquer pesquisa de mercado.

  Rode com --listar para pegar os e-mails e falar com eles.
  `)
}

main()
  .catch((err) => {
    console.error('\nFalhou:', err?.message || err)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
