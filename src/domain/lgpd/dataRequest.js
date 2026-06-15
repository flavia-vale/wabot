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
// operacionais e credenciais; PII de conteúdo). Ordem irrelevante — todos
// filtram por userId. NÃO inclui Payment nem AffiliateCommission (retenção).
export const PURGED_MODELS = [
  'messageLog',
  'scheduledMessage',
  'credential',
  'botConfig',
  'offerQueueItem',
  'offerQueue',
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
  'offerQueue',
  'offerQueueItem',
  'payment',
  'affiliateLink',
  'followLog',
]

export function redactUserForExport(user) {
  if (!user) return null
  const { passwordHash, ...rest } = user
  return { ...rest, passwordHash: '[redigido]' }
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
    data[model] = await db[model].findMany({ where: { userId } })
  }
  return data
}

// Executa a anonimização. Recebe db (Prisma client ou mock) e o userId.
// Retorna um sumário { purged: { model: count }, anonymized: true }.
export async function anonymizeUser(db, userId, now = new Date()) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) {
    const err = new Error(`Usuário não encontrado: ${userId}`)
    err.code = 'USER_NOT_FOUND'
    throw err
  }
  const purged = {}
  for (const model of PURGED_MODELS) {
    if (!db[model]?.deleteMany) continue
    const result = await db[model].deleteMany({ where: { userId } })
    purged[model] = result?.count ?? 0
  }
  await db.user.update({ where: { id: userId }, data: buildAnonymizedUserFields(userId, now) })
  return { anonymized: true, userId, purged }
}
