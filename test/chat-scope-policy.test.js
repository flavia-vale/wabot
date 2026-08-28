import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CHAT_SCOPE_MODES,
  CHAT_JID_TYPES,
  normalizeChatScopeMode,
  classifyChatJid,
  buildAllowedJidSet,
  shouldIgnoreByChatScope,
  shouldAutoDisableChatScope,
} from '../src/core/chatScopePolicy.js'

const MONITORADO = '120363402840158007@g.us'
const DESTINO = '120363419653295051@g.us'
const CANAL_BOTAO = '120363284081143328@newsletter'
const GRUPO_ALHEIO = '120363429986896955@g.us'
const CANAL_ALHEIO = '120363111111111111@newsletter'
const DM_LID = '207009538424894@lid'
const DM_NUM = '556792286325@s.whatsapp.net'
const EU = '553175258050@s.whatsapp.net'

const allowed = buildAllowedJidSet([MONITORADO, DESTINO, CANAL_BOTAO])
const selfJids = buildAllowedJidSet([EU, '3595575529613@lid'])

function decide(jid, overrides = {}) {
  return shouldIgnoreByChatScope(jid, { mode: CHAT_SCOPE_MODES.DM, allowedJids: allowed, ready: true, selfJids, ...overrides })
}

test('classifica os tipos de endereço', () => {
  assert.equal(classifyChatJid(MONITORADO), CHAT_JID_TYPES.GROUP)
  assert.equal(classifyChatJid(CANAL_ALHEIO), CHAT_JID_TYPES.NEWSLETTER)
  assert.equal(classifyChatJid(DM_LID), CHAT_JID_TYPES.DM)
  assert.equal(classifyChatJid(DM_NUM), CHAT_JID_TYPES.DM)
  assert.equal(classifyChatJid('status@broadcast'), CHAT_JID_TYPES.STATUS)
  assert.equal(classifyChatJid('coisa-nova@sei-la'), CHAT_JID_TYPES.UNKNOWN)
})

test('sufixo de aparelho não atrapalha o casamento com a lista', () => {
  assert.equal(decide('120363402840158007:12@g.us', { mode: CHAT_SCOPE_MODES.DM_GROUP }).ignore, false)
})

test('modo desconhecido cai em desligado (não filtra mais do que pediram)', () => {
  assert.equal(normalizeChatScopeMode('agressivo'), CHAT_SCOPE_MODES.OFF)
  assert.equal(normalizeChatScopeMode(undefined), CHAT_SCOPE_MODES.OFF)
  assert.equal(normalizeChatScopeMode('DM'), CHAT_SCOPE_MODES.DM)
})

test('modo dm: ignora conversa direta de fora e NÃO toca em grupo nem canal', () => {
  assert.equal(decide(DM_LID).ignore, true)
  assert.equal(decide(DM_NUM).ignore, true)
  assert.equal(decide(GRUPO_ALHEIO).ignore, false, 'grupo só entra no modo seguinte')
  assert.equal(decide(CANAL_ALHEIO).ignore, false, 'canal só entra no modo strict')
})

test('modo dm+group soma o grupo de fora, mantendo o canal fora da regra', () => {
  assert.equal(decide(GRUPO_ALHEIO, { mode: CHAT_SCOPE_MODES.DM_GROUP }).ignore, true)
  assert.equal(decide(CANAL_ALHEIO, { mode: CHAT_SCOPE_MODES.DM_GROUP }).ignore, false)
})

test('modo strict soma o canal de fora', () => {
  assert.equal(decide(CANAL_ALHEIO, { mode: CHAT_SCOPE_MODES.STRICT }).ignore, true)
})

test('nada que está na lista de escolhidos é ignorado, em nenhum modo', () => {
  for (const mode of Object.values(CHAT_SCOPE_MODES)) {
    for (const jid of [MONITORADO, DESTINO, CANAL_BOTAO]) {
      assert.equal(decide(jid, { mode }).ignore, false, `${jid} foi ignorado no modo ${mode}`)
    }
  }
})

