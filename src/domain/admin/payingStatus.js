// Quem já colocou dinheiro na mesa — o sinal que a operação mais procura e que
// não existia em lugar nenhum das listas do admin.
//
// Pedido da dona do produto (2026-09-05): "em toda tabela e todo momento em
// que estivermos falando de clientes, quero enxergar de longe quem é pagante".
//
// A fonte é PAGAMENTO APROVADO, nunca o campo `plan`. `plan` também é escrito
// por liberação manual de acesso e por trial, então usá-lo pintaria de verde
// quem nunca pagou — que é justamente o oposto do que a tag serve para dizer.
//
// Dois estados de propósito (decisão de 2026-09-05):
//   - `pagante`     → já pagou E o acesso está em dia. Verde, com cifrão.
//   - `ex_pagante`  → já pagou e o acesso venceu. Cinza. É conversa de
//                     recuperação, não de venda nova — misturar com quem nunca
//                     pagou apagaria essa diferença.
//
// Puro: sem I/O e sem relógio implícito.

export const PAYING_STATUS = {
  PAYING: 'pagante',
  FORMER: 'ex_pagante',
  NEVER: 'nunca_pagou',
}

export const PAYING_LABELS = {
  [PAYING_STATUS.PAYING]: 'Pagante',
  [PAYING_STATUS.FORMER]: 'Já foi pagante',
  [PAYING_STATUS.NEVER]: 'Nunca pagou',
}

export function resolvePayingStatus({ everPaid = false, accessExpiresAt = null, now = Date.now() } = {}) {
  if (!everPaid) {
    return { status: PAYING_STATUS.NEVER, label: PAYING_LABELS[PAYING_STATUS.NEVER], everPaid: false, isPaying: false }
  }
  // Sem data de validade, quem pagou continua valendo como pagante — é o caso
  // de acesso liberado sem prazo. Tirar a tag por falta de dado seria mentir
  // para menos justamente sobre quem paga.
  const expiresMs = accessExpiresAt == null || accessExpiresAt === '' ? null : new Date(accessExpiresAt).getTime()
  const active = !Number.isFinite(expiresMs) || expiresMs > Number(now)
  const status = active ? PAYING_STATUS.PAYING : PAYING_STATUS.FORMER
  return { status, label: PAYING_LABELS[status], everPaid: true, isPaying: active }
}

// Anexa o estado à linha que vai para a tela. Mantido aqui (e não em cada
// rota) para que uma tabela nova herde a mesma regra sem reescrevê-la.
export function withPayingStatus(row, { everPaid = false, now = Date.now() } = {}) {
  const paying = resolvePayingStatus({ everPaid, accessExpiresAt: row?.accessExpiresAt ?? null, now })
  return {
    ...row,
    everPaid: paying.everPaid,
    isPaying: paying.isPaying,
    payingStatus: paying.status,
    payingLabel: paying.label,
  }
}
