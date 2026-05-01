'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

export default function GruposPage() {
  const [groups, setGroups] = useState([])
  const [form, setForm] = useState({ waJid: '', name: '', role: 'monitor' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    try { setGroups(await api.groups()) } catch {}
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.addGroup(form.waJid.trim(), form.name.trim(), form.role)
      setForm({ waJid: '', name: '', role: 'monitor' })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id) {
    try { await api.deleteGroup(id); await load() } catch {}
  }

  const monitor = groups.filter(g => g.role === 'monitor')
  const post = groups.filter(g => g.role === 'post')

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Grupos</h2>
      <p className="text-gray-500 text-sm mb-6">Configure quais grupos monitorar e onde postar</p>

      {/* Lista */}
      {[{ label: '👀 Monitorar (origem)', items: monitor }, { label: '📢 Postar (destino)', items: post }].map(({ label, items }) => (
        <div key={label} className="bg-white rounded-2xl shadow p-5 mb-4">
          <h3 className="font-semibold text-gray-700 mb-3">{label}</h3>
          {items.length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhum grupo cadastrado</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map(g => (
                <li key={g.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-gray-700">{g.name}</span>
                    <span className="ml-2 text-gray-400 text-xs">{g.waJid}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(g.id)}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {/* Formulário */}
      <div className="bg-white rounded-2xl shadow p-5">
        <h3 className="font-semibold text-gray-700 mb-3">Adicionar grupo</h3>
        <form onSubmit={handleAdd} className="flex flex-col gap-3">
          <input
            placeholder="Nome do grupo (ex: Grupo Ofertas)"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400"
          />
          <input
            placeholder="JID do grupo (ex: 120363421377996844@g.us)"
            value={form.waJid}
            onChange={e => setForm(f => ({ ...f, waJid: e.target.value }))}
            required
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400"
          />
          <select
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-400"
          >
            <option value="monitor">👀 Monitorar (origem)</option>
            <option value="post">📢 Postar (destino)</option>
          </select>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-green-600 text-white rounded-lg py-2 font-semibold hover:bg-green-700 disabled:opacity-50 transition"
          >
            {loading ? 'Salvando...' : 'Adicionar'}
          </button>
        </form>

        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">
            <strong>Como achar o JID:</strong> Use o script <code>list-groups.js</code> na raiz do projeto para listar seus grupos com os JIDs.
          </p>
        </div>
      </div>
    </div>
  )
}
