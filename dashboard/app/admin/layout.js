export const metadata = {
  title: 'Admin BOTinho',
  description: 'Área administrativa restrita do BOTinho.',
  alternates: { canonical: '/admin' },
  robots: {
    index: false,
    follow: false,
  },
}

export default function AdminLayout({ children }) {
  return children
}
