# Quickstart — Validar a rede de segurança (Etapa 0)

Guia de validação executável. Prova que a barreira e o gate funcionam sem alterar
comportamento de produção. Não contém código de implementação — só passos e
resultados esperados. Detalhes de regras/estrutura em `contracts/` e `data-model.md`.

## Pré-requisitos

- Node 22.x, repositório na branch `002-regression-safety-net` (a partir de `develop`).
- `npm ci` executado (instala `dependency-cruiser` como devDependency).

## 1. Barreira verde no baseline (SC-001)

```bash
npm run arch:check
```

**Esperado**: exit `0`. As 2 violações conhecidas (`src/offerAutomation/dispatcher.js`
e `src/core/mirrorTemplate.js` → `dashboard/lib/*`) estão allowlisted e não falham.

## 2. Barreira vermelha ao injetar violação (SC-002)

Teste manual, reversível — **não commitar**:

```bash
# Caso A: novo import src -> dashboard
printf "import x from '../dashboard/lib/mobileOfferComposer.js'\n" > src/__viol.js
npm run arch:check   # esperado: exit != 0, aponta src/__viol.js
rm src/__viol.js

# Caso B: rota importando sessionCore direto
# (adicionar temporariamente em um arquivo de src/api/routes/ um import de
#  ../../core/sessionCore.js e rodar arch:check -> esperado exit != 0)
```

**Esperado**: cada caso sai **vermelho** identificando o arquivo infrator; após
`rm`/reverter, `npm run arch:check` volta a **verde**.

## 3. Regra dormante de domínio não quebra o CI (FR-006 / edge)

```bash
ls src/domain 2>/dev/null || echo "src/domain ausente — regra domain-no-infra dormante"
npm run arch:check   # continua verde
```

## 4. Suíte de testes continua passando sem alteração (SC-006)

```bash
npm test
```

**Esperado**: mesma suíte de ~150 arquivos passa; nenhum assert de comportamento
foi modificado por esta etapa.

## 5. Gate de CI em PR (SC-003)

1. Abrir PR desta branch contra `develop`.
2. Conferir que o workflow **Quality gate** roda: `npm ci` → `npm test` →
   `npm run arch:check`.
3. **Esperado**: check verde. Um commit com teste quebrado torna o check vermelho
   e bloqueia o merge (com branch protection exigindo o check).

## 6. `deploy.yml` inalterado (SC-005)

```bash
git diff --stat origin/develop -- .github/workflows/deploy.yml
# esperado: sem saída (nenhuma mudança)
sha256sum .github/workflows/deploy.yml
# esperado: 158b331b16686a4b98107026d2ae7027933e997c94030cb2da0d3adf50f6ad54
```

## 7. Livro-razão existe com template + seed (SC-004)

```bash
test -f docs/architecture/coupling-ledger.md && echo OK
```

**Esperado**: arquivo existe, contém o template de entrada (Data / O que quebrou /
Acoplamento causador / Como foi mitigado / Status) e a entrada seed das 2
violações `src/ → dashboard/lib` apontando remoção na Etapa 1.

## Critério de saída da Etapa 0

Todos os passos 1–7 verdes; diff toca apenas `.dependency-cruiser.cjs`,
`.github/workflows/quality-gate.yml`, `docs/architecture/coupling-ledger.md`,
`package.json` e `package-lock.json`. Zero mudança em `src/**/*.js` de runtime.
