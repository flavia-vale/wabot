// Modo de imagem das ofertas espelhadas — chave única, global.
//
// Desde 2026-07 (specs/001-image-mode-preview-default) todo grupo sai como card
// de "preview clicável" e o valor persistido em `Group.imageMode` é ignorado
// pelo chokepoint (`toMonitorGroup`, src/billing/groupEntitlements.js).
//
// 2026-08-20: o Mercado Livre passou a barrar o IP do servidor e parte das
// ofertas voltou a sair sem foto no modo preview. Enquanto a causa não estiver
// fechada, a dona do produto pediu para mudar todo mundo para o outro modo
// disponível — "imagem que veio na mensagem" (`original`), que não depende de
// abrir a página da loja e por isso não é afetado pelo bloqueio.
//
// A troca é por env (não por dado): assim ela vale para todas as contas de uma
// vez, não reescreve escolha nenhuma no banco e volta ao preview apagando a
// linha do `.env` — sem migration e sem redeploy. O valor persistido continua
// intocado (a "memória" de quem estava em preview está no snapshot gravado por
// `scripts/snapshot-image-mode.mjs`).
const MODOS_VALIDOS = new Set(['preview', 'original', 'fetch', 'none'])

export const DESTINATION_IMAGE_MODE = Object.freeze({
  ORIGINAL: 'original',
  ORIGINAL_WATERMARK: 'original_watermark',
  PREVIEW: 'preview',
  PREVIEW_WATERMARK: 'preview_watermark',
})

const DESTINATION_MODES = new Set(Object.values(DESTINATION_IMAGE_MODE))

export function resolveDestinationImageMode(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return DESTINATION_MODES.has(normalized) ? normalized : DESTINATION_IMAGE_MODE.ORIGINAL
}

export function destinationImageBaseMode(value) {
  const mode = resolveDestinationImageMode(value)
  return mode.startsWith('preview') ? DESTINATION_IMAGE_MODE.PREVIEW : DESTINATION_IMAGE_MODE.ORIGINAL
}

export function destinationImageUsesWatermark(value) {
  const mode = resolveDestinationImageMode(value)
  return mode === DESTINATION_IMAGE_MODE.ORIGINAL_WATERMARK || mode === DESTINATION_IMAGE_MODE.PREVIEW_WATERMARK
}

// 2026-08-21: o padrão do produto passou de `preview` para `original` ("a foto
// que veio na oferta"). O card de preview depende de ABRIR A PÁGINA DA LOJA para
// achar a foto, e com o Mercado Livre bloqueando o IP do servidor a oferta saía
// sem imagem — medido em produção: todo link de produto direto do ML ficava sem
// foto, e um grupo que só recebia esse tipo de link ficou 100% sem imagem.
// `original` não abre a loja: reaproveita a foto da própria mensagem, subindo-a
// de novo (mesmo caminho do botão "Ver canal", que sempre funcionou).
//
// O modo `preview` CONTINUA no código e alcançável por `GROUP_IMAGE_MODE=preview`
// — a investigação da foto por loja fica para depois. Só deixou de ser padrão e
// não é oferecido na tela da cliente.
export const DEFAULT_GROUP_IMAGE_MODE = 'original'

/**
 * Modo efetivo de imagem para TODOS os grupos monitorados.
 * Valor desconhecido/ausente cai no padrão histórico (`preview`) — nunca deixa
 * o pipeline sem modo por causa de um `.env` mal preenchido.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {'preview'|'original'|'fetch'|'none'}
 */
export function resolveGroupImageMode(env = process.env) {
  const raw = String(env?.GROUP_IMAGE_MODE ?? '').trim().toLowerCase()
  return MODOS_VALIDOS.has(raw) ? raw : DEFAULT_GROUP_IMAGE_MODE
}

