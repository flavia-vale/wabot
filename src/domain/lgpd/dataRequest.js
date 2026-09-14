// LGPD — exportação e exclusão (anonimização) de dados do titular.
//
// Modo de operação: processo MANUAL operado por admin via
// scripts/lgpd_data_request.mjs. Endpoints automatizados ficam para a Onda 2.
//
// Decisão de design: a "exclusão" é uma ANONIMIZAÇÃO IN-PLACE da linha User,
// não um hard-delete. Motivos:
//  1. Payment e AffiliateCommission têm FK obrigatória para User (referredUser,
//     paidBy) e precisam ser retidos por obrigação fiscal/contábil. Hard-delete
//     do User quebraria essas FKs ou apagaria o ledger financeiro.
//  2. Anonimizar os campos de PII (nome, email, telefone, IP, user-agent, hash
//     de senha) satisfaz o direito de eliminação dos dados pessoais mantendo a
//     integridade referencial dos registros financeiros (que deixam de apontar
//     para uma pessoa identificável).
// Os dados operacionais que contêm PII de conteúdo (MessageLog.messageText,
// ScheduledMessage, Credential, auth_info) são apagados de fato.

// Campos de PII da linha User, substituídos por marcadores estáveis derivados
// do id (não reversíveis, mas determinísticos para auditoria).
export function buildAnonymizedUserFields(userId, now = new Date()) {
  const tag = String(userId).slice(0, 8)
  return {
    name: `Conta removida ${tag}`,
    email: `deleted_${userId}@anonimizado.invalid`,
    contactPhone: null,
    contactPhoneVerifiedAt: null,
    contactPhoneOptInAt: null,
    passwordHash: 'LGPD_ANONYMIZED',
    referralCode: null,
    termsAcceptedIp: null,
    termsAcceptedUserAgent: null,
    status: 'deleted',
    accessExpiresAt: now,
  }
}

// Modelos cujas linhas do titular são DELETADAS na anonimização (dados
// operacionais e credenciais; PII de conteúdo). A ordem É relevante para os
// modelos do Instagram: StoryPublication restringe a exclusão de Destination
// e StoryTemplate, portanto publicações precisam sair primeiro. NÃO inclui
// Payment nem AffiliateCommission (retenção).
export const PURGED_MODELS = [
  'storyPublication',
  'renderedAsset',
  'instagramStoryIngress',
  'instagramOAuthState',
  'instagramConnection',
  'destination',
  'storyTemplate',
  'messageLog',
  'scheduledMessage',
  'credential',
  'botConfig',
  'offerQueueItem',
  'offerQueue',
  'offerAutomationReviewItem',
  'offerAutomation',
  'offerAutomationSentLog',
  'groupTarget',
  'group',
  'followLog',
  'affiliateLink',
  'probeEvidence',
  'waSession',
  'analyticsEvent',
]

// Modelos exportados no pacote de dados do titular (leitura). Mapeia nome do
// modelo Prisma -> filtro. Campos sensíveis (passwordHash, Credential.data
// cifrado) são redigidos no export.
export const EXPORTED_MODELS = [
  'group',
  'groupTarget',
  'botConfig',
  'scheduledMessage',
  'messageLog',
  'offerAutomation',
  'offerAutomationReviewItem',
  'offerQueue',
  'offerQueueItem',
  'payment',
  'affiliateLink',
  'followLog',
  'destination',
  'instagramConnection',
  'instagramOAuthState',
  'storyTemplate',
  'renderedAsset',
  'storyPublication',
  'instagramStoryIngress',
]

export function redactUserForExport(user) {
  if (!user) return null
  const { passwordHash, ...rest } = user
  return { ...rest, passwordHash: '[redigido]' }
}

function redactExportRows(model, rows) {
  if (model !== 'instagramConnection') return rows
  return rows.map(({ encryptedToken, ...row }) => ({ ...row, encryptedToken: '[redigido]' }))
}

// Monta o pacote de exportação. db é o Prisma client (ou mock). Retorna objeto
// serializável em JSON.
export async function collectUserExport(db, userId, now = new Date()) {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) {
    const err = new Error(`Usuário não encontrado: ${userId}`)
    err.code = 'USER_NOT_FOUND'
    throw err
  }
  const data = { exportedAt: now.toISOString(), userId, user: redactUserForExport(user) }
  for (const model of EXPORTED_MODELS) {
    if (!db[model]?.findMany) continue
    // Credential.data fica de fora do export por conter segredos cifrados;
    // se um dia for incluído, redigir o campo data.
    const rows = await db[model].findMany({ where: { userId } })
    data[model] = redactExportRows(model, rows)
  }
  return data
}

// Executa a anonimização. Recebe db (Prisma client ou mock) e o userId.
// Retorna um sumário { purged: { model: count }, anonymized: true }.
export async function anonymizeUser(db, userId, now = new Date(), { storage = null } = {}) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) {
    const err = new Error(`Usuário não encontrado: ${userId}`)
    err.code = 'USER_NOT_FOUND'
    throw err
  }
  // Apagar a LINHA de RenderedAsset não apaga o JPEG do Story no disco, e a
  // varredura de expirados é guiada pelo banco — sem a linha, ela nunca mais
  // olha para o arquivo. Resultado antes: a imagem da titular ficava para
  // sempre no servidor e continuava servível pela URL assinada. Os arquivos
  // saem ANTES do deleteMany, que é quando ainda sabemos as storageKeys.
  let removedAssetFiles = 0
  if (storage?.remove && db.renderedAsset?.findMany) {
    const assets = await db.renderedAsset.findMany({ where: { userId }, select: { storageKey: true } }).catch(() => [])
    for (const asset of assets) {
      // Falha em um arquivo não pode abortar a anonimização inteira; a
      // varredura de órfãos passa depois.
      try { await storage.remove(asset.storageKey); removedAssetFiles++ } catch { /* varredura de órfãos cobre */ }
    }
  }
  const purged = { renderedAssetFiles: removedAssetFiles }
  for (const model of PURGED_MODELS) {
    if (!db[model]?.deleteMany) continue
    const result = await db[model].deleteMany({ where: { userId } })
    purged[model] = result?.count ?? 0
  }
  await db.user.update({ where: { id: userId }, data: buildAnonymizedUserFields(userId, now) })
  return { anonymized: true, userId, purged }
}
