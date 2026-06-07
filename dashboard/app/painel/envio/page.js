'use client'

/* Enviar mensagem (broadcast manual) — versão Menta simplificada.
 * Mantém o contrato real de api.broadcastSend(text, selectedTargetJids), mas
 * remove segmentação avançada: a pessoa escolhe destinos diretamente. */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { trackEvent } from '@/lib/analytics'
import { usePainelHeader } from '../PainelShell'

function classifyError(message = '') {
  const text = message.toLowerCase()
  if (text.includes('network') || text.includes('fetch') || text.includes('conex')) {
    return 'conectividade'
  }
  if (text.includes('invalid') || text.includes('obrigat') || text.includes('required')) {
    return 'validação'
  }
  return 'regra de negócio'
}

function MessagePreview({ text, title = 'Prévia da mensagem' }) {
  const trimmed = text.trim()

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
        <span className="text-xs text-gray-400">{text.length} caractere(s)</span>
      </div>
      {trimmed ? (
        <p className="whitespace-pre-wrap rounded-2xl bg-white px-3 py-2.5 min-h-11 text-sm text-gray-700 shadow-sm">{text}</p>
      ) : (
        <p className="text-sm text-gray-400">Digite uma mensagem para visualizar a prévia antes de enviar.</p>
      )}
    </div>
  )
}

