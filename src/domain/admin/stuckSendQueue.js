// Operação → Filas (M5 da auditoria do painel admin). Regra PURA, sem banco.
//
// Em produção `QUEUE_BACKEND` não está no .env: a fila de envio é em memória e
// NÃO existe DLQ do Redis. O que existe de verdade é MessageLog preso em
// 'sending' (src/jobs/stuckSendLogs.js). Aqui ficam: o que é "preso", qual o
// backend e como montar a linha por cliente.

import { STUCK_SENDING_MS } from '../../ops/adminOpsAlertPolicy.js'

export const FILAS_MAX_LINHAS = 500

/** 'bullmq' só com QUEUE_BACKEND=bullmq; qualquer outra coisa é memória. */
export function resolveQueueBackend(env = process.env) {
  return String(env?.QUEUE_BACKEND || '').trim().toLowerCase() === 'bullmq' ? 'bullmq' : 'memoria'
}

/** A DLQ do Redis só existe com BullMQ. */
export function dlqDisponivel(env = process.env) {
  return resolveQueueBackend(env) === 'bullmq'
}

/** Linha em 'sending' há mais que o limite? `sentAt` é quando entrou em 'sending'. */
export function isStuckSending(row, nowMs = Date.now(), limitMs = STUCK_SENDING_MS) {
  if (!row || row.status !== 'sending' || !row.sentAt) return false
  const t = new Date(row.sentAt).getTime()
  return Number.isFinite(t) && nowMs - t > limitMs
}

/**
 * groupBy de presos (userId, _count, _min.sentAt) + clientes + último sucesso
 * por cliente → linhas ordenadas (mais antigo primeiro), no máximo 500.
 */
export function buildFilasRows({ presos = [], usuarios = [], ultimosSucessos = [], nowMs = Date.now() } = {}) {
  const user = new Map(usuarios.map(u => [u.id, u]))
  const ok = new Map(ultimosSucessos.map(l => [l.userId, l._max?.sentAt ?? null]))
  return presos
    .map(p => {
      const maisAntigo = p._min?.sentAt ? new Date(p._min.sentAt).getTime() : null
      const u = user.get(p.userId)
      return {
        userId: p.userId,
        email: u?.email ?? null,
        name: u?.name ?? null,
        presos: Number(p._count?._all ?? 0),
        maisAntigoMs: maisAntigo != null && Number.isFinite(maisAntigo) ? Math.max(0, nowMs - maisAntigo) : null,
        ultimoSucessoEm: ok.get(p.userId) ? new Date(ok.get(p.userId)).toISOString() : null,
      }
    })
    .sort((a, b) => (b.maisAntigoMs ?? 0) - (a.maisAntigoMs ?? 0))
    .slice(0, FILAS_MAX_LINHAS)
}

export function validateReprocessReason(body) {
  const reason = String(body?.reason ?? '').trim()
  if (reason.length < 5) return { ok: false, error: 'Motivo obrigatório com pelo menos 5 caracteres.' }
  return { ok: true, reason: reason.slice(0, 300) }
}
