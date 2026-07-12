# Phase 0 — Research: Rede de segurança contra regressão e acoplamento

Resolve as escolhas técnicas da Etapa 0. Nenhuma NEEDS CLARIFICATION permaneceu:
a spec já fixou a preferência de ferramenta e as invariantes; este documento
consolida as decisões e alternativas.

## Decisão 1 — Ferramenta de barreira de import

- **Decision**: `dependency-cruiser` como devDependency, config em
  `.dependency-cruiser.cjs`, rodável via `npm run arch:check`.
- **Rationale**: (a) analisa imports estáticos sem exigir mudança no código de
  produção — não precisa de plugin de ESLint acoplado ao build do backend/Next;
  (b) suporta regex de origem/destino e exclusão por `pathNot`, exatamente o que
  a allowlist de baseline exige; (c) não tem postinstall pesado (respeita FR-017
  e o edge case de devDependency); (d) já é a ferramenta indicada na spec
  (Assumptions).
- **Alternatives considered**:
  - `eslint-plugin-boundaries` — aceitável (spec permite como fallback), mas
    acopla a checagem ao pipeline ESLint e à config existente (`eslint.config.js`
    hoje roda `no-undef` puro sem importar nada, de propósito). Reintroduziria
    dependência de config compartilhada. Rejeitado por acoplamento maior.
  - Script `grep`/AST caseiro — reinventa resolução de módulo (ESM, aliases),
    frágil com import dinâmico/tipo. Rejeitado por manutenção.

## Decisão 2 — Formato da config (`.cjs` e não `.js`)

- **Decision**: `.dependency-cruiser.cjs` (CommonJS, `module.exports`).
- **Rationale**: `package.json` tem `type: module`, então um `.js` seria tratado
  como ESM; o formato que `depcruise --init` gera e que a ferramenta espera é
  CommonJS. `.cjs` evita `ReferenceError: module is not defined` sem forçar
  `export default`. Consistente com `ecosystem.config.cjs` já usado no repo.
- **Alternatives considered**: `.dependency-cruiser.json` (perde comentários que
  documentam cada regra e o motivo da allowlist — a config é também documentação);
  `.js` ESM (funcionaria com `export default`, mas foge do default da ferramenta).

## Decisão 3 — Como expressar a allowlist de baseline (encolhível para zero)

- **Decision**: Regra `forbidden` `no-src-to-dashboard` com
  `from.path: '^src/'`, `to.path: '^dashboard/'` e `from.pathNot` listando os
  **2 arquivos** de baseline. Remover uma exceção = apagar uma linha do `pathNot`.
- **Rationale**: Atende FR-002/FR-003/FR-005 e o edge case "baseline encolhendo":
  `dependency-cruiser` **não** falha por "exceção não utilizada", então quando a
  Etapa 1 remover a violação real, a barreira segue verde mesmo se a linha do
  `pathNot` ainda existir — e removê-la é um passo tranquilo, não bloqueante.
- **Alternatives considered**: Usar a feature de `--baseline` (snapshot JSON de
  violações conhecidas) — mais opaco, gera um arquivo de "known violations" que é
  fácil de inflar acidentalmente; o `pathNot` explícito é auto-documentado e força
  a decisão consciente por arquivo. Rejeitado por transparência.

## Decisão 4 — Regra `routes ↛ sessionCore`

- **Decision**: Regra `forbidden` `routes-must-use-manager`:
  `from.path: '^src/api/routes/'`, `to.path: 'src/core/sessionCore\\.js$'`.
