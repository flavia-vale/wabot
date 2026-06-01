export function isChannelGroup(group) {
  return String(group.waJid || group.jid || '').endsWith('@newsletter') || group.kind === 'channel'
}

export function filterDestGroups(groups, { search = '', includeChannels = false } = {}) {
  const normalizedSearch = search.toLowerCase()
  return groups.filter((group) => {
    if (!includeChannels && isChannelGroup(group)) return false
    if (!normalizedSearch) return true
    const name = String(group.name || group.subject || '').toLowerCase()
    return name.includes(normalizedSearch)
  })
}

export function groupKey(group) {
  return String(group.waJid || group.jid || group.id || '')
}

export function selectAllVisible(currentKeys = [], visibleGroups = []) {
  const visibleKeys = visibleGroups.map(groupKey)
  const merged = [...currentKeys]
  for (const key of visibleKeys) {
    if (!merged.includes(key)) merged.push(key)
  }
  return merged
}

export function clearVisible(currentKeys = [], visibleGroups = []) {
  const visibleKeySet = new Set(visibleGroups.map(groupKey))
  return currentKeys.filter((key) => !visibleKeySet.has(key))
}
