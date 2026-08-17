// Passada periódica que descobre credencial de loja recusada e avisa a cliente
// por e-mail (Mercado Livre / Amazon / Shopee).
//
// Por que existe: o caso real que motivou (ago/2026) ficou UMA SEMANA com o
// código do ML e o da Amazon mortos, 0 link curto em 7 dias, e ninguém
// percebeu — o aviso só existia dentro do painel, e quem não abre o painel não
// vê. As ofertas continuavam saindo (plano B), então nada gritava.
//
// Onde roda: in-process na API (setInterval + unref no boot de server.js),
// MESMO padrão de startLeadNurteSweep/startLogRetentionJob. Sem processo PM2
// novo, sem worker, sem Redis — AGENTS.md "Política de memória" (custo de RAM
// ~desprezível: uma consulta por ciclo, sem estado acumulado).
//
// Efeitos (db, sondagem, sendMail) são injetados para a lógica de decisão ficar
// em policy.js, pura e testável db-free. Nunca lança para o chamador: o
// setInterval do boot não pode morrer por causa desta feature (isolamento por
// item via try/catch + continue, mesma lição do RCA "fila travava inteira
// quando UM item falhava").

import { randomUUID } from 'crypto'
import { parseCredentialData, validateCredentialData } from '../credentialHealth.js'
import { encryptCredential } from '../credentialCrypto.js'
import { sendTemplateEmail } from '../email/dispatcher.js'
import { resolveDashboardUrl } from '../email/layout.js'
import { isAccountInUse, loadAccountActivity } from '../email/accountActivity.js'
import { buildExpiryAlerts } from './message.js'
import {
  ALERT_EVENT,
  EXPIRY_ALERT_PLATFORMS,
  isAlertableUser,
  isConfirmedExpired,
  platformsDueForProbe,
  resolveAlertCooldownMs,
} from './policy.js'

/**
 * Último aviso enviado por loja, para um cliente. É a persistência do
 * anti-spam: mora em AnalyticsEvent (mesmo padrão da trilha de nutrição), então
 * não exige tabela/migration nova e sobrevive a restart da API.
 * @returns {Promise<Record<string, Date|null>>}
 */
export async function lastAlertByPlatform({ db, userId, since }) {
  const events = await db.analyticsEvent.findMany({
    where: { userId, event: ALERT_EVENT, ...(since ? { createdAt: { gte: since } } : {}) },
  })
  const result = {}
  for (const e of events) {
    let platform = null
    try {
      const metadata = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : (e.metadata || {})
      platform = metadata?.platform ?? null
    } catch {
      // metadata malformada — ignora esse registro isolado, não aborta a leitura
    }
    if (!platform) continue
    const at = new Date(e.createdAt)
    if (!result[platform] || at > result[platform]) result[platform] = at
  }
  return result
}

function groupCredentialsByUser(credentials = []) {
  const byUser = new Map()
  for (const cred of credentials) {
    if (!EXPIRY_ALERT_PLATFORMS.includes(cred.platform)) continue
    if (!cred.user) continue
    const entry = byUser.get(cred.userId) ?? { user: cred.user, credentials: new Map() }
    entry.credentials.set(cred.platform, cred)
    byUser.set(cred.userId, entry)
  }
  return byUser
}

/**
 * Executa uma passada: para cada cliente com código de acesso cadastrado no ML
 * ou na Amazon, sonda o que estiver fora da janela de silêncio e, quando a
 * sondagem CONFIRMA que venceu (`alive === false`; `null` nunca conta), manda
 * um e-mail — um só, mesmo quando as duas lojas venceram.
 *
 * @param {{
 *   db: object,
 *   sendMail: function,
 *   checkers: Record<string, function>,
 *   now?: Date,
 *   logger?: object,
 *   cooldownMs?: number,
 *   probeCaches?: Record<string, { getCachedProbe: function, setCachedProbe: function }>,
 * }} params
 * @returns {Promise<{scanned:number, probed:number, expired:number, sent:number, skipped:number, failed:number, failures:Array}>}
 */
