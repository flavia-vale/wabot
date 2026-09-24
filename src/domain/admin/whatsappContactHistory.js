/**
 * Histórico de contato por WhatsApp, para a aba "Contato com cliente" do
 * admin (2026-09-24).
 *
 * Toda mensagem pelo próprio WhatsApp — automática (piloto de ativação,
 * `src/core/selfWelcomeMessage.js`) ou manual (a admin escreve e manda pelo
 * painel) — vira uma linha em `CustomerContactLog` (`channel: 'whatsapp'`),
 * a MESMA tabela do "Registrar contato de CS". Não é uma tabela nova: é o
 * histórico que já existia ganhando as mensagens automáticas.
 *
 * `reason` é sempre um slug técnico (ver `src/bot-worker.js`,
 * `logWhatsappSelfMessageContact`); este módulo traduz para o que a admin lê
 * na tela — nada de slug cru na tela.
 *
 * Módulo PURO: sem banco, sem rede.
 */

export const WHATSAPP_CONTACT_REASON_LABELS = Object.freeze({
  boas_vindas_conexao: 'Boas-vindas ao conectar o WhatsApp',
  primeira_oferta_publicada: '1ª oferta publicada (prova de valor)',
  lembrete_sem_etiqueta: 'Lembrete: cadastrar a loja',
  lembrete_sem_grupo: 'Lembrete: escolher os grupos',
  mensagem_manual_suporte: 'Mensagem manual do suporte',
})

/** Slug desconhecido devolve ele mesmo — nunca some da tela por dúvida. */
export function describeWhatsappContactReason(reason) {
  return WHATSAPP_CONTACT_REASON_LABELS[reason] ?? String(reason ?? '')
}

/** `true` = foi a admin quem mandou (tem `actorUserId`); `false` = automática. */
export function isManualWhatsappContact(row) {
  return Boolean(row?.actorUserId)
}

/**
 * Formata uma linha crua de `CustomerContactLog` (com `user`/`actorUser`
 * incluídos na consulta) para o formato que a tela consome.
 */
export function presentWhatsappContactRow(row) {
  return {
    id: row.id,
    when: row.createdAt,
    userId: row.userId,
    clienteEmail: row.user?.email ?? null,
    clienteNome: row.user?.name ?? null,
    motivo: describeWhatsappContactReason(row.reason),
    manual: isManualWhatsappContact(row),
    enviadoPor: row.actorUser?.email ?? null,
    texto: row.notes ?? null,
  }
}
