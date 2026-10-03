import { AdminGate } from '@/components/AdminGate'
import './admin.css'

export const metadata = {
  title: 'Admin Espelha Grupos',
  description: 'Área administrativa restrita do Espelha Grupos.',
  alternates: { canonical: '/admin' },
  robots: {
    index: false,
    follow: false,
  },
}

export default function AdminLayout({ children }) {
  // Só monta o admin para quem tem papel (Q6 da auditoria, 2026-10-02).
  // `.admin-root` declara os tokens do DS que só existiam em painel.css (D12).
  return <div className="admin-root"><AdminGate>{children}</AdminGate></div>
}
