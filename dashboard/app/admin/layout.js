import { AdminGate } from '@/components/AdminGate'

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
  return <AdminGate>{children}</AdminGate>
}
