import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveToCleanProductUrl } from '../src/converters/mercadolivre.js'

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
