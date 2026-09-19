import { DELIVERY_CONTRACT_VERSION, DESTINATION_TYPE } from '../domain/delivery/constants.js'
import { DEFAULT_STORY_TEMPLATE, normalizeStoryTemplate, storyTemplateHash } from './rendering/template.js'

export function serializeTemplateDefinition(definition) {
  return JSON.stringify(definition)
}

export async function ensureDefaultStoryTemplate({ db, definition = DEFAULT_STORY_TEMPLATE } = {}) {
  if (!db) throw new Error('db obrigatório')
  const normalized = normalizeStoryTemplate(definition)
  const hash = storyTemplateHash(normalized)
  return db.$transaction(async tx => {
    const template = await tx.storyTemplate.upsert({
      where: { scopeKey_key: { scopeKey: 'system', key: normalized.key } },
      create: { scopeKey: 'system', key: normalized.key, name: 'Wabot Clássico', currentVersion: normalized.version },
      update: { enabled: true },
    })
    await tx.storyTemplateVersion.upsert({
      where: { templateId_version: { templateId: template.id, version: normalized.version } },
      create: { templateId: template.id, version: normalized.version, definitionJson: serializeTemplateDefinition(normalized), contentHash: hash },
      // Versões são imutáveis: mudança de conteúdo exige incrementar version.
      update: {},
    })
    if (template.currentVersion !== normalized.version) {
      return tx.storyTemplate.update({ where: { id: template.id }, data: { currentVersion: normalized.version } })
    }
    return template
  })
}

export async function createStoryPublication({ request, templateId, templateVersionId }, { db } = {}) {
  if (!db) throw new Error('db obrigatório')
  if (request?.destination?.type !== DESTINATION_TYPE.INSTAGRAM_STORY) throw new TypeError('destino deve ser instagram_story')
  try {
    return await db.$transaction(async tx => {
      const [destination, templateVersion] = await Promise.all([
        tx.destination.findFirst({ where: { id: request.destination.id, userId: request.userId, type: DESTINATION_TYPE.INSTAGRAM_STORY, enabled: true } }),
        tx.storyTemplateVersion.findFirst({ where: { id: templateVersionId, templateId }, include: { template: true } }),
      ])
      if (!destination) throw Object.assign(new Error('Destino Instagram indisponível'), { code: 'DESTINATION_UNAVAILABLE' })
      if (!templateVersion || (templateVersion.template.userId && templateVersion.template.userId !== request.userId) || !templateVersion.template.enabled) {
        throw Object.assign(new Error('Template de Story indisponível'), { code: 'TEMPLATE_UNAVAILABLE' })
      }
      const existing = await tx.storyPublication.findUnique({ where: { idempotencyKey: request.idempotencyKey } })
      if (existing) {
        if (existing.userId !== request.userId || existing.destinationId !== destination.id) throw Object.assign(new Error('Chave de idempotência pertence a outra publicação'), { code: 'IDEMPOTENCY_CONFLICT' })
        return existing
      }
      return tx.storyPublication.create({ data: {
        id: request.id,
        userId: request.userId,
        destinationId: destination.id,
        templateId,
        templateVersionId,
        contractVersion: request.contractVersion || DELIVERY_CONTRACT_VERSION,
        sourceType: request.source.type,
        sourceId: request.source.id,
        offerSnapshotJson: JSON.stringify(request.offer),
        idempotencyKey: request.idempotencyKey,
        scheduledFor: request.scheduledFor ? new Date(request.scheduledFor) : null,
      } })
    })
  } catch (error) {
    if (error?.code === 'P2002') {
      const existing = await db.storyPublication.findUnique({ where: { idempotencyKey: request.idempotencyKey } })
      if (existing?.userId === request.userId && existing.destinationId === request.destination.id) return existing
    }
    throw error
  }
}
