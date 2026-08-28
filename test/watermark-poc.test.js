import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import sharp from 'sharp'

import {
  createSampleInput,
  escapeXml,
  normalizeWatermarkConfig,
  renderDestinationWatermark,
  runRenderCli,
} from '../scripts/experiments/watermark-poc/render.mjs'

async function fixture() {
  return sharp({ create: { width: 1200, height: 800, channels: 3, background: '#e5e7eb' } })
    .png()
    .toBuffer()
}

test('POC escapa texto controlado pelo cliente antes de montar SVG', () => {
  assert.equal(escapeXml('A&B <teste> "ok"'), 'A&amp;B &lt;teste&gt; &quot;ok&quot;')
})

test('POC gera internamente uma imagem demonstrativa valida', async () => {
  const sample = await createSampleInput()
  const metadata = await sharp(sample).metadata()
  assert.equal(metadata.format, 'jpeg')
  assert.equal(metadata.width, 1200)
  assert.equal(metadata.height, 800)
})

test('POC valida limites e posicao da configuracao', () => {
  assert.deepEqual(normalizeWatermarkConfig({ text: ' Minha marca ', position: 'top-left' }), {
    text: 'Minha marca',
    position: 'top-left',
    opacity: 0.68,
    maxWidthPercent: 42,
  })
  assert.throws(() => normalizeWatermarkConfig({ text: '' }), /sem texto/)
  assert.throws(() => normalizeWatermarkConfig({ text: 'x'.repeat(51) }), /50 caracteres/)
  assert.throws(() => normalizeWatermarkConfig({ text: 'ok', position: 'center' }), /Posicao/)
})

test('POC gera JPEG principal e thumbnail marcados por destino', async () => {
  const input = await fixture()
  const first = await renderDestinationWatermark(input, { text: 'GRUPO A', position: 'bottom-right' })
  const second = await renderDestinationWatermark(input, { text: 'CANAL B', position: 'bottom-left' })

  const firstMeta = await sharp(first.main).metadata()
  const thumbMeta = await sharp(first.thumbnail).metadata()
  assert.equal(firstMeta.format, 'jpeg')
  assert.equal(firstMeta.width, 1200)
  assert.equal(firstMeta.height, 800)
  assert.ok(thumbMeta.width <= 500)
  assert.ok(thumbMeta.height <= 500)
  assert.notEqual(crypto.createHash('sha256').update(first.main).digest('hex'), crypto.createHash('sha256').update(second.main).digest('hex'))
  assert.notEqual(crypto.createHash('sha256').update(first.thumbnail).digest('hex'), crypto.createHash('sha256').update(second.thumbnail).digest('hex'))
  assert.equal(first.watermarkApplied, true)
  assert.equal(first.skipReason, null)
})

test('POC preserva imagem pequena sem tentar sobrepor marca fora dos limites', async () => {
  const input = await sharp({ create: { width: 100, height: 80, channels: 3, background: '#fff' } }).png().toBuffer()
  const result = await renderDestinationWatermark(input, { text: 'GRUPO A' })

  assert.equal(result.watermarkApplied, false)
  assert.equal(result.skipReason, 'image_too_small')
  assert.equal(result.width, 100)
  assert.equal(result.height, 80)
})

test('CLI usa IDs ordinais e nao grava JID ou texto da marca no relatorio', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'watermark-poc-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const inputPath = path.join(directory, 'input.png')
  const configPath = path.join(directory, 'config.json')
  const outputPath = path.join(directory, 'output')
  const jid = '5511999999999@g.us'
  const watermarkText = 'MARCA PRIVADA'
  await fs.writeFile(inputPath, await fixture())
  await fs.writeFile(configPath, JSON.stringify({ destinations: [{ jid, text: watermarkText }] }))

  await runRenderCli(['--input', inputPath, '--config', configPath, '--output', outputPath])
  const files = (await fs.readdir(outputPath)).sort()
  const reportText = await fs.readFile(path.join(outputPath, 'report.json'), 'utf8')

  assert.deepEqual(files, ['destination-001-main.jpg', 'destination-001-thumb.jpg', 'report.json'])
  assert.doesNotMatch(reportText, /5511999999999/)
  assert.doesNotMatch(reportText, /MARCA PRIVADA/)
})

test('CLI funciona sem arquivo de entrada usando amostra gerada', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'watermark-poc-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const configPath = path.join(directory, 'config.json')
  const outputPath = path.join(directory, 'output')
  await fs.writeFile(configPath, JSON.stringify({ destinations: [{ jid: 'teste@g.us', text: 'MARCA TESTE' }] }))

  await runRenderCli(['--config', configPath, '--output', outputPath])
  const report = JSON.parse(await fs.readFile(path.join(outputPath, 'report.json'), 'utf8'))

  assert.equal(report.inputSource, 'generated_sample')
  assert.equal(report.report[0].watermarkApplied, true)
})

test('CLI rejeita JID duplicado antes de sobrescrever uma variante', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'watermark-poc-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const inputPath = path.join(directory, 'input.png')
  const configPath = path.join(directory, 'config.json')
  await fs.writeFile(inputPath, await fixture())
  await fs.writeFile(configPath, JSON.stringify({
    destinations: [
      { jid: 'duplicado@g.us', text: 'A' },
      { jid: 'duplicado@g.us', text: 'B' },
    ],
  }))

  await assert.rejects(
    runRenderCli(['--input', inputPath, '--config', configPath, '--output', path.join(directory, 'output')]),
    /duplicado/,
  )
})