// O MESMO gancho decide recibo de entrega e entrada em grupo (conferido na
// fonte do Baileys 6.7.23) — se ignorarmos isto, quebramos outras coisas.
test('status@broadcast e a própria conta nunca são ignorados', () => {
  assert.equal(decide('status@broadcast', { mode: CHAT_SCOPE_MODES.STRICT }).ignore, false)
  assert.equal(decide(EU, { mode: CHAT_SCOPE_MODES.STRICT }).ignore, false)
  assert.equal(decide('3595575529613@lid', { mode: CHAT_SCOPE_MODES.STRICT }).ignore, false)
})

test('tipo desconhecido nunca é ignorado (endereço novo do WhatsApp não pode virar surdez)', () => {
  assert.equal(decide('formato-que-nao-existe-ainda@novo', { mode: CHAT_SCOPE_MODES.STRICT }).ignore, false)
})

// Fail-open: princípio 1 do plano — nada pode travar o uso.
test('não filtra nada com o modo desligado', () => {
  assert.equal(decide(DM_LID, { mode: CHAT_SCOPE_MODES.OFF }).ignore, false)
})

test('não filtra nada enquanto a config não carregou', () => {
  assert.equal(decide(DM_LID, { ready: false }).ignore, false)
})

test('não filtra nada com a lista de escolhidos vazia', () => {
  assert.equal(decide(DM_LID, { allowedJids: buildAllowedJidSet([]) }).ignore, false)
  assert.equal(decide(DM_LID, { allowedJids: null }).ignore, false)
})

test('não filtra nada com o freio de emergência acionado', () => {
  assert.equal(decide(DM_LID, { disabled: true }).ignore, false)
})

// FREIO DE EMERGÊNCIA
const PANIC = 30 * 60_000
const NOW = 1_800_000_000_000

test('freio desliga a regra quando a conta parou de receber e o filtro segue cortando', () => {
  assert.equal(shouldAutoDisableChatScope({
    now: NOW, enabled: true, everAccepted: true,
    lastAcceptedAtMs: NOW - PANIC - 1, ignoredSinceLastAccepted: 12, panicMs: PANIC,
  }), true)
})

test('freio NÃO dispara em conta que nunca recebeu (conta nova)', () => {
  assert.equal(shouldAutoDisableChatScope({
    now: NOW, enabled: true, everAccepted: false,
    lastAcceptedAtMs: null, ignoredSinceLastAccepted: 99, panicMs: PANIC,
  }), false)
})

test('freio NÃO dispara sem nada sendo ignorado (silêncio é da fonte, não nosso)', () => {
  assert.equal(shouldAutoDisableChatScope({
    now: NOW, enabled: true, everAccepted: true,
    lastAcceptedAtMs: NOW - PANIC * 3, ignoredSinceLastAccepted: 0, panicMs: PANIC,
  }), false)
})

test('freio NÃO dispara dentro da janela nem duas vezes', () => {
  assert.equal(shouldAutoDisableChatScope({
    now: NOW, enabled: true, everAccepted: true,
    lastAcceptedAtMs: NOW - 60_000, ignoredSinceLastAccepted: 5, panicMs: PANIC,
  }), false)
  assert.equal(shouldAutoDisableChatScope({
    now: NOW, enabled: true, alreadyDisabled: true, everAccepted: true,
    lastAcceptedAtMs: NOW - PANIC * 2, ignoredSinceLastAccepted: 5, panicMs: PANIC,
  }), false)
})

test('panicMs=0 desliga o freio sem quebrar', () => {
  assert.equal(shouldAutoDisableChatScope({
    now: NOW, enabled: true, everAccepted: true,
    lastAcceptedAtMs: NOW - PANIC * 5, ignoredSinceLastAccepted: 5, panicMs: 0,
  }), false)
})
