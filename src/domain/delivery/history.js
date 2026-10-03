// Feature 017 — linha do histórico (MessageLog) de uma entrega feita por
// outro aplicativo (caixa de saída). Mesma forma das linhas do WhatsApp, para
// a tela tratar todas igual; o adaptador nunca escreve aqui (contrato,
// regra 4). Fica fora de src/delivery*/ porque grava a coluna `platform`
// (loja) do MessageLog, nome que as pastas novas não usam.

import logger from '../../logger.js'

export async function writeDeliveryHistory(db, row, offer, { status, errorMsg = null, reducoes = null }) {
  const historico = offer?.historico ?? {}
  const data = {
    status,
    errorMsg,
    deliveryNetwork: row.deliveryNetwork,
    deliveryReductions: reducoes,
  }
  if (row.messageLogId) {
    await db.messageLog.update({ where: { id: row.messageLogId }, data }).catch(() => {})
    return
  }
  await db.messageLog.create({
    data: {
      ...data,
      userId: row.userId,
      platform: String(historico.loja ?? ''),
      sourceGroup: String(row.sourceId ?? historico.origem ?? ''),
      destGroup: row.destinationId,
      originalUrl: String(historico.linkOriginal ?? offer?.linkConvertido ?? ''),
      convertedUrl: String(offer?.linkConvertido ?? ''),
      messageText: String(offer?.texto ?? '').slice(0, 4000),
    },
  }).catch((err) => logger.warn({ err: err?.message, outboxId: row.id }, 'caixa de saída: falha ao gravar histórico'))
}

