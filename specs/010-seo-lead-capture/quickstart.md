# Quickstart — Validação da feature 010 (SEO Fix, Signup Attribution & Article Lead Capture)

Roteiro executável para provar que a feature funciona ponta a ponta. Não contém código de
implementação — apenas passos de verificação. Detalhes de dados/contratos em
[data-model.md](./data-model.md) e [contracts/](./contracts/).

## Pré-requisitos

- Repo na branch `010-seo-lead-capture` (a partir de `develop`).
- `dashboard/` com dependências instaladas (`npm ci` em `dashboard/`).
- API com dependências instaladas na raiz (`npm ci`).
- Nenhum `.env`/porta/deploy alterado (fluxo canônico feature → develop → main).

---

## US1 — SEO técnico verde (P1)

Rodar de dentro de `dashboard/`:

```bash
cd dashboard
npm run guard:seo-registry      # esperado: OK, sem listar /cadastro nem /parcerias
npm run lint:seo-metadata       # esperado: sem par duplicado /conteudos × /blog/comecar-afiliado-...
npm run validate:seo-p0         # esperado: verde (roda os dois acima)
```

**Aprovado quando**: os três comandos saem com exit 0 e nenhum dos dois erros pré-existentes
aparece (SC-001, SC-003).

## US4 — Sitemap/robots cobrindo as rotas novas (P2)

```bash
cd dashboard
# Inspecionar o sitemap gerado (build ou dev) e confirmar presença das URLs:
#   /cadastro, /parcerias e as 6 páginas de blog novas.
# Confirmar que robots.js NÃO bloqueia /blog/*, /cadastro, /parcerias.
```

**Aprovado quando**: 100% das rotas-alvo aparecem no sitemap e nenhuma está em `disallow`
(SC-002). O passo de submissão no Google Search Console / Bing Webmaster é **manual**,
documentado em `docs/deploy/seo-search-console-submission.md` (FR-009) — seguir o passo a passo
lá para submeter o sitemap.

## US2 — Atribuição de cadastro por página de entrada (P1)

Cenário manual (staging):

1. Entrar por uma URL de artigo com UTMs, ex.:
   `/blog/<artigo>?utm_source=teste&utm_medium=organic&utm_campaign=lote1`.
2. Navegar até o cadastro e concluir o registro com e-mail real.
3. Consultar a atribuição (rota admin de leitura de cadastros por landing) e confirmar que o
   cadastro ficou associado à **página de entrada** e aos **UTMs** capturados.
4. Repetir **sem** UTMs → o cadastro conclui normalmente e a landing ainda é registrada; UTMs
   ficam vazios (FR-005).

**Aprovado quando**: novos cadastros têm `landing_page` na metadata do evento
`signup_created` (UTMs quando presentes) e a consulta agrupa por landing (SC-004, FR-007),
sem PII sensível exposta (FR-014).

## US3 — Captura de e-mail no artigo (P2)

1. Abrir uma página de artigo/blog → confirmar que o bloco de captura de e-mail aparece dentro
   do layout do artigo.
2. Submeter e-mail **inválido/vazio** → mensagem de validação amigável, **nenhum** lead
   registrado.
3. Submeter e-mail **válido** → lead registrado pelo fluxo existente; confirmação/acesso ao
   material.
4. Conferir que toda a cópia do bloco usa a marca **BOTinho**.

**Aprovado quando**: bloco presente em todo artigo; válido registra, inválido não (SC-005);
marca correta (FR-012).

## Regra de custo (SC-006 / FR-013)

Confirmar que a feature **não** adicionou processo PM2/worker/serviço novo, dependência de
Redis/BullMQ, cache em memória adicional nem elevou o teto de heap:

```bash
grep "name:" ecosystem.config.cjs   # mesmos apps de antes; nada novo
git diff --stat                      # mudanças concentradas em dashboard/ + auth.js + docs
```

**Aprovado quando**: nenhuma mudança memory-heavy (verificável no ecosystem e no diff).

---

## Entrega

Branch → validar em **staging** (`http://178.105.54.0:3006`) rodando os passos US1–US4 →
PR `develop` → após validado, PR `develop` → `main`. Sem tocar `.env`, portas ou deploy além do
necessário.
