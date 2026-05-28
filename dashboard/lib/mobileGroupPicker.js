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
