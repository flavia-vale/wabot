'use client'

export function instagramDestinationsFromConnections(connections) {
  return (Array.isArray(connections) ? connections : [])
    .filter((connection) => connection.status === 'connected')
    .flatMap((connection) => (connection.destinations || []).filter((destination) => destination.enabled !== false))
}

export default function InstagramDestinationPicker({ destinations, selectedIds, onToggle, disabled = false, title = 'Instagram Stories' }) {
  if (!destinations.length) return null
  return (
    <div style={{ marginTop: 16 }}>
      <span className="pnl-label">{title}</span>
      <p className="pnl-hint" style={{ marginTop: 4 }}>Também publique a imagem vertical nestas contas conectadas.</p>
      <div className="pnl-grid" style={{ marginTop: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        {destinations.map((destination) => (
          <label className="pnl-check" key={destination.id}>
            <input type="checkbox" checked={selectedIds.includes(destination.id)} onChange={() => onToggle(destination.id)} disabled={disabled} />
            {destination.name}
          </label>
        ))}
      </div>
    </div>
  )
}
