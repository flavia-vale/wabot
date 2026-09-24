import { redirect } from 'next/navigation'
import { buildSeoRobots } from '@/lib/seo-registry.mjs'

// A rota só redireciona, mas está no registro como não indexável: o sinal de
// `noindex` precisa sair também na metadata, não só do sitemap
// (validate:seo-consistency, contracts/seo-robots.md).
export const metadata = { robots: buildSeoRobots('/cadastro') }

/* Destino canônico dos links de indicação de afiliados
 * (https://espelhagrupos.com.br/cadastro?aff=CODIGO, gerados em
 * /painel/afiliados). O formulário real de cadastro vive em
 * /login?mode=register, que lê ?aff= e grava o cookie aff_code —
 * aqui só preservamos a query inteira (aff, utm_*, ref) no redirect.
 */
export default async function CadastroPage({ searchParams }) {
  const params = await searchParams
  const query = new URLSearchParams({ mode: 'register' })
  for (const [key, value] of Object.entries(params)) {
    if (key === 'mode' || value === undefined) continue
    const values = Array.isArray(value) ? value : [value]
    for (const v of values) query.append(key, v)
  }
  redirect(`/login?${query.toString()}`)
}
