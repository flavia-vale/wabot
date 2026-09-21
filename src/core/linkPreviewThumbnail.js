// Recupera a thumbnail HQ que o próprio WhatsApp hospeda para um link preview.
//
// `extendedTextMessage.jpegThumbnail` é só o placeholder inline (centenas ou
// poucos milhares de bytes). Quando existem `thumbnailDirectPath` + `mediaKey`,
// o proto também aponta para a versão remota — e `downloadMediaMessage` já sabe
// baixar/descriptografar esse mediaType (`thumbnail-link`). Ignorar esses campos
// fazia ofertas Magalu caírem no placeholder de 545–1999 bytes mesmo com a foto
// boa disponível no próprio WhatsApp.

/**
 * @param {{
 *   message: object,
 *   extendedTextMessage: object,
 *   downloadMediaMessage: Function,
 *   logger?: object,
 *   reuploadRequest?: Function,
 * }} params
 * @returns {Promise<Buffer|null>}
 */
export async function downloadHighQualityLinkPreview({
  message,
  extendedTextMessage,
  downloadMediaMessage,
  logger,
  reuploadRequest,
} = {}) {
  const ext = extendedTextMessage
  if (!ext?.thumbnailDirectPath || !ext?.mediaKey) return null
  if (typeof downloadMediaMessage !== 'function') return null

  try {
    const buffer = await downloadMediaMessage(
      message,
      'buffer',
      {},
      { logger, reuploadRequest },
    )
    return Buffer.isBuffer(buffer) && buffer.length ? buffer : null
  } catch {
    // Best-effort: quem chama ainda possui o jpegThumbnail inline.
    return null
  }
}
