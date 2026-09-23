'use client'

import { usePainelHeader } from '../PainelShell'
import AccountAccessForms from '@/components/AccountAccessForms'

export default function ConfiguracoesPage() {
  usePainelHeader({ title: 'Configurações', subtitle: 'Acesso da conta' })
  return <AccountAccessForms />
}