export default function EnvioPage() {
  usePainelHeader({ title: 'Enviar mensagem', subtitle: 'Escreva a mensagem e selecione os destinos que vão receber' })

  const [broadcastText, setBroadcastText] = useState('')
  const [broadcastLoading, setBroadcastLoading] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState(null)
  const [broadcastError, setBroadcastError] = useState('')

  const [broadcastConfirmOpen, setBroadcastConfirmOpen] = useState(false)
  const [targetGroups, setTargetGroups] = useState([])
  const [selectedTargetJids, setSelectedTargetJids] = useState([])
  const [targetGroupsLoading, setTargetGroupsLoading] = useState(true)
  const [targetGroupsError, setTargetGroupsError] = useState('')

  async function loadTargetGroups() {
    setTargetGroupsError('')
    setTargetGroupsLoading(true)
    try {
      const groups = await api.groups()
      const postGroups = groups.filter((group) => group.role === 'post')
      setTargetGroups(postGroups)
      setSelectedTargetJids((prev) => prev.filter((jid) => postGroups.some((group) => group.waJid === jid)))
      trackEvent('group_selector_viewed', { total_destinations_loaded: postGroups.length, mode: 'direct' })
    } catch (err) {
      setTargetGroupsError(err.message || 'Não foi possível carregar os grupos de destino.')
    } finally {
      setTargetGroupsLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    async function load() {
      setTargetGroupsError('')
      setTargetGroupsLoading(true)
      try {
        const groups = await api.groups()
        if (!active) return
        const postGroups = groups.filter((group) => group.role === 'post')
        setTargetGroups(postGroups)
        setSelectedTargetJids((prev) => prev.filter((jid) => postGroups.some((group) => group.waJid === jid)))
        trackEvent('group_selector_viewed', { total_destinations_loaded: postGroups.length, mode: 'direct' })
      } catch (err) {
        if (active) setTargetGroupsError(err.message || 'Não foi possível carregar os grupos de destino.')
      } finally {
        if (active) setTargetGroupsLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  async function sendBroadcastNow() {
    if (broadcastLoading) return
    setBroadcastLoading(true)
    setBroadcastConfirmOpen(false)
    try {
      const res = await api.broadcastSend(broadcastText.trim(), selectedTargetJids)
      trackEvent('group_selector_confirmed', { selected_count: selectedTargetJids.length, selection_mode_mix: 'direct' })
      setBroadcastResult(res)
      setBroadcastText('')
    } catch (err) {
      setBroadcastError(err.message)
    } finally {
      setBroadcastLoading(false)
    }
  }

  async function handleBroadcast(e) {
    e.preventDefault()
    setBroadcastError('')
    setBroadcastResult(null)

    if (!targetGroupsError && !targetGroups.length) {
      setBroadcastError('Nenhum grupo de destino configurado. Adicione um grupo de postagem antes de enviar.')
      return
    }

    if (!selectedTargetJids.length) {
      setBroadcastError('Selecione ao menos um grupo/canal de destino antes de enviar.')
      trackEvent('group_selection_blocked', { block_reason: 'none_selected' })
      return
    }

    setBroadcastConfirmOpen(true)
  }

  function toggleTarget(jid) {
    setSelectedTargetJids((prev) => {
      const exists = prev.includes(jid)
      const next = exists ? prev.filter((item) => item !== jid) : [...prev, jid]
      trackEvent(exists ? 'group_unselected' : 'group_selected', { destination_id: jid, mode: 'direct' })
      return next
    })
  }

  const targetGroupCount = targetGroups.length
  const broadcastConfirmMessage = targetGroupsError
    ? 'Você está prestes a enviar esta mensagem agora para os grupos de destino configurados. Não foi possível contar os grupos neste momento; a API fará a validação final.'
    : `Você está prestes a enviar esta mensagem agora para ${selectedTargetJids.length} grupo(s)/canal(is) selecionado(s).`

  return (
    <div className="max-w-xl">
      <div className="bg-white rounded-2xl shadow p-5 mb-4">
        <h3 className="font-semibold text-gray-700 mb-1">📤 Enviar agora</h3>
        <p className="text-xs text-amber-700 mb-4">Impacto: a mensagem será enviada apenas para os destinos selecionados. Total selecionado: <strong>{selectedTargetJids.length}</strong>{targetGroupsLoading ? '' : ` de ${targetGroupCount}`}. </p>

        {targetGroupsError && (
          <div className="mb-3">
            <Alert type="warning" title="Grupos indisponíveis" message={`${targetGroupsError} A confirmação usará a validação da API ao enviar.`} />
            <button type="button" onClick={loadTargetGroups} className="mt-2 text-xs font-semibold text-amber-700 underline">Recarregar grupos</button>
          </div>
        )}

        <form onSubmit={handleBroadcast} className="flex flex-col gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-gray-900">Mensagem</span>
            <textarea
              rows={5}
              placeholder="Digite a mensagem..."
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2.5 min-h-11 text-sm"
            />
          </label>

          <MessagePreview text={broadcastText} />

          <section className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-gray-900">Destinos</p>
                <p className="mt-1 text-xs text-gray-600">Selecione os grupos/canais que vão receber esta mensagem.</p>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-gray-700">{selectedTargetJids.length} selecionado(s)</span>
            </div>
            <div className="max-h-56 space-y-1 overflow-auto rounded-lg border bg-white p-2">
              {targetGroupsLoading ? (
                <p className="text-xs text-gray-500">Carregando destinos...</p>
              ) : targetGroups.length ? targetGroups.map((group) => {
                const checked = selectedTargetJids.includes(group.waJid)
                return (
                  <label key={group.id} className="flex items-center justify-between gap-2 rounded px-2 py-2 text-sm hover:bg-gray-50">
                    <span className="truncate">{group.name}</span>
                    <input type="checkbox" checked={checked} onChange={() => toggleTarget(group.waJid)} />
                  </label>
                )
              }) : <p className="text-xs text-gray-500">Nenhum destino cadastrado ainda.</p>}
            </div>
            <p className="mt-3 text-xs text-gray-600">Seu grupo de destino não está aqui? Clique aqui para adicionar</p>
            <Link href="/painel/grupos" className="mt-2 inline-flex min-h-10 items-center justify-center rounded-xl bg-gray-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-gray-800">
              Adicionar grupo de destino
            </Link>
          </section>

          {broadcastError && (
            <Alert
              type="error"
              title={`Erro de ${classifyError(broadcastError)}`}
              message={broadcastError}
            />
          )}

          {broadcastResult && (
            <Alert
              type="success"
              title="Broadcast enfileirado"
              message={`Enfileirado para ${broadcastResult.queued ?? 0} grupo(s). ${broadcastResult.rejected ? `${broadcastResult.rejected} rejeitado(s) pela fila.` : ''}`}
            />
          )}

          <button
            type="submit"
            disabled={broadcastLoading || targetGroupsLoading || !broadcastText.trim()}
            className="bg-green-600 text-white rounded-xl py-2.5 font-semibold disabled:opacity-50"
          >
            {broadcastLoading ? 'Enviando...' : <><span aria-hidden="true">📤</span> Enviar agora</>}
          </button>
        </form>
      </div>

      <ConfirmDialog open={broadcastConfirmOpen} title="Confirmar envio imediato" message={broadcastConfirmMessage} confirmLabel={broadcastLoading ? 'Enviando...' : 'Enviar agora'} onCancel={() => setBroadcastConfirmOpen(false)} onConfirm={sendBroadcastNow} />
    </div>
  )
}
