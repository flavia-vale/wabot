// PR-5 follow-up: click tracker foundation.
//
// Esta PR só monta o mecanismo isolado:
//   - shortlink (hash → originalUrl) com persistência em AffiliateLink
//   - logging de click em AffiliateClick (IP/UA hashed por privacidade)
//   - endpoint público GET /r/:hash que 302 redireciona + grava click
//
// NÃO mexe em src/converters/ (bloco protegido). A integração — fazer
// o bot enviar o shortlink em vez do link original — fica para PR
// dedicada, com cuidado.
//
// Próximo PR (já desbloqueado): PR-5.C.4 — usar getClickStats como
// sinal indireto de saúde (drop > 70% em 48h → yellow).

import crypto from 'node:crypto'
import defaultDb from '../db.js'
import { writeAffiliateClick } from '../events/store.js'

const HASH_BYTES = 6 // 8 chars base64url

function getClickHashSalt() {
  return process.env.CLICK_HASH_SALT || 'wabot-click-salt-v1'
}

export function generateHash() {
  return crypto.randomBytes(HASH_BYTES).toString('base64url')
}

function hashWithSalt(value) {
  if (value == null || value === '') return null
  return crypto.createHash('sha256').update(String(value) + '|' + getClickHashSalt()).digest('hex')
}

export const hashIp = hashWithSalt
export const hashUserAgent = hashWithSalt

/**
 * @param {string} userId
 * @param {string} originalUrl
 * @param {{ db?: any, baseUrl?: string, groupId?: string, messageLogId?: string }} [opts]
 */
export async function createShortlink(userId, originalUrl, opts = {}) {
  if (!originalUrl || typeof originalUrl !== 'string') {
    throw new Error('createShortlink: URL obrigatória')
  }
  const db = opts.db ?? defaultDb
  const baseUrl = (opts.baseUrl ?? process.env.SHORTLINK_BASE_URL ?? '').replace(/\/$/, '')

  // Loop de retry caso colisão de hash (improvável, mas defensivo).
  for (let attempt = 0; attempt < 5; attempt++) {
    const hash = generateHash()
    try {
      const row = await db.affiliateLink.create({
        data: {
          userId,
          hash,
          originalUrl,
          ...(opts.groupId ? { groupId: opts.groupId } : {}),
          ...(opts.messageLogId ? { messageLogId: opts.messageLogId } : {}),
        },
      })
      return {
        hash: row.hash,
        shortUrl: baseUrl ? `${baseUrl}/r/${row.hash}` : `/r/${row.hash}`,
        id: row.id,
      }
    } catch (err) {
      // Prisma P2002 = unique constraint; retry com novo hash.
      if (err?.code !== 'P2002' && attempt < 4) continue
      if (attempt >= 4) throw err
    }
  }
  throw new Error('createShortlink: não foi possível gerar hash único')
}

export async function resolveShortlink(hash, opts = {}) {
  const db = opts.db ?? defaultDb
  return db.affiliateLink.findUnique({ where: { hash } })
}

/**
 * @param {string} linkId
 * @param {{ ip?: string, userAgent?: string }} request
 * @param {{ db?: any }} [opts]
 */
export async function recordClick(linkId, request = {}, opts = {}) {
  const db = opts.db ?? defaultDb
  return writeAffiliateClick({
    linkId,
    ipHash: hashIp(request.ip),
    uaHash: hashUserAgent(request.userAgent),
  }, { db })
}

/**
 * Agrega clicks numa janela. Aceita userId OU groupId.
 * @param {{ db?: any, userId?: string, groupId?: string, days?: number }} opts
 * @returns {Promise<{ total: number, days: number }>}
 */
export async function getClickStats(opts) {
  const db = opts.db ?? defaultDb
  const days = opts.days ?? 7
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const linkWhere = {}
  if (opts.userId) linkWhere.userId = opts.userId
  if (opts.groupId) linkWhere.groupId = opts.groupId

  const total = await db.affiliateClick.count({
    where: {
      ...(Object.keys(linkWhere).length ? { link: linkWhere } : {}),
      clickedAt: { gte: since },
    },
  })
  return { total, days }
}
