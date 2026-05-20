'use client'

export function ProbeToggle({ value, onChange, disabled, probeAccountSessionId }) {
  const configured = !!probeAccountSessionId

  return (
    <fieldset className="bg-white rounded-2xl shadow p-5">
      <legend className="text-base font-semibold text-gray-800">🔭 Probe externo</legend>
      <p className="text-xs text-gray-500 mb-4">
        Uma segunda conta WhatsApp conectada como observadora confere se suas mensagens chegam nos canais de destino.
        Se não chegar, o bot marca o canal em estado de alerta — detecção precoce de banimento silencioso.
      </p>

      {configured ? (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-800">
          <span>✅</span>
          <span>
            Conta observadora configurada:{' '}
            <span className="font-mono font-semibold">{probeAccountSessionId}</span>
          </span>
        </div>
      ) : (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold text-amber-800 mb-2">⚠️ Nenhuma conta observadora configurada</p>
          <p className="text-xs text-amber-700 mb-3">
            Para usar o probe, você precisa conectar um segundo número de WhatsApp como conta observadora.
            Esse número é diferente do número principal que envia as mensagens.
          </p>
          <p className="text-xs font-semibold text-gray-700 mb-1">Como configurar:</p>
          <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
            <li>
              Vá em{' '}
              <a href="/dashboard/credenciais" className="text-blue-600 underline hover:text-blue-800">
                Credenciais
              </a>{' '}
              e conecte um segundo número de WhatsApp.
            </li>
            <li>Anote o <strong>ID da sessão</strong> gerado (ex.: <span className="font-mono text-gray-700">probe-session-1</span>).</li>
            <li>Entre em contato com o suporte informando esse ID para ativarmos como conta observadora.</li>
          </ol>
        </div>
      )}

      <label className={`inline-flex items-center gap-2 ${!configured ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <input
          type="checkbox"
          checked={!!value.probeEnabled}
          onChange={e => onChange({ probeEnabled: e.target.checked })}
          disabled={disabled || !configured}
          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-400"
        />
        <span className="text-sm text-gray-700">Ativar probe externo</span>
      </label>
      {!configured && (
        <p className="text-[11px] text-gray-400 mt-1 ml-6">
          Configure a conta observadora antes de ativar.
        </p>
      )}
    </fieldset>
  )
}
