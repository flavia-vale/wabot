'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TutorialRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/m/checklistespelhamento')
  }, [router])
  return null
}
