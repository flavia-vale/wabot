'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    const token = localStorage.getItem('token')
    router.replace(token ? '/dashboard' : '/login')
  }, [router])

  return <p aria-live="polite" className="p-6 text-sm text-gray-500">Redirecionando...</p>
}
