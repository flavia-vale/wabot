// Aviso de "seu teste está acabando" no painel, com a PROVA do que o robô já
// fez pela cliente. Puro — sem banco, sem data implícita (o `now` entra).
//
// Por que existe: a mediana entre cadastro e primeiro pagamento é 7 dias,
// exatamente o fim do teste — ou seja, quem paga decide no fim do trial. E 34
// das 113 pessoas que não pagaram (30,1%) chegaram a ver oferta publicada e
// mesmo assim nunca abriram o pagamento. O teste acabava em silêncio.
//
// A prova de valor é obrigatória: "seu teste acaba" sozinho é cobrança; com "o
// robô já publicou N ofertas" vira lembrança do que ela perde. Quando N é
// zero, o aviso muda de assunto — pedir pagamento de quem nunca viu o produto
// funcionar é o jeito mais rápido de perder a cliente.

/** Quantos dias antes do fim o aviso começa a aparecer. */
export const TRIAL_NOTICE_WINDOW_DAYS = 3

const DAY_MS = 24 * 60 * 60 * 1000

function toDate(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function labelDias(dias) {
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'amanhã'
  return `em ${dias} dias`
}

/**
 * @param {{ plan?: string, accessExpiresAt?: string|Date, offersPublished?: number, now?: Date }} params
 * @returns {null | { daysLeft: number, offersPublished: number, hasProof: boolean, headline: string, body: string, ctaLabel: string, ctaHref: string, secondaryLabel: string|null, secondaryHref: string|null }}
 */
export function buildTrialEndingNotice({ plan, accessExpiresAt, offersPublished = 0, now = new Date() } = {}) {
  if (plan !== 'trial') return null

  const expiresAt = toDate(accessExpiresAt)
  if (!expiresAt) return null

  const msLeft = expiresAt.getTime() - now.getTime()
  // Já venceu: quem avisa é o banner de plano vencido, que tem outra ação
  // (reativar) — dois avisos sobre a mesma coisa viram ruído.
  if (msLeft <= 0) return null

  const daysLeft = Math.ceil(msLeft / DAY_MS)
  if (daysLeft > TRIAL_NOTICE_WINDOW_DAYS) return null

  const publicadas = Number.isFinite(Number(offersPublished)) ? Math.max(0, Math.trunc(Number(offersPublished))) : 0
  const hasProof = publicadas > 0
  const quando = labelDias(daysLeft)

  if (!hasProof) {
    return {
      daysLeft,
      offersPublished: 0,
      hasProof: false,
      headline: `Seu teste acaba ${quando} e o robô ainda não publicou nenhuma oferta`,
      body: 'Dá tempo de ver funcionando: conecte o WhatsApp, escolha os grupos e cadastre pelo menos uma loja. Se travar em algum passo, responda que a gente faz junto com você.',
      ctaLabel: 'Terminar a configuração',
      ctaHref: '/painel/checklist',
      secondaryLabel: 'Ver os planos',
      secondaryHref: '/painel/plano',
    }
  }

  return {
    daysLeft,
    offersPublished: publicadas,
    hasProof: true,
    headline: `Seu teste acaba ${quando}`,
    body: `Nesse tempo o robô já publicou ${publicadas} ${publicadas === 1 ? 'oferta' : 'ofertas'} nos seus grupos, sozinho. Quando o teste acabar ele para de enviar até você escolher um plano.`,
    ctaLabel: 'Continuar com o robô',
    ctaHref: '/painel/plano',
    secondaryLabel: 'Ver o que já foi enviado',
    secondaryHref: '/painel/envios',
  }
}
