import db from '../../db.js'
import { isValidWatermarkColor, isValidWatermarkSize, isValidWatermarkPosition, isWatermarkTextTooLong, normalizeWatermarkInputText } from '../../core/watermarkInput.js'
import { effectiveDestinationImageMode } from '../../core/imageModePolicy.js'
import { trackAnalyticsEventSafe } from '../../analytics.js'
import { ensureCountQuota } from '../quotas.js'
import {
  reloadConfig as _reloadConfig,
  channelMetadata as _channelMetadata,
  followChannelImmediate as _followChannelImmediate,
  listFollowedChannels as _listFollowedChannels,
  isRunning as _isRunning,
} from '../../manager.js'
import { ensureJid, detectKind, parseChannelInviteUrl, JID_KIND } from '../../core/jid.js'
import { normalizeChannelForwardJid } from '../../core/channelSend.js'
import { canFollowNow, logFollow } from '../../core/followGuard.js'
import { getHealth as getChannelHealth } from '../../core/channelHealth.js'
import { captureSnapshot } from '../../jobs/channelSnapshot.js'
import { lintChannelTitle, lintCopyTemplate } from '../../core/copyLinter.js'
import { recomputeScore as recomputeReportRiskScore } from '../../core/reportRiskScore.js'
import { registerProbeEvidence, resolveLatestSentForGroup } from '../../core/probeEvidence.js'
import { FORWARD_MODE, NO_LINK_SCOPE, normalizeForwardingPolicy } from '../../forwardingPolicy.js'
import { buildFeatureGateError, canUseAdvancedPreservation, canUseChannels, FEATURE_CODES } from '../../billing/plans.js'
import { normalizeRelayFooter, RELAY_FOOTER_MAX_CHARS } from '../../core/relayFooter.js'

const ALLOWED_KINDS = new Set([JID_KIND.GROUP, JID_KIND.CHANNEL])

function parseBoolean(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value === 'true'
  return Boolean(value)
}

function normalizeGroupJid(rawJid) {
  return ensureJid(rawJid, JID_KIND.GROUP)
}

async function getPlanSubject(userId) {
  return db.user.findUnique({
    where: { id: userId },
    select: { plan: true, accessExpiresAt: true },
  })
}

async function ensureChannelFeatureAllowed(userId, reply) {
  const user = await getPlanSubject(userId)
  if (canUseChannels(user ?? { plan: 'basic' })) return true
  reply.code(403).send(buildFeatureGateError(FEATURE_CODES.CHANNELS))
  return false
}

async function ensureAdvancedPreservationAllowed(userId, reply) {
  const user = await getPlanSubject(userId)
  if (canUseAdvancedPreservation(user ?? { plan: 'basic' })) return true
  reply.code(403).send(buildFeatureGateError(FEATURE_CODES.ADVANCED_PRESERVATION))
  return false
}

