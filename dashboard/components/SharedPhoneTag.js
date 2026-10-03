'use client'

// Tag "número repetido" — o mesmo WhatsApp aparecendo em mais de uma conta.
//
// Âmbar de propósito: no admin, verde já é "online" e vermelho é falha nossa.
// Isto não é nenhum dos dois — é um fato que pede conferência, e o texto diz
// exatamente o fato ("em N contas"), nunca uma conclusão sobre a pessoa. Troca
// de chip e conta antiga abandonada produzem o mesmo sinal.
//
// A decisão de QUEM recebe a tag é do backend
// (`src/domain/admin/sharedPhoneStatus.js`), nunca desta tela: assim todas as
// tabelas do admin dizem a mesma coisa sobre a mesma cliente.

export function SharedPhoneTag({ status, contas = 0, compact = false, className = '' }) {
  if (String(status ?? '').trim() !== 'numero_repetido') return null
  const quantidade = Number(contas) || 0
  const label = quantidade > 1 ? `Número em ${quantidade} contas` : 'Número repetido'
  return (
    <span
      title="Este número de WhatsApp já foi ligado por mais de uma conta. Pode ser troca de chip ou conta antiga da mesma pessoa — vale conferir o histórico antes de concluir qualquer coisa."
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-ds-warn/20 px-2 py-0.5 font-black text-ds-warn-ink ring-1 ring-ds-warn/60 ${compact ? 'text-[10.5px]' : 'text-[10.5px]'} ${className}`}
    >
      <span aria-hidden="true">📵</span>{label}
    </span>
  )
}

export default SharedPhoneTag
