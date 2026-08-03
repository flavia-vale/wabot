import { getIndexableSeoRoutes } from '../dashboard/lib/seo-registry.mjs'
import { getSiteUrl } from '../dashboard/lib/site-url.js'

/* Chave de verificação do IndexNow. NÃO é segredo — o protocolo exige que ela
 * seja publicada em `dashboard/public/<chave>.txt` para provar posse do domínio.
 *
 * ⚠️ Esta é a chave que o IndexNow REALMENTE aceita para espelhagrupos.com.br
 * (resposta 202). Entre 27/07 e 31/07 o script apontava para
 * `76ef5ca2d765d0c0a6a34d4fc02376fd`, criada por um segundo commit que entrou 1
 * minuto depois do primeiro (c0201487 e 5bee4a71 implementaram o mesmo recurso
 * em paralelo). O IndexNow rejeitava aquela chave com 403
 * `UserForbiddedToAccessSite`, deixando o step vermelho em todo deploy de
 * produção. Confirmado por teste direto contra a API: chave antiga → 202,
 * chave nova → 403, com os dois arquivos servindo 200 em produção.
 *
 * Ao rotacionar: o arquivo .txt deve conter APENAS a chave, sem quebra de linha
 * no fim (a chave que falhava tinha 33 bytes por causa do `\n`; esta tem 32).
 * Só existe UM arquivo .txt de chave no repo — ver test/indexnow-key.test.js.
 */
const INDEXNOW_KEY = 'fa4326c71e4b5b768c893e56db7e045d'
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
const MAX_ATTEMPTS = 3

const baseUrl = getSiteUrl()
const host = new URL(baseUrl).host

const urlList = getIndexableSeoRoutes().map(
  (route) => `${baseUrl}${route.path === '/' ? '' : route.path}`
)

const payload = {
  host,
  key: INDEXNOW_KEY,
  keyLocation: `${baseUrl}/${INDEXNOW_KEY}.txt`,
  urlList,
}

async function submit() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        console.log(`OK: IndexNow notificado com ${urlList.length} URLs (status ${res.status}).`)
        return
      }
      console.warn(`Tentativa ${attempt}/${MAX_ATTEMPTS} falhou: status ${res.status} ${res.statusText}`)
    } catch (err) {
      console.warn(`Tentativa ${attempt}/${MAX_ATTEMPTS} falhou: ${err.message}`)
    }
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 3000))
    }
  }
  console.error('ERRO: falha ao notificar IndexNow após 3 tentativas. O DEPLOY foi concluído — a etapa de SSH roda antes desta.')
  console.error('Se o status for 403 UserForbiddedToAccessSite, o IndexNow não conseguiu validar a posse do domínio. Verifique, nesta ordem:')
  console.error(`  1. ${baseUrl}/${INDEXNOW_KEY}.txt responde 200 e contém APENAS a chave, sem quebra de linha no fim;`)
  console.error('  2. INDEXNOW_KEY neste script bate com o nome do arquivo .txt em dashboard/public/;')
  console.error('  3. existe só UM arquivo de chave em dashboard/public/ (rodar: node --test test/indexnow-key.test.js).')
  process.exit(1)
}

await submit()
