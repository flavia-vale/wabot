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
