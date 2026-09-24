'use client'
import Link from 'next/link'

// Reescrito por specs/018-unificar-protecao-anti-ban (FR-006/FR-008a): a tela
// unificada chama-se "Anti-banimento", em linguagem leiga, sem prometer que o
// número não será banido — só que o robô toma cuidado extra por conta e por
// grupo/canal. Detalhamento do estado bloqueado (o robô continua protegendo o
// número mesmo sem o plano) fica completo na User Story 3.
const FEATURES = [
  { icon: '📈', title: 'Limite por grupo e canal', desc: 'O robô espalha os envios para não estourar o limite diário nem mandar muitas ofertas de uma vez.' },
  { icon: '🐢', title: 'Espaçamento entre destinos', desc: 'Uma pequena pausa entre um grupo/canal e outro, para o ritmo parecer humano.' },
  { icon: '🎲', title: 'Variação automática de textos', desc: 'Cada mensagem sai com pequenas variações já configuradas.' },
  { icon: '🖼️', title: 'Variação leve de imagens', desc: 'Pequenos ajustes na foto de cada envio para canais.' },
  { icon: '🩺', title: 'Situação de cada canal', desc: 'Verde, amarelo ou vermelho para cada canal de destino.' },
  { icon: '🔭', title: 'Vigia contra bloqueio escondido', desc: 'Percebe sinais de bloqueio antes que isso afete o envio.' },
]

export function UpsellShell({ ctaHref = '/painel/plano' }) {
  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-1">🛡️ Anti-banimento</h2>
        <p className="text-sm text-gray-600">
          Tudo que protege o seu número de ser bloqueado, num lugar só. O robô continua
          protegendo o seu número mesmo sem este plano — com o ritmo padrão seguro, ou
          com os ajustes que você já tinha deixado.
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
          Conhecer o plano PRO
        </Link>
        <Link href="/painel/plano"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Ver detalhes do plano
        </Link>
      </div>
    </div>
  )
}
