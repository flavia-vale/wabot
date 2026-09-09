// "Este número de WhatsApp já fez o teste grátis em outra conta?"
//
// Módulo PURO: recebe a foto e devolve a decisão. Sem banco, sem rede.
//
// POR QUE O NÚMERO, E NÃO O RESTO (medido em produção, 2026-09-09):
// quatro pessoas usaram doze contas para renovar o teste. Uma delas trocou
// nome E e-mail a cada conta (`giovannagaby42`, `giovannafirmino872`,
// `joaopedroferreiragazzani2345`) e NENHUMA regra de nome ou de e-mail a
// pegaria. O que as três tinham em comum era o número do WhatsApp conectado.
//
// A razão é econômica, não técnica: e-mail, nome e endereço de internet são
// descartáveis, e o número do WhatsApp não é — é onde vivem os grupos da
// cliente. Quem troca de chip para ganhar sete dias perde o ativo que faz o
// produto valer. Um bom identificador antifraude é aquele que a pessoa não
// quer trocar.
//
// QUATRO INVARIANTES QUE NÃO PODEM AFROUXAR:
//
// 1. **Conta pagante NUNCA é bloqueada.** Nem que o número se repita, nem que
//    o histórico esteja sujo. Barrar quem paga é o pior desfecho possível, e
//    nenhuma economia de teste grátis compensa.
// 2. **Só bloqueia quem está em TESTE agora.** A regra existe para impedir
//    teste em cima de teste, não para impedir alguém de usar o produto.
// 3. **Fail-safe é DEIXAR CONECTAR.** Sem número confiável, sem histórico,
//    com dado faltando ou com a trava desligada → conecta. Impedir uma cliente
//    legítima de ligar o robô custa mais que um teste grátis a mais.
// 4. **A trava nasce DESLIGADA** (`WA_PHONE_REUSE_MODE=off`). Isto mexe no
//    caminho mais sensível do produto; liga em staging primeiro, e desligar é
//    uma linha no `.env`, sem redeploy.

/** Modos, em ordem de severidade. `off` é o default. */
export const PHONE_REUSE_MODES = Object.freeze(['off', 'warn', 'block'])

export function resolvePhoneReuseMode(value = process.env.WA_PHONE_REUSE_MODE) {
  const modo = String(value ?? '').trim().toLowerCase()
  return PHONE_REUSE_MODES.includes(modo) ? modo : 'off'
}

/**
 * Só dígitos. O WhatsApp devolve o número de formas diferentes conforme o
 * caminho (`5511999998888`, `+55 11 99999-8888`), e comparar formatação
 * faria a mesma pessoa parecer duas.
 */
export function normalizeWaPhone(phone) {
  const digitos = String(phone ?? '').replace(/\D/g, '')
  // Abaixo de 8 dígitos não é telefone; acima de 15 não existe no plano
  // internacional. Nos dois casos preferimos não ter opinião.
  if (digitos.length < 8 || digitos.length > 15) return null
  return digitos
}

/** Planos que significam "esta conta paga". Trial e vazio ficam de fora. */
const PLANOS_PAGOS = new Set(['basic', 'pro'])

export function isPayingPlan(plan) {
  return PLANOS_PAGOS.has(String(plan ?? '').trim().toLowerCase())
}

/**
 * @param {object} args
 * @param {string} args.phone  número que acabou de conectar
 * @param {{ id?: string, plan?: string, accessExpiresAt?: Date|string|null }} args.currentUser
 * @param {Array<{ userId?: string, email?: string, plan?: string, paid?: boolean }>} args.previousOwners
 *   contas ANTERIORES que já conectaram este mesmo número (sem a atual)
 * @param {string} [args.mode]
 * @returns {{ acao: 'permitir'|'avisar'|'bloquear', motivo: string, contas: string[] }}
 */
export function decidePhoneReuse({ phone, currentUser = {}, previousOwners = [], mode } = {}) {
  const modo = mode ?? resolvePhoneReuseMode()
  const permitir = (motivo) => ({ acao: 'permitir', motivo, contas: [] })

  if (modo === 'off') return permitir('trava_desligada')
  if (!normalizeWaPhone(phone)) return permitir('sem_numero_confiavel')

  const anteriores = (Array.isArray(previousOwners) ? previousOwners : [])
    .filter(c => c && c.userId && c.userId !== currentUser.id)
  if (!anteriores.length) return permitir('numero_inedito')

  const contas = anteriores.map(c => c.email || c.userId).filter(Boolean)

  // Invariante 1: quem paga passa, sempre. Vale para a conta atual...
  if (isPayingPlan(currentUser.plan)) {
    return { acao: 'avisar', motivo: 'conta_pagante_com_numero_repetido', contas }
  }
  // ...e o aviso muda de tom quando o número já teve conta pagante antes: aí a
  // conversa é de renovação, não de teste repetido.
  const jaPagouAntes = anteriores.some(c => c.paid === true || isPayingPlan(c.plan))

  if (modo === 'warn') {
    return { acao: 'avisar', motivo: jaPagouAntes ? 'numero_de_ex_pagante' : 'teste_repetido', contas }
  }

  return {
    acao: 'bloquear',
    motivo: jaPagouAntes ? 'numero_de_ex_pagante' : 'teste_repetido',
    contas,
  }
}

/**
 * O que a cliente lê quando a conexão é recusada.
 *
 * Linguagem leiga obrigatória nesta superfície: nada de "conta", "sessão",
 * "trial", "bloqueio". E o texto SEMPRE oferece a saída — sem ela, a recusa
 * vira parede e a pessoa some sem falar com ninguém.
 */
export function describePhoneReuseBlock(motivo) {
  if (motivo === 'numero_de_ex_pagante') {
    return 'Este número de WhatsApp já usou o Espelha Grupos antes. Para voltar a enviar suas ofertas, escolha um plano — tudo o que você configurou continua salvo.'
  }
  return 'Este número de WhatsApp já fez o teste grátis. O teste é liberado uma vez por pessoa. Para continuar enviando suas ofertas, escolha um plano — tudo o que você configurou continua salvo.'
}

/**
 * E-mail da conta anterior, parcialmente escondido.
 *
 * A tela de recusa PRECISA mostrar de qual conta se trata, senão a cliente não
 * tem como agir — mas o endereço inteiro na tela entregaria o e-mail de outra
 * pessoa a quem só teve posse do número. Mostrar o suficiente para ela
 * reconhecer o que é dela, e nada além disso: o botão de recuperar senha
 * dispara para o endereço COMPLETO no backend, e quem é dona recebe no
 * próprio e-mail.
 */
export function maskEmailForNotice(email) {
  const texto = String(email ?? '').trim().toLowerCase()
  const at = texto.lastIndexOf('@')
  if (at <= 0) return null
  const local = texto.slice(0, at)
  const dominio = texto.slice(at)
  if (local.length <= 2) return `${local[0]}***${dominio}`
  return `${local.slice(0, 3)}***${dominio}`
}

/** O que gravamos na sessão para a tela montar a recusa. */
export function buildPhoneReuseNotice({ motivo, previousEmail } = {}) {
  return {
    tipo: 'phone_reuse',
    motivo: motivo ?? 'teste_repetido',
    texto: describePhoneReuseBlock(motivo),
    emailMascarado: maskEmailForNotice(previousEmail),
    // O endereço completo NUNCA vai para o navegador: ele fica aqui só para o
    // botão de recuperar senha disparar do lado do servidor.
    emailCompleto: String(previousEmail ?? '').trim().toLowerCase() || null,
  }
}