// Como a foto "que veio na mensagem" chega ao destino: SUBINDO de novo
// (`reupload`) ou REPASSANDO o proto já hospedado da origem (`relay`).
//
// RCA 2026-08-20/21: existiam DOIS caminhos para a mesma promessa de produto
// ("usar a imagem da mensagem"), e eles não eram equivalentes:
//   - destino COM botão "Ver canal" → `getImage` baixa a mídia da origem e a
//     SOBE de novo como imagem nova (o botão só é aceito em corpo de mídia).
//     É o caminho que a cliente descreve como "funciona perfeito".
//   - destino SEM botão, modo `original` → `relayMessage` REAPROVEITA o proto
//     da origem, sem subir nada.
// Ao mudar todas as contas para `original`, o grupo sem botão passou a usar o
// repasse e a cliente reportou oferta que chegava no grupo gêmeo (com botão) e
// não chegava nele — com o envio gravado como sucesso, porque o repasse é
// aceito pelo Baileys e a perda acontece depois, na entrega.
//
// Padrão passa a ser `reupload`: um caminho só, o mesmo que já funciona.
// Escape hatch `IMAGE_ORIGINAL_STRATEGY=relay` volta ao comportamento
// histórico (mais barato e preserva vídeo) sem redeploy.
export function shouldReuploadOriginalMedia(env = process.env) {
  return String(env?.IMAGE_ORIGINAL_STRATEGY ?? '').trim().toLowerCase() !== 'relay'
}

// 2026-08-22 (fim do dia): a escolha por grupo foi RETIRADA da tela porque, com
// ela ligada em produção, apareceu divergência entre o que o painel mostrava e
// o que saía no grupo. A suspeita — nunca comprovada até então — era
// `getImage()` no bot-worker memoizar a imagem UMA vez por MENSAGEM (uma única
// variável `cachedImage`), não por destino: como `buildPayload` roda uma vez
// por destino, o PRIMEIRO destino a resolver a imagem fixava o resultado para
// todos os destinos seguintes da mesma oferta, mesmo que pedissem modos
// diferentes.
//
// 2026-08-28 (specs deste módulo): a escolha volta À TELA, agora por DESTINO
// (não mais por grupo monitorado — a origem nunca leu `imageMode`, quem lê é
// o destino de postagem). A causa suspeita acima É a que este módulo fecha:
// `getImage()` em bot-worker.js passou a memoizar num `Map` chaveado pelo modo
// EFETIVO (`destinationImageBaseMode`) em vez de uma variável única, então
// destinos com modos diferentes na MESMA mensagem resolvem e cacheiam
// independentemente — dois destinos gêmeos, um 'original' e outro 'preview',
// não competem mais pelo mesmo slot de cache. Ver
// `test/destination-watermark-worker.test.js` ("dois destinos com modos
// diferentes na mesma mensagem não compartilham cache de imagem") para a
// guarda de regressão. Antes de expandir esse comportamento (ex.: ativar
// `preview_watermark`), validar em staging com dois destinos reais e modos
// diferentes na mesma oferta — é exatamente o cenário que gerou a divergência
// de 22/08.
export const DESTINATION_IMAGE_MODE = Object.freeze({
  ORIGINAL: 'original',
  ORIGINAL_WATERMARK: 'original_watermark',
  PREVIEW: 'preview',
  // Ainda NÃO implementado no worker nem aceito pela API — ver groups.js e
  // bot-worker.js. Existe aqui só para a política já falar a linguagem final
  // e o próximo passo não precisar reescrever este enum.
  PREVIEW_WATERMARK: 'preview_watermark',
})

const DESTINATION_MODES = new Set(Object.values(DESTINATION_IMAGE_MODE))

/**
 * Modo de imagem do DESTINO (grupo/canal de postagem), nunca da origem.
 * Valor desconhecido/ausente cai em 'original' — nunca deixa o pipeline sem
 * modo por causa de um valor legado (`none`/`fetch`/`preview` gravado antes
 * desta feature) ou de um dado corrompido.
 * @param {string|null|undefined} value
 * @returns {'original'|'original_watermark'|'preview'|'preview_watermark'}
 */
export function resolveDestinationImageMode(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return DESTINATION_MODES.has(normalized) ? normalized : DESTINATION_IMAGE_MODE.ORIGINAL
}

/**
 * Modo-base da imagem (de onde os bytes vêm): 'original' reaproveita a foto da
 * mensagem monitorada; 'preview' raspa a loja e monta o card clicável. As
 * variantes com marca d'água usam o mesmo modo-base do par sem marca.
 */
export function destinationImageBaseMode(value) {
  const mode = resolveDestinationImageMode(value)
  return mode.startsWith('preview') ? DESTINATION_IMAGE_MODE.PREVIEW : DESTINATION_IMAGE_MODE.ORIGINAL
}

export function destinationImageUsesWatermark(value) {
  const mode = resolveDestinationImageMode(value)
  return mode === DESTINATION_IMAGE_MODE.ORIGINAL_WATERMARK || mode === DESTINATION_IMAGE_MODE.PREVIEW_WATERMARK
}
