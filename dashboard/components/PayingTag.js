'use client'

// Tag "Pagante" — a etiqueta que a operação procura em toda tabela de cliente.
//
// Verde com cifrão de propósito: no admin verde já significa "online", então a
// diferença tem que estar no símbolo e no texto, não só na cor. Cinza para
// quem já pagou e venceu — é conversa de recuperação, não de venda nova.
//
// A decisão de QUAL estado é do backend (`src/domain/admin/payingStatus.js`),
// nunca desta tela: aqui só pintamos o que veio, para que todas as tabelas
// digam a mesma coisa.

const TAG_STYLE = {
  pagante: 'bg-emerald-600 text-white ring-emerald-700',
  ex_pagante: 'bg-slate-200 text-slate-700 ring-slate-300',
}

const TAG_TITLE = {
  pagante: 'Já pagou pelo menos uma vez e o acesso está em dia',
  ex_pagante: 'Já pagou, mas o acesso venceu',
}

export function PayingTag({ status, compact = false, className = '' }) {
  const key = String(status ?? '').trim()
  if (key !== 'pagante' && key !== 'ex_pagante') return null
  const label = key === 'pagante' ? 'Pagante' : 'Já foi pagante'
  return (
    <span
      title={TAG_TITLE[key]}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-black ring-1 ${compact ? 'text-[10px]' : 'text-[11px]'} ${TAG_STYLE[key]} ${className}`}
    >
      <span aria-hidden="true">R$</span>{label}
    </span>
  )
}

export default PayingTag
