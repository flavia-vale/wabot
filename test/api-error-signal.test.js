// Guarda do incidente 2026-09-09: o painel caiu inteiro e não havia nada
// pesquisável nem durável sobre a falha.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { classifyApiError, describeApiErrorKind, API_ERROR_KINDS } from '../src/ops/apiErrorSignal.js'
import { ANALYTICS_EVENTS } from '../src/analytics.js'
import { getTemplateDefinition } from '../src/email/registry.js'

const ler = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')

test('o erro EXATO do incidente é reconhecido como contrato com o banco', () => {
  const r = classifyApiError({ message: 'Unknown field `blockedReason` for select statement on model `User`.' })
  assert.equal(r.kind, API_ERROR_KINDS.SCHEMA_MISMATCH)
  assert.equal(r.signal, true)
  // É o único tipo que merece e-mail na primeira ocorrência: derruba todas as
  // contas de uma vez, não uma tela.
  assert.equal(r.alert, true)
})

test('erro de cliente NUNCA vira incidente', () => {
  for (const status of [400, 401, 403, 404, 409, 429]) {
    const r = classifyApiError({ message: 'qualquer', statusCode: status })
    assert.equal(r.signal, false, `status ${status} não pode virar sinal`)
    assert.equal(r.alert, false)
  }
})

test('banco indisponível é sinal, mas não acorda ninguém', () => {
  for (const erro of [{ code: 'P1001', message: 'cannot reach database' }, { message: 'SQLITE_BUSY: database is locked' }]) {
    const r = classifyApiError(erro)
    assert.equal(r.kind, API_ERROR_KINDS.DB_UNAVAILABLE)
    assert.equal(r.signal, true)
    assert.equal(r.alert, false, 'blip de banco é passageiro — e-mail a cada um treina a ignorar')
  }
})

test('erro sem marca conhecida continua virando sinal, como "outro"', () => {
  const r = classifyApiError({ message: 'algo inesperado' })
  assert.equal(r.kind, API_ERROR_KINDS.OTHER)
  assert.equal(r.signal, true)
})

test('todo tipo tem explicação com próximo passo', () => {
  for (const kind of Object.values(API_ERROR_KINDS)) {
    const texto = describeApiErrorKind(kind)
    assert.ok(texto.length > 30, `explicação curta demais para ${kind}`)
    assert.match(texto, /confira/i, 'aviso sem próximo passo vira ruído')
  }
})

test('a API grava o termo pesquisável, o sinal e a allowlist', () => {
  const server = ler('../src/api/server.js')
  assert.match(server, /setErrorHandler/)
  // Termo fixo: é o que permite procurar sem saber a mensagem da biblioteca.
  assert.match(server, /'FALHA DA API'/)
  assert.match(server, /event: 'ops_api_error'/)
  assert.ok(ANALYTICS_EVENTS.has('ops_api_error'), 'fora da allowlist o evento some sem erro')
})

test('a resposta para a cliente não muda', () => {
  const server = ler('../src/api/server.js')
  const inicio = server.indexOf('app.setErrorHandler')
  const fim = server.indexOf("app.addHook('onSend'")
  const bloco = server.slice(inicio, fim)
  assert.match(bloco, /reply\.send\(error\)/, 'o handler precisa repassar o erro original')
  assert.doesNotMatch(bloco, /reply\.code\(/, 'mudar o status quebraria contrato de rota existente')
})

test('o aviso interno existe e é endereçado à admin', () => {
  const t = getTemplateDefinition('admin_api_com_erro')
  assert.ok(t)
  assert.equal(t.group, 'interno')
  assert.equal(t.audience, 'admin')
  assert.match(t.body, /não por algo que a cliente fez/i)
})
