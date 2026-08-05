import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// "Quando o código deste clone mudou pela última vez".
//
// O deploy faz `git pull`, que reescreve APENAS os arquivos alterados — então o
// mtime mais recente dentro de `src/` é uma boa proxy de "momento em que a
// última correção chegou ao servidor". É deliberadamente independente de git:
// não depende de `.git` existir, de shallow clone nem de rodar comando externo.
//
// Usado por `ops/staleWorkerCodeGuard.js` para comparar contra o boot do
// bot-supervisor. Ver o RCA no topo daquele arquivo.

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Diretórios que não representam código nosso em execução.
const SKIP_DIRS = new Set(['node_modules', '.git', 'test', '__tests__'])

const CODE_FILE_RE = /\.(?:js|mjs|cjs|json)$/

// Cache de processo: o valor não muda enquanto o processo vive (se os arquivos
// mudarem, é justamente porque houve deploy — e aí o processo é o desatualizado,
// que é o que o guard quer detectar).
let cachedCodeChangedAtMs = null

export async function computeCodeChangedAtMs(dir = SRC_DIR) {
  let newest = 0
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return newest
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
    const fullPath = path.join(dir, entry.name)
    try {
      if (entry.isDirectory()) {
        const nested = await computeCodeChangedAtMs(fullPath)
        if (nested > newest) newest = nested
        continue
      }
      if (!entry.isFile() || !CODE_FILE_RE.test(entry.name)) continue
      const info = await stat(fullPath)
      if (info.mtimeMs > newest) newest = info.mtimeMs
    } catch {
      // Arquivo sumiu/sem permissão no meio da varredura: ignora. O guard
      // trata ausência de dado como "não avisar" (fail-safe).
    }
  }

  return newest
}

export async function getCodeChangedAtMs() {
  if (cachedCodeChangedAtMs === null) {
    cachedCodeChangedAtMs = await computeCodeChangedAtMs()
  }
  return cachedCodeChangedAtMs
}

export const __codeVersionInternals = { SRC_DIR, SKIP_DIRS }
