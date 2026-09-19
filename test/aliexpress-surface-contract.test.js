import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('AliExpress está ligada em todas as superfícies estáticas da plataforma', () => {
  const required = [
    ['src/api/routes/config.js', /platforms: ['"]shopee,[^'"]*aliexpress/],
    ['src/api/routes/groups.js', /'aliexpress'/],
    ['src/bot-worker.js', /aliexpress: 'AliExpress'/],
    ['src/core/mirrorTemplate.js', /aliexpress: 'AliExpress'/],
    ['dashboard/app/painel/espelhamento/page.js', /id: 'aliexpress'/],
    // A tela de teste de conversão não guarda mais a lista de endereços (ela
    // usa `detectLinks`), então a cobertura dela passou a ser dupla: o texto
    // que a cliente lê + o detector que de fato reconhece a loja.
    ['dashboard/app/painel/converte-links/page.js', /AliExpress/],
    ['src/detector.js', /aliexpress/],
    ['dashboard/lib/mobileCouponStore.js', /aliexpress: ''/],
    ['dashboard/lib/mobileLogs.js', /aliexpress: 'AliExpress'/],
    ['prisma/schema.prisma', /platforms\s+String\s+@default\("[^"]*aliexpress/],
  ]
  for (const [path, pattern] of required) assert.match(read(path), pattern, `AliExpress ausente em ${path}`)
})

