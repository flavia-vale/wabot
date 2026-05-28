import { test } from 'node:test'
import assert from 'node:assert/strict'
import axios from 'axios'
import { resolveToCleanProductUrl, convert } from '../src/converters/mercadolivre.js'

test('link de recomendação com MLB no path resolve para o produto (tracking removido)', async () => {
  const url = 'https://produto.mercadolivre.com.br/MLB-4049246221-secadora-roupas-portatil-_JM?searchVariation=188766696371#polycard_client=recommendations&reco_backend=x&c_id=/home/element'
  const clean = await resolveToCleanProductUrl(url)
  assert.equal(clean, 'https://produto.mercadolivre.com.br/MLB-4049246221-secadora-roupas-portatil-_JM?searchVariation=188766696371')
})

test('link /up/MLBU (recomendação/anúncio) usa wid= do fragmento como produto real', async () => {
  const url = 'https://www.mercadolivre.com.br/centrifuga-de-roupas-bcr15b/up/MLBU3956523918#polycard_client=recommendations_vip-pads-right&wid=MLB4664496065&sid=recos&is_advertising=true'
  const clean = await resolveToCleanProductUrl(url)
  assert.equal(clean, 'https://produto.mercadolivre.com.br/MLB4664496065-x-_JM')
})

test('convert sinaliza warning ml_ssid_expired quando API de afiliado rejeita auth (401)', async (t) => {
  t.mock.method(axios, 'post', async () => ({ status: 401, data: { message: 'unauthorized: sessão expirada' }, headers: {} }))
  const url = 'https://produto.mercadolivre.com.br/MLB-4049246221-secadora-_JM'
  const result = await convert(url, { tag: '475630078', ssid: 'ssid-expirado-1234567890' })
  assert.equal(typeof result, 'object')
  assert.equal(result.warning, 'ml_ssid_expired')
  assert.match(result.url, /partner_id=475630078/)
})
