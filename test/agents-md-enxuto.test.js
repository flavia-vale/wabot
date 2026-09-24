// Guarda do AGENTS.md enxuto (2026-09-23).
// O AGENTS.md é carregado em TODA sessão e em TODO subagente. Ele chegou a
// ~450 KB (~110 mil tokens por sessão) porque cada RCA virou seção fixa. Hoje
// o detalhe mora em docs/rca/<tema>.md e o AGENTS.md só traz regras fixas,
// índice por tema e mapa de sintomas. Este teste impede o arquivo de voltar a
// inchar e impede o índice/mapa de apontar para arquivo que não existe.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const AGENTS = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8')
const MAX_BYTES = 40 * 1024

test('AGENTS.md continua abaixo do teto de tamanho', () => {
  const bytes = Buffer.byteLength(AGENTS)
  assert.ok(bytes <= MAX_BYTES, `AGENTS.md tem ${bytes} bytes (teto ${MAX_BYTES}). RCA novo vai para docs/rca/<tema>.md, não aqui.`)
})

test('todo docs/rca/*.md está no índice e todo item do índice existe', () => {
  const files = fs.readdirSync(path.join(ROOT, 'docs/rca')).filter((f) => f.endsWith('.md'))
  assert.ok(files.length > 0)
  for (const f of files) {
    assert.ok(AGENTS.includes(`docs/rca/${f}`), `docs/rca/${f} não aparece no índice do AGENTS.md`)
  }
  const referenced = [...AGENTS.matchAll(/docs\/rca\/([\w.-]+\.md)/g)].map((m) => m[1])
  for (const f of referenced) {
    assert.ok(files.includes(f), `AGENTS.md aponta para docs/rca/${f}, que não existe`)
  }
})

test('caminhos citados no mapa de sintomas existem', () => {
  const faltando = []
  for (const [, ref] of AGENTS.matchAll(/`([^`\s]+)`/g)) {
    let alvo = null
    if (/^(src|dashboard|scripts|test|\.github)\/[\w./-]+\.(m?js|ya?ml|sh)$/.test(ref) && !ref.includes('*') && !ref.includes('<')) alvo = ref
    else if (/^(diag-[\w-]+|testar-recorrencia|sincronizar-assinatura|backfill-numeros-whatsapp)\.mjs$/.test(ref)) alvo = `scripts/${ref}`
    if (alvo && !fs.existsSync(path.join(ROOT, alvo))) faltando.push(alvo)
  }
  assert.deepEqual(faltando, [], 'o mapa de sintomas cita arquivos que não existem')
})