export async function runCredentialExpirySweep({
  db,
  sendMail,
  checkers = {},
  now = new Date(),
  logger = console,
  cooldownMs = resolveAlertCooldownMs(),
  probeCaches = {},
} = {}) {
  const summary = { scanned: 0, probed: 0, expired: 0, sent: 0, skipped: 0, failed: 0, failures: [] }

  let credentials = []
  try {
    credentials = await db.credential.findMany({
      where: { platform: { in: [...EXPIRY_ALERT_PLATFORMS] } },
      include: { user: true },
    })
  } catch (err) {
    logger?.error?.({ err: err?.message }, 'credential-expiry: falha ao carregar credenciais')
    return summary
  }

  const cooldownStart = new Date(new Date(now).getTime() - cooldownMs)

  for (const [userId, entry] of groupCredentialsByUser(credentials)) {
    summary.scanned += 1
    try {
      // Endereço fabricado (user_*@sistema.com) e conta banida/suspensa nem
      // chegam a ser sondados — não há e-mail para mandar.
      if (!isAlertableUser(entry.user)) {
        summary.skipped += 1
        continue
      }

      const configured = [...entry.credentials.keys()].filter((platform) => {
        const data = parseCredentialData(entry.credentials.get(platform)?.data)
        // Falta de campo é outro problema (o painel já diz "falta preencher") —
        // aqui só tratamos código cadastrado que a loja passou a recusar.
        return validateCredentialData(platform, data).configured
      })

      // Antes de gastar sondagem na loja: essa conta está usando o robô? Conta
      // com plano vencido / WhatsApp fora / parada há dias não tem o que fazer
      // com o aviso, e a sondagem ainda queimaria uma rotação de código à toa.
      // Foto incompleta (consulta que caiu) não silencia — segue e sonda.
      const activity = await loadAccountActivity({ db, userId, user: entry.user })
      if (!activity.incompleta && !isAccountInUse(activity, now)) {
        summary.skipped += 1
        continue
      }

      const alertedAt = await lastAlertByPlatform({ db, userId, since: cooldownStart })
      const due = platformsDueForProbe({ platforms: configured, lastAlertByPlatform: alertedAt, now, cooldownMs })
      if (!due.length) {
        summary.skipped += 1
        continue
      }

      const expiredPlatforms = []
      for (const platform of due) {
        const probe = await probePlatform({
          db, platform, userId, cred: entry.credentials.get(platform), checkers, probeCaches, logger,
        })
        if (probe?.fromCache !== true) summary.probed += 1
        if (isConfirmedExpired(probe)) expiredPlatforms.push(platform)
      }

      if (!expiredPlatforms.length) continue
      summary.expired += expiredPlatforms.length

      // Passa pelo motor de e-mails (catálogo + travas + histórico): assim a
      // admin edita estes textos pela aba E-mails, como todos os outros.
      //
      // Pode sair mais de um e-mail: ML/Amazon compartilham um texto ("continua
      // saindo, só o link fica mais comprido") e a Shopee tem o dela ("as
      // ofertas pararam"). Ver buildExpiryAlerts.
      const alerts = buildExpiryAlerts(expiredPlatforms)
      const notified = []
      for (const alert of alerts) {
        const res = await sendTemplateEmail({
          db,
          sendMail,
          slug: alert.slug,
          user: entry.user,
          vars: { ...alert.vars, link_credenciais: `${resolveDashboardUrl()}/painel/ids-afiliada` },
          mode: 'auto',
          now,
          logger,
        })
        // Sem SMTP (ou trava do despachante): NÃO gravar o aviso desta loja,
        // senão a janela de silêncio queima sem a cliente ter recebido nada.
        if (res?.sent) notified.push(...alert.platforms)
      }

      if (!notified.length) {
        summary.skipped += 1
        continue
      }

      for (const platform of notified) {
        await db.analyticsEvent.create({
          data: {
            id: randomUUID(),
            userId,
            event: ALERT_EVENT,
            metadata: JSON.stringify({ platform, together: notified.length }),
            createdAt: new Date(now),
          },
        })
      }
      summary.sent += 1
      logger?.info?.({ userId, platforms: notified }, 'credential-expiry: aviso enviado')
    } catch (err) {
      summary.failed += 1
      summary.failures.push({ userId, error: String(err?.message ?? err) })
      logger?.error?.({ err: err?.message, userId }, 'credential-expiry: falha isolada num cliente')
    }
  }

  return summary
}

// Sondagem de uma loja para um cliente. Reaproveita o cache curto de sondagem
// do painel (quando disponível) e PERSISTE a rotação de código que a loja
// devolve — sem isso, a rotação seria descartada e a sessão morreria mais cedo
// por causa da nossa própria checagem (mesmo contrato das rotas
// GET /credentials/<loja>/session).
async function probePlatform({ db, platform, userId, cred, checkers, probeCaches, logger }) {
  const cache = probeCaches[platform]
  const cached = cache?.getCachedProbe?.(userId)
  if (cached) return { ...cached, fromCache: true }

  const check = checkers[platform]
  if (typeof check !== 'function') return null

  const data = parseCredentialData(cred?.data)
  let result
  try {
    result = await check(data)
  } catch (err) {
    // Falha da sondagem NUNCA vira "seu código venceu": fica indeterminado.
    logger?.warn?.({ platform, userId, err: err?.message }, 'credential-expiry: sondagem falhou')
    return { configured: true, alive: null, reason: 'check_failed' }
  }

  const { credentialPatch, ...publicResult } = result || {}
  if (credentialPatch) {
    try {
      await db.credential.update({
        where: { userId_platform: { userId, platform } },
        data: { data: encryptCredential(JSON.stringify({ ...data, ...credentialPatch })) },
      })
    } catch (err) {
      logger?.warn?.({ platform, userId, err: err?.message }, 'credential-expiry: falha ao persistir rotação do código')
    }
  }

  if (publicResult.alive === true || publicResult.alive === false) {
    cache?.setCachedProbe?.(userId, { ...publicResult, checkedAt: new Date().toISOString() })
  }
  return publicResult
}
