// Regras de CONTATO ATIVO semanal — quem a dona do produto deve procurar nesta
// semana, e em qual conversa cada cliente entra.
//
// PURO de propósito: nada de banco, rede ou data implícita. Quem carrega os
// fatos é `scripts/contato-ativo-semanal.mjs`; quem decide é aqui. Assim a
// regra é testável sem banco e não se espalha por cópias que passam a
// discordar entre si (mesma lição de `signupOrigin.js` e `payingStatus.js`).
//
// INVARIANTE PRINCIPAL: cada cliente entra em UM grupo só, o de maior
// prioridade. Uma pessoa que venceu o plano, está com o robô caído e sem loja
// cadastrada não pode virar três mensagens na mesma semana — isso é o caminho
// mais rápido para ela parar de ler o que a gente manda (mesma razão do teto
// semanal de e-mails automáticos em `src/email/accountActivity.js`).

const DIA = 24 * 60 * 60 * 1000

/**
 * Os grupos, EM ORDEM DE PRIORIDADE. O primeiro que casar leva a cliente.
 *
 * `pedido: true` marca os cinco grupos pedidos explicitamente pela dona do
 * produto; os demais são sugestões — todos podem ser filtrados no script.
 */
export const OUTREACH_SEGMENTS = Object.freeze([
  {
    id: 'cobranca-recusada',
    titulo: 'Cobrança automática recusada (últimos 7 dias)',
    porque: 'Ela já é cliente e o cartão foi recusado. É receita que já existe indo embora sozinha.',
    acao: 'Avisar com o acesso dela AINDA valendo e oferecer atualizar o cartão ou pagar avulso. Nunca pedir para assinar de novo (tentativa idêntica repetida é o que dispara a recusa por suspeita).',
  },
  {
    id: 'vence-em-breve',
    titulo: 'Acesso vence nos próximos 5 dias (sem renovação automática)',
    porque: 'Conversa barata: ela ainda está usando o robô. Depois do vencimento o custo de trazer de volta é muito maior.',
    acao: 'Lembrar da data e oferecer ligar a cobrança automática.',
  },
  {
    id: 'venceu-ate-3d',
    titulo: '1. Venceu nos últimos 3 dias e não renovou',
    porque: 'O robô parou agora. É a janela de maior chance de volta.',
    acao: 'Mensagem curta com o link de pagamento. Se ela nunca enviou nada (coluna nunca_enviou), o assunto é OUTRO: ela não chegou a ver o produto funcionar — cobrar aí afasta.',
    pedido: true,
  },
  {
    id: 'venceu-4-a-20d',
    titulo: '2. Venceu entre 4 e 20 dias',
    porque: 'Ainda lembra do produto e os grupos dela continuam configurados aqui.',
    acao: 'Perguntar o que faltou antes de oferecer preço. Se ela usava bastante (último envio recente), vale lembrar do volume que ela publicava.',
    pedido: true,
  },
  {
    id: 'venceu-mais-20d',
    titulo: '3. Venceu há mais de 20 dias',
    porque: 'Recuperação fria. Vale um contato por mês, não por semana.',
    acao: 'Mensagem de reativação (novidades, condição). Não insistir toda semana com a mesma pessoa.',
    pedido: true,
  },
  {
    id: 'sem-envio-ate-7d',
    titulo: '4. Criou a conta nos últimos 7 dias e nunca publicou nada',
    porque: 'Está dentro do teste e travou em alguma etapa. É o contato com maior retorno do funil.',
    acao: 'Olhar as colunas whatsapp e loja: elas dizem ONDE ela parou. Oferecer configurar junto.',
    pedido: true,
  },
  {
    id: 'sem-envio-8-a-20d',
    titulo: '5. Criou a conta entre 8 e 20 dias atrás e nunca publicou nada',
    porque: 'O teste está acabando (ou acabou) sem ela ter visto o robô funcionar uma vez.',
    acao: 'Mesma leitura das colunas whatsapp/loja. Aqui o risco é ela concluir que o produto não funciona.',
    pedido: true,
  },
  {
    id: 'robo-caido',
    titulo: 'Acesso em dia e WhatsApp desconectado há 2+ dias',
    porque: 'Ela está PAGANDO e sem robô. É o pior desfecho possível para uma cliente ativa.',
    acao: 'Avisar que caiu e ajudar a reconectar. Confira antes se foi ela quem desligou.',
  },
  {
    id: 'parou-de-enviar',
    titulo: 'Acesso em dia, já publicava e parou há 7+ dias',
    porque: 'Sinal silencioso de abandono: o plano segue valendo e o produto deixou de ser usado.',
    acao: 'Perguntar o que mudou. Costuma ser loja recusada, grupo trocado ou fila parada.',
  },
  {
    id: 'sem-loja',
    titulo: 'Acesso em dia e nenhuma loja cadastrada',
    porque: 'Sem a etiqueta de afiliada o robô recebe as ofertas e NÃO publica nada. O painel fica verde e ela acha que o produto não funciona.',
    acao: 'Mandar o vídeo do cadastro da loja. É a causa nº 1 de "não sai nada".',
  },
])

