import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'

import { ANALYTICS_EVENTS } from '../src/analytics.js'

const botWorkerSource = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')

// RCA 2026-08 ("as ofertas estão indo sem imagem"): quando o card de preview
// não consegue foto, a oferta sai como TEXTO PURO — e esse caminho era
// completamente MUDO em produção. `fetchProductImage` trata o próprio erro e
// devolve `null` (não lança), então o `.catch(logger.debug)` nunca rodava; e
// `logger.debug` não chega ao bot.log de qualquer forma (o transport de arquivo
// é `level: 'info'`). Sem log e sem sinal, não havia como saber em que etapa a
// foto se perdia nem em qual loja. Não regredir.

function previewFnSource() {
  const start = botWorkerSource.indexOf('async function buildManualLinkPreview(')
  assert.notEqual(start, -1, 'buildManualLinkPreview não encontrada')
  const end = botWorkerSource.indexOf('const STORE_PREVIEW_TITLES', start)
  assert.notEqual(end, -1, 'fim de buildManualLinkPreview não encontrado')
  return botWorkerSource.slice(start, end)
}

test('o caminho "preview sem imagem" avisa em nível visível no log', () => {
  const helperStart = botWorkerSource.indexOf('function reportPreviewCardNoImage(')
  assert.notEqual(helperStart, -1, 'reportPreviewCardNoImage não encontrada')
  const helper = botWorkerSource.slice(helperStart, helperStart + 600)
  assert.match(helper, /logger\.warn\(/, 'o aviso precisa ser warn — debug não chega ao bot.log')
  assert.match(helper, /recordOperationalSignal\('preview_card_no_image'/, 'precisa emitir o sinal durável')
})

test('todas as etapas de perda de foto são reportadas', () => {
  const fn = previewFnSource()
  for (const stage of ['anchor_missing', 'scrape_sem_imagem', 'download_falhou', 'normalize_falhou', 'sem_plataforma']) {
    assert.match(fn, new RegExp(`reportPreviewCardNoImage\\('${stage}'`), `etapa ${stage} sem aviso`)
  }
})

test('nenhuma etapa de perda de foto volta a ser logada em debug', () => {
  const fn = previewFnSource()
  assert.equal(/logger\.debug\(/.test(fn), false, 'debug não chega ao bot.log — usar warn')
})

test('o sinal está na allowlist do analytics', () => {
  assert.equal(ANALYTICS_EVENTS.has('ops_preview_card_no_image'), true)
})
