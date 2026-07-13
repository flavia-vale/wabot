# Phase 0 — Research: Smoke list (Etapa 0.5)

Todas as NEEDS CLARIFICATION resolvidas. Não há incógnitas de runtime — a feature
é seleção + documentação.

## R1 — Como listar os arquivos: enumeração explícita vs. glob

- **Decisão**: enumeração explícita da lista curada dentro do script `smoke` do
  `package.json`.
- **Rationale**:
  - FR-007 exige falha visível quando um arquivo listado some (renome/move). Com
    lista explícita, `node --test <path>` erra e o exit é ≠ 0. Um glob apenas
    varreria o que existe e **encolheria o conjunto em silêncio**, escondendo a
    dessincronização.
  - A curadoria "quais testes são críticos" é humana/versionada (Assumption da
    spec). A lista no `package.json` é o registro auditável em code review.
  - Determinismo: conjunto e ordem fixos, independentes de layout de diretório.
- **Alternativas consideradas**:
  - *Glob por convenção de pasta* (`test/smoke/**`): exigiria mover os 26 testes
    existentes → viola FR-012 ("apenas SELECIONA, não altera"). Rejeitada.
  - *Arquivo runner Node dedicado* (`scripts/smoke.mjs` lendo um array): mais
    código para manter e mais uma superfície fora de `test`. Um script npm
    inline com a lista basta. Rejeitada por YAGNI.
  - *Glob com verificação de contagem*: acrescenta lógica frágil (hardcode "26").
    Enumeração explícita já resolve o mesmo objetivo sem número mágico.

## R2 — Env e preparo de banco

- **Decisão**: replicar o padrão do script `test` — `NODE_ENV=test` +
  `DATABASE_URL="file:/tmp/wabot-test.db"` — e adicionar `presmoke` idêntico ao
  `pretest` (reset do banco via `prisma db push --force-reset`).
- **Rationale**:
  - Alguns arquivos do subconjunto tocam o banco (auth, payments,
    group-entitlements/route, offer-automation). Sem o reset, sairiam
    falso-vermelho por schema ausente (edge case da spec).
  - npm executa `pre<script>` automaticamente, então `presmoke` roda antes de
    `smoke` sem orquestração manual — mesmo mecanismo do par `pretest`/`test`.
  - Reusa o banco de teste isolado (`/tmp/wabot-test.db`); nunca toca
    `staging.db`/`prod.db` nem `.env` reais (FR-005, FR-012).
- **Alternativas consideradas**:
  - *Rodar sem reset de DB* (só testes puros): frágil — qualquer inclusão futura
    de teste com DB quebraria o smoke. O reset é barato e torna o smoke robusto.
  - *Banco em memória separado só para o smoke*: inventa mecanismo novo divergente
    do `test`; a spec pede explicitamente reusar o padrão existente. Rejeitada.

## R3 — Rápido e determinístico

- **Decisão**: manter `--test-concurrency=1` (como o `test`) e confiar na redução
  de escopo (~26/176) para a velocidade; não introduzir paralelismo novo.
- **Rationale**: o ganho vem de rodar ~15% dos arquivos, a maioria puros. Ligar
  concorrência agora arriscaria flakiness (testes que compartilham o mesmo
  `/tmp/wabot-test.db`) e comprometeria o "verde-confiável" que é o propósito do
  smoke. Determinismo > microganho de paralelismo nesta etapa.
- **Alternativa considerada**: `--test-concurrency` > 1 — adiada; pode ser
  avaliada depois se o tempo incomodar, mas fora do escopo da Etapa 0.5.

## R4 — Constitution / regras canônicas

- **Decisão**: usar o AGENTS.md como fonte do Constitution Check (o
  `constitution.md` é template não preenchido).
- **Rationale**: AGENTS.md é declarado fonte única de regras do repo. Todos os
  gates relevantes (sem runtime prod, sem memória, fluxo feature→develop, não
  tocar deploy) mapeiam para FR-012..FR-014 e passam.

## R5 — Confirmação dos caminhos curados

- **Decisão**: os 26 caminhos da tabela FR-003 foram verificados como existentes
  em `test/` (incluindo os três sob `test/core/`: `global-dedup`,
  `mirror-dedup-key`, `worker-spawn-options`, que divergiam do texto original da
  demanda). Nenhum caminho MISSING.
- **Rationale**: pré-condição do SC-001 (smoke verde no develop atual).
