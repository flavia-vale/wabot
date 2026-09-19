import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// RCA 2026-09-18: /alternativas/* e os posts do blog não registravam chegada
// por IA nem a primeira página do cadastro. Guarda estrutural: os dois
// templates precisam continuar montando o rastreador público, e ele precisa
// continuar seguindo a regra de privacidade (só o host do referenciador).

const here = path.dirname(fileURLToPath(import.meta.url))
const read = (rel) => fs.readFileSync(path.join(here, '..', rel), 'utf8')

test('o rastreador público registra origem e first-touch pela MESMA regra do OrganicPageTracker', () => {
  const src = read('dashboard/components/marketing/PublicReferralTracker.jsx')
  assert.match(src, /classifyReferrer\(document\.referrer, window\.location\.hostname\)/)
  assert.match(src, /shouldTrackReferral\(referral\)/)
  assert.match(src, /captureFirstTouchLandingPage\(/)
  assert.match(src, /TRACKING_EVENTS\.REFERRAL_VISIT/)
  assert.match(src, /referrer_host: referral\.host/)
  // Privacidade: nunca manda a URL do referenciador, só o host classificado.
  assert.doesNotMatch(src, /referrer_url|referrer:\s*document\.referrer/)
})

test('/alternativas/* (ComparisonPageTracker) passa a medir chegada por IA', () => {
  const src = read('dashboard/components/marketing/ComparisonPageTracker.jsx')
  assert.match(src, /import \{ trackPublicReferral \} from '\.\/PublicReferralTracker'/)
  assert.match(src, /trackPublicReferral\(\{ template: 'comparison'/)
})

test('os posts do blog (ArticleShell) montam o rastreador público', () => {
  const src = read('dashboard/components/marketing/ArticleShell.jsx')
  assert.match(src, /<PublicReferralTracker template="article" \/>/)
})

test('o evento continua nas três allowlists (navegador, rota, gravação)', () => {
  const browser = read('dashboard/lib/analytics.js')
  const server = read('src/analytics.js')
  assert.match(browser, /referral_visit/)
  assert.ok((server.match(/referral_visit/g) || []).length >= 2, 'src/analytics.js precisa listar referral_visit nas allowlists pública e de gravação')
})
