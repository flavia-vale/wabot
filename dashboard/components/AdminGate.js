'use client'

// Cerca do /admin/*: só monta a página para quem tem papel admin.
//
// Medido em produção (2026-10-02, Q6 da auditoria): uma conta trial sem papel
// nenhum carregou páginas do admin e disparou 80 chamadas, todas barradas com
// 403 pelo backend. O backend continua sendo a trava de verdade; aqui só
// evitamos que a casca do admin (e as 20 chamadas do Início) rode para quem
// não é admin. 401 (sem login) já é tratado pelo apiFetch, que manda para o
// login. 403 (logada, mas não admin) volta para o painel da cliente.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { LoadingState } from '@/components/States'

export function AdminGate({ children }) {
  const router = useRouter()
  const [liberado, setLiberado] = useState(false)

  useEffect(() => {
    let active = true
    api.adminMe()
      .then(() => { if (active) setLiberado(true) })
      .catch((err) => {
        if (!active) return
        if (err?.status === 403) { router.replace('/painel'); return }
        if (err?.status === 401) return // apiFetch já redirecionou para o login
        // Falha de rede/5xx: deixa a página tentar; cada rota continua exigindo papel.
        setLiberado(true)
      })
    return () => { active = false }
  }, [router])

  if (!liberado) return <LoadingState />
  return children
}