const ORDEM = OUTREACH_SEGMENTS.map(s => s.id)

export function describeOutreachSegment(id) {
  return OUTREACH_SEGMENTS.find(s => s.id === id) ?? null
}

function diasEntre(depois, antes) {
  const a = depois instanceof Date ? depois.getTime() : Number(depois)
  const b = antes instanceof Date ? antes.getTime() : Number(antes)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return (a - b) / DIA
}

/**
 * Decide em qual conversa a cliente entra nesta semana, ou `null` quando não
 * há motivo para procurá-la.
 *
 * Fail-safe: na dúvida NÃO entra em lista nenhuma. Contato ativo é caro e
 * mandar mensagem errada (cobrar quem já pagou, avisar de queda quem desligou
 * o robô de propósito) custa mais que o contato que deixou de acontecer.
 */
export function classifyOutreachSegment(cliente = {}, now = new Date()) {
  const agora = now instanceof Date ? now : new Date(now)
  const {
    status,
    createdAt,
    accessExpiresAt,
    everSent = false,
    lastSentAt = null,
    hasCredential = false,
    waEverConnected = false,
    waConnected = false,
    waSince = null,
    waStoppedByUser = false,
    subscriptionActive = false,
    lastRejectedChargeAt = null,
    lastApprovedPaymentAt = null,
  } = cliente

  // Conta bloqueada não recebe contato de vendas.
  if (status === 'banned' || status === 'suspended') return null

  const expira = accessExpiresAt ? new Date(accessExpiresAt) : null
  const expiraValido = expira && !Number.isNaN(expira.getTime())
  const diasDesdeVencimento = expiraValido ? diasEntre(agora, expira) : null
  const acessoValido = expiraValido ? diasDesdeVencimento < 0 : false

  // 1. Cobrança recusada: só quando a recusa é recente E nada foi pago depois
  //    dela (quem voltou a cobrar não precisa de aviso).
  if (lastRejectedChargeAt) {
    const recusa = new Date(lastRejectedChargeAt)
    const dias = diasEntre(agora, recusa)
    const pagouDepois = lastApprovedPaymentAt
      ? new Date(lastApprovedPaymentAt).getTime() > recusa.getTime()
      : false
    if (dias !== null && dias >= 0 && dias <= 7 && !pagouDepois) return 'cobranca-recusada'
  }

  // 2. Vencendo: só faz sentido com acesso ainda valendo e sem cobrança
  //    automática ligada — quem tem renovação automática não precisa ser
  //    lembrada de pagar.
  if (acessoValido && !subscriptionActive && diasDesdeVencimento > -5) return 'vence-em-breve'

  // 3-5. Vencidos, em três janelas.
  if (!acessoValido && expiraValido && !subscriptionActive) {
    if (diasDesdeVencimento <= 3) return 'venceu-ate-3d'
    if (diasDesdeVencimento <= 20) return 'venceu-4-a-20d'
    return 'venceu-mais-20d'
  }

  const diasDeConta = createdAt ? diasEntre(agora, new Date(createdAt)) : null

  // 6-7. Nunca publicou nada, em duas janelas de idade da conta.
  if (!everSent && diasDeConta !== null) {
    if (diasDeConta <= 7) return 'sem-envio-ate-7d'
    if (diasDeConta <= 20) return 'sem-envio-8-a-20d'
    // Mais de 20 dias sem nunca ter publicado e sem plano vencido: já foi
    // procurada duas vezes. Não vira lista semanal.
    return null
  }

  // Daqui para baixo só entra quem comprovadamente está com o acesso em dia
  // (ou com renovação automática ligada). Sem data de validade confiável não
  // dá para afirmar isso — e o fail-safe é NÃO procurar.
  if (!acessoValido && !subscriptionActive) return null

  // Acesso em dia (ou renovação automática ligada).
  // 8. Robô caído. "Ela desligou" NUNCA entra — desligar é escolha, não
  //    problema (mesma regra de `wasStoppedByUser` nos e-mails de saúde).
  if (waEverConnected && !waConnected && !waStoppedByUser && waSince) {
    const dias = diasEntre(agora, new Date(waSince))
    if (dias !== null && dias >= 2) return 'robo-caido'
  }

  // 9. Publicava e parou.
  if (everSent && lastSentAt) {
    const dias = diasEntre(agora, new Date(lastSentAt))
    if (dias !== null && dias >= 7) return 'parou-de-enviar'
  }

  // 10. Sem loja cadastrada: o robô não publica NADA e nada avisa isso.
  if (!hasCredential) return 'sem-loja'

  return null
}

/** Ordena as linhas na mesma ordem de prioridade dos grupos. */
export function compareBySegment(a, b) {
  return ORDEM.indexOf(a) - ORDEM.indexOf(b)
}
