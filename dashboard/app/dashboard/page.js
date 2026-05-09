'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { api, openQRSocket } from '@/lib/api'
import { QRCodeCanvas as QRCode } from 'qrcode.react'
import { Alert } from '@/components/Alert'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { HelpLink } from '@/components/HelpLink'
import { LoadingState } from '@/components/States'

const QR_TIMEOUT_SECONDS = 20
const STATUS_ERROR_MESSAGE = 'Não foi possível carregar o status da conexão. Tente novamente.'

export default function DashboardPage() {
  const [status, setStatus] = useState(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState('')
  const [qr, setQr] = useState(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [socketState, setSocketState] = useState('idle')
  const [qrWaitElapsed, setQrWaitElapsed] = useState(0)
  const wsRef = useRef(null)

  const [showPairingInput, setShowPairingInput] = useState(false)
  const [pairingPhone, setPairingPhone] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [showForgetConfirm, setShowForgetConfirm] = useState(false)

  const fetchStatus = useCallback(async ({ showLoading = false, recoverable = false } = {}) => {
    if (showLoading) setStatusLoading(true)
    if (recoverable) setStatusError('')

    try {
      const s = await api.sessionStatus()
      setStatus(s)
      setStatusError('')
      return s
    } catch (err) {
      if (recoverable) setStatusError(err.message || STATUS_ERROR_MESSAGE)
      return null
    } finally {
      if (showLoading) setStatusLoading(false)
    }
  }, [])

  const openWS = useCallback(async () => {
    if (wsRef.current) wsRef.current.close()
    const { ticket } = await api.sessionQRTicket()
    const ws = openQRSocket(ticket, {
      onOpen: () => setSocketState('connected'),
      onError: () => setSocketState('error'),
      onClose: () => setSocketState('closed'),
      onMessage: (msg) => {
        if (msg.type === 'qr') setQr(msg.data)
        if (msg.type === 'status') {
          setStatus((s) => ({ ...s, status: msg.data, phone: msg.phone ?? s?.phone }))
          setStatusError('')
          if (msg.data === 'connected') {
            setFeedback('WhatsApp conectado com sucesso.')
            setQr(null)
            setPairingCode('')
            wsRef.current?.close()
            fetchStatus()
          }
        }
      },
    })
    wsRef.current = ws
  }, [fetchStatus])

  useEffect(() => {
    let active = true

    async function loadInitialStatus() {
      setStatusLoading(true)
      setStatusError('')
      try {
        const s = await api.sessionStatus()
        if (!active) return
        setStatus(s)
        if (s.running && s.status === 'connecting') openWS().catch(() => setSocketState('error'))
      } catch (err) {
        if (active) setStatusError(err.message || STATUS_ERROR_MESSAGE)
      } finally {
        if (active) setStatusLoading(false)
      }
    }

    loadInitialStatus()

    return () => {
      active = false
      wsRef.current?.close()
    }
  }, [openWS])

  useEffect(() => {
    if (!(status?.running && status?.status === 'connecting') || qr || pairingCode) return
    const interval = setInterval(() => setQrWaitElapsed((prev) => prev + 1), 1000)
    return () => clearInterval(interval)
  }, [status?.running, status?.status, qr, pairingCode])

  async function handleQRConnect() {
    if (loading) return
    setError('')
    setFeedback('')
    setStatusError('')
    setShowPairingInput(false)
    setPairingCode('')
    setQrWaitElapsed(0)
    setLoading(true)
    setActionLoading('connect')
    try {
      await api.sessionStart()
      const s = await fetchStatus()
      if (s?.running) await openWS()
      setTimeout(async () => {
        const s = await api.sessionStatus().catch(() => null)
        if (s && !s.running && s.status === 'disconnected') {
          setQr(null)
          setStatus(s)
        }
      }, 6000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  function handlePairingPhoneChange(e) {
    setPairingPhone(e.target.value.replace(/\D/g, ''))
  }

  async function handlePairingSubmit(e) {
    e.preventDefault()
    if (!pairingPhone.trim()) return
    setError('')
    setFeedback('')
    setStatusError('')
    if (loading) return
    setLoading(true)
    setActionLoading('pairing')
    try {
      if (!status?.running) await api.sessionStart()
      const { code } = await api.sessionPairingCode(pairingPhone.trim())
      setPairingCode(code)
      setQrWaitElapsed(0)
      setFeedback('Código de pareamento gerado.')
      await openWS()
    } catch (err) {
      setError(err.message)
      if (!status?.running) await fetchStatus()
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  async function handleStop() {
    if (loading) return
    setError('')
    setFeedback('')
    setStatusError('')
    setLoading(true)
    setActionLoading('stop')
    try {
      await api.sessionStop()
      setQr(null)
      setPairingCode('')
      setShowPairingInput(false)
      wsRef.current?.close()
      await fetchStatus()
      setFeedback('Bot desligado. Para voltar, gere um novo QR Code ou código de pareamento.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  async function handleForget() {
    if (loading) return
    setError('')
    setFeedback('')
    setStatusError('')
    setLoading(true)
    setActionLoading('forget')
    try {
      await api.sessionForget()
      setQr(null)
      setPairingCode('')
      setShowPairingInput(false)
      wsRef.current?.close()
      await fetchStatus()
      setFeedback('Sessão removida com sucesso. Conecte novamente por QR Code ou código de pareamento para usar o bot.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setActionLoading('')
    }
  }

  async function copyPairingCode() {
    try {
      await navigator.clipboard.writeText(pairingCode)
      setFeedback('Código copiado para a área de transferência.')
    } catch {
      setError('Não foi possível copiar o código. Copie manualmente.')
    }
  }

  const isConnected = status?.status === 'connected'
  const isConnecting = status?.status === 'connecting'
  const isRunning = status?.running
  const showQrRetry = isRunning && isConnecting && !qr && !pairingCode && qrWaitElapsed >= QR_TIMEOUT_SECONDS
  const canSubmitPairing = pairingPhone.trim().length >= 10

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">WhatsApp</h2>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-gray-500 text-sm">Conecte seu número ao bot</p>
        <HelpLink topic="como-conectar-whatsapp-qr-code">Ajuda para conectar</HelpLink>
      </div>

      <div className="mb-3 flex flex-col gap-2">
        {statusError && (
          <Alert
            type="error"
            title="Falha ao carregar status"
            message={statusError || STATUS_ERROR_MESSAGE}
          />
        )}
        {statusError && (
          <button
            type="button"
            onClick={() => fetchStatus({ showLoading: true, recoverable: true })}
            disabled={statusLoading}
            className="self-start rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
          >
            {statusLoading ? 'Tentando...' : 'Tentar novamente'}
          </button>
        )}
        {socketState === 'error' && <Alert type="warning" title="Conexão instável" message="Conexão de pareamento instável. Tentando reconectar..." />}
        {socketState === 'closed' && isConnecting && <Alert type="warning" title="Conexão perdida" message="Gere novamente o QR ou aguarde reconexão." />}
        {feedback && <Alert type="success" title="Tudo certo" message={feedback} />}
        {error && <Alert type="error" title="Falha na conexão" message={`Não foi possível concluir a ação. ${error}`} />}
      </div>

      <div className="bg-white rounded-2xl shadow p-5 mb-4 flex items-center gap-4">
        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
          isConnected ? 'bg-green-500' :
          isConnecting ? 'bg-yellow-400 animate-pulse' :
          'bg-gray-300'
        }`} />
        <div>
          {statusLoading ? (
            <LoadingState message="Carregando status do WhatsApp..." />
          ) : (
            <p className="font-semibold text-gray-700">{isConnected ? 'Conectado' : isConnecting ? 'Conectando...' : statusError ? 'Status indisponível' : 'Desconectado'}</p>
          )}
          {status?.phone && <p className="text-xs text-gray-400">+{status.phone}</p>}
        </div>
      </div>

      {isRunning && isConnecting && !qr && !pairingCode && (
        <div className="bg-white rounded-2xl shadow p-8 mb-4 flex flex-col items-center gap-4">
          <svg className="animate-spin w-10 h-10 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <div role="status" aria-live="polite" className="text-center">
            <p className="text-sm font-medium text-gray-600">Gerando QR Code... ({qrWaitElapsed}s)</p>
            <p className="text-xs text-gray-400">Aguarde alguns segundos enquanto o WhatsApp prepara a conexão.</p>
          </div>
          {showQrRetry && (
            <button onClick={handleQRConnect} disabled={loading} className="text-sm text-green-700 underline disabled:opacity-50 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">
              Tentar novamente
            </button>
          )}
        </div>
      )}

      {qr && (
        <div className="bg-white rounded-2xl shadow p-6 mb-4 flex flex-col items-center gap-3">
          <p className="text-sm text-gray-600">Escaneie o QR Code com o WhatsApp</p>
          <QRCode value={qr} size={200} />
          <div className="text-center text-xs text-gray-500">
            <p>No WhatsApp: <strong>Configurações → Dispositivos conectados → Conectar um dispositivo.</strong></p>
            <p>Mantenha esta tela aberta até a conexão ser concluída. O QR atualiza automaticamente.</p>
          </div>
        </div>
      )}

      {pairingCode && !isConnected && (
        <div className="bg-white rounded-2xl shadow p-6 mb-4 flex flex-col items-center gap-3">
          <p className="text-sm font-semibold text-gray-700">Código de pareamento</p>
          <p className="text-4xl font-mono font-bold tracking-widest text-green-600">{pairingCode}</p>
          <button onClick={copyPairingCode} className="text-sm text-blue-700 underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Copiar código</button>
          <p className="text-xs text-gray-500 text-center">No WhatsApp: <strong>Configurações → Dispositivos vinculados → Vincular pelo número</strong></p>
        </div>
      )}

      {!isRunning && !showPairingInput && !statusLoading && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="font-semibold text-gray-700">Conectar via QR Code</h3>
              <p className="mt-1 text-xs text-gray-500">Mais rápido se você está com o celular em mãos.</p>
              <button onClick={handleQRConnect} disabled={loading} className="mt-4 w-full bg-green-600 text-white px-4 py-3 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">
                <span aria-hidden="true">📷</span>{actionLoading === 'connect' ? 'Conectando...' : 'Gerar QR Code'}
              </button>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="font-semibold text-gray-700">Conectar pelo número</h3>
              <p className="mt-1 text-xs text-gray-500">Use um código para vincular pelo WhatsApp.</p>
              <button onClick={() => { setShowPairingInput(true); setError('') }} disabled={loading} className="mt-4 w-full bg-blue-600 text-white px-4 py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
                <span aria-hidden="true">📱</span>Obter código
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-sm font-semibold text-amber-800">Ações avançadas</h3>
            <p className="mt-1 text-xs text-amber-700">Use “Esquecer número salvo” apenas se quiser remover a sessão deste painel e conectar novamente por QR Code ou código.</p>
            <button onClick={() => setShowForgetConfirm(true)} disabled={loading} className="mt-3 bg-white text-amber-800 border border-amber-200 px-4 py-2.5 min-h-11 rounded-lg font-semibold hover:bg-amber-100 disabled:opacity-50 transition text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2">Esquecer número salvo</button>
          </div>
        </div>
      )}

      {!isRunning && showPairingInput && (
        <form onSubmit={handlePairingSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número do WhatsApp (com DDD e código do país)</label>
            <input type="tel" inputMode="numeric" autoComplete="tel" value={pairingPhone} onChange={handlePairingPhoneChange} placeholder="Ex: 5511999999999" className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={loading} autoFocus />
            <p className="text-xs text-gray-400 mt-1">Cole com +, espaços ou parênteses se quiser; vamos manter apenas os números.</p>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={loading || !canSubmitPairing} className="flex-1 bg-blue-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">{loading ? 'Aguarde...' : 'Obter código'}</button>
            <button type="button" onClick={() => { setShowPairingInput(false); setPairingPhone(''); setError('') }} disabled={loading} className="px-5 py-3 rounded-xl font-semibold bg-gray-200 text-gray-600 hover:bg-gray-300 disabled:opacity-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2">Cancelar</button>
          </div>
        </form>
      )}

      {isRunning && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Ação operacional</h3>
            <p className="text-xs text-gray-500 mb-2">Desliga o bot agora, mas mantém a sessão salva para reconectar depois.</p>
            <button onClick={handleStop} disabled={loading} className="bg-red-500 text-white px-5 py-2.5 min-h-11 rounded-lg font-semibold hover:bg-red-600 disabled:opacity-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2">{actionLoading === 'stop' ? 'Desconectando...' : 'Desligar bot'}</button>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-sm font-semibold text-amber-800">Ações avançadas</h3>
            <p className="mt-1 text-xs text-amber-700">Esquecer número desconecta o WhatsApp e remove a sessão salva neste painel. Para usar novamente, você precisará conectar por QR Code ou código.</p>
            <button onClick={() => setShowForgetConfirm(true)} disabled={loading} className="mt-3 bg-white text-amber-800 border border-amber-200 px-4 py-2.5 min-h-11 rounded-lg font-semibold hover:bg-amber-100 disabled:opacity-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2">Esquecer número</button>
          </div>
        </div>
      )}
      <ConfirmDialog open={showForgetConfirm} title="Esquecer número" message="Isso vai desconectar o WhatsApp e remover a sessão salva neste painel. Para usar novamente, você precisará conectar por QR Code ou código." confirmLabel="Esquecer sessão" danger onCancel={() => setShowForgetConfirm(false)} onConfirm={async () => { setShowForgetConfirm(false); await handleForget() }} />
    </div>
  )
}
