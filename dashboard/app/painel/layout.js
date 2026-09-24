import './painel.css'
import PainelShell from './PainelShell'

export const metadata = {
  title: 'Painel do Espelha Grupos',
  description: 'Painel do Espelha Grupos — visão geral da operação, envios e configuração.',
  alternates: { canonical: '/painel' },
  robots: { index: false, follow: false },
}

export default function PainelLayout({ children }) {
  return <PainelShell>{children}</PainelShell>
}
