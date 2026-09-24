// Trava a REDAÇÃO da tela "Anti-banimento" (specs/018-unificar-protecao-anti-ban,
// User Story 2, contracts/ui-anti-banimento.md § Linguagem).
//
// A tela é para quem quer proteger o número, não para quem sabe o que é
// "burst cap" ou "jitter". Termo técnico vazando para rótulo, dica ou aviso é
// exatamente o problema que a feature existe para resolver — então o texto
// (e não só o comportamento) tem teste.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readdirSync } from 'node:fs'

// Lista proibida completa de contracts/ui-anti-banimento.md § Linguagem.
// Palavras curtas/ambíguas (cap, hash, score) usam \b para não confundir com
// identificador JS que só aparece como CHAVE de objeto (nunca como texto
// visível — texto visível vem de literal de string ou nó de texto JSX).
// \b nos dois lados nas palavras curtas: elas também são nome de CAMPO
// interno (burstCap, throttleEnabled, preservationPresetId, stagger em
// ChannelStaggerForm) que aparece como string entre aspas em código legítimo
// (chave de objeto passada como literal, caminho de import) — sem \b\.\.\b\, o
// identificador de código dispararia falso positivo por conter a palavra como
// SUBSTRING, o que não é o mesmo que ela aparecer como TEXTO para a cliente.
const JARGAO_PROIBIDO = [
  /\bburst\b/i,
  /rajada/i,
  /\bthrottle\b/i,
  /\bjitter\b/i,
  /\bpreset\b/i,
  /\bcap\b/i,
  /anti-?flood/i,
  /shadowban/i,
  /\bhash\b/i,
  /snapshot/i,
  /\bscore\b/i,
  /muta[çc][ãa]o/i,
  /\bstagger\b/i,
  /atraso entre canais/i,
  /preserva[çc][ãa]o avan[çc]ada/i,
  /m[óo]dulo de preserva[çc][ãa]o/i,
  /preserva[çc][ãa]o pro/i,
  /preserva[çc][ãa]o por grupo/i,
  /preserva[çc][ãa]o por destino/i,
]

// Remove comentário de bloco e de linha ANTES de extrair texto — comentário
// explica o histórico da migração ("substitui o antigo grupo 'Preservação
// avançada'") e não é o que a cliente lê; sem isso ele soa como jargão
// vazando quando na verdade só documenta o próprio conserto.
function semComentarios(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ')
    // Caminho de import/export (ex.: '@/components/preservacao/ChannelStaggerForm')
    // é nome de arquivo, não texto que a cliente lê.
    .replace(/^[ \t]*(import|export)\b.*$/gm, ' ')
}

