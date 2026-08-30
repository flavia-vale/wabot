import fs from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

import { renderDestinationWatermark } from './render.mjs'

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function boundedInteger(name, fallback, min, max) {
  const value = Number(option(name, fallback))
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`--${name} deve ser inteiro entre ${min} e ${max}`)
  }
  return value
}

const count = boundedInteger('destinations', 2, 1, 50)
const iterations = boundedInteger('iterations', 3, 1, 20)
const inputPath = option('input', '')
const outputPath = option('output', './output/benchmark-report.json')

sharp.cache(false)
sharp.concurrency(1)

const input = inputPath
  ? await fs.readFile(inputPath)
  : await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#e5e7eb' } }).jpeg().toBuffer()

const samples = []
let peakRssBytes = process.memoryUsage().rss
for (let iteration = 0; iteration < iterations; iteration += 1) {
  for (let destination = 0; destination < count; destination += 1) {
    const rendered = await renderDestinationWatermark(input, {
      text: `MARCA DESTINO ${destination + 1}`,
      position: destination % 2 === 0 ? 'bottom-right' : 'bottom-left',
    })
    samples.push(rendered.durationMs)
    peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss)
  }
}

samples.sort((a, b) => a - b)
const percentile = value => samples[Math.min(samples.length - 1, Math.floor(samples.length * value))]
const report = {
  destinations: count,
  iterations,
  samples: samples.length,
  averageMs: Number((samples.reduce((sum, value) => sum + value, 0) / samples.length).toFixed(2)),
  p50Ms: Number(percentile(0.5).toFixed(2)),
  p95Ms: Number(percentile(0.95).toFixed(2)),
  maxMs: Number(samples.at(-1).toFixed(2)),
  finalRssMb: Number((process.memoryUsage().rss / 1024 / 1024).toFixed(1)),
  peakRssMb: Number((peakRssBytes / 1024 / 1024).toFixed(1)),
}

await fs.mkdir(path.dirname(outputPath), { recursive: true })
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
