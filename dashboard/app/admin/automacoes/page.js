'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { Alert } from '@/components/Alert'
import { LoadingState } from '@/components/States'
import SectionErrorBoundary from '@/components/SectionErrorBoundary'

export default function AdminAutomationsPage() {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    loadUsers()
  }, [page, limit, search])

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/admin/automation-quota', {
        params: { page, limit, search },
      })
      setUsers(res.users || [])
      setTotal(res.total || 0)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateQuota = async (userId, newLimit) => {
    setSaving(userId)
    try {
      await api.patch(`/admin/automation-quota/${userId}`, {
        maxAutomations: newLimit,
      })
      await loadUsers()
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao atualizar limite')
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Configuração de Automações</h1>

      {error && <Alert type="error" title="Erro" message={error} />}

      <div className="mb-6 flex gap-2">
        <input
          type="text"
          placeholder="Buscar por email ou nome..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-3 py-2 text-left">Email</th>
              <th className="border px-3 py-2 text-left">Nome</th>
              <th className="border px-3 py-2 text-center">Ativas</th>
              <th className="border px-3 py-2 text-center">Total</th>
              <th className="border px-3 py-2 text-center">Limite</th>
              <th className="border px-3 py-2">Ação</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="border px-3 py-2 text-xs font-mono">{user.email}</td>
                <td className="border px-3 py-2">{user.name || '-'}</td>
                <td className="border px-3 py-2 text-center font-semibold">
                  {user.activeAutomations}
                </td>
                <td className="border px-3 py-2 text-center">
                  {user.totalAutomations}
                </td>
                <td className="border px-3 py-2">
                  <QuotaEditor
                    userId={user.id}
                    currentLimit={user.maxAutomations}
                    onUpdate={handleUpdateQuota}
                    saving={saving === user.id}
                  />
                </td>
                <td className="border px-3 py-2">
                  {saving === user.id && (
                    <span className="text-xs text-gray-500">Salvando...</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Nenhum usuário encontrado
        </div>
      )}

      <div className="mt-6 flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Mostrando {Math.min((page - 1) * limit + 1, total)} a{' '}
          {Math.min(page * limit, total)} de {total} usuários
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50"
          >
            Anterior
          </button>
          <div className="px-3 py-1 text-sm">
            Página {page}
          </div>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page * limit >= total}
            className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  )
}

function QuotaEditor({ userId, currentLimit, onUpdate, saving }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(currentLimit))

  const handleSave = async () => {
    const newLimit = parseInt(value, 10)
    if (isNaN(newLimit) || newLimit < 1 || newLimit > 200) {
      alert('Limite deve estar entre 1 e 200')
      return
    }
    await onUpdate(userId, newLimit)
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-center gap-2">
        <span className="font-semibold">{currentLimit}</span>
        <button
          onClick={() => setEditing(true)}
          disabled={saving}
          className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Editar
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <input
        type="number"
        min="1"
        max="200"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-16 px-2 py-1 text-xs border rounded"
        autoFocus
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
      >
        OK
      </button>
      <button
        onClick={() => {
          setEditing(false)
          setValue(String(currentLimit))
        }}
        disabled={saving}
        className="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500 disabled:opacity-50"
      >
        Cancelar
      </button>
    </div>
  )
}
