#!/usr/bin/env node
// Aponta TODOS os grupos monitorados de uma cliente para o MESMO modelo de
// mensagem, e deixa esse modelo como padrão da conta (grupo novo já nasce
// usando ele).
//
// Existe porque o modelo é escolhido grupo a grupo: quem tem 3 grupos
// monitorados pode ter 3 comportamentos diferentes sem perceber, e grupo sem
// modelo espelha o texto original — o que de fora parece "o template não
// funciona".
//
// Read-only por padrão: sem `--aplicar` ele só MOSTRA o que mudaria.
//
//   node scripts/apontar-grupos-para-template.mjs <email|telefone> --modelo=<chave>
//   node scripts/apontar-grupos-para-template.mjs <email|telefone> --modelo=<chave> --aplicar
//
// `--sem-padrao` muda só os grupos de hoje e não mexe no padrão da conta.
//
// O worker relê a config sozinho em até 60s (CONFIG_CACHE_TTL_MS) — NÃO
// precisa reiniciar nada, nem o bot-supervisor.
import 'dotenv/config'
import db from '../src/db.js'
import { composeTemplates } from '../dashboard/lib/mobileTemplateStore.js'

const args = process.argv.slice(2)
const alvo = args.find((a) => !a.startsWith('--')) || ''
const aplicar = args.includes('--aplicar')
const semPadrao = args.includes('--sem-padrao')
const modeloArg = args.find((a) => a.startsWith('--modelo='))
const modelo = modeloArg ? modeloArg.slice('--modelo='.length).trim() : ''

if (!alvo || !modelo) {
  console.error('uso: node scripts/apontar-grupos-para-template.mjs <email|telefone> --modelo=<chave> [--sem-padrao] [--aplicar]')
  process.exit(1)
}

const soDigitos = (v) => String(v || '').replace(/\D/g, '')
const digitosAlvo = soDigitos(alvo)

function parseStore(json) {
  try {
    const raw = JSON.parse(json || '{}')
    return {
      overrides: raw && typeof raw.overrides === 'object' && raw.overrides ? { ...raw.overrides } : {},
      custom: Array.isArray(raw?.custom) ? raw.custom.filter((t) => t && t.key) : [],
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
    console.error('Essa conta não tem configuração do robô (BotConfig).')
    process.exit(2)
  }

  // Apontar para modelo que não existe faz o robô cair no texto original EM
  // SILÊNCIO — é o modo de falha que mais parece "o template não funciona".
  const resolvido = composeTemplates(parseStore(config.mobileTemplatesJson)).find((t) => t.key === modelo)
  if (!resolvido?.body) {
    console.error(`O modelo "${modelo}" não existe nessa conta. Modelos disponíveis:`)
    composeTemplates(parseStore(config.mobileTemplatesJson)).forEach((t) => console.error(`  - ${t.key} (${t.name})`))
    process.exit(2)
  }

  const monitores = await db.group.findMany({
    where: { userId: user.id, role: 'monitor' },
    select: { id: true, name: true, templateKey: true },
  })
  console.log(`[2] Grupos monitorados: ${monitores.length}`)
  monitores.forEach((g) => {
    const atual = g.templateKey || '(herda o padrão)'
    console.log(`    - ${g.name} | de "${atual}" para "${modelo}"${(g.templateKey || '') === modelo ? ' (já está)' : ''}`)
  })
  console.log(`[3] Padrão da conta: "${config.mirrorTemplateKeyDefault || '(nenhum)'}" -> ${semPadrao ? '(não vai mexer)' : `"${modelo}"`}`)

  console.log('\n--- texto que os grupos vão passar a usar ---')
  console.log(resolvido.body)
  console.log('--- fim ---\n')

  if (!aplicar) {
    console.log('Nada foi gravado (modo de leitura). Rode de novo com --aplicar para valer.')
    return
  }

  const r = await db.group.updateMany({ where: { userId: user.id, role: 'monitor' }, data: { templateKey: modelo } })
  if (!semPadrao) {
    await db.botConfig.update({ where: { userId: user.id }, data: { mirrorTemplateKeyDefault: modelo } })
  }

  const depoisGrupos = await db.group.findMany({
    where: { userId: user.id, role: 'monitor' },
    select: { name: true, templateKey: true },
  })
  const depoisConfig = await db.botConfig.findUnique({ where: { userId: user.id } })
  console.log(`[4] Gravado (${r.count} grupo(s)). Como está agora:`)
  depoisGrupos.forEach((g) => console.log(`    - ${g.name} | modelo=${g.templateKey || '(herda o padrão)'}`))
  console.log(`    Padrão da conta: ${depoisConfig?.mirrorTemplateKeyDefault || '(nenhum)'}`)
  console.log('\nVale nas próximas ofertas (o robô relê a configuração em até 1 minuto). Não precisa reiniciar nada.')
}

main()
  .catch((err) => { console.error('Falhou:', err?.message || err); process.exitCode = 1 })
  .finally(() => db.$disconnect())
