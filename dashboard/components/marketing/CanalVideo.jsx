// Vídeo do canal embutido numa página pública + VideoObject. Não renderiza
// nada quando `video` é null (vídeo ainda não publicado): página sem vídeo é
// melhor que página com player quebrado ou schema apontando para o nada.
// `youtube-nocookie` é o único domínio liberado no `frame-src` da CSP.

export function buildCanalVideoSchema(video) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description: video.description,
    thumbnailUrl: [video.thumbnailUrl],
    uploadDate: video.uploadDate,
    contentUrl: video.url,
    embedUrl: video.embedUrl,
  }
}

export function CanalVideo({ video, title = 'Veja em vídeo' }) {
  if (!video) return null
  return (
    <section aria-label={title}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildCanalVideoSchema(video)) }} />
      <h2 style={{ fontSize: 'clamp(24px, 2.6vw, 32px)', lineHeight: 1.15 }}>{title}</h2>
      <div style={{ position: 'relative', marginTop: 16, aspectRatio: '16 / 9', width: '100%', overflow: 'hidden', borderRadius: 16, border: '1px solid var(--line)' }}>
        <iframe
          src={video.embedUrl}
          title={video.title}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: 'var(--ink-soft)' }}>
        {video.description}{' '}
        <a href={video.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>Assistir no YouTube</a>
      </p>
    </section>
  )
}
