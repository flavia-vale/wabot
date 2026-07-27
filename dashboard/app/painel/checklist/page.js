'use client'
import { ActivationChecklist } from '@/components/ActivationChecklist'
import { usePainelHeader } from '../PainelShell'

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
  )
}

function VideoBanner({ href, title, desc }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        borderRadius: 16, padding: '14px 16px', marginBottom: 14,
        border: '1px solid color-mix(in oklab, var(--danger) 30%, var(--line))',
        background: 'color-mix(in oklab, var(--danger) 8%, var(--surface))',
        textDecoration: 'none',
      }}
    >
      <span style={{
        flexShrink: 0, width: 40, height: 40, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--danger)', color: 'white',
      }}>
        <PlayIcon />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{title}</span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{desc}</span>
      </span>
      <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 12, fontWeight: 700, color: 'var(--danger)' }}>Assistir ▶</span>
    </a>
  )
}

export default function ChecklistPage() {
  usePainelHeader({ title: 'Primeiros passos', subtitle: 'Configure o bot em 5 passos simples' })
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <VideoBanner
        href="https://youtu.be/IKsjAYolwLM?is=ojds8lZO5o9RdKPm"
        title="🎥 Vídeo-aula: Como ativar seu robô"
        desc="Conectar o WhatsApp e configurar os grupos espelhados, passo a passo."
      />
      <VideoBanner
        href="https://youtu.be/6F2AUM88FKk?is=Tafcm6QdDvJo9UgH"
        title="🎥 Vídeo-aula: Como cadastrar suas credenciais"
        desc="Shopee, Mercado Livre, Amazon e Magazine Luiza, passo a passo."
      />
      <ActivationChecklist persist />
    </div>
  )
}
