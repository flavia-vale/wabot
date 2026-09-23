import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// specs/017-client-coupon-catalog (T021). bot-worker.js roda como processo
// próprio e não expõe processSendJob/resolveCouponTextForJob para import
// direto — mesmo padrão estrutural de test/bot-worker-retry-cache-wiring.test.js
// e test/mirror-dedup-key-surrogate.test.js. As invariantes comportamentais em
// si (chooseCoupon/renderCouponText/applyCouponToken) já têm cobertura direta
// e exaustiva em test/client-coupon-policy.test.js; este arquivo garante que o
// WIRING dentro de bot-worker.js respeita FR-014, FR-028a/SC-009 e FR-028b.

const __dirname = dirname(fileURLToPath(import.meta.url))
const botWorkerSource = readFileSync(join(__dirname, '../src/bot-worker.js'), 'utf8')

test('(a) FR-014 — cupons vêm de getConfig(), cujo cache expira sozinho em CONFIG_CACHE_TTL_MS', () => {
  // resolveCouponTextForJob precisa ler os cupons de getConfig() (o MESMO
  // cache que já existe para credenciais/grupos/botConfig), nunca de uma
  // consulta própria — é isso que faz CONFIG_CACHE_TTL_MS (rede de segurança
  // do D1 da pesquisa) valer também para o desligar/ligar de cupom.
  const fnMatch = botWorkerSource.match(/async function resolveCouponTextForJob\(job\) \{[\s\S]*?\n\}/)
  assert.ok(fnMatch, 'resolveCouponTextForJob não encontrada')
  const fnBody = fnMatch[0]
  assert.match(fnBody, /getConfig\(\)/, 'precisa ler os cupons via getConfig() (cache com TTL), não uma consulta própria')
  assert.doesNotMatch(fnBody, /db\.clientCoupon\.findMany/, 'não pode consultar clientCoupon diretamente aqui — isso violaria FR-028a/SC-009')

  // A validade em si (vencido/não vencido) é comparada a cada chamada com
  // `now: Date.now()` dentro desta função — nunca cacheada junto do TTL de
  // 60s, senão um cupom que vence entre o carregamento e o envio continuaria
  // saindo por até 1 minuto (o D1 da pesquisa só permite essa folga para o
  // ligado/desligado, nunca para a validade).
  assert.match(fnBody, /now:\s*Date\.now\(\)/, 'a validade precisa ser comparada com o relógio no momento do envio, não cacheada')

  // CONFIG_CACHE_TTL_MS precisa existir e ser o TTL do getConfig() consumido
  // acima — é a rede de segurança quando a invalidação ativa (reloadWorkerConfig)
  // se perde (Redis piscando, supervisor fora do ar, comando perdido).
  assert.match(botWorkerSource, /const CONFIG_CACHE_TTL_MS = /, 'CONFIG_CACHE_TTL_MS precisa existir como rede de segurança')
})

test('(a) o carregamento dos cupons em loadConfig() só traz os LIGADOS (enabled: true)', () => {
  const loadConfigMatch = botWorkerSource.match(/async function loadConfig\(\) \{[\s\S]*?\n\}\n/)
  assert.ok(loadConfigMatch, 'loadConfig não encontrada')
  assert.match(loadConfigMatch[0], /db\.clientCoupon\.findMany\(\{\s*where:\s*\{\s*userId,\s*enabled:\s*true\s*\}\s*\}\)/, 'loadConfig precisa filtrar só cupons ligados')
})

test('(b) FR-028b — a resolução do cupom no envio nunca escapa para fora do try/catch', () => {
  // O bloco dentro do laço de tentativas de processSendJob chama
  // resolveCouponTextForJob/applyCouponTokenToPayload dentro de um try cujo
  // catch loga e SEGUE (nunca relança) — "oferta sem cupom" nunca pode virar
  // "oferta perdida".
  const blockMatch = botWorkerSource.match(/if \(!couponTokenResolved\) \{[\s\S]*?\n {10}\}\n/)
  assert.ok(blockMatch, 'bloco de resolução do cupom no dequeue não encontrado')
  const block = blockMatch[0]
  assert.match(block, /try \{/, 'a resolução do cupom precisa estar dentro de um try')
  assert.match(block, /catch \(err\) \{/, 'precisa ter catch próprio')
  assert.doesNotMatch(block, /catch \(err\) \{\s*throw/, 'o catch não pode relançar — best-effort absoluto')

  // resolveCouponTextForJob em si também nunca lança (defesa em profundidade:
  // mesmo se o call site esquecesse o try/catch, a função não propagaria erro).
  const fnMatch = botWorkerSource.match(/async function resolveCouponTextForJob\(job\) \{[\s\S]*?\n\}/)
  assert.match(fnMatch[0], /catch \{\s*return ''\s*\}/, 'resolveCouponTextForJob precisa devolver \'\' em qualquer falha, nunca lançar')
})

test('(b) a substituição do token roda UMA vez por job, não a cada tentativa de retry', () => {
  // `couponTokenResolved` é declarado FORA do for de tentativas — senão uma
  // falha transitória de envio (retry) tentaria resolver o cupom de novo a
  // cada tentativa, o que é desperdício e pode produzir texto inconsistente
  // entre tentativas (o cupom podia ter vencido entre uma tentativa e outra).
  const declIndex = botWorkerSource.indexOf('let couponTokenResolved = false')
  const forIndex = botWorkerSource.indexOf('for (let attempt = 1; attempt <= SEND_MAX_ATTEMPTS; attempt++) {')
  assert.notEqual(declIndex, -1, 'couponTokenResolved não declarada')
  assert.notEqual(forIndex, -1, 'for de tentativas não encontrado')
  assert.ok(declIndex < forIndex, 'couponTokenResolved precisa ser declarada ANTES do for de tentativas (escopo por job, não por tentativa)')
})

test('(c) SC-009 — nenhuma consulta ao banco atribuível ao cupom dentro de processSendJob', () => {
  const startIndex = botWorkerSource.indexOf('async function processSendJob(job) {')
  assert.notEqual(startIndex, -1, 'processSendJob não encontrada')
  // Delimita o corpo de processSendJob até a próxima função de nível de
  // função de topo (heurística: próxima ocorrência de "\nasync function " ou
  // "\nfunction " depois do início, o que aparecer primeiro).
  const rest = botWorkerSource.slice(startIndex + 'async function processSendJob(job) {'.length)
  const nextFnRelative = rest.search(/\n(?:async )?function [a-zA-Z0-9_]+\(/)
  const body = nextFnRelative === -1 ? rest : rest.slice(0, nextFnRelative)
  assert.doesNotMatch(body, /db\.clientCoupon/, 'processSendJob não pode consultar ClientCoupon diretamente — só via getConfig() (cache)')
})
