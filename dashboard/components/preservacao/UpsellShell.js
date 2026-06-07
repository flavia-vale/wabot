'use client'
import Link from 'next/link'

const FEATURES = [
  { icon: '📈', title: 'Limite inteligente por canal', desc: 'O bot espalha envios pra não estourar cap diário ou em rajadas.' },
  { icon: '🐢', title: 'Espaçamento humano', desc: 'Pausa pequena entre canais diferentes pra parecer natural.' },
  { icon: '🎲', title: 'Variação automática de textos', desc: 'Cada mensagem sai com pequenas variações pré-configuradas.' },
  { icon: '🖼️', title: 'Mutação leve de imagens', desc: 'Crop e recompressão sutis pra evitar hash duplicado.' },
  { icon: '🩺', title: 'Saúde dos canais', desc: 'Status verde/amarelo/vermelho pra cada canal de destino.' },
  { icon: '🔭', title: 'Observador externo', desc: 'Detecta sombras de banimento antes que afete o envio.' },
  { icon: '📊', title: 'Score de risco', desc: 'Estimativa 0-100 da chance de denúncia por canal.' },
  { icon: '📸', title: 'Snapshots diários', desc: 'Histórico do estado de cada canal — 30 dias guardados.' },
]

export function UpsellShell({ ctaHref = '/painel/plano' }) {
  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">🛡️ Módulo de Preservação Avançada</h2>
        <p className="text-sm text-gray-600">
          Mantenha seus canais saudáveis com camadas extras de defesa estatística contra denúncia e shadowban.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FEATURES.map(f => (
          <li key={f.title} className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">{f.icon}</span>
              <div>
                <p className="font-semibold text-gray-800 text-sm">{f.title}</p>
                <p className="text-xs text-gray-500 mt-1">{f.desc}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs text-gray-500">
        Disponível no plano Pro e durante o Trial. O Trial libera todas as funcionalidades por tempo limitado.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link href={ctaHref}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2">
          Ativar Pro
        </Link>
        <Link href="/planos"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Ver detalhes do plano
        </Link>
      </div>
    </div>
  )
}
