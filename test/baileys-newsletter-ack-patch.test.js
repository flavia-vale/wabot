import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'

// RCA 2026-09-24 — quedas 500 crônicas (~600/dia há ≥10 dias, 85% com
// `stuckMsg:true`). Medido no bot.log de produção: dos 344 `stream:error` com
// `<ack>`, 223 (65%) eram de CANAL (@newsletter), e o mesmo id voltava em
// cadeia a cada reconexão. Causa: o Baileys 6.7.x confirma mensagem de canal
// com `<receipt to=...@newsletter>`; o servidor recusa com `<stream:error>`
// carregando o `<ack>` que esperava → 500 → reconexão → reentrega → repete.
// O 7.x corrigiu (commit f46e8b1, nov/2025): canal recebe `<ack>`, nunca
// `<receipt>`. A linha 6.7 nunca recebeu o conserto (6.7.24 == 6.7.23).
//
// O conserto é um patch no pacote instalado (patch-package, `postinstall`).
// Estes testes garantem que ele está APLICADO no node_modules em uso — sem
// isso, um `npm ci` que pulasse o postinstall devolveria o bug em silêncio
// para a frota inteira.

const require = createRequire(import.meta.url)
const pkg = require('@whiskeysockets/baileys/package.json')
const recvPath = require.resolve('@whiskeysockets/baileys/lib/Socket/messages-recv.js')
const recv = readFileSync(recvPath, 'utf8')
const rootPkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const patches = readdirSync(new URL('../patches', import.meta.url))

test('o patch existe para EXATAMENTE a versão instalada do Baileys', () => {
  const esperado = `@whiskeysockets+baileys+${pkg.version}.patch`
  assert.ok(patches.includes(esperado), `faltou patches/${esperado} — ao subir o Baileys, refaça o patch (ou confirme que a versão nova já confirma canal com <ack>)`)
})

test('o Baileys instalado confirma mensagem de CANAL com <ack>, nunca com <receipt>', () => {
  assert.match(recv, /import \{[^}]*\bisJidNewsletter\b[^}]*\} from '\.\.\/WABinary\/index\.js'/)
  const branch = recv.match(/else if \(isJidNewsletter\(msg\.key\.remoteJid\)\) \{[\s\S]*?\n\s*\}\n\s*else \{/)
  assert.ok(branch, 'patch não aplicado: falta o ramo de canal em handleMessage (rode `npx patch-package`)')
  assert.match(branch[0], /await sendMessageAck\(node\);/)
  assert.doesNotMatch(branch[0], /sendReceipt\(/, 'canal não pode receber <receipt>')
  // O ramo de canal precisa vir ANTES do ramo genérico que manda <receipt>.
  const idxCanal = recv.indexOf('else if (isJidNewsletter(msg.key.remoteJid))')
  const idxReceipt = recv.indexOf('await sendReceipt(msg.key.remoteJid, participant, [msg.key.id], type);')
  assert.ok(idxCanal > 0 && idxReceipt > idxCanal)
})

test('o patch é aplicado em todo install (postinstall) e reinicia o supervisor no deploy', () => {
  assert.match(rootPkg.scripts.postinstall, /^patch-package && /, 'postinstall precisa rodar patch-package ANTES do prisma generate')
  assert.ok(rootPkg.devDependencies?.['patch-package'], 'patch-package precisa estar nas devDependencies')
  for (const script of ['scripts/deploy_safe_staging.sh', 'scripts/deploy_safe_dashboard.sh']) {
    const source = readFileSync(new URL(`../${script}`, import.meta.url), 'utf8')
    const re = source.match(/^WORKER_CODE_PATHS_RE='(.+)'$/m)
    assert.ok(re, `${script}: WORKER_CODE_PATHS_RE não encontrado`)
    assert.ok(new RegExp(re[1]).test('patches/@whiskeysockets+baileys+6.7.23.patch'), `${script}: mudar um patch do Baileys precisa reiniciar o bot-supervisor, senão o conserto fica dormente nos robôs`)
  }
})
