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

  // estados de pareamento por número
  const [showPairingInput, setShowPairingInput] = useState(false)
  const [pairingPhone, setPairingPhone] = useState('')
  const [pairingCode, setPairingCode] = useState('')

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
        if (msg.data === 'connected') { setQr(null); setPairingCode(''); wsRef.current?.close(); fetchStatus() }
      }
    })
    wsRef.current = ws
  }

  async function handleQRConnect() {
    setError('')
    setShowPairingInput(false)
    setPairingCode('')
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

  async function handlePairingSubmit(e) {
    e.preventDefault()
    if (!pairingPhone.trim()) return
    setError('')
    setLoading(true)
    try {
      if (!status?.running) await api.sessionStart()
      const { code } = await api.sessionPairingCode(pairingPhone.trim())
      setPairingCode(code)
      openWS()
    } catch (err) {
      setError(err.message)
      // se o start falhou, garantir estado limpo
      if (!status?.running) await fetchStatus().catch(() => {})
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
      setPairingCode('')
      setShowPairingInput(false)
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
      setPairingCode('')
      setShowPairingInput(false)
      wsRef.current?.close()
      await fetchStatus()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const isConnected = status?.status === 'connected'
  const isConnecting = status?.status === 'connecting'
  const isRunning = status?.running

  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">WhatsApp</h2>
      <p className="text-gray-500 text-sm mb-6">Conecte seu número ao bot</p>

      {/* Status */}
      <div className="bg-white rounded-2xl shadow p-5 mb-4 flex items-center gap-4">
        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
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

      {/* Código de pareamento */}
      {pairingCode && !isConnected && (
        <div className="bg-white rounded-2xl shadow p-6 mb-4 flex flex-col items-center gap-3">
          <p className="text-sm font-semibold text-gray-700">Código de pareamento</p>
          <p className="text-4xl font-mono font-bold tracking-widest text-green-600">{pairingCode}</p>
          <p className="text-xs text-gray-500 text-center">
            No WhatsApp: <strong>Configurações → Dispositivos vinculados → Vincular pelo número</strong>
          </p>
        </div>
      )}

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      {/* Estado: desconectado — opções de conexão */}
      {!isRunning && !showPairingInput && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleQRConnect}
              disabled={loading}
              className="flex-1 bg-green-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              <span>📷</span>
              {loading ? 'Iniciando...' : 'Conectar via QR Code'}
            </button>
            <button
              onClick={() => { setShowPairingInput(true); setError('') }}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              <span>📱</span>
              Conectar pelo número
            </button>
          </div>
          <button
            onClick={handleForget}
            disabled={loading}
            className="bg-gray-200 text-gray-600 px-5 py-2 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50 transition text-sm"
          >
            Esquecer número salvo
          </button>
        </div>
      )}

      {/* Estado: formulário de pareamento por número */}
      {!isRunning && showPairingInput && (
        <form onSubmit={handlePairingSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número do WhatsApp (com DDD e código do país)
            </label>
            <input
              type="tel"
              value={pairingPhone}
              onChange={e => setPairingPhone(e.target.value)}
              placeholder="Ex: 5511999999999"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">Apenas números, sem espaços ou símbolos</p>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !pairingPhone.trim()}
              className="flex-1 bg-blue-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? 'Aguarde...' : 'Obter código'}
            </button>
            <button
              type="button"
              onClick={() => { setShowPairingInput(false); setPairingPhone(''); setError('') }}
              disabled={loading}
              className="px-5 py-3 rounded-xl font-semibold bg-gray-200 text-gray-600 hover:bg-gray-300 disabled:opacity-50 transition"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Estado: bot rodando (conectando ou conectado) */}
      {isRunning && (
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleStop}
            disabled={loading}
            className="bg-red-500 text-white px-5 py-2 rounded-lg font-semibold hover:bg-red-600 disabled:opacity-50 transition"
          >
            {loading ? 'Parando...' : 'Desligar bot'}
          </button>
          <button
            onClick={handleForget}
            disabled={loading}
            className="bg-gray-200 text-gray-600 px-5 py-2 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50 transition"
          >
            Esquecer número
          </button>
        </div>
      )}
    </div>
  )
}
