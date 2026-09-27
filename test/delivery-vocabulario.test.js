import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Feature 017 (arquitetura multicanal de entrega), FR-001/FR-003/SC-008/R6:
// "canal"/`channel` já significa Canal do WhatsApp (`@newsletter`) e
// "plataforma"/`platform` já significa LOJA. Esta feature cunha o termo
// `deliveryNetwork` — "aplicativo" para a cliente — e não pode reaproveitar
// nenhuma das duas palavras já ocupadas, nem deixar jargão técnico
// (adaptador, driver, transporte, Bot API, Graph API, webhook, token,
// chat_id) chegar a qualquer tela.
//
// Este teste é ESTRUTURAL e RECURSIVO: varre as pastas NOVAS desta feature
// (as únicas que existem por causa dela) atrás dos termos banidos. Cobre
// arquivos futuros das próximas fatias sem precisar ser reescrito.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')

// Pastas NOVAS desta feature — nascidas com ela, então não têm "uso legítimo
// pré-existente" para allowlist. Fora daqui (o resto de src/ e dashboard/) já
// usa "canal"/"plataforma" para os conceitos que essas palavras já têm, e
// varrer o repo inteiro exigiria uma allowlist do tamanho do próprio repo —
// o que essas pastas cobrem é exatamente a superfície NOVA que esta feature
// introduz (FR-001/FR-003/SC-008).
const NEW_SURFACE_DIRS = [
  'src/core/delivery',
  'src/delivery',
  'src/deliveryOutbox',
  'test/helpers/fakeDeliveryNetwork.js',
]

function listJsFilesRecursive(dirOrFile) {
  const stat = statSync(dirOrFile)
  if (!stat.isDirectory()) return [dirOrFile]
  const out = []
  for (const entry of readdirSync(dirOrFile)) {
    const full = path.join(dirOrFile, entry)
    const s = statSync(full)
    if (s.isDirectory()) out.push(...listJsFilesRecursive(full))
    else if (entry.endsWith('.js')) out.push(full)
  }
  return out
}

// Remove comentários (linha e bloco) antes de varrer. O que importa para
// FR-001/FR-003 é o USO no código (identificador, string, chave) — não a
// prosa explicando POR QUE a palavra é reservada (este próprio arquivo, e os
// comentários de src/core/delivery/networks.js, citam "canal"/"plataforma"
// ao EXPLICAR a regra, o que é diferente de usá-las como sinônimo de rede de
// entrega). Stripping é best-effort (regex, não um parser completo) — ver
// AGENTS.md sobre testes estruturais estáticos deste repositório.
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function existingFiles(paths) {
  const out = []
  for (const rel of paths) {
    const full = path.join(repoRoot, rel)
    try {
      out.push(...listJsFilesRecursive(full))
    } catch {
      // pasta/arquivo ainda não existe nesta fatia — tudo bem, ela nasce nas
      // fatias seguintes (ex.: src/delivery/telegram/).
    }
  }
  return out
}

// Jargão técnico que a cliente NUNCA pode ler, em NENHUMA superfície nova.
const TECH_JARGON_RES = [
  /rede de entrega/i,
  /\badaptador\b/i,
  /\bdriver\b/i,
  /\btransporte\b/i,
  /\bBot API\b/i,
  /\bGraph API\b/i,
  /\bwebhook\b/i,
  /\btoken\b/i,
  /\bchat_id\b/i,
]

// "canal"/channel e "plataforma"/platform continuam proibidos como sinônimo
// de rede de entrega nas pastas NOVAS — aqui não há uso legítimo herdado
// (Canal do WhatsApp e loja pertencem a outras partes do código, não a
// src/core/delivery/, src/delivery/ ou src/deliveryOutbox/).
const RESERVED_WORD_RES = [
  { re: /\bchannel\b/i, label: 'channel' },
  { re: /\bcanal\b/i, label: 'canal' },
  { re: /\bplatform\b/i, label: 'platform' },
  { re: /\bplataforma\b/i, label: 'plataforma' },
]

test('nenhum arquivo novo desta feature usa jargão técnico que a cliente não pode ler', () => {
  const files = existingFiles(NEW_SURFACE_DIRS)
  assert.ok(files.length > 0, 'esperava encontrar arquivos novos desta feature para varrer')
  for (const file of files) {
    const source = stripComments(readFileSync(file, 'utf8'))
    for (const re of TECH_JARGON_RES) {
      assert.doesNotMatch(source, re, `${path.relative(repoRoot, file)}: termo técnico banido encontrado no código (${re})`)
    }
  }
})

test('nenhum arquivo novo desta feature reaproveita "canal"/channel ou "plataforma"/platform, no CÓDIGO, para rede de entrega', () => {
  const files = existingFiles(NEW_SURFACE_DIRS)
  for (const file of files) {
    const source = stripComments(readFileSync(file, 'utf8'))
    for (const { re, label } of RESERVED_WORD_RES) {
      assert.doesNotMatch(source, re, `${path.relative(repoRoot, file)}: palavra reservada "${label}" encontrada no código — já significa Canal do WhatsApp / loja em outras partes do produto`)
    }
  }
})

test('o direito de plano desta feature não reaproveita FEATURE_CODES.CHANNELS nem o nome "channels"', () => {
  const plansSource = readFileSync(path.join(repoRoot, 'src/billing/plans.js'), 'utf8')
  const multiNetworkBlockStart = plansSource.indexOf('MULTI_NETWORK')
  assert.notEqual(multiNetworkBlockStart, -1, 'FEATURE_CODES.MULTI_NETWORK não encontrado em src/billing/plans.js')
  assert.doesNotMatch(plansSource, /MULTI_NETWORK:\s*['"]channels['"]/, 'MULTI_NETWORK não pode valer "channels" — esse código já significa Canal do WhatsApp')
})
