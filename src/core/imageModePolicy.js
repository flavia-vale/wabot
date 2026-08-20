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

export const DEFAULT_GROUP_IMAGE_MODE = 'preview'

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
