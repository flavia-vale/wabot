'use client'

/* Enviar mensagem (broadcast manual) — versão Menta do painel. A lógica de
 * seleção de destinos (Smart Segmentador), envio imediato e confirmação é a
 * mesma de /dashboard/envio; o título vai para a topbar via usePainelHeader. */

import { useEffect, useMemo, useState } from 'react'
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

const MESSAGE_TEMPLATES = [
  { label: 'Oferta relâmpago', text: '⚡ Oferta relâmpago!\n\nProduto:\nPreço:\nLink:' },
  { label: 'Cupom', text: '🎟️ Cupom disponível!\n\nUse o cupom:\nLink da oferta:' },
  { label: 'Últimas unidades', text: '🔥 Últimas unidades!\n\nGaranta antes que acabe:' },
]

export default function EnvioPage() {
  usePainelHeader({ title: 'Enviar mensagem', subtitle: 'Envie manualmente uma mensagem para os grupos de postagem selecionados' })

  const [broadcastText, setBroadcastText] = useState('')
  const [broadcastLoading, setBroadcastLoading] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState(null)
  const [broadcastError, setBroadcastError] = useState('')

  const [broadcastConfirmOpen, setBroadcastConfirmOpen] = useState(false)
  const [targetGroups, setTargetGroups] = useState([])
  const [selectedTargetJids, setSelectedTargetJids] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [minMembers, setMinMembers] = useState('')
  const [includeChannels, setIncludeChannels] = useState(false)
  const [topN, setTopN] = useState(10)
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
    } catch (err) {
      setTargetGroupsError(err.message || 'Não foi possível carregar os grupos de destino.')
    } finally {
      setTargetGroupsLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    api.groups()
      .then((groups) => {
        if (!active) return
        const postGroups = groups.filter((group) => group.role === 'post')
        setTargetGroups(postGroups)
        setSelectedTargetJids((prev) => prev.filter((jid) => postGroups.some((group) => group.waJid === jid)))
        trackEvent('group_selector_viewed', { total_destinations_loaded: postGroups.length, defaults_applied: true })
      })
      .catch((err) => {
        if (active) setTargetGroupsError(err.message || 'Não foi possível carregar os grupos de destino.')
      })
      .finally(() => {
        if (active) setTargetGroupsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  async function sendBroadcastNow() {
    if (broadcastLoading) return
    setBroadcastLoading(true)
    setBroadcastConfirmOpen(false)
    try {
      const res = await api.broadcastSend(broadcastText.trim(), selectedTargetJids)
      trackEvent('group_selector_confirmed', { selected_count: selectedTargetJids.length, selection_mode_mix: 'mixed' })
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

  const filteredTargetGroups = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const min = Number(minMembers || 0)
    return targetGroups.filter((group) => {
      if (!includeChannels && group.waJid?.endsWith('@newsletter')) return false
      if (query && !String(group.name || '').toLowerCase().includes(query)) return false
      const participants = Number(group.participantsCount || 0)
      if (Number.isFinite(min) && min > 0 && participants < min) return false
      return true
    })
  }, [targetGroups, searchTerm, minMembers, includeChannels])

  function toggleTarget(jid) {
    setSelectedTargetJids((prev) => {
      const exists = prev.includes(jid)
      const next = exists ? prev.filter((item) => item !== jid) : [...prev, jid]
      trackEvent(exists ? 'group_unselected' : 'group_selected', { destination_id: jid })
      return next
    })
  }

  function applyTopN() {
    const n = Math.max(1, Number(topN || 1))
    const ranked = [...filteredTargetGroups].sort((a, b) => {
      const sizeA = Number(a.participantsCount || 0)
      const sizeB = Number(b.participantsCount || 0)
      return sizeB - sizeA
    })
    const picked = ranked.slice(0, n).map((group) => group.waJid)
    setSelectedTargetJids((prev) => [...new Set([...prev, ...picked])])
    trackEvent('group_top_n_applied', { requested_n: n, applied_count: picked.length })
  }

  function selectAllVisible() {
    const jids = filteredTargetGroups.map((group) => group.waJid)
    setSelectedTargetJids((prev) => [...new Set([...prev, ...jids])])
    trackEvent('group_bulk_selected', { selected_count: jids.length, source: 'filter_result' })
  }

  function clearSelection() {
    setSelectedTargetJids([])
    trackEvent('group_unselected', { reason: 'bulk_clear' })
  }

  const targetGroupCount = targetGroups.length
  const broadcastConfirmMessage = targetGroupsError
    ? 'Você está prestes a enviar esta mensagem agora para os grupos de destino configurados. Não foi possível contar os grupos neste momento; a API fará a validação final.'
    : `Você está prestes a enviar esta mensagem agora para ${selectedTargetJids.length} grupo(s)/canal(is) selecionado(s).`

  return (
    <div className="max-w-xl">
      <div className="bg-white rounded-2xl shadow p-5 mb-4">
        <h3 className="font-semibold text-gray-700 mb-1">📤 Enviar agora</h3>
        <p className="text-xs text-amber-700 mb-2">Impacto: a mensagem será enviada apenas para os destinos selecionados. Total selecionado: <strong>{selectedTargetJids.length}</strong>{targetGroupsLoading ? '' : ` de ${targetGroupCount}`}. </p>

        <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Smart Segmentador (MVP)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); trackEvent('group_filter_changed', { filter_name: 'search', to_value: e.target.value }) }} placeholder="Buscar grupo/canal" className="w-full rounded-lg border px-3 py-2 text-sm" />
            <input value={minMembers} onChange={(e) => { setMinMembers(e.target.value); trackEvent('group_filter_changed', { filter_name: 'min_members', to_value: e.target.value }) }} type="number" min={0} placeholder="Mín. participantes" className="w-full rounded-lg border px-3 py-2 text-sm" />
          </div>
          <label className="mt-2 inline-flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={includeChannels} onChange={(e) => { setIncludeChannels(e.target.checked); trackEvent('group_filter_changed', { filter_name: 'include_channels', to_value: e.target.checked }) }} />
            Incluir canais
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={selectAllVisible} className="rounded-full border px-3 py-1 text-xs">Selecionar visíveis ({filteredTargetGroups.length})</button>
            <button type="button" onClick={clearSelection} className="rounded-full border px-3 py-1 text-xs">Limpar seleção</button>
            <input type="number" min={1} value={topN} onChange={(e) => setTopN(e.target.value)} className="w-20 rounded-full border px-2 py-1 text-xs" />
            <button type="button" onClick={applyTopN} className="rounded-full border px-3 py-1 text-xs">Top N</button>
          </div>
          <div className="mt-3 max-h-44 space-y-1 overflow-auto rounded-lg border bg-white p-2">
            {filteredTargetGroups.length ? filteredTargetGroups.map((group) => {
              const checked = selectedTargetJids.includes(group.waJid)
              return (
                <label key={group.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm hover:bg-gray-50">
                  <span className="truncate">{group.name}</span>
                  <input type="checkbox" checked={checked} onChange={() => toggleTarget(group.waJid)} />
                </label>
              )
            }) : <p className="text-xs text-gray-500">Nenhum destino com os filtros atuais.</p>}
          </div>
        </div>
        {targetGroupsError && (
          <div className="mb-3">
            <Alert type="warning" title="Grupos indisponíveis" message={`${targetGroupsError} A confirmação usará a validação da API ao enviar.`} />
            <button type="button" onClick={loadTargetGroups} className="mt-2 text-xs font-semibold text-amber-700 underline">Recarregar grupos</button>
          </div>
        )}

        <div className="mb-3 flex flex-wrap gap-2">
          {MESSAGE_TEMPLATES.map((template) => (
            <button
              key={template.label}
              type="button"
              onClick={() => setBroadcastText(template.text)}
              className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:border-green-400 hover:text-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
            >
              {template.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleBroadcast} className="flex flex-col gap-3">
          <textarea
            rows={4}
            placeholder="Digite a mensagem..."
            value={broadcastText}
            onChange={(e) => setBroadcastText(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2.5 min-h-11 text-sm"
          />

          <MessagePreview text={broadcastText} />

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
