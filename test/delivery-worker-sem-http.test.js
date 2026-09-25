import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Feature 017 (arquitetura multicanal de entrega), R5/FR-021 do plano: o
// worker NUNCA fala HTTP com o Telegram. Quando um destino não é WhatsApp,
// ele escreve numa caixa de saída e segue — quem fala com o Telegram é uma
// passada dentro do processo da API (D-A6). Isso torna estruturalmente
// impossível o modo de falha do RCA "fila entupida por UM destino
// derrubando a vazão de todos": um `await` de rede do Telegram dentro do
// consumidor serial do WhatsApp congelaria os envios de todo mundo.
//
// Este teste é estático (grep de source), sem executar nada: falha se
// src/bot-worker.js ou qualquer arquivo em src/delivery/whatsapp/ importar o
// cliente HTTP do Telegram, ou contiver `fetch(` apontando para
// api.telegram.org.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')

function listJsFilesRecursive(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) out.push(...listJsFilesRecursive(full))
    else if (entry.endsWith('.js')) out.push(full)
  }
  return out
}

test('src/bot-worker.js não importa o cliente HTTP do Telegram nem chama api.telegram.org', () => {
  const source = readFileSync(path.join(repoRoot, 'src/bot-worker.js'), 'utf8')
  assert.doesNotMatch(source, /delivery\/telegram\//, 'bot-worker.js não pode importar nada de src/delivery/telegram/')
  assert.doesNotMatch(source, /api\.telegram\.org/, 'bot-worker.js não pode conter o host da Bot API do Telegram')
})

test('nenhum arquivo em src/delivery/whatsapp/ importa o cliente do Telegram nem fala com api.telegram.org', () => {
  const dir = path.join(repoRoot, 'src/delivery/whatsapp')
  const files = listJsFilesRecursive(dir)
  assert.ok(files.length > 0, 'esperava encontrar arquivos em src/delivery/whatsapp/')
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    assert.doesNotMatch(source, /delivery\/telegram\//, `${file}: não pode importar nada de src/delivery/telegram/`)
    assert.doesNotMatch(source, /api\.telegram\.org/, `${file}: não pode conter o host da Bot API do Telegram`)
  }
})

test('src/supervisor/ não fala com api.telegram.org (o Telegram nunca mora no processo protegido)', () => {
  const dir = path.join(repoRoot, 'src/supervisor')
  const files = listJsFilesRecursive(dir)
  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    assert.doesNotMatch(source, /api\.telegram\.org/, `${file}: supervisor não pode falar com a Bot API do Telegram`)
  }
})
