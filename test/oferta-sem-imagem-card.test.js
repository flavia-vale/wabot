import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Guard estrutural (mesmo padrão de test/bot-worker-retry-cache-wiring.test.js).
//
// Hotfix 2026-08-26: com o piso de qualidade da miniatura ligado, o envio sem
// imagem caía em `useLinkPreview` puro — que só liga o preview AUTOMÁTICO do
// Baileys. Esse preview não resolve link de afiliado encurtado (s.shopee.com.br,
// amzn.to, meli.la), então a oferta chegou no grupo como TEXTO PELADO: sem foto
// e sem card. Trocar foto ruim por nenhuma imagem é regressão, não conserto.
const source = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

test('envio sem imagem monta o card manual em vez de contar com o preview automático', () => {
  const branch = /if \(useLinkPreview && !image\) \{[\s\S]{0,1600}?\n          \}/.exec(source)
  assert.ok(branch, 'o ramo "sem imagem" precisa existir em buildPayload')
  assert.match(branch[0], /buildManualLinkPreview\(/, 'precisa montar o card manual')
  assert.match(branch[0], /fetchOriginPhoto: getOriginalPhotoOnce/, 'precisa oferecer a foto da mensagem de origem como plano B')
  assert.match(branch[0], /linkPreview: fallbackPreview/, 'o card montado precisa chegar ao payload')
})

test('o plano B da foto de origem não pode ser bloqueado pela env nesse caminho', () => {
  assert.match(
    source,
    /allowSmallOriginPhoto \|\| shouldUseOriginPhotoFallback\(\)/,
    'sem imagem, o plano B é a diferença entre card e texto pelado — roda mesmo com a env desligada',
  )
})