export async function groupsRoutes(app, opts = {}) {
  const reloadConfig = opts.reloadConfig ?? _reloadConfig
  const channelMetadata = opts.channelMetadata ?? _channelMetadata
  const followChannelImmediate = opts.followChannelImmediate ?? _followChannelImmediate
  const listFollowedChannelsFn = opts.listFollowedChannels ?? _listFollowedChannels
  const isRunning = opts.isRunning ?? _isRunning
  app.get('/', { onRequest: [app.authenticate] }, async (req) => {
    return db.group.findMany({ where: { userId: req.user.sub } })
  })

  app.post('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { waJid: rawJid, name: rawName, role, kind: rawKind } = req.body ?? {}
    const kind = (rawKind ?? JID_KIND.GROUP).toString()
    if (!ALLOWED_KINDS.has(kind)) return reply.code(400).send({ error: 'kind deve ser group ou channel' })
    const waJid = ensureJid(rawJid, kind === JID_KIND.CHANNEL ? JID_KIND.CHANNEL : JID_KIND.GROUP)
    const name = rawName?.trim()
    if (!waJid || !name || !role) return reply.code(400).send({ error: 'waJid, name e role obrigatórios' })
    if (!['monitor', 'post'].includes(role)) return reply.code(400).send({ error: 'role deve ser monitor ou post' })
    if (detectKind(waJid) !== kind) return reply.code(400).send({ error: `waJid não bate com kind=${kind}` })

    // Trava de segurança (anti-eco): um mesmo grupo/canal NÃO pode ser fonte
    // monitorada ('monitor') e destino ('post') ao mesmo tempo. Como o robô
    // agora espelha também mensagens enviadas pelo próprio número (fromMe) em
    // grupos monitorados, um grupo que fosse source E destino faria o robô
    // reprocessar os próprios envios → loop de espelhamento (duplicação e risco
    // de ban). Bloqueamos o cadastro no papel oposto antes de criar.
    const oppositeRole = role === 'monitor' ? 'post' : 'monitor'
    const roleConflict = await db.group.findFirst({
      where: { userId: req.user.sub, waJid, role: oppositeRole },
      select: { id: true },
    })
    if (roleConflict) {
      const conflictMessage = role === 'post'
        ? 'Bloqueado por segurança: este grupo já é um grupo MONITORADO (fonte). O mesmo grupo não pode ser também um grupo de DESTINO — isso criaria um loop de espelhamento, com o robô reenviando as próprias mensagens (duplicação e risco de banimento). Remova-o dos grupos monitorados antes de usá-lo como destino.'
        : 'Bloqueado por segurança: este grupo já é um grupo de DESTINO. O mesmo grupo não pode ser também um grupo MONITORADO (fonte) — isso criaria um loop de espelhamento, com o robô reenviando as próprias mensagens (duplicação e risco de banimento). Remova-o dos destinos antes de monitorá-lo.'
      return reply.code(409).send({ error: conflictMessage })
    }

    if (kind === JID_KIND.CHANNEL && !(await ensureChannelFeatureAllowed(req.user.sub, reply))) return
    if (!(await ensureCountQuota(reply, {
      userId: req.user.sub,
      quota: 'groupsPerUser',
      count: () => db.group.count({ where: { userId: req.user.sub } }),
      label: 'grupos/canais cadastrados',
    }))) return

    try {
      const group = await db.group.create({
        // 2026-08-28: a estratégia de imagem passa a ser escolhida por DESTINO
        // (role='post'), na tela de "Filtros" desse grupo/canal — ver
        // src/core/imageModePolicy.js e src/billing/groupEntitlements.js. Todo
        // grupo novo nasce em 'original' ("a foto que veio na oferta", padrão
        // do produto desde 2026-08-21); role='monitor' nunca leu este campo,
        // mas mantemos um único valor por simplicidade e defesa em
        // profundidade.
        data: { userId: req.user.sub, waJid, name, role, kind, forwardMode: FORWARD_MODE.LINK_ONLY, imageMode: 'original' },
      })
      trackAnalyticsEventSafe({
        userId: req.user.sub,
        event: role === 'monitor' ? 'monitor_group_created' : 'post_group_created',
        metadata: { role, kind },
      })
      const configReload = await reloadWorkerConfig(req.user.sub)
      app.log.info({ groupId: group.id, role, kind, configReloaded: configReload.ok, configReloadError: configReload.error }, 'Grupo/canal criado; configuração do worker recarregada quando disponível')
      return group
    } catch (err) {
      if (err.code === 'P2002') return reply.code(409).send({ error: 'Grupo já cadastrado com esse role' })
      throw err
    }
  })

  // `reloadConfig` é assíncrono no modo remote (comando via Redis até o
  // supervisor) e devolve uma Promise. Sem `await`, a Promise ia crua para o
  // logger e virava `configReloaded: {}` — parecia confirmação e não era: não
  // dizia se o supervisor recebeu o comando nem se o worker invalidou o cache.
  // Foi o que impediu de distinguir "job antigo ainda saindo" de "worker nem
  // recarregou" no RCA 2026-08-26.
  async function reloadWorkerConfig(userId) {
    try {
      return { ok: Boolean(await reloadConfig(userId)), error: null }
    } catch (err) {
      return { ok: false, error: err?.message || String(err) }
    }
  }

  app.get('/:id/targets', { onRequest: [app.authenticate] }, async (req, reply) => {
    const monitor = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub, role: 'monitor' } })
    if (!monitor) return reply.code(404).send({ error: 'Grupo monitor não encontrado' })

    const targets = await db.groupTarget.findMany({ where: { userId: req.user.sub, monitorId: monitor.id }, select: { postId: true } })
    if (targets.length > 0) return { postIds: targets.map(t => t.postId), mode: 'explicit' }

    // Escolha explícita que ficou sem nenhum destino (a cliente apagou os grupos
    // que havia selecionado): a resposta honesta é "nenhum destino", e o
    // espelhamento dessa origem fica parado até ela escolher de novo. Mostrar
    // todos aqui era o que fazia o painel dizer que estava tudo selecionado
    // enquanto a oferta caía em grupo que ela nunca escolheu (RCA 2026-08-26).
    if (monitor.targetsMode === 'explicit') return { postIds: [], mode: 'explicit' }

    // Sem linhas em GroupTarget significa fallback canônico: o monitor envia
    // para TODOS os destinos de postagem do usuário. Retornamos esses ids para
    // a UI não parecer que o sistema “desmarcou sozinho” os destinos; o campo
    // mode preserva a semântica para clientes que queiram exibir o fallback.
    const allPosts = await db.group.findMany({
      where: { userId: req.user.sub, role: 'post' },
      select: { id: true },
      orderBy: { name: 'asc' },
    })
    return { postIds: allPosts.map(g => g.id), mode: 'all' }
  })

  app.put('/:id/targets', { onRequest: [app.authenticate] }, async (req, reply) => {
    const monitor = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub, role: 'monitor' } })
    if (!monitor) return reply.code(404).send({ error: 'Grupo monitor não encontrado' })

    const postIds = Array.isArray(req.body?.postIds) ? [...new Set(req.body.postIds.map(String))] : []
    const validPosts = await db.group.findMany({
      where: { userId: req.user.sub, role: 'post', id: { in: postIds } },
      select: { id: true, kind: true },
    })
    if (validPosts.length !== postIds.length) return reply.code(400).send({ error: 'Lista de grupos destino inválida' })
    const usesChannel = monitor.kind === JID_KIND.CHANNEL || validPosts.some(post => post.kind === JID_KIND.CHANNEL)
    if (usesChannel && !(await ensureChannelFeatureAllowed(req.user.sub, reply))) return

    // `targetsMode` grava a INTENÇÃO da cliente. Salvar a escolha é SEMPRE
    // 'explicit' — inclusive com a lista vazia. Desmarcar tudo e salvar é a
    // cliente dizendo "não mande para ninguém"; gravar 'all' aqui fazia o GET
    // devolver TODOS os destinos de volta (o fallback histórico), então ao
    // reabrir a tela tudo aparecia marcado de novo e a origem seguia espelhando
    // para grupos que ela acabara de desmarcar. 'all' continua existindo apenas
    // para quem NUNCA escolheu destino (nenhum salvamento nesta origem).
    const targetsMode = 'explicit'
    await db.$transaction([
      db.groupTarget.deleteMany({ where: { userId: req.user.sub, monitorId: monitor.id } }),
      ...postIds.map(postId => db.groupTarget.create({ data: { userId: req.user.sub, monitorId: monitor.id, postId } })),
      db.group.update({ where: { id: monitor.id }, data: { targetsMode } }),
    ])

    const configReload = await reloadWorkerConfig(req.user.sub)
    app.log.info({ monitorId: monitor.id, postCount: postIds.length, targetsMode, configReloaded: configReload.ok, configReloadError: configReload.error }, 'Destinos do grupo monitor atualizados; configuração do worker recarregada quando disponível')
    return { postIds, mode: targetsMode }
  })

  app.put('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo não encontrado' })

    const { blockedKeywords, allowedPlatforms, welcomeMsg, imageMode, watermarkText, watermarkColor, watermarkSize, watermarkPosition, imageLinkTarget, fallbackToOriginal, forwardMode, noLinkScope, templateKey, relayFooterText, primaryLinkTarget, channelButtonJid, channelButtonName } = req.body ?? {}
    if (allowedPlatforms !== undefined) {
      const platforms = String(allowedPlatforms).split(',').filter(Boolean)
      const invalid = platforms.find(p => !['shopee', 'amazon', 'mercadolivre', 'magazineluiza', 'shein', 'aliexpress'].includes(p))
      if (invalid) return reply.code(400).send({ error: 'allowedPlatforms contém plataforma inválida' })
    }

    // Os quatro modos da política (core/imageModePolicy.js) são aceitos desde
    // que o worker saiba compor cada um. `preview_watermark` entrou aqui junto
    // com a composição da marca no card (buildManualLinkPreview, bot-worker.js)
    // — nunca liberar um modo antes do worker, senão a cliente salva uma
    // escolha que ela veria como "não fez nada".
    if (imageMode !== undefined && !['original', 'original_watermark', 'preview', 'preview_watermark'].includes(imageMode)) {
      return reply.code(400).send({ error: 'imageMode inválido' })
    }
    // Modo de imagem e marca d'água pertencem ao DESTINO, nunca à origem — a
    // origem nunca leu este campo (toMonitorGroup em groupEntitlements.js nem
    // repassa `imageMode`), mas bloqueamos a escrita aqui para não deixar uma
    // configuração "fantasma" salva sem nenhum efeito.
    if ((imageMode !== undefined || watermarkText !== undefined || watermarkColor !== undefined || watermarkSize !== undefined || watermarkPosition !== undefined) && group.role !== 'post') {
      return reply.code(400).send({ error: 'Modo de imagem e marca d\'água só podem ser definidos no destino.' })
    }
    // Limite, cores, tamanhos e posições vêm de core/watermarkInput.js — o
    // lugar único onde a API repete o formato do renderizador sem carregar
    // `sharp` (política de memória; ver o cabeçalho daquele módulo).
    const normalizedWatermarkText = normalizeWatermarkInputText(watermarkText)
    if (normalizedWatermarkText !== undefined && isWatermarkTextTooLong(normalizedWatermarkText)) {
      return reply.code(400).send({ error: 'A marca d\'água deve ter no máximo 25 caracteres.' })
    }
    if (watermarkColor !== undefined && !isValidWatermarkColor(watermarkColor)) {
      return reply.code(400).send({ error: 'Cor da marca d\'água inválida.' })
    }
    if (watermarkSize !== undefined && !isValidWatermarkSize(watermarkSize)) {
      return reply.code(400).send({ error: 'Tamanho da marca d\'água inválido.' })
    }
    if (watermarkPosition !== undefined && !isValidWatermarkPosition(watermarkPosition)) {
      return reply.code(400).send({ error: 'Posição da marca d\'água inválida.' })
    }
    const requestedImageMode = imageMode ?? group.imageMode ?? 'original'
    const requestedWatermarkText = normalizedWatermarkText ?? group.watermarkText ?? ''
    if (['original_watermark', 'preview_watermark'].includes(requestedImageMode) && !requestedWatermarkText) {
      return reply.code(400).send({ error: 'Escreva o texto da marca d\'água antes de ativar esse modo.' })
    }
    if (imageLinkTarget !== undefined && !['first', 'last'].includes(imageLinkTarget)) {
      return reply.code(400).send({ error: 'imageLinkTarget inválido' })
    }

    if (forwardMode !== undefined && !Object.values(FORWARD_MODE).includes(forwardMode)) {
      return reply.code(400).send({ error: 'forwardMode inválido' })
    }
    if (noLinkScope !== undefined && !Object.values(NO_LINK_SCOPE).includes(noLinkScope)) {
      return reply.code(400).send({ error: 'noLinkScope inválido' })
    }
    if (primaryLinkTarget !== undefined && primaryLinkTarget !== null && primaryLinkTarget !== '' && !['first', 'last'].includes(primaryLinkTarget)) {
      return reply.code(400).send({ error: 'primaryLinkTarget inválido' })
    }
    if (templateKey !== undefined && templateKey !== null && String(templateKey).trim() && !/^[A-Za-z0-9_-]{1,80}$/.test(String(templateKey).trim())) {
      return reply.code(400).send({ error: 'templateKey inválido' })
    }
    const normalizedRelayFooter = normalizeRelayFooter(relayFooterText)
    if (normalizedRelayFooter !== undefined && normalizedRelayFooter.length > RELAY_FOOTER_MAX_CHARS) {
      return reply.code(400).send({ error: `O texto adicional deve ter no máximo ${RELAY_FOOTER_MAX_CHARS} caracteres.` })
    }
    if (relayFooterText !== undefined && group.role !== 'monitor') {
      return reply.code(400).send({ error: 'Texto adicional só pode ser definido em grupos monitorados.' })
    }

    if (forwardMode === FORWARD_MODE.LINK_ONLY && noLinkScope !== undefined && noLinkScope !== null) {
      return reply.code(400).send({ error: 'noLinkScope só pode ser usado com forwardMode=ALLOW_NO_LINK' })
    }

    // Botão "Ver canal" por grupo de destino: '' limpa (sem botão), JID válido
    // salva, formato inválido → 400. Só faz sentido em grupo de destino (post).
    const normalizedChannelButtonJid = channelButtonJid !== undefined ? normalizeChannelForwardJid(channelButtonJid) : undefined
    if (channelButtonJid !== undefined && normalizedChannelButtonJid === null) {
      return reply.code(400).send({ error: 'JID do canal inválido. Use o formato 1203...@newsletter.' })
    }
    if (channelButtonJid !== undefined && group.role !== 'post') {
      return reply.code(400).send({ error: 'Botão de canal só pode ser definido em grupos de destino (post).' })
    }
    const normalizedChannelButtonName = channelButtonName !== undefined
      ? String(channelButtonName ?? '').trim().slice(0, 80)
      : undefined

    // Plano B / Fase 3: o override de janela silenciosa POR GRUPO foi removido.
    // Horário de funcionamento e limites anti-ban por destino vivem agora em
    // /painel/preservacao/destinos (presets + override por destino).

    const currentPolicy = normalizeForwardingPolicy(group)
    const requestedForwardMode = forwardMode ?? currentPolicy.forwardMode
    const requestedNoLinkScope = requestedForwardMode === FORWARD_MODE.ALLOW_NO_LINK
      ? (noLinkScope ?? currentPolicy.noLinkScope ?? NO_LINK_SCOPE.TEXT_ONLY)
      : null

    const enablingAdvancedPreservation = requestedForwardMode === FORWARD_MODE.ALLOW_NO_LINK
    if (enablingAdvancedPreservation && !(await ensureAdvancedPreservationAllowed(req.user.sub, reply))) return

    // Botão "Ver canal" e card clicável não convivem: o WhatsApp só aceita o
    // botão em corpo de mídia. Em vez de guardar uma escolha que nunca vai
    // valer, gravamos já o formato que de fato vai sair — assim o painel mostra
    // a verdade em vez de prometer um card que o WhatsApp derruba. A marca
    // d'água é preservada na troca ('card com marca' vira 'foto com marca').
    const channelButtonFinal = normalizedChannelButtonJid !== undefined
      ? normalizedChannelButtonJid || null
      : (group.channelButtonJid ?? null)
    const imageModeSolicitado = imageMode ?? group.imageMode
    const imageModeFinal = effectiveDestinationImageMode(imageModeSolicitado, { hasChannelButton: Boolean(channelButtonFinal) })
    const precisaDegradar = imageModeFinal !== imageModeSolicitado

    const updated = await db.group.update({
      where: { id: req.params.id },
      data: {
        ...(blockedKeywords !== undefined ? { blockedKeywords: String(blockedKeywords).trim() || null } : {}),
        ...(allowedPlatforms !== undefined ? { allowedPlatforms: String(allowedPlatforms).trim() || null } : {}),
        ...(welcomeMsg !== undefined ? { welcomeMsg: String(welcomeMsg).trim() || null } : {}),
        ...((imageMode !== undefined || precisaDegradar) ? { imageMode: imageModeFinal } : {}),
        ...(normalizedWatermarkText !== undefined ? { watermarkText: normalizedWatermarkText || null } : {}),
        ...(watermarkColor !== undefined ? { watermarkColor } : {}),
        ...(watermarkSize !== undefined ? { watermarkSize } : {}),
        ...(watermarkPosition !== undefined ? { watermarkPosition } : {}),
        ...(imageLinkTarget !== undefined ? { imageLinkTarget } : {}),
        ...(fallbackToOriginal !== undefined ? { fallbackToOriginal: parseBoolean(fallbackToOriginal) } : {}),
        ...(forwardMode !== undefined ? { forwardMode: requestedForwardMode } : {}),
        // Três estados: null = herda o template padrão global; '' = relay explícito
        // (não aplica template mesmo havendo padrão global); 'chave' = template fixo.
        ...(templateKey !== undefined ? { templateKey: templateKey === null ? null : String(templateKey).trim() } : {}),
        ...(normalizedRelayFooter !== undefined ? { relayFooterText: normalizedRelayFooter || null } : {}),
        ...(primaryLinkTarget !== undefined ? { primaryLinkTarget: primaryLinkTarget || null } : {}),
        ...((noLinkScope !== undefined || forwardMode !== undefined) ? { noLinkScope: requestedNoLinkScope } : {}),
        ...(normalizedChannelButtonJid !== undefined ? { channelButtonJid: normalizedChannelButtonJid || null } : {}),
        ...(normalizedChannelButtonName !== undefined ? { channelButtonName: normalizedChannelButtonName || null } : {}),
      },
    })
    const configReload = await reloadWorkerConfig(req.user.sub)
    app.log.info({ groupId: updated.id, imageMode: updated.imageMode, imageLinkTarget: updated.imageLinkTarget, fallbackToOriginal: updated.fallbackToOriginal, configReloaded: configReload.ok, configReloadError: configReload.error }, 'Grupo atualizado; configuração do worker recarregada quando disponível')
    return updated
  })

  app.delete('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo não encontrado' })
    await db.group.delete({ where: { id: req.params.id } })
    const configReload = await reloadWorkerConfig(req.user.sub)
    app.log.info({ groupId: group.id, role: group.role, configReloaded: configReload.ok, configReloadError: configReload.error }, 'Grupo removido; configuração do worker recarregada quando disponível')
    return { ok: true }
  })

  app.post('/resolve-channel-invite', { onRequest: [app.authenticate] }, async (req, reply) => {
    const url = req.body?.url
    const inviteCode = typeof url === 'string' ? parseChannelInviteUrl(url) : null
    if (!inviteCode) return reply.code(400).send({ error: 'URL de convite de canal inválida' })
    if (!(await ensureChannelFeatureAllowed(req.user.sub, reply))) return
    if (!isRunning(req.user.sub)) return reply.code(503).send({ error: 'WhatsApp não está conectado. Conecte primeiro.' })
    try {
      const data = await channelMetadata(req.user.sub, { inviteCode })
      if (!data) return reply.code(404).send({ error: 'Canal não encontrado. Confira o link.' })
      return data
    } catch (err) {
      req.log.warn({ err: err.message, inviteCode }, 'resolve-channel-invite falhou')
      return reply.code(502).send({ error: err.message || 'Falha ao buscar canal' })
    }
  })

  app.post('/resolve-channel-jid', { onRequest: [app.authenticate] }, async (req, reply) => {
    const jid = typeof req.body?.jid === 'string' ? req.body.jid.trim() : ''
    if (detectKind(jid) !== JID_KIND.CHANNEL) return reply.code(400).send({ error: 'JID deve terminar com @newsletter' })
    if (!(await ensureChannelFeatureAllowed(req.user.sub, reply))) return
    if (!isRunning(req.user.sub)) return reply.code(503).send({ error: 'WhatsApp não está conectado.' })
    try {
      const data = await channelMetadata(req.user.sub, { jid })
      if (!data) return reply.code(404).send({ error: 'Canal não encontrado' })
      return data
    } catch (err) {
      req.log.warn({ err: err.message, jid }, 'resolve-channel-jid falhou')
      return reply.code(502).send({ error: err.message })
    }
  })

  app.post('/:id/follow-now', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo/canal não encontrado' })
    if (group.kind !== JID_KIND.CHANNEL) return reply.code(400).send({ error: 'follow-now só vale pra canais' })
    if (!(await ensureChannelFeatureAllowed(req.user.sub, reply))) return
    if (!isRunning(req.user.sub)) return reply.code(503).send({ error: 'WhatsApp não está conectado.' })

    // O guard anti-ban roda SEMPRE (warmup + cooldown + intervalo mínimo).
    // O toggle followGuardEnabled controla apenas se o limite diário
    // personalizado vale; desligado, vale o teto conservador padrão.
    const guard = await canFollowNow(req.user.sub)
    if (!guard.ok) {
      const retryAfterSec = Math.max(1, Math.ceil((guard.retryAfterMs ?? 60_000) / 1000))
      reply.header('Retry-After', String(retryAfterSec))
      return reply.code(429).send({
        error: 'Limite anti-ban atingido',
        reason: guard.reason,
        retryAfterMs: guard.retryAfterMs,
        dailyUsed: guard.dailyUsed,
        dailyCap: guard.dailyCap,
      })
    }

    try {
      const data = await followChannelImmediate(req.user.sub, group.waJid)
      await logFollow(req.user.sub, group.waJid, 'ok').catch(() => {})
      return data
    } catch (err) {
      req.log.warn({ err: err.message, groupId: group.id }, 'follow-now falhou')
      await logFollow(req.user.sub, group.waJid, 'error', err.message ?? null).catch(() => {})
      return reply.code(502).send({ error: err.message || 'Falha ao seguir canal' })
    }
  })

  // PR-5.E.2: lint de título/copy. UI chama no submit; warnings nunca
  // bloqueiam — só alertam o cliente sobre risco de denúncia/banimento.
  app.post('/lint', { onRequest: [app.authenticate] }, async (req) => {
    const { title, template } = req.body ?? {}
    const warnings = []
    if (typeof title === 'string') warnings.push(...lintChannelTitle(title).warnings)
    if (typeof template === 'string') warnings.push(...lintCopyTemplate(template).warnings)
    return { warnings }
  })

  app.get('/:id/snapshots', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo/canal não encontrado' })
    if (group.kind !== JID_KIND.CHANNEL) return reply.code(400).send({ error: 'snapshots só vale pra canais' })
    return db.channelSnapshot.findMany({
      where: { groupId: group.id },
      orderBy: { snapshotedAt: 'desc' },
      take: 30,
    })
  })

  app.post('/:id/snapshot-now', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo/canal não encontrado' })
    if (group.kind !== JID_KIND.CHANNEL) return reply.code(400).send({ error: 'snapshot só vale pra canais' })
    if (!isRunning(req.user.sub)) return reply.code(503).send({ error: 'WhatsApp não está conectado.' })
    try {
      const row = await captureSnapshot(group.id, {
        userId: req.user.sub,
        waJid: group.waJid,
        getMetadata: channelMetadata,
      })
      if (!row) return reply.code(502).send({ error: 'Não foi possível obter metadata do canal' })
      return row
    } catch (err) {
      req.log.warn({ err: err.message, groupId: group.id }, 'snapshot-now falhou')
      return reply.code(502).send({ error: err.message ?? 'Falha ao capturar snapshot' })
    }
  })

  app.post('/:id/recreate', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo/canal não encontrado' })
    if (group.kind !== JID_KIND.CHANNEL) return reply.code(400).send({ error: 'recreate só vale pra canais' })
    const newJid = req.body?.newJid
    if (!newJid || typeof newJid !== 'string' || !newJid.endsWith('@newsletter')) {
      return reply.code(400).send({ error: 'newJid inválido (deve terminar em @newsletter)' })
    }
    if (newJid === group.waJid) {
      return reply.code(400).send({ error: 'newJid é igual ao JID atual' })
    }
    if (!isRunning(req.user.sub)) return reply.code(503).send({ error: 'WhatsApp não está conectado.' })

    // Valida ownership do novo canal antes de trocar.
    let meta
    try {
      meta = await channelMetadata(req.user.sub, { jid: newJid })
    } catch (err) {
      req.log.warn({ err: err.message, newJid }, 'recreate: falha ao buscar metadata do novo canal')
      return reply.code(502).send({ error: 'Não foi possível verificar o novo canal' })
    }
    if (!meta) return reply.code(404).send({ error: 'Novo canal não encontrado no WhatsApp' })
    if (!meta.isViewerOwner) return reply.code(403).send({ error: 'Você não é admin do novo canal' })

    const updated = await db.group.update({
      where: { id: group.id },
      data: { waJid: newJid, name: meta.name || group.name },
    })
    // Reset health/throttle do canal pra começar limpo no novo JID.
    await db.channelHealth.deleteMany({ where: { groupId: group.id } }).catch(() => {})
    await db.channelThrottle.deleteMany({ where: { groupId: group.id } }).catch(() => {})

    return { group: updated, owner: meta.owner, name: meta.name }
  })

  app.get('/:id/health', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo/canal não encontrado' })
    if (group.kind !== JID_KIND.CHANNEL) return reply.code(400).send({ error: 'health só vale pra canais' })
    return getChannelHealth(group.id)
  })

  // PR-5.C.3: endpoint público (autenticado) que aceita "ping" externo da
  // conta-probe. Atualiza lastProbeSeenAt no ChannelHealth. O watchdog
  // periódico decide quando degradar saúde se faltar ping pós-post.
  app.post('/:id/probe-ping', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo/canal não encontrado' })
    if (group.kind !== JID_KIND.CHANNEL) return reply.code(400).send({ error: 'probe só vale pra canais' })
    const cfg = await db.botConfig.findUnique({ where: { userId: req.user.sub } })
    const latestSentAt = await resolveLatestSentForGroup({ userId: req.user.sub, groupWaJid: group.waJid }, { db })
    await registerProbeEvidence({
      userId: req.user.sub,
      groupId: group.id,
      probeSessionId: cfg?.probeAccountSessionId || 'manual',
      sentAt: latestSentAt,
      messageFingerprint: latestSentAt ? `${group.id}:${Math.floor(new Date(latestSentAt).getTime() / 60000)}` : null,
      matchSource: 'manual-ping-fallback',
    }, { db })
    return { ok: true, groupId: group.id }
  })

  app.post('/:id/risk-score/recompute', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo/canal não encontrado' })
    if (group.kind !== JID_KIND.CHANNEL) return reply.code(400).send({ error: 'risk-score só vale pra canais' })
    const daysRaw = Number(req.query?.days)
    const days = Number.isFinite(daysRaw) && daysRaw >= 1 && daysRaw <= 30 ? Math.floor(daysRaw) : 7
    const out = await recomputeReportRiskScore(group.id, { db, userId: req.user.sub, days })
    if (!out) return reply.code(404).send({ error: 'Não foi possível calcular' })
    return out
  })

  app.post('/:id/refresh-admin', { onRequest: [app.authenticate] }, async (req, reply) => {
    const group = await db.group.findFirst({ where: { id: req.params.id, userId: req.user.sub } })
    if (!group) return reply.code(404).send({ error: 'Grupo/canal não encontrado' })
    if (group.kind !== JID_KIND.CHANNEL) return reply.code(400).send({ error: 'refresh-admin só vale pra canais' })
    if (!(await ensureChannelFeatureAllowed(req.user.sub, reply))) return
    if (!isRunning(req.user.sub)) return reply.code(503).send({ error: 'WhatsApp não está conectado.' })
    try {
      const data = await channelMetadata(req.user.sub, { jid: group.waJid })
      if (!data) return reply.code(404).send({ error: 'Canal não encontrado no WhatsApp' })
      return { isViewerOwner: data.isViewerOwner, owner: data.owner, name: data.name }
    } catch (err) {
      req.log.warn({ err: err.message, groupId: group.id }, 'refresh-admin falhou')
      return reply.code(502).send({ error: err.message || 'Falha ao verificar canal' })
    }
  })

  app.get('/wa/channels', { onRequest: [app.authenticate] }, async (req, reply) => {
    if (!(await ensureChannelFeatureAllowed(req.user.sub, reply))) return
    if (!isRunning(req.user.sub)) return reply.code(503).send({ error: 'WhatsApp não está conectado.' })
    try {
      const data = await listFollowedChannelsFn(req.user.sub)
      return data ?? []
    } catch (err) {
      req.log.warn({ err: err.message }, 'wa/channels falhou')
      return reply.code(502).send({ error: err.message || 'Falha ao listar canais' })
    }
  })
}
