export function getRoleForMobileGroupTab(tab) {
  return tab === 'origem' ? 'monitor' : 'post'
}

export function getWhatsAppGroupJid(group = {}) {
  return String(group.waJid || group.jid || group.id || '')
}

export function getWhatsAppGroupName(group = {}) {
  return group.name || group.subject || getWhatsAppGroupJid(group)
}

export function buildExistingJidRoleSet(groups = []) {
  return new Set(
    groups
      .map((group) => {
        const waJid = getWhatsAppGroupJid(group).trim()
        return waJid && group.role ? `${waJid}::${group.role}` : ''
      })
      .filter(Boolean)
  )
}

export function sortWhatsAppGroupsForMobilePicker(groups = []) {
  return [...groups].sort((a, b) => String(getWhatsAppGroupName(a)).localeCompare(String(getWhatsAppGroupName(b)), 'pt-BR'))
}

export function getMobileGroupPickerItem(group = {}, role, existingJidRoles = new Set()) {
  const waJid = getWhatsAppGroupJid(group).trim()
  const name = getWhatsAppGroupName(group)
  const alreadyInCurrentRole = existingJidRoles.has(`${waJid}::${role}`)
  return {
    waJid,
    name,
    kind: group.kind || 'group',
    disabled: alreadyInCurrentRole,
    pill: alreadyInCurrentRole ? 'já está na lista' : role === 'monitor' ? 'Monitorar' : 'Publicar',
  }
}

// Plataformas que podem ser filtradas por grupo de origem. Mesma lista do
// painel responsivo (app/painel/grupos/page.js → ALL_PLATFORMS); manter
// sincronizado para não divergir o comportamento entre as duas UIs.
export const MOBILE_GROUP_PLATFORMS = [
  { id: 'shopee', label: 'Shopee' },
  { id: 'amazon', label: 'Amazon' },
  { id: 'mercadolivre', label: 'Mercado Livre' },
  { id: 'magazineluiza', label: 'Magazine Luiza' },
  { id: 'shein', label: 'SHEIN' },
]

function parsePlatformCsv(allowedPlatforms) {
  return String(allowedPlatforms || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

// Sem seleção explícita (csv vazio/null) significa "todas as plataformas
// liberadas" — exatamente como o desktop trata um grupo recém-cadastrado.
export function isMobilePlatformSelected(allowedPlatforms, platformId) {
  if (!allowedPlatforms) return true
  return new Set(parsePlatformCsv(allowedPlatforms)).has(platformId)
}

// Retorna o novo csv de allowedPlatforms ao ligar/desligar uma plataforma.
// Quando o grupo ainda não tem seleção manual, parte do conjunto completo
// para que desmarcar uma plataforma deixe as demais ativas (igual desktop).
export function toggleMobilePlatform(allowedPlatforms, platformId) {
  const current = allowedPlatforms
    ? parsePlatformCsv(allowedPlatforms)
    : MOBILE_GROUP_PLATFORMS.map((platform) => platform.id)
  const next = current.includes(platformId)
    ? current.filter((id) => id !== platformId)
    : [...current, platformId]
  return next.join(',')
}

// Liga/desliga um grupo de destino na lista de alvos de um grupo monitorado.
export function toggleMobileTargetPostId(postIds = [], postId) {
  const current = Array.isArray(postIds) ? postIds : []
  return current.includes(postId)
    ? current.filter((id) => id !== postId)
    : [...current, postId]
}

export const MOBILE_GROUP_DUPLICATE_FEEDBACK = 'Este grupo já está cadastrado para monitorar/publicar.'

export function prepareMobileGroupAddPayload(data = {}, role, existingJidRoles = new Set()) {
  const waJid = getWhatsAppGroupJid(data).trim()
  const name = String(data.name || data.subject || waJid).trim()
  const kind = data.kind || 'group'

  if (existingJidRoles.has(`${waJid}::${role}`)) {
    return { ok: false, reason: 'duplicate', feedback: MOBILE_GROUP_DUPLICATE_FEEDBACK }
  }

  return {
    ok: true,
    payload: { waJid, name, role, kind },
  }
}
