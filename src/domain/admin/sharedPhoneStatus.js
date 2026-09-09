// Tag "número repetido" — o mesmo número de WhatsApp aparecendo em mais de uma
// conta.
//
// Módulo PURO, no mesmo desenho de `payingStatus.js`: a decisão é do backend,
// nunca de cada tela. Sem isso, duas tabelas do admin passariam a discordar
// sobre quem está marcado, que é exatamente o que a tag existe para evitar.
//
// POR QUE ESTA TAG (medido em produção, 2026-09-09): quatro pessoas usaram doze
// contas para renovar o teste. Uma trocou nome E e-mail a cada conta, então
// nenhuma regra de nome ou e-mail a pegaria — só o número em comum. A tag põe
// esse sinal na frente de quem decide, em vez de deixá-lo num evento de banco
// que ninguém consulta.
//
// DUAS INVARIANTES:
//
// 1. **A tag descreve um FATO, não uma acusação.** "Este número aparece em N
//    contas" é verdade verificável; "esta pessoa fraudou" é conclusão, e quem
//    conclui é gente. Troca de chip e conta antiga abandonada produzem o mesmo
//    sinal.
// 2. **Sem dado confiável, sem tag.** Falta de tag é ausência de informação;
//    tag errada é informação falsa, e a segunda é pior.

/**
 * @param {{ sharedPhoneAccounts?: number }} args
 *   `sharedPhoneAccounts` = em quantas contas o número desta cliente aparece,
 *   contando a dela. 2 ou mais significa repetido.
 * @returns {{ status: 'numero_repetido'|null, contas: number }}
 */
export function resolveSharedPhoneStatus({ sharedPhoneAccounts } = {}) {
  const contas = Number(sharedPhoneAccounts)
  if (!Number.isFinite(contas) || contas < 2) return { status: null, contas: 0 }
  return { status: 'numero_repetido', contas: Math.trunc(contas) }
}

/** Aplica a tag ao objeto que vai para a tela, no padrão de `withPayingStatus`. */
export function withSharedPhoneStatus(customer, sharedPhoneAccounts) {
  const { status, contas } = resolveSharedPhoneStatus({ sharedPhoneAccounts })
  return { ...customer, sharedPhoneStatus: status, sharedPhoneAccounts: contas }
}
