// Texto dos avisos do Link Inteligente (e-mail e WhatsApp). Puro.
// Linguagem de gente: sem jargão; diz o que aconteceu, o que perde e o que fazer.

export const ALERT_EMAIL_SLUGS = Object.freeze({
  warn: 'link_inteligente_quase_cheio',
  urgent: 'link_inteligente_lotado',
})

/** "menos de 1 hora", "cerca de 14 horas", "cerca de 3 dias" — ou null sem previsão. */
export function etaPhrase(hours) {
  if (hours == null || !Number.isFinite(hours) || hours < 0) return null
  if (hours < 1) return 'menos de 1 hora'
  if (hours < 48) return `cerca de ${Math.round(hours)} horas`
  return `cerca de ${Math.round(hours / 24)} dias`
}

/**
 * @param {{ kind:'warn'|'urgent', reminder?:boolean, link:{name:string}, occupancy:object, panelUrl:string }} args
 * @returns {{ emailSlug:string, emailVars:object, whatsappText:string, whatsappKind:string }}
 */
export function buildAlertContent({ kind, reminder = false, link, occupancy, panelUrl }) {
  const name = String(link?.name ?? 'seu link').trim()
  const prefix = reminder ? 'Lembrete: ' : ''

  if (kind === 'urgent') {
    const groups = occupancy?.activeCount ?? 0
    return {
      emailSlug: ALERT_EMAIL_SLUGS.urgent,
      emailVars: { nome_link: name, grupos: String(groups), link_painel: panelUrl },
      whatsappText: `${prefix}O Link Inteligente “${name}” está lotado: os ${groups} grupos chegaram ao limite.\n\nQuem clicar no link agora vê “Grupos lotados” e não consegue entrar.\n\nAdicione um grupo novo agora (o robô precisa ser admin dele): ${panelUrl}`,
      whatsappKind: 'smart_link_alert_urgent',
    }
  }

  const eta = etaPhrase(occupancy?.etaHours)
  const slots = occupancy?.remainingSlots ?? 0
  return {
    emailSlug: ALERT_EMAIL_SLUGS.warn,
    emailVars: {
      nome_link: name,
      ocupacao: String(occupancy?.avgPct ?? ''),
      vagas: String(slots),
      previsao_frase: eta ? ` — no ritmo dos últimos dias, elas acabam em ${eta}` : '',
      link_painel: panelUrl,
    },
    whatsappText: `${prefix}Todos os grupos do Link Inteligente “${name}” passaram de 90% da capacidade (em média, ${occupancy?.avgPct}% cheios).\n\nSobram cerca de ${slots} vagas${eta ? `; no ritmo dos últimos dias elas acabam em ${eta}` : ''}.\n\nCrie um grupo novo, coloque o robô como admin e adicione ao link para o rodízio continuar: ${panelUrl}`,
    whatsappKind: 'smart_link_alert',
  }
}
