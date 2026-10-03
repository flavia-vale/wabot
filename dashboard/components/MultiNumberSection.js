'use client'

/* Vários números por conta na tela WhatsApp: com o número reserva liberado
 * para a conta, mostra o controle da reserva; PRO em dia que ainda não
 * contratou vê a contratação; os demais (flag desligada, Basic), a lista de
 * espera. */

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { MultiNumberWaitlistCard } from '@/components/MultiNumberWaitlistCard'
import { ReserveNumberCard } from '@/components/ReserveNumberCard'
import { ReservePurchaseCard } from '@/components/ReservePurchaseCard'

export function MultiNumberSection() {
  const [reserve, setReserve] = useState(undefined)

  useEffect(() => {
    let alive = true
    api.reserveState()
      .then((data) => { if (alive) setReserve(data) })
      .catch(() => { if (alive) setReserve(null) })
    return () => { alive = false }
  }, [])

  if (reserve === undefined) return null
  if (reserve?.access?.allowed) return <ReserveNumberCard initialState={reserve} />
  if (reserve?.access?.reason === 'not_purchased') return <ReservePurchaseCard />
  return <MultiNumberWaitlistCard />
}
