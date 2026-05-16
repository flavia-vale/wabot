export const FORWARD_MODE = {
  LINK_ONLY: 'LINK_ONLY',
  ALLOW_NO_LINK: 'ALLOW_NO_LINK',
}

export const NO_LINK_SCOPE = {
  ALL: 'ALL',
  TEXT_ONLY: 'TEXT_ONLY',
  TEXT_IMAGE_WITH_CAPTION: 'TEXT_IMAGE_WITH_CAPTION',
}

export function normalizeForwardingPolicy(group = {}) {
  const forwardMode = group.forwardMode === FORWARD_MODE.ALLOW_NO_LINK
    ? FORWARD_MODE.ALLOW_NO_LINK
    : FORWARD_MODE.LINK_ONLY

  const noLinkScope = Object.values(NO_LINK_SCOPE).includes(group.noLinkScope)
    ? group.noLinkScope
    : NO_LINK_SCOPE.TEXT_ONLY

  return { forwardMode, noLinkScope }
}

export function shouldForwardMessage({ hasLinks, messageKind, policy }) {
  if (hasLinks) return true
  if (policy.forwardMode !== FORWARD_MODE.ALLOW_NO_LINK) return false

  if (policy.noLinkScope === NO_LINK_SCOPE.ALL) return true
  if (policy.noLinkScope === NO_LINK_SCOPE.TEXT_ONLY) return messageKind === 'text'
  if (policy.noLinkScope === NO_LINK_SCOPE.TEXT_IMAGE_WITH_CAPTION) return messageKind === 'text' || messageKind === 'image_with_caption'
  return false
}

export function detectMessageKind(innerMessage, text) {
  if (innerMessage?.imageMessage && text?.trim()) return 'image_with_caption'
  if (innerMessage?.videoMessage && text?.trim()) return 'video_with_caption'
  if (text?.trim()) return 'text'
  if (innerMessage?.imageMessage) return 'image'
  if (innerMessage?.videoMessage) return 'video'
  if (innerMessage?.audioMessage) return 'audio'
  if (innerMessage?.stickerMessage) return 'sticker'
  if (innerMessage?.documentMessage) return 'document'
  return 'other'
}
