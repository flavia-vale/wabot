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

// FORMATOS QUE A CLIENTE ESCOLHE NA TELA (2026-08-22).
//
// A escolha por grupo voltou ao painel. Só estes DOIS entram na tela, e é de
// propósito — são os que mudam o que a pessoa vê no celular:
//   - `preview`  → texto + card grande; TOCAR NO CARD ABRE A LOJA;
//   - `original` → foto com legenda; tocar na foto só AMPLIA a foto.
// `fetch` e `none` continuam dormentes (FR-006): existem no código e na coluna,
// mas nunca são oferecidos. Valor legado desses dois cai no padrão global em
// vez de reativar um caminho que ninguém escolheu conscientemente.
export const MODOS_ESCOLHIVEIS_NA_TELA = Object.freeze(['preview', 'original'])

/**
 * Modo de imagem EFETIVO de um grupo monitorado. Ordem de precedência:
 *
 *   1. `GROUP_IMAGE_MODE_FORCE` — chave-mestra global. Ignora a escolha de
 *      TODO mundo. Existe porque a lição de 2026-08-19/21 foi justamente essa:
 *      quando uma loja bloqueia o caminho da foto, é preciso trocar o formato
 *      de todas as contas em minutos, sem migration e sem redeploy. Com a
 *      escolha por grupo de volta, `GROUP_IMAGE_MODE` sozinho não conseguiria
 *      mais fazer isso (quem escolheu ganharia da env) — daí a chave separada.
 *   2. A escolha da cliente (`Group.imageMode`), se for um dos formatos que a
 *      tela oferece.
 *   3. `GROUP_IMAGE_MODE` / padrão do produto — vale para grupo que nunca
 *      escolheu nada.
 *
 * @param {{ imageMode?: string|null }} group
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {'preview'|'original'|'fetch'|'none'}
 */
export function resolveGroupImageModeFor(group, env = process.env) {
  const forcado = String(env?.GROUP_IMAGE_MODE_FORCE ?? '').trim().toLowerCase()
  if (MODOS_VALIDOS.has(forcado)) return forcado

  const escolha = String(group?.imageMode ?? '').trim().toLowerCase()
  if (MODOS_ESCOLHIVEIS_NA_TELA.includes(escolha)) return escolha

  return resolveGroupImageMode(env)
}
