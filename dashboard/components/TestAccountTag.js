'use client'

// Tag "Conta de teste" — a etiqueta que explica por que um pagamento está na
// tela e não está na soma.
//
// Por que existe: a dona do produto mantém assinatura de teste ligada para
// validar a cobrança recorrente (o ciclo de renovação só se prova com uma
// assinatura de verdade rodando). Esse dinheiro não cai no caixa dela, então
// fica fora de receita, MRR, LTV e ROI — mas a conta CONTINUA visível, porque
// é ela que está sendo observada. Sem a etiqueta, a linha aparecendo na lista
// e sumindo do total pareceria defeito.
//
// Quem decide quais contas são de teste é o backend
// (`src/domain/admin/testAccounts.js`), nunca esta tela — senão duas tabelas
// do admin passam a discordar sobre quanto entrou no mês.

export function TestAccountTag({ email, emails, compact = false, className = '' }) {
  const normalized = String(email ?? '').trim().toLowerCase()
  if (!normalized || !Array.isArray(emails)) return null
  const isTest = emails.some(candidate => String(candidate ?? '').trim().toLowerCase() === normalized)
  if (!isTest) return null
  return (
    <span
      title="Assinatura de teste: aparece nas listas, mas fica fora das somas de receita, MRR, LTV e ROI"
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 font-black text-amber-800 ring-1 ring-amber-300 ${compact ? 'text-[10px]' : 'text-[11px]'} ${className}`}
    >
      <span aria-hidden="true">🧪</span>Teste · fora da soma
    </span>
  )
}

export default TestAccountTag
