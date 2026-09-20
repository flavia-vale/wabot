import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// RCA 2026-09-16 — "escrevi o texto adicional e não sai nada na oferta".
//
// `Group.templateKey` tem TRÊS estados, e o robô (src/bot-worker.js, na
// resolução de `effectiveTemplateKey`) os trata assim:
//   null  → HERDA o modelo padrão global (BotConfig.mirrorTemplateKeyDefault)
//   ''    → "manter texto original" explícito
//   chave → modelo fixo do grupo
//
// A tela de Espelhamento (antiga "Grupos") tratava `null` e `''` como a mesma coisa. Para quem tem um
// modelo padrão global, um grupo nunca tocado (`null`) aparecia como "Manter
// texto original convertido" E oferecia o campo "Adicionar texto ao final da
// mensagem" — enquanto o robô, na verdade, aplicava o modelo e ignorava o
// texto (o complemento só vale no relay). A cliente escrevia, salvava, lia
// "Texto salvo" e a oferta saía sem nada.
//
// Guardas estruturais: o painel precisa conhecer o padrão global e usar a
// MESMA regra de três estados.

const ROOT = path.resolve(import.meta.dirname, '..')
const PAGINA = readFileSync(path.join(ROOT, 'dashboard/app/painel/espelhamento/page.js'), 'utf8')
const WORKER = readFileSync(path.join(ROOT, 'src/bot-worker.js'), 'utf8')

test('a tela carrega o modelo padrão global', () => {
  assert.match(
    PAGINA,
    /mirrorTemplateKeyDefault/,
    'sem o padrão global a tela não tem como saber o que um grupo com templateKey nulo publica',
  )
})

test('a tela distingue "herda o padrão" de "manter texto original"', () => {
  assert.match(PAGINA, /inheritsDefault/, 'os três estados de templateKey precisam existir na tela')
  assert.doesNotMatch(
    PAGINA,
    /const templateValue = \(g\.templateKey == null \|\| g\.templateKey === ''\) \? '__relay__'/,
    'voltou a tratar null e vazio como a mesma coisa — é exatamente o bug',
  )
})

test('o campo de texto adicional só aparece quando o robô de fato o usa', () => {
  assert.match(
    PAGINA,
    /\{!templateApplied && <RelayFooterField/,
    'o complemento só vale no relay; oferecê-lo com modelo ativo promete algo que o robô descarta',
  )
  assert.doesNotMatch(
    PAGINA,
    /templateValue === '__relay__' && <RelayFooterField/,
    'a caixa cai no relay quando o modelo padrão foi apagado, mas o robô ainda descarta o complemento — decidir por templateValue traz o bug de volta',
  )
  assert.match(
    PAGINA,
    /const templateApplied = effectiveTemplateKey !== ''/,
    'o rótulo precisa refletir o modelo EFETIVO, não o campo cru do grupo',
  )
})

test('o robô continua com a regra de três estados que a tela espelha', () => {
  assert.match(
    WORKER,
    /groupTemplateKey === null \|\| groupTemplateKey === undefined\)\s*\n?\s*\? \(cfg\.botConfig\?\.mirrorTemplateKeyDefault/,
    'se o robô mudar a herança, a tela precisa mudar junto — senão a divergência volta',
  )
  assert.match(
    WORKER,
    /if \(!effectiveTemplateKey\) \{\s*\n\s*finalText = appendRelayFooter/,
    'o complemento continua pertencendo exclusivamente ao relay',
  )
})
