'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { HelpLink } from '@/components/HelpLink'

const ALL_PLATFORMS = [
  { id: 'shopee', label: 'Shopee' },
  { id: 'amazon', label: 'Amazon' },
  { id: 'mercadolivre', label: 'Mercado Livre' },
  { id: 'magazineluiza', label: 'Magazine Luiza' },
]

export default function GruposPage() {
  const [groups, setGroups] = useState([])
  const [actionError, setActionError] = useState('')
  const [waGroups, setWaGroups] = useState(null)
  const [loadingWA, setLoadingWA] = useState(false)
  const [waError, setWaError] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [manualForm, setManualForm] = useState({ waJid: '', name: '', role: 'monitor' })
  const [manualLoading, setManualLoading] = useState(false)
  const [manualError, setManualError] = useState('')
  const [deleteTargetId, setDeleteTargetId] = useState(null)

  async function load() {
    try { setGroups(await api.groups()) } catch (err) { setActionError(err.message) }
  }

  useEffect(() => {
    let active = true
    api.groups().then((data) => { if (active) setGroups(data) }).catch((err) => { if (active) setActionError(err.message) })
    return () => { active = false }
  }, [])

  async function handleDelete(id) {
    setActionError('')
    try { await api.deleteGroup(id); await load() } catch (err) { setActionError(err.message) }
  }

  async function handleUpdateGroup(id, data) {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...data } : g))
    try { await api.updateGroup(id, data) } catch (err) { setActionError(err.message); await load() }
  }

  function toggleGroupPlatform(group, platformId) {
    const current = group.allowedPlatforms
      ? group.allowedPlatforms.split(',').filter(Boolean)
      : ALL_PLATFORMS.map(p => p.id)
    const next = current.includes(platformId)
      ? current.filter(p => p !== platformId)
      : [...current, platformId]
    handleUpdateGroup(group.id, { allowedPlatforms: next.join(',') })
  }

  async function handleLoadWA() {
    setLoadingWA(true)
    setWaError('')
    setWaGroups(null)
    try {
      const list = await api.sessionWAGroups()
      setWaGroups(list.sort((a, b) => a.name.localeCompare(b.name)))
    } catch (err) {
      setWaError(err.message)
    } finally {
      setLoadingWA(false)
    }
  }

  async function handleAddFromWA(g, role) {
    setActionError('')
    try {
      await api.addGroup(g.waJid, g.name, role)
      await load()
    } catch (err) { setActionError(err.message) }
  }

  async function handleManualAdd(e) {
    e.preventDefault()
    setManualError('')
    setActionError('')
    setManualLoading(true)
    try {
      await api.addGroup(manualForm.waJid.trim(), manualForm.name.trim(), manualForm.role)
      setManualForm({ waJid: '', name: '', role: 'monitor' })
      await load()
    } catch (err) {
      setManualError(err.message)
    } finally {
      setManualLoading(false)
    }
  }

  const monitor = groups.filter(g => g.role === 'monitor')
  const post = groups.filter(g => g.role === 'post')
  const existingJidRoles = new Set(groups.map(g => `${g.waJid}::${g.role}`))

  return (
    <div className="max-w-xl">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Grupos</h2>
        <HelpLink topic="como-cadastrar-grupos">Ajuda</HelpLink>
      </div>
      <p className="text-gray-500 text-sm mb-6">Configure quais grupos monitorar e onde postar</p>

      {actionError && <p className="text-red-500 text-sm mb-4">{actionError}</p>}

      {/* Carregar grupos do WhatsApp */}
      <div className="bg-white rounded-2xl shadow p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-700">Carregar grupos existentes</h3>
          <button
            onClick={handleLoadWA}
            disabled={loadingWA}
            className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition"
          >
            {loadingWA ? 'Carregando...' : 'Carregar do WhatsApp'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-3">O bot precisa estar conectado para listar os grupos.</p>

        {waError && <p className="text-red-500 text-sm mb-2">{waError}</p>}

        {waGroups && waGroups.length === 0 && (
          <p className="text-gray-400 text-sm">Nenhum grupo encontrado.</p>
        )}

        {waGroups && waGroups.length > 0 && (
          <ul className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {waGroups.map(g => {
              const monitorAlready = existingJidRoles.has(`${g.waJid}::monitor`)
              const postAlready = existingJidRoles.has(`${g.waJid}::post`)
              const bothAlready = monitorAlready && postAlready
              return (
                <li key={g.waJid} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                  <span className={`font-medium ${bothAlready ? 'text-gray-400' : 'text-gray-700'}`}>
                    {g.name}
                    {bothAlready && <span className="ml-2 text-xs text-gray-400">(já cadastrado)</span>}
                  </span>
                  {!bothAlready && (
                    <div className="flex gap-2">
                      {!monitorAlready && (
                        <button
                          onClick={() => handleAddFromWA(g, 'monitor')}
                          className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition"
                        >
                          👀 Monitorar
                        </button>
                      )}
                      {!postAlready && (
                        <button
                          onClick={() => handleAddFromWA(g, 'post')}
                          className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200 transition"
                        >
                          📢 Postar
                        </button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Grupos monitorados */}
      <div className="bg-white rounded-2xl shadow p-5 mb-4">
        <h3 className="font-semibold text-gray-700 mb-3">👀 Monitorar (origem)</h3>
        {monitor.length === 0 ? (
          <p className="text-gray-400 text-sm">Nenhum grupo cadastrado</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {monitor.map(g => (
              <li key={g.id} className="text-sm border border-gray-100 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium text-gray-700">{g.name}</span>
                    <span className="ml-2 text-gray-400 text-xs">{g.waJid}</span>
                  </div>
                  <button onClick={() => setDeleteTargetId(g.id)} className="text-red-400 hover:text-red-600 text-xs">
                    Remover
                  </button>
                </div>
                <div className="border-t border-gray-100 pt-2">
                  <p className="text-xs text-gray-500 mb-1.5">Imagem da mensagem:</p>
                  <div className="flex gap-4">
                    {[['none', 'Nenhuma'], ['original', 'Original'], ['fetch', 'Buscar no site']].map(([value, label]) => (
                      <label key={value} className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                        <input
                          type="radio"
                          name={`imageMode-${g.id}`}
                          value={value}
                          checked={(g.imageMode ?? 'none') === value}
                          onChange={() => handleUpdateGroup(g.id, { imageMode: value })}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  {(g.imageMode ?? 'none') === 'fetch' && (
                    <div className="flex gap-5 mt-2">
                      <label className="text-xs text-gray-500">
                        Usar link:{' '}
                        <select
                          value={g.imageLinkTarget ?? 'first'}
                          onChange={e => handleUpdateGroup(g.id, { imageLinkTarget: e.target.value })}
                          className="ml-1 border border-gray-200 rounded px-1.5 py-0.5 text-xs"
                        >
                          <option value="first">Primeiro</option>
                          <option value="last">Último</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={g.fallbackToOriginal ?? false}
                          onChange={e => handleUpdateGroup(g.id, { fallbackToOriginal: e.target.checked })}
                        />
                        Fallback para original
                      </label>
                    </div>
                  )}
                </div>
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <p className="text-xs font-medium text-gray-500 mb-2">Filtros deste grupo (opcional):</p>
                  <input
                    value={g.blockedKeywords ?? ''}
                    onChange={e => handleUpdateGroup(g.id, { blockedKeywords: e.target.value })}
                    placeholder="Palavras bloqueadas só neste grupo"
                    className="mb-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_PLATFORMS.map(platform => {
                      const selected = new Set((g.allowedPlatforms || '').split(',').filter(Boolean))
                      const checked = g.allowedPlatforms ? selected.has(platform.id) : true
                      return (
                        <label key={platform.id} className="flex items-center gap-1 text-xs text-gray-500">
                          <input type="checkbox" checked={checked} onChange={() => toggleGroupPlatform(g, platform.id)} />
                          {platform.label}
                        </label>
                      )
                    })}
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">Sem seleção manual, usa as plataformas globais.</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Grupos de postagem */}
      <div className="bg-white rounded-2xl shadow p-5 mb-4">
        <h3 className="font-semibold text-gray-700 mb-3">📢 Postar (destino)</h3>
        {post.length === 0 ? (
          <p className="text-gray-400 text-sm">Nenhum grupo cadastrado</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {post.map(g => (
              <li key={g.id} className="text-sm border border-gray-100 rounded-xl p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="font-medium text-gray-700">{g.name}</span>
                    <span className="ml-2 text-gray-400 text-xs">{g.waJid}</span>
                  </div>
                  <button onClick={() => setDeleteTargetId(g.id)} className="text-red-400 hover:text-red-600 text-xs">
                    Remover
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={g.welcomeMsg ?? ''}
                  onChange={e => handleUpdateGroup(g.id, { welcomeMsg: e.target.value })}
                  placeholder="Mensagem de boas-vindas específica deste grupo (opcional)"
                  className="mt-3 w-full border border-gray-200 rounded-lg px-3 py-2 text-xs"
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow p-5">
        <button
          type="button"
          onClick={() => setShowManual(v => !v)}
          className="text-sm text-gray-600 underline underline-offset-4"
        >
          {showManual ? 'Ocultar modo avançado' : 'Mostrar modo avançado (JID manual)'}
        </button>

        {showManual && (
          <>
            <p className="text-xs text-amber-600 mt-3 mb-2">
              Use apenas se você já tiver o JID técnico do grupo.
            </p>
            <form onSubmit={handleManualAdd} className="flex flex-col gap-3">
              <input
                placeholder="Nome do grupo (ex: Grupo Ofertas)"
                value={manualForm.name}
                onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))}
                required
                className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400"
              />
              <input
                placeholder="JID do grupo (ex: 120363421377996844@g.us)"
                value={manualForm.waJid}
                onChange={e => setManualForm(f => ({ ...f, waJid: e.target.value }))}
                required
                className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400"
              />
              <select
                value={manualForm.role}
                onChange={e => setManualForm(f => ({ ...f, role: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400"
              >
                <option value="monitor">👀 Monitorar (origem)</option>
                <option value="post">📢 Postar (destino)</option>
              </select>

              {manualError && <p className="text-red-500 text-sm">{manualError}</p>}

              <button
                type="submit"
                disabled={manualLoading}
                className="bg-gray-700 text-white rounded-lg py-2 font-semibold hover:bg-gray-800 disabled:opacity-50 transition"
              >
                {manualLoading ? 'Salvando...' : 'Adicionar manualmente'}
              </button>
            </form>
          </>
        )}
      </div>
      <ConfirmDialog open={!!deleteTargetId} title="Remover grupo" message="O grupo será removido desta configuração." confirmLabel="Remover" danger onCancel={() => setDeleteTargetId(null)} onConfirm={async () => { const id = deleteTargetId; setDeleteTargetId(null); if (id) await handleDelete(id) }} />
    </div>
  )
}
