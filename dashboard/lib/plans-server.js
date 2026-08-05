import { getApiPort } from '@/app/api/[...path]/route'
import { DEFAULT_LANDING_PLANS } from '@/lib/marketing-content'

/* Carga dos planos NO SERVIDOR (auditoria de funil 2026-08-05, §1.4).
 *
 * O bloco de preço da home era montado só no cliente (`useEffect` +
 * `/api/public/plans`). Componente client do App Router até é pré-renderizado
 * no HTML inicial, então o preço não sumia — mas o que ia para o HTML era
 * sempre o FALLBACK (`DEFAULT_LANDING_PLANS`), não o valor que a admin
 * configurou. Quem lê o HTML e não executa JS (crawler do Google, IA, leitor
 * de tela em conexão ruim) via um preço potencialmente desatualizado, e quem
 * executa via o número trocar depois da hidratação, bem no momento da decisão.
 *
 * POR QUE NÃO USAR `headers()` AQUI (importante, não regredir): ler `headers()`
 * força a página a virar dinâmica (`ƒ`), e a home era estática (`○`). Medido no
 * build: com `headers()` a `/` passou de `○` para `ƒ`, ou seja, TODA visita à
 * home passaria a executar render + fetch no servidor. Num VPS que já divide
 * RAM entre prod e staging, isso é carga nova em troca de nada — a porta da API
 * é derivável de `process.env.PORT`, que o `.env.local` de cada ambiente já
 * define (3000 prod / 3006 staging). Com `revalidate`, a home segue
 * pré-renderizada e o preço novo aparece na próxima revalidação.
 *
 * NÃO duplicar o mapa de porta dashboard→API: `getApiPort` é a fonte única
 * (regra dos 3 lugares em AGENTS.md, "Ambientes e portas").
 */

const PLANS_FETCH_TIMEOUT_MS = Number(process.env.PLANS_FETCH_TIMEOUT_MS || 2500)
// Janela em que uma troca de preço feita no painel admin aparece nas páginas
// estáticas. 5min é curto o bastante para não confundir a cliente e longo o
// bastante para a home não bater na API a cada visita.
const PLANS_REVALIDATE_SECONDS = Number(process.env.PLANS_REVALIDATE_SECONDS || 300)

// `getApiPort` espera algo com `.headers.get()`. Sem request (render estático),
// o shim devolve null e a função cai no `process.env.PORT`, que é o caminho
// desejado — sem tocar em `headers()` e sem tornar a página dinâmica.
const STATIC_HEADERS_SHIM = { headers: { get: () => null } }

function buildPlansUrl() {
  return `http://127.0.0.1:${getApiPort(STATIC_HEADERS_SHIM)}/api/public/plans`
}

function mergeWithDefaults(remotePlans) {
  const byId = new Map((remotePlans ?? []).map((plan) => [plan.id, plan]))
  return DEFAULT_LANDING_PLANS.map((defaultPlan) => {
    const remote = byId.get(defaultPlan.id)
    if (!remote) return defaultPlan
    return {
      ...defaultPlan,
      name: remote.title || defaultPlan.name,
      price: remote.price || defaultPlan.price,
      period: remote.period || defaultPlan.period,
      desc: remote.description || defaultPlan.desc,
      features:
        Array.isArray(remote.features) && remote.features.length
          ? remote.features
          : defaultPlan.features,
      position: remote.position ?? defaultPlan.position,
    }
  })
}

/** Planos públicos já mesclados com o fallback. Nunca lança. */
export async function getLandingPlans() {
  try {
    const res = await fetch(buildPlansUrl(), {
      next: { revalidate: PLANS_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(PLANS_FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return DEFAULT_LANDING_PLANS
    const data = await res.json()
    return mergeWithDefaults(Array.isArray(data?.plans) ? data.plans : [])
  } catch {
    // API fora, timeout, ou build rodando sem servidor de pé (é o caso normal
    // no `npm run build`): o fallback é a resposta correta, nunca uma exceção.
    return DEFAULT_LANDING_PLANS
  }
}
