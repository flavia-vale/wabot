import Link from 'next/link'
import { PublicShell } from '@/components/PublicShell'
import { LeadMagnetCard } from './LeadMagnetCard'
import { EDITORIAL_AUTHOR, formatDatePtBr } from '@/lib/editorial-content'

export function ArticleShell({ eyebrow, title, description, children, origin, publishedAt, updatedAt, author = EDITORIAL_AUTHOR, leadMagnetVariant = 'default' }) {
  return (
    <PublicShell>
      <main className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-10 md:grid-cols-[minmax(0,1fr)_360px] md:px-8 md:py-16">
        <article className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-emerald-100 md:p-10">
          <Link href="/" className="text-sm font-bold text-emerald-700 hover:text-emerald-800">← Voltar para o Espelha Grupos</Link>
          <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-gray-950 md:text-5xl">{title}</h1>
          <p className="mt-5 text-lg leading-8 text-gray-600">{description}</p>
          {(publishedAt || updatedAt) && (
            <p className="mt-4 text-sm font-semibold text-gray-500">
              Por {author} · Publicado em {formatDatePtBr(publishedAt || updatedAt)} · Atualizado em {formatDatePtBr(updatedAt || publishedAt)}
            </p>
          )}
          <div className="mt-8 space-y-8 text-base leading-8 text-gray-700 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:tracking-tight [&_h2]:text-gray-950 [&_h3]:text-xl [&_h3]:font-black [&_h3]:text-gray-950 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_strong]:text-gray-950">
            {children}
          </div>
        </article>
        <div className="md:sticky md:top-6 md:self-start">
          <LeadMagnetCard origin={origin} compact variant={leadMagnetVariant} />
        </div>
      </main>
    </PublicShell>
  )
}