- **Rationale**: Codifica a regra canônica do `AGENTS.md` ("Não importar
  `sessionCore` direto — sempre via `manager.js`"). Inspeção confirmou que hoje
  nenhuma rota importa `sessionCore` diretamente (só há um comentário em
  `session.js`), então a regra nasce **verde** e passa a barrar reintrodução.
- **Alternatives considered**: Regra mais ampla `routes ↛ src/core/**` —
  rejeitada por ser larga demais; a regra canônica mira especificamente
  `sessionCore.js`.

## Decisão 5 — Regra dormante `domain ↛ infra` (FR-006)

- **Decision**: Regra `forbidden` `domain-no-infra`:
  `from.path: '^src/domain/'`, `to.path: 'node_modules/(@prisma/client|@whiskeysockets/baileys|baileys|ioredis)'`
  (mais o Prisma client resolvido). Fica **dormante** porque `src/domain/` não
  existe — nenhum módulo casa a origem, então a regra nunca dispara e o CI não
  quebra (edge case coberto).
- **Rationale**: Prepara a defesa em profundidade da Etapa 1 sem custo hoje.
  `dependency-cruiser` avalia regras só contra módulos existentes; origem vazia =
  zero violações.
- **Alternatives considered**: Omitir a regra até Etapa 1 — rejeitado; a spec
  (FR-006) pede a regra preparada agora, e deixá-la dormante é barato.

## Decisão 6 — Escopo e `doNotFollow` da varredura

- **Decision**: `npm run arch:check` = `depcruise src dashboard/lib --config .dependency-cruiser.cjs`,
  com `doNotFollow` em `node_modules` e `options.tsConfig` ausente (projeto é JS
  puro em `src/`). Focar em imports estáticos de módulo (ESM `import`/`require`),
  ignorando type-only (não há TS em `src/`).
- **Rationale**: Varrer `src` cobre a origem das fronteiras; incluir
  `dashboard/lib` garante que o destino das violações seja resolvível. Evita
  falso positivo de import dinâmico/tipo (edge case) por mirar arestas reais.
- **Alternatives considered**: Varrer o repo inteiro (`.`) — mais lento e traz
  ruído de `dashboard/.next`, scripts, testes. Rejeitado por escopo.

## Decisão 7 — Estrutura do workflow de CI

- **Decision**: **Novo** `.github/workflows/quality-gate.yml`, disparo em
  `pull_request` para `develop` e `main`, um job que faz: checkout →
  `actions/setup-node@v4` (node 22) → `npm ci` → `npm test` → `npm run arch:check`.
  `deploy.yml` e `backend-lint.yml` ficam intocados.
- **Rationale**: FR-008–FR-012 + SC-005. `npm ci` dispara o `postinstall`
  (`prisma generate`) e o `pretest` (`prisma db push` para `/tmp`) já existentes,
  então `npm test` roda sem setup extra de banco. Rodar a barreira no mesmo job
  (FR-012) mantém um pipeline único de qualidade. Job separado do deploy evita
  qualquer risco à SC-005.
- **Alternatives considered**:
  - Estender `backend-lint.yml` — ele foi desenhado de propósito para rodar
    `npx eslint` **sem** `npm ci` (não dispara Prisma, não depende de lockfile).
    Misturar `npm ci`/`npm test` ali contaminaria essa intenção. Rejeitado.
  - Node 24 (como `backend-lint.yml`) — o runtime dev validado é 22.x; alinhar o
    gate de testes ao node de dev reduz risco de divergência na suíte. Decisão:
    node 22. (Trivial de mudar depois se o projeto padronizar 24.)
  - Marcar o check como *required* via API — fora do escopo de código; a criação
    do workflow entrega o check, a marcação *required* é ato de configuração de
    branch protection no GitHub (Assumptions da spec).

## Decisão 8 — Livro-razão de acoplamento

- **Decision**: `docs/architecture/coupling-ledger.md` com: (1) propósito e
  "quando registrar"; (2) template de entrada (campos: Data / O que quebrou /
  Acoplamento causador / Como foi mitigado / Status); (3) 1 entrada seed com as 2
  violações `src/ → dashboard/lib`, marcada como dívida de baseline a remover na
  Etapa 1.
- **Rationale**: FR-013–FR-015 + SC-004. Documento de processo, sem efeito no CI.
- **Alternatives considered**: Issue no GitHub em vez de doc versionado —
  rejeitado; a spec pede documento vivo consultável no repo.

## Riscos e mitigação

- **`npm ci` falhar no CI por lockfile desatualizado** — adicionar
  `dependency-cruiser` exige `npm install` local para atualizar `package-lock.json`
  e commitá-lo. Mitigação: gerar o lock no mesmo commit da devDependency.
- **Barreira dar falso positivo em algum import legítimo `src → dashboard`** — a
  inspeção confirmou que só existem as 2 violações conhecidas; qualquer outra é
  uma violação real que deve mesmo falhar. Mitigação: rodar `arch:check` local
  antes de abrir a PR (deve sair verde no baseline — SC-001).
