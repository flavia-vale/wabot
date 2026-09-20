import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../dashboard/app/painel/espelhamento/page.js', import.meta.url), 'utf8')

/* O card de cadência GLOBAL de envio não pertence a esta tela: ritmo de envio
 * é preservação por destino, e mostrá-lo aqui fazia a cliente procurar o ajuste
 * no lugar errado.
 *
 * ⚠️ A guarda deixou de proibir `api.getConfig()` em 2026-09-19, quando a tela
 * absorveu a de Grupos: o painel do grupo precisa do MODELO PADRÃO GLOBAL
 * (`BotConfig.mirrorTemplateKeyDefault`) para não oferecer o campo de texto
 * adicional onde o robô o descarta (RCA 2026-09-16,
 * test/painel-modelo-herdado-e-texto-adicional.test.js). O que a guarda protege
 * é a AUSÊNCIA do card de cadência, e isso continua verificado pelos textos e
 * pelo cálculo do ritmo. */
test('/painel/espelhamento no longer displays global send cadence card', () => {
  assert.doesNotMatch(source, /1 envio a cada/)
  assert.doesNotMatch(source, /Evita parecer spam/)
  assert.doesNotMatch(source, /const ritmo =/)
})

test('a leitura da configuração global serve só ao modelo padrão', () => {
  // Se `getConfig()` voltar a alimentar outra coisa nesta tela, é sinal de que
  // o card de cadência (ou parente) está voltando pela porta dos fundos.
  const usos = source.match(/config\?\.[A-Za-z]+/g) ?? []
  assert.deepEqual([...new Set(usos)], ['config?.mirrorTemplateKeyDefault'])
})
