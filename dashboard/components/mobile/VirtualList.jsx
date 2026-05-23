'use client'

import { useMemo, useState } from 'react'

export function VirtualList({ items, itemHeight = 110, height = 420, overscan = 4, renderItem }) {
  const [scrollTop, setScrollTop] = useState(0)
  const totalHeight = items.length * itemHeight

  const range = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const visibleCount = Math.ceil(height / itemHeight) + overscan * 2
    const end = Math.min(items.length, start + visibleCount)
    return { start, end }
  }, [height, itemHeight, items.length, overscan, scrollTop])

  const visible = items.slice(range.start, range.end)

  return (
    <div
      className="overflow-auto"
      style={{ height }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      role="list"
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${range.start * itemHeight}px)` }}>
          {visible.map((item, index) => (
            <div key={item.id ?? `${range.start + index}`} style={{ height: itemHeight }} role="listitem">
              {renderItem(item)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
