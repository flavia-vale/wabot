'use client'
import { ActivationChecklist } from '@/components/ActivationChecklist'
import { usePainelHeader } from '../PainelShell'

export default function ChecklistPage() {
  usePainelHeader({ title: 'Primeiros passos', subtitle: 'Configure o bot em 4 passos simples' })
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <ActivationChecklist persist />
    </div>
  )
}
