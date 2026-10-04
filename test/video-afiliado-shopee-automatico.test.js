import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { VIDEO_AFILIADO_SHOPEE_AUTOMATICO, videoPublicado } from '../src/tutorialVideo.js'

// Frente 5 da análise SEO+GEO de 02/10/2026: o lugar do vídeo fica pronto nas
// páginas, mas nada aparece (nem player, nem VideoObject) enquanto o vídeo
// não foi publicado — schema apontando para vídeo inexistente é dado falso.

test('sem id ou sem data de publicação, o vídeo não existe para o site', () => {
  assert.equal(videoPublicado({ ...VIDEO_AFILIADO_SHOPEE_AUTOMATICO, id: null }), null)
  assert.equal(videoPublicado({ ...VIDEO_AFILIADO_SHOPEE_AUTOMATICO, id: 'abc123', publicadoEm: null }), null)
  assert.equal(videoPublicado(null), null)
})

test('publicado, monta os endereços só no domínio liberado pela CSP (youtube-nocookie)', () => {
  const video = videoPublicado({ ...VIDEO_AFILIADO_SHOPEE_AUTOMATICO, id: 'abc123', publicadoEm: '2026-10-10T12:00:00+00:00' })
  assert.equal(video.url, 'https://www.youtube.com/watch?v=abc123')
  assert.equal(video.embedUrl, 'https://www.youtube-nocookie.com/embed/abc123?rel=0')
  assert.equal(video.uploadDate, '2026-10-10T12:00:00+00:00')
  assert.match(video.title, /AFILIADO SHOPEE/)
})

test('o título do vídeo não promete "não bane" nem ganho', () => {
  const texto = `${VIDEO_AFILIADO_SHOPEE_AUTOMATICO.titulo} ${VIDEO_AFILIADO_SHOPEE_AUTOMATICO.descricao}`
  assert.doesNotMatch(texto, /n[ãa]o ban|anti-?ban|ganh[ea] garantid|renda garantida/i)
})

test('as duas páginas do plano reservam o lugar do vídeo', () => {
  const comercial = fs.readFileSync(new URL('../dashboard/app/_preservationCommercialPages.js', import.meta.url), 'utf8')
  const quemSomos = fs.readFileSync(new URL('../dashboard/app/quem-somos/page.js', import.meta.url), 'utf8')
  const bloco = comercial.slice(comercial.indexOf("'bot-afiliados-whatsapp': {"), comercial.indexOf("'bot-achadinhos-whatsapp': {"))
  assert.match(bloco, /video: videoPublicado\(VIDEO_AFILIADO_SHOPEE_AUTOMATICO\)/)
  assert.match(quemSomos, /<CanalVideo video=\{videoPublicado\(VIDEO_AFILIADO_SHOPEE_AUTOMATICO\)\}/)
})
