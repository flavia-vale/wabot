'use client'

/* Retorno do checkout do Mercado Pago — versão Menta do painel. É a return URL
 * do pagamento aprovado, então não pode 404. Usa o fluxo canônico de sucesso
 * apontando o CTA para /painel. */

import Link from 'next/link'
import { usePainelHeader } from '../../PainelShell'

export default function PagamentoSucessoPage() {
  usePainelHeader({ title: 'Pagamento confirmado', subtitle: 'Seu pagamento foi registrado com sucesso' })

  return (
    <div className="max-w-xl">
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 shadow">
        <h1 className="text-2xl font-bold text-green-800 mb-2">Pagamento confirmado com sucesso!</h1>
        <p className="text-sm text-green-700 mb-5">
          Seu pagamento foi registrado. Você já pode continuar usando sua conta normalmente.
        </p>
        <Link
          href="/painel"
          className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
        >
          Voltar para meu painel
        </Link>
      </div>
    </div>
  )
}
