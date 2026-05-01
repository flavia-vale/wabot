'use client'
import { useEffect, useState, useRef } from 'react'
import { api, openQRSocket } from '@/lib/api'
import { QRCodeCanvas as QRCode } from 'qrcode.react'

export default function DashboardPage() {
  const [status, setStatus] = useState(null)
  const [qr, setQr] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const wsRef = useRef(null)

  async function fetchStatus() {
    try {
      const s = await api.sessionStatus()
      setStatus(s)
      if (s.running && s.status === 'connecting') openWS()
    } catch {}
  }

  useEffect(() => {
    fetchStatus()
    return () => wsRef.current?.close()
  }, [])

  function openWS() {
    if (wsRef.current) wsRef.current.close()
    const token = localStorage.getItem('token')
    const ws = openQRSocket(token, (msg) => {
      if (msg.type === 'qr') setQr(msg.data)
      if (msg.type === 'status') {
        setStatus(s => ({ ...s, status: msg.data, phone: msg.phone ?? s?.phone }))
        if (msg.data === 'connected') { setQr(null); wsRef.current?.close(); fetchStatus() }
      }
    })
    wsRef.current = ws
  }

  async function handleStart() {
    setError('')
    setLoading(true)
    try {
      await api.sessionStart()
      await fetchStatus()
      openWS()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleStop() {
    setError('')
    setLoading(true)
    try {
      await api.sessionStop()
      setQr(null)
      wsRef.current?.close()
      await fetchStatus()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleForget() {
    if (!confirm('Esquecer o número vai desconectar o bot e apagar a sessão salva. Você precisará escanear um novo QR Code. Continuar?')) return
    setError('')
    setLoading(true)
    try {
      await api.sessionForget()
      setQr(null)
      wsRef.current?.close()
      await api.sessionStart()
      await fetchStatus()
      openWS()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const isConnected = status?.status === 'connected'
  const isConnecting = status?.status === 'connecting'

  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">WhatsApp</h2>
      <p className="text-gray-500 text-sm mb-6">Conecte seu número ao bot</p>

      {/* Status */}
      <div className="bg-white rounded-2xl shadow p-5 mb-4 flex items-center gap-4">
        <div className={`w-3 h-3 rounded-full ${
          isConnected ? 'bg-green-500' :
          isConnecting ? 'bg-yellow-400 animate-pulse' :
          'bg-gray-300'
        }`} />
        <div>
          <p className="font-semibold text-gray-700">
            {isConnected ? 'Conectado' : isConnecting ? 'Conectando...' : 'Desconectado'}
          </p>
          {status?.phone && <p className="text-xs text-gray-400">+{status.phone}</p>}
        </div>
      </div>

      {/* QR Code */}
      {qr && (
        <div className="bg-white rounded-2xl shadow p-6 mb-4 flex flex-col items-center gap-3">
          <p className="text-sm text-gray-600">Escaneie o QR Code com o WhatsApp</p>
          <QRCode value={qr} size={200} />
          <p className="text-xs text-gray-400">Atualiza automaticamente</p>
        </div>
      )}

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      {/* Botões */}
      <div className="flex gap-3 flex-wrap">
        {!status?.running ? (
          <button
            onClick={handleStart}
            disabled={loading}
            className="bg-green-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition"
          >
            {loading ? 'Iniciando...' : 'Ligar bot'}
          </button>
        ) : (
          <button
            onClick={handleStop}
            disabled={loading}
            className="bg-red-500 text-white px-5 py-2 rounded-lg font-semibold hover:bg-red-600 disabled:opacity-50 transition"
          >
            {loading ? 'Parando...' : 'Desligar bot'}
          </button>
        )}
        <button
          onClick={handleForget}
          disabled={loading}
          className="bg-gray-200 text-gray-600 px-5 py-2 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50 transition"
        >
          Esquecer número
        </button>
      </div>
    </div>
  )
}
