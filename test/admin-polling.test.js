import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const root = new URL('../dashboard/app/admin', import.meta.url).pathname

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : /\.(js|jsx|mjs)$/.test(name) ? [full] : []
  })
}

function intervalMs(expr) {
  const nums = expr.replace(/_/g, '').match(/\d+(?:\.\d+)?/g) || []
  return nums.reduce((acc, n) => acc * Number(n), 1)
}

test('admin: nenhum setInterval < 60 s e sempre pausado com aba escondida', () => {
  for (const file of walk(root)) {
    const src = readFileSync(file, 'utf8')
    const re = /setInterval\(/g
    let m
    while ((m = re.exec(src))) {
      let depth = 1
      let i = m.index + m[0].length
      let lastComma = -1
      for (; i < src.length && depth > 0; i++) {
        const c = src[i]
        if (c === '(' || c === '{' || c === '[') depth++
        else if (c === ')' || c === '}' || c === ']') depth--
        else if (c === ',' && depth === 1) lastComma = i
      }
      const call = src.slice(m.index, i)
      const rel = path.relative(root, file)
      assert.ok(lastComma > 0, `${rel}: setInterval sem intervalo`)
      const ms = intervalMs(src.slice(lastComma + 1, i - 1))
      assert.ok(ms >= 60_000, `${rel}: setInterval de ${ms} ms (mínimo 60_000)`)
      assert.match(call, /visibilityState/, `${rel}: setInterval sem document.visibilityState`)
    }
  }
})

test('admin: GET /online (leitura periódica) não grava AdminAuditLog', () => {
  const src = readFileSync(new URL('../src/api/routes/admin.js', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /admin\.online\.read/)
})
