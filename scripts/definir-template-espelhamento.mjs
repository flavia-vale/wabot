#!/usr/bin/env node
// Troca, NA MÃO, o texto do template de espelhamento de UMA cliente.
//
// Existe porque a edição pelo painel depende da cliente achar a tela certa
// (Modelos de mensagem) E de o modelo editado ser o mesmo que os grupos
// monitorados dela estão usando — duas coisas que já confundiram na prática.
//
// Read-only por padrão: sem `--aplicar` ele só MOSTRA o que mudaria.
//
//   node scripts/definir-template-espelhamento.mjs <email|telefone> --corpo=<arquivo.txt>
//   node scripts/definir-template-espelhamento.mjs <email|telefone> --corpo=<arquivo.txt> --aplicar
//
// O worker relê a config sozinho em até 60s (CONFIG_CACHE_TTL_MS) — NÃO
// precisa reiniciar nada, nem o bot-supervisor.
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { db } from '../src/db.js'
import { canonicalizeTemplateBody } from '../src/core/templateVariables.js'
import { composeTemplates } from '../dashboard/lib/mobileTemplateStore.js'

const args = process.argv.slice(2)
const alvo = args.find((a) => !a.startsWith('--')) || ''
const aplicar = args.includes('--aplicar')
const corpoArg = args.find((a) => a.startsWith('--corpo='))
const nomeArg = args.find((a) => a.startsWith('--nome='))
const nomeModelo = nomeArg ? nomeArg.slice('--nome='.length) : 'Modelo da cliente'

if (!alvo || !corpoArg) {
  console.error('uso: node scripts/definir-template-espelhamento.mjs <email|telefone> --corpo=<arquivo.txt> [--nome="..."] [--aplicar]')
  process.exit(1)
}

const corpo = canonicalizeTemplateBody(readFileSync(corpoArg.slice('--corpo='.length), 'utf8').replace(/\s+$/, ''))
if (!corpo.trim()) {
  console.error('O arquivo do texto está vazio.')
  process.exit(1)
}

const soDigitos = (v) => String(v || '').replace(/\D/g, '')
const digitosAlvo = soDigitos(alvo)

function parseStore(json) {
  try {
    const raw = JSON.parse(json || '{}')
    return {
      overrides: raw && typeof raw.overrides === 'object' && raw.overrides ? { ...raw.overrides } : {},
      custom: Array.isArray(raw?.custom) ? raw.custom.filter((t) => t && t.key).map((t) => ({ ...t })) : [],
    }
  } catch {
    return { overrides: {}, custom: [] }
  }
}

async function main() {
  const users = await db.user.findMany({
    where: alvo.includes('@')
      ? { email: alvo.trim() }
      : (digitosAlvo ? { contactPhone: { contains: digitosAlvo.slice(-8) } } : { email: alvo.trim() }),
    select: { id: true, name: true, email: true, contactPhone: true },
  })
  if (!users.length) {
    console.error(`Nenhuma conta encontrada para "${alvo}".`)
    process.exit(2)
  }
  if (users.length > 1) {
    console.error('Mais de uma conta bate com esse dado — rode de novo usando o e-mail exato:')
    users.forEach((u) => console.error(`  - ${u.email} (${u.contactPhone || 'sem telefone'})`))
    process.exit(2)
  }
  const user = users[0]
  console.log(`[1] Conta: ${user.name} <${user.email}> ${user.contactPhone || ''}`)

  const config = await db.botConfig.findUnique({ where: { userId: user.id } })
  if (!config) {
    console.error('Essa conta não tem configuração do robô (BotConfig). Peça para ela abrir o painel uma vez antes.')
    process.exit(2)
  }

  const monitores = await db.group.findMany({
    where: { userId: user.id, role: 'monitor' },
    select: { id: true, name: true, waJid: true, templateKey: true, forwardMode: true },
  })
  console.log(`[2] Grupos monitorados: ${monitores.length}`)
  monitores.forEach((g) => console.log(`    - ${g.name} | modelo=${g.templateKey || '(herda o padrão)'} | envio=${g.forwardMode}`))
  console.log(`    Modelo padrão da conta: ${config.mirrorTemplateKeyDefault || '(nenhum — espelha o texto original)'}`)

  const store = parseStore(config.mobileTemplatesJson)
  const emUso = [...new Set([
    ...monitores.map((g) => (g.templateKey || '').trim()).filter(Boolean),
    (config.mirrorTemplateKeyDefault || '').trim(),
  ].filter(Boolean))]

  // Se ela já usa UM modelo só, reescrevemos o texto DELE — assim nada mais na
  // conta muda de lugar. Se usa vários (ou nenhum), criamos um modelo próprio e
  // apontamos tudo para ele.
  let chave = emUso.length === 1 ? emUso[0] : ''
  let proximo = { overrides: { ...store.overrides }, custom: store.custom.map((t) => ({ ...t })) }
  let criou = false

  if (chave) {
    const custom = proximo.custom.find((t) => t.key === chave)
    if (custom) custom.body = corpo
    else proximo.overrides[chave] = corpo
    console.log(`[3] Vai reescrever o texto do modelo "${chave}" (o que ela já usa).`)
  } else {
    chave = `tpl_${Date.now()}`
    proximo.custom.push({ key: chave, name: nomeModelo, body: corpo })
    criou = true
    console.log(`[3] Ela usa ${emUso.length === 0 ? 'nenhum modelo' : 'mais de um modelo'} — vai criar o modelo "${nomeModelo}" e apontar os grupos monitorados para ele.`)
  }

  console.log('\n--- texto novo ---')
  console.log(corpo)
  console.log('--- fim ---\n')

  if (!aplicar) {
    console.log('Nada foi gravado (modo de leitura). Rode de novo com --aplicar para valer.')
    return
  }

  await db.botConfig.update({
    where: { userId: user.id },
    data: {
      mobileTemplatesJson: JSON.stringify(proximo),
      ...(criou ? { mirrorTemplateKeyDefault: chave } : {}),
    },
  })
  if (criou && monitores.length) {
    await db.group.updateMany({ where: { userId: user.id, role: 'monitor' }, data: { templateKey: chave } })
  }

  // Confere lendo de volta pelo MESMO caminho que o robô usa.
  const depois = await db.botConfig.findUnique({ where: { userId: user.id } })
  const resolvido = composeTemplates(parseStore(depois.mobileTemplatesJson)).find((t) => t.key === chave)
  console.log(`[4] Gravado. O robô agora lê para "${chave}":\n`)
  console.log(resolvido?.body || '(NÃO ENCONTRADO — confira antes de dar por certo)')
  console.log('\nA mudança vale nas próximas ofertas (o robô relê a configuração em até 1 minuto). Não precisa reiniciar nada.')
}

main()
  .catch((err) => { console.error('Falhou:', err?.message || err); process.exitCode = 1 })
  .finally(() => db.$disconnect())
