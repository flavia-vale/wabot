'use client'

import { useEffect, useRef, useState } from 'react'

// Lista com scroll horizontal + dica visual de "tem mais conteúdo". Antes os
// rows usavam scrollbarWidth:'none' sem nenhum indicador, então em telas
// estreitas o usuário não percebia que havia itens à direita. Renderiza um
// fade nas bordas que some quando chega no início/fim.
export function MobileHScroll({ children, fadeColor = 'var(--bg)', style, contentStyle, ...rest }) {
  const ref = useRef(null)
  const [edges, setEdges] = useState({ start: false, end: false })

  function recompute() {
    const el = ref.current
    if (!el) return
    const start = el.scrollLeft > 1
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }))
  }

  useEffect(() => {
    recompute()
    const el = ref.current
    if (!el) return undefined
    window.addEventListener('resize', recompute)
    return () => window.removeEventListener('resize', recompute)
  }, [children])

  const fade = (side, visible) => ({
    position: 'absolute',
    top: 0,
    bottom: 0,
    [side]: 0,
    width: 28,
    pointerEvents: 'none',
    background: `linear-gradient(to ${side === 'left' ? 'right' : 'left'}, ${fadeColor}, transparent)`,
    opacity: visible ? 1 : 0,
    transition: 'opacity .15s',
    zIndex: 1,
  })

  return (
    <div style={{ position: 'relative', ...style }}>
      <div
        ref={ref}
        onScroll={recompute}
        style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', ...contentStyle }}
        {...rest}
      >
        {children}
      </div>
      <div aria-hidden="true" style={fade('left', edges.start)} />
      <div aria-hidden="true" style={fade('right', edges.end)} />
    </div>
  )
}
