import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { createSampleInput, renderDestinationWatermark } from '../../../src/core/destinationWatermark.js'
export { createSampleInput, escapeXml, normalizeWatermarkConfig, renderDestinationWatermark } from '../../../src/core/destinationWatermark.js'

function parseArgs(argv) {
  const result = {}
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (!value.startsWith('--')) continue
    const key = value.slice(2)
    result[key] = argv[index + 1]
    index += 1
  }
  return result
}

export async function runRenderCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  if (!args.config || !args.output) {
    throw new Error('Uso: node render.mjs [--input imagem.jpg] --config config.json --output diretorio')
  }

  sharp.cache(false)
  sharp.concurrency(1)
  const [input, configFile] = await Promise.all([
    args.input ? fs.readFile(args.input) : createSampleInput(),
    fs.readFile(args.config, 'utf8').then(JSON.parse),
  ])
  const destinations = Array.isArray(configFile.destinations) ? configFile.destinations : []
  if (destinations.length < 1 || destinations.length > 50) throw new Error('Config deve ter entre 1 e 50 destinos')
  const jids = destinations.map(destination => String(destination.jid ?? '').trim())
  if (jids.some(jid => !jid)) throw new Error('Destino sem jid')
  if (new Set(jids).size !== jids.length) throw new Error('Config contem JID de destino duplicado')
  await fs.mkdir(args.output, { recursive: true })

  const report = []
  for (const [index, destination] of destinations.entries()) {
    const rendered = await renderDestinationWatermark(input, { ...configFile.defaults, ...destination })
    // Identificador ordinal: diferente de hash de telefone/JID, nao permite
    // tentativa de reidentificacao por forca bruta a partir do report.
    const fileId = `destination-${String(index + 1).padStart(3, '0')}`
    await Promise.all([
      fs.writeFile(path.join(args.output, `${fileId}-main.jpg`), rendered.main),
      fs.writeFile(path.join(args.output, `${fileId}-thumb.jpg`), rendered.thumbnail),
    ])
    report.push({
      destinationId: fileId,
      width: rendered.width,
      height: rendered.height,
      mainBytes: rendered.main.length,
      thumbnailBytes: rendered.thumbnail.length,
      durationMs: Number(rendered.durationMs.toFixed(2)),
      rssMb: Number((process.memoryUsage().rss / 1024 / 1024).toFixed(1)),
      watermarkApplied: rendered.watermarkApplied,
      skipReason: rendered.skipReason,
    })
  }
  await fs.writeFile(path.join(args.output, 'report.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    inputSource: args.input ? 'file' : 'generated_sample',
    report,
  }, null, 2)}\n`)
  return report
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runRenderCli().then(report => {
    console.table(report)
  }).catch(error => {
    console.error(`POC falhou: ${error.message}`)
    process.exitCode = 1
  })
}