// Extrai só o que a cliente PODE LER: texto entre tags JSX e conteúdo de
// literais de string/template — nunca chave de objeto/identificador JS (ex.:
// `throttleEnabled: true` não é texto visível, é código) nem comentário.
function textosVisiveis(sourceComComentarios) {
  const source = semComentarios(sourceComComentarios)
  // `*` (não `{2,}`): um par vazio como useState('') tem ZERO caracteres entre
  // as aspas — com mínimo de 2, essa aspa "curta demais" é pulada e o par
  // seguinte passa a ser formado com a PRÓXIMA aspa qualquer do arquivo,
  // varrendo por cima de JSX inteiro como se fosse uma string só (bug
  // encontrado ao rodar contra ContaPart.js: `useState('')` fazia o próximo
  // "match" começar no meio do template literal seguinte e engolir várias
  // linhas de JSX). Match vazio/curto não credita jargão a lugar nenhum.
  const jsxText = [...source.matchAll(/>([^<>{}]*)</g)].map((m) => m[1])
  const singleQuoted = [...source.matchAll(/'([^'\\]*)'/g)].map((m) => m[1])
  const doubleQuoted = [...source.matchAll(/"([^"\\]*)"/g)].map((m) => m[1])
  const template = [...source.matchAll(/`([^`\\]*)`/g)].map((m) => m[1])
  return [...jsxText, ...singleQuoted, ...doubleQuoted, ...template]
}

function arquivosDe(dir) {
  const out = []
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const caminho = new URL(`${item.name}${item.isDirectory() ? '/' : ''}`, dir)
    if (item.isDirectory()) out.push(...arquivosDe(caminho))
    else if (item.name.endsWith('.js')) out.push(caminho)
  }
  return out
}

// Tela + componentes que ela de fato usa (contracts/ui-anti-banimento.md):
// só os consumidos pela árvore de dashboard/app/painel/anti-banimento (não o
// diretório inteiro de dashboard/components/preservacao — ele ainda guarda
// componentes de outra função, como o probe de canal, que não têm o mesmo
// contrato de linguagem desta feature).
const ANTI_BANIMENTO_DIR = new URL('../dashboard/app/painel/anti-banimento/', import.meta.url)
const COMPONENTES_USADOS = [
  'HealthOverview.js',
  'RiskScoreSummary.js',
  'OperatingHoursForm.js',
  'PreservationLimitsForm.js',
  'PresetButtons.js',
  'FeatureToggle.js',
  'ChannelStaggerForm.js',
  'FollowGuardForm.js',
  'ImageMutationToggle.js',
  'UpsellShell.js',
]

const arquivos = [
  ...arquivosDe(ANTI_BANIMENTO_DIR),
  ...COMPONENTES_USADOS.map((nome) => new URL(`../dashboard/components/preservacao/${nome}`, import.meta.url)),
]

for (const arquivo of arquivos) {
  test(`${arquivo.pathname.split('/').pop()}: nenhum jargão técnico no texto visível`, () => {
    const source = readFileSync(arquivo, 'utf8')
    const textos = textosVisiveis(source)
    for (const regex of JARGAO_PROIBIDO) {
      for (const texto of textos) {
        assert.doesNotMatch(texto, regex, `jargão "${regex}" em "${texto}" (${arquivo.pathname})`)
      }
    }
  })
}

test('a mensagem do gate de plano (src/billing/plans.js) não tem jargão', () => {
  const source = readFileSync(new URL('../src/billing/plans.js', import.meta.url), 'utf8')
  const match = source.match(/error:\s*'([^']*Anti-banimento[^']*)'/)
  assert.ok(match, 'não achei a mensagem de recusa do Anti-banimento')
  for (const regex of JARGAO_PROIBIDO) {
    assert.doesNotMatch(match[1], regex, `jargão "${regex}" na mensagem do gate: "${match[1]}"`)
  }
})

test('os motivos de adiamento que chegam ao painel (deferReasonMessage) não têm jargão nem citam tela antiga', () => {
  const source = readFileSync(new URL('../src/bot-worker.js', import.meta.url), 'utf8')
  const fnMatch = source.match(/function deferReasonMessage\(reason\) \{[\s\S]*?\n\}\n/)
  assert.ok(fnMatch, 'não achei deferReasonMessage em bot-worker.js')
  const body = semComentarios(fnMatch[0])
  const mensagens = [...body.matchAll(/'([^'\\]{4,})'/g)].map((m) => m[1])
  assert.ok(mensagens.length > 0, 'não extraí nenhuma mensagem de deferReasonMessage')
  for (const regex of JARGAO_PROIBIDO) {
    for (const msg of mensagens) {
      assert.doesNotMatch(msg, regex, `jargão "${regex}" em "${msg}"`)
    }
  }
})

test('nenhuma frase promete que o número não será banido', () => {
  for (const arquivo of arquivos) {
    const source = readFileSync(arquivo, 'utf8')
    for (const texto of textosVisiveis(source)) {
      assert.doesNotMatch(texto, /n[ãa]o (vai ser|ser[áa]) banid[oa]/i, `promessa indevida em: "${texto}" (${arquivo.pathname})`)
      assert.doesNotMatch(texto, /nunca (vai ser|ser[áa]) banid[oa]/i, `promessa indevida em: "${texto}" (${arquivo.pathname})`)
      if (/garantimos/i.test(texto)) {
        assert.doesNotMatch(texto, /banid|banimento/i, `promessa indevida (garantia) em: "${texto}" (${arquivo.pathname})`)
      }
    }
  }
})
