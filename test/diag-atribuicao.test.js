// Guardas dos dois erros de atribuição encontrados em 2026-08-19, rodando os
// scripts de diagnóstico contra produção. Os dois faziam o relatório mentir na
// direção mais cara: um escondia de onde vem o cliente, o outro dizia que
// alguém tinha visto o produto funcionar quando não tinha.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { classificaLanding, origemDeIA } from '../scripts/diag-origem-cadastros.mjs'

const raiz = new URL('..', import.meta.url)

test('landing_page com utm colado no caminho ainda é classificada pela página', () => {
  // O sanitizador de atribuição troca '?' e '=' por '-', então a query vira
  // parte do caminho. Cortar em '?' nunca dispara — foi assim que 5 cadastros
  // vindos de páginas comerciais caíram em "outro".
  assert.equal(
    classificaLanding('/automatizar-divulgacao-em-grupos-whatsapp-utm_source-chatgpt.com'),
    'CONTEÚDO (página de busca)'
  )
  assert.equal(
    classificaLanding('/padronizar-divulgacao-afiliado-whatsapp-utm_source-chatgpt.com'),
    'CONTEÚDO (página de busca)'
  )
  assert.equal(classificaLanding('/blog/como-ser-afiliado-shopee-whatsapp'), 'CONTEÚDO (blog)')
  assert.equal(classificaLanding('/alternativas/achadinhos-bot'), 'CONTEÚDO (comparativo)')
})

test('prefixos comerciais que existiam de verdade não caem em "outro"', () => {
  // Estes vieram do dado real de produção. Cada um que falta aqui é um cadastro
  // de SEO contado como origem desconhecida.
  for (const rota of [
    '/bot-achadinhos-whatsapp',
    '/bot-afiliados-whatsapp',
    '/automatizar-divulgacao-em-grupos-whatsapp',
    '/padronizar-divulgacao-afiliado-whatsapp',
    '/postar-em-varios-grupos-whatsapp-ao-mesmo-tempo',
    '/reduzir-tempo-operacional-em-grupos-whatsapp',
    '/programa-de-afiliados',
  ]) {
    assert.equal(classificaLanding(rota), 'CONTEÚDO (página de busca)', `${rota} caiu em outro`)
  }
})

test('reconhece o carimbo que a IA põe no link', () => {
  assert.equal(origemDeIA('/bot-ofertas-afiliados-whatsapp-utm_source-chatgpt.com'), 'chatgpt')
  assert.equal(origemDeIA('/-utm_source-chatgpt.com'), 'chatgpt')
  assert.equal(origemDeIA('/x?utm_source=perplexity.ai'), 'perplexity')
  assert.equal(origemDeIA('/bot-achadinhos-whatsapp'), null)
  assert.equal(origemDeIA(''), null)
})

test('home e cadastro continuam marcados como ambíguos', () => {
  // Não podem virar "CONTEÚDO": creditar SEO por isso infla o número que
  // justifica investimento.
  assert.equal(classificaLanding('/'), 'home (ambíguo)')
  assert.equal(classificaLanding('/-utm_source-chatgpt.com'), 'home (ambíguo)')
  assert.equal(classificaLanding('/login-reason-session-expired'), 'direto no cadastro (ambíguo)')
  assert.equal(classificaLanding(''), 'sem registro')
})

test('o funil só conta como envio a linha que SAIU', () => {
  const fonte = readFileSync(new URL('scripts/diag-funil-ativacao.mjs', raiz), 'utf8')
  // Sem o filtro de status, linha `skipped` (o caso comum de quem não tem
  // credencial: skip:no_valid_conversions) contava como "enviou" e jogava a
  // pessoa no grupo "viu o produto funcionar" — conversa oposta à necessária.
  assert.match(fonte, /status: 'success'[^)]*distinct: \['userId'\]/)
  // Os rótulos saíram daqui para `src/domain/admin/funnel.js` (o mesmo módulo
  // que o painel /admin/funil usa) — a distinção continua obrigatória, só
  // mudou de casa. Sem ela, "tentou e nada saiu" some dentro de "nunca enviou"
  // e a conversa mais urgente do funil desaparece.
  assert.match(fonte, /classifyStallReason/)
  const motivos = readFileSync(new URL('src/domain/admin/funnel.js', raiz), 'utf8')
  assert.match(motivos, /'tried_nothing_sent'/)
  assert.match(motivos, /'sent_no_checkout'/)
})
