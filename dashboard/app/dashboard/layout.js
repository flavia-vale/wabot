import DashboardClientLayout from './DashboardClientLayout'

export const metadata = {
  title: 'Painel do BOTinho',
  description: 'Área autenticada para configurar grupos, credenciais, envios e logs do BOTinho.',
  alternates: { canonical: '/dashboard' },
  robots: {
    index: false,
    follow: false,
  },
}

export default function DashboardLayout({ children }) {
  return <DashboardClientLayout>{children}</DashboardClientLayout>
}
