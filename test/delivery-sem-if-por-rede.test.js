import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Feature 017 (arquitetura multicanal de entrega), FR-031/US7: adicionar uma
// rede nova NÃO PODE exigir alteração nos módulos compartilhados. A prova
// estrutural é: nenhum módulo compartilhado compara literalmente com o NOME
// de uma rede de entrega ('telegram'/'whatsapp'/'instagram'/'fake') —
// decisões saem só da declaração de capacidades
// (src/core/delivery/networks.js), nunca de `if (rede === 'telegram')`.
//
// ⚠️ Allowlist deliberada (achado de T001/AGENTS.md): o Story do Instagram já
// tem entrega funcional mesclada em `main` por um caminho PARALELO
// (src/instagram/, com destinos Instagram em src/offerAutomation/ e
// src/offerQueue/ via o modelo `Destination`/`OfferAutomationDestination`/
// `OfferQueueDestination` — ver AGENTS.md, seção "Instagram Stories"). Esse
// código É PRÉ-EXISTENTE, não faz parte desta feature, e NÃO usa
// comparação literal com a STRING 'instagram' — ele testa a EXISTÊNCIA da
// relação `instagramDestinations`/`instagramRuntime`. Este teste não toca
// nele. O que ele prova é que nenhum código NOVO desta feature (ou peça
// futura destas fatias) volte a comparar literalmente com nome de rede.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')

// Diretórios/arquivos que os módulos compartilhados desta feature NÃO podem
// decidir por nome de rede (FR-031). `src/core/delivery/networks.js` é a
// ÚNICA exceção legítima — é o registro em si (D-A1 do plano).
const SCANNED_TARGETS = [
  'src/core',
  'src/billing',
  'src/offerAutomation',
  'src/offerQueue',
  'dashboard/lib/painel/logsCopy.js',
]

const EXEMPT_FILE_SUFFIX = path.join('src', 'core', 'delivery', 'networks.js')

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

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const NETWORK_NAME_LITERAL_RE = /(['"])(whatsapp|telegram|instagram|fake)\1/g

test('nenhum módulo compartilhado compara literalmente com nome de rede de entrega (fora do registro)', () => {
  const files = []
  for (const rel of SCANNED_TARGETS) {
    const full = path.join(repoRoot, rel)
    if (!existsSync(full)) continue
    files.push(...listJsFilesRecursive(full))
  }
  assert.ok(files.length > 5, 'esperava varrer um número razoável de arquivos')

  const offenders = []
  for (const file of files) {
    if (file.endsWith(EXEMPT_FILE_SUFFIX)) continue
    const code = stripComments(readFileSync(file, 'utf8'))
    const matches = code.match(NETWORK_NAME_LITERAL_RE)
    if (matches) offenders.push({ file: path.relative(repoRoot, file), matches })
  }

  assert.deepEqual(offenders, [], `arquivo(s) comparando literalmente com nome de rede de entrega fora de networks.js: ${JSON.stringify(offenders)}`)
})
