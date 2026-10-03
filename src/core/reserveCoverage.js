// Origens que um número NÃO recebe (Fase 2.1 — docs/rca/multi-numero.md).
// Usado no aviso da troca: grupos pela pertença gravada; canais não dá para
// saber sem perguntar ao robô, então entram como "confira no painel".
import { sourceCoverage } from '../domain/session/groupMembership.js'

export async function sourceGapsForSlot({ db, userId, slot }) {
  const [sources, members] = await Promise.all([
    db.group.findMany({ where: { userId, role: 'monitor' }, select: { waJid: true, name: true } }),
    db.waGroupMembership.findMany({ where: { userId, slot }, select: { waJid: true } }),
  ])
  // Sem pertença gravada não dá para afirmar nada sobre grupos.
  if (!members.length) return { known: false, missingGroups: [], channelCount: 0 }
  const cov = sourceCoverage({ sources, memberJids: members.map(m => m.waJid) })
  return { known: true, missingGroups: cov.missingGroups, channelCount: cov.unknownChannels.length }
}

const UNKNOWN_NOTICE = 'Confira no painel se o número que assumiu está nos grupos e canais de onde você copia as ofertas.'

// Texto do e-mail (nunca vazio: variável vazia vira aviso no log do motor).
export function sourceGapsNotice({ known = false, missingGroups = [], channelCount = 0 } = {}) {
  if (!known) return UNKNOWN_NOTICE
  const lines = []
  if (missingGroups.length) {
    const names = missingGroups.slice(0, 10).map(g => `- ${g.name || g.waJid}`)
    if (missingGroups.length > 10) names.push(`- e mais ${missingGroups.length - 10}`)
    lines.push(`Atenção: o número que assumiu não está nestes grupos de origem, então eles pararam de ser copiados:\n${names.join('\n')}`)
  }
  if (channelCount > 0) {
    lines.push(`Você copia de ${channelCount === 1 ? '1 canal' : `${channelCount} canais`}. Confira no painel se o número que assumiu segue ${channelCount === 1 ? 'esse canal' : 'esses canais'}.`)
  }
  if (!lines.length) return 'Conferimos: o número que assumiu está em todos os grupos de onde você copia as ofertas.'
  return lines.join('\n\n')
}
