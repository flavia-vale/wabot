'use client'

import { useMemo } from 'react'
import { homeStats, recentMirrors } from '@/components/mobile/mobileData'

export function useMobileHomeData() {
  return useMemo(
    () => ({
      summary: homeStats,
      recent: recentMirrors,
      generatedAt: null,
    }),
    [],
  )
}
