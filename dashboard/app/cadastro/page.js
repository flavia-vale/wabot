import { redirect } from 'next/navigation'

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
