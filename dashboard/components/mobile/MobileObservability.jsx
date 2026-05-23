'use client'

import { useEffect } from 'react'

export function useMobileRoutePerf(routeName) {
  useEffect(() => {
    const start = performance.now()
    const timer = window.setTimeout(() => {
      const latencyMs = Math.round(performance.now() - start)
      window.dispatchEvent(new CustomEvent('mobile:route-latency', { detail: { routeName, latencyMs } }))
      if (process.env.NODE_ENV !== 'production') {
        console.info('[mobile][latency]', routeName, `${latencyMs}ms`)
      }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [routeName])
}

export function logMobileCriticalAction(action, payload = {}) {
  window.dispatchEvent(
    new CustomEvent('mobile:critical-action', {
      detail: {
        action,
        payload,
        at: new Date().toISOString(),
      },
    }),
  )

  if (process.env.NODE_ENV !== 'production') {
    console.info('[mobile][action]', action, payload)
  }
}
