import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('as quatro superfícies de oferta expõem destinos Instagram conectados', async () => {
  const [manual, queues, automations, mirroring] = await Promise.all([
    read('dashboard/app/painel/criar-oferta/page.js'),
    read('dashboard/app/painel/filas/page.js'),
    read('dashboard/app/painel/ofertas-automaticas/page.js'),
    read('dashboard/app/painel/espelhamento/page.js'),
  ])
  assert.match(manual, /instagramStoryCreate/)
  assert.match(manual, /InstagramDestinationPicker/)
  assert.match(queues, /instagramDestinationIds/)
  assert.match(automations, /instagramDestinationIds/)
  assert.match(mirroring, /instagramMirrorTargetsUpdate/)
})

test('fila recebe snapshot canônico da oferta quando também publica Story', async () => {
  const manual = await read('dashboard/app/painel/criar-oferta/page.js')
  assert.match(manual, /offerQueueItemAdd\(queueId, payload\)/)
  assert.match(manual, /const payload = \{ text: offerMessage, imageUrl: generated\?\.imageUrl, imageRefererUrl: generated\?\.imageRefererUrl, offer \}/)
})

test('fila Instagram-only não reutiliza o fallback legado de todos os grupos', async () => {
  const route = await read('src/api/routes/offerQueue.js')
  assert.match(route, /queue\.whatsappEnabled === false \? \[\] : await resolveTargetJids/)
})

test('seletores Instagram ficam restritos ao plano acima do Pro na UI', async () => {
  const entitlement = await read('dashboard/lib/planEntitlements.js')
  assert.match(entitlement, /plan !== 'premium'/)
  for (const path of ['dashboard/app/painel/criar-oferta/page.js', 'dashboard/app/painel/filas/page.js', 'dashboard/app/painel/ofertas-automaticas/page.js', 'dashboard/app/painel/espelhamento/page.js']) {
    assert.match(await read(path), /hasInstagramStoriesAccess/)
  }
})

test('plano Premium herda as telas Pro em vez de cair no paywall', async () => {
  // hasProLikeAccess delega para getPlanEntitlements (src/billing/plans.js —
  // fonte ÚNICA do gate de plano, FR-015/FR-015a,
  // specs/018-unificar-protecao-anti-ban) em vez de reimplementar a regra
  // aqui: duas fontes discordando foi exatamente o bug que deixava o Premium
  // bloqueado na tela antiga de Preservação.
  const entitlement = await read('dashboard/lib/planEntitlements.js')
  assert.match(entitlement, /from ['"]\.\.\/\.\.\/src\/billing\/plans\.js['"]/)
  assert.match(entitlement, /getPlanEntitlements/)
  const { hasProLikeAccess } = await import('../dashboard/lib/planEntitlements.js')
  assert.equal(hasProLikeAccess({ plan: 'premium', accessExpiresAt: null }), true)
})
