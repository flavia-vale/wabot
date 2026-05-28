export function getRoleForMobileGroupTab(tab) {
  return tab === 'origem' ? 'monitor' : 'post'
}

export function getWhatsAppGroupJid(group = {}) {
  return group.waJid || group.jid || group.id || ''
}

export function getWhatsAppGroupName(group = {}) {
  return group.name || group.subject || getWhatsAppGroupJid(group)
}

export function buildExistingJidRoleSet(groups = []) {
  return new Set(groups.map((group) => `${group.waJid || group.jid}::${group.role}`))
}

export function sortWhatsAppGroupsForMobilePicker(groups = []) {
  return [...groups].sort((a, b) => String(getWhatsAppGroupName(a)).localeCompare(String(getWhatsAppGroupName(b)), 'pt-BR'))
}

export function getMobileGroupPickerItem(group = {}, role, existingJidRoles = new Set()) {
  const waJid = getWhatsAppGroupJid(group)
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
