'use client'

export function ClickTrackerStatus({ flags }) {
  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">🔗 Rastreio de cliques</legend>
      <p className="text-xs text-gray-500 mb-3">
        Cada link enviado pelo bot pode virar um endereço curto que conta os cliques. Configurado no servidor — só pra conferência aqui.
      </p>
      <ul className="text-xs space-y-1 text-gray-700">
        <li>Endereço base: <span className="font-mono">{flags?.shortlinkBaseUrl ?? 'não configurado'}</span></li>
        <li>Chave de hash configurada: <strong>{flags?.clickTrackerSaltConfigured ? '✅ Sim' : '❌ Não'}</strong></li>
      </ul>
    </fieldset>
  )
}
