# Contrato — Regras da barreira de import (`.dependency-cruiser.cjs`)

Contrato observável da barreira: dado o repo em um estado, `npm run arch:check`
produz um exit code determinístico. Estes são os casos que a config DEVE satisfazer.

## Comando de referência

```bash
npm run arch:check
# = depcruise src dashboard/lib --config .dependency-cruiser.cjs
```

Exit `0` = verde (nenhuma violação fora da allowlist). Exit ≠ `0` = vermelho
(pelo menos uma violação de fronteira reportada, com arquivo infrator).

## Casos de contrato

| # | Estado do repo | Resultado esperado | FR / SC |
|---|---|---|---|
| C1 | Baseline atual (as 2 violações `src → dashboard/lib` presentes e allowlisted) | **exit 0** (verde) | FR-002/FR-003, SC-001 |
| C2 | Novo arquivo `src/foo.js` com `import ... from '../dashboard/lib/x.js'` | **exit ≠ 0**, aponta `src/foo.js` | FR-002, SC-002 |
| C3 | `src/api/routes/bar.js` com `import ... from '../../core/sessionCore.js'` | **exit ≠ 0**, indica usar `manager.js` | FR-004, SC-002 |
| C4 | Uma das 2 exceções removida do código (Etapa 1), linha ainda no `pathNot` | **exit 0** (verde), sem erro de "exceção não usada" | FR-005, edge "baseline encolhendo" |
| C5 | `src/domain/` inexistente (hoje) | **exit 0** — regra `domain-no-infra` dormante não dispara | FR-006, edge "src/domain vazio" |
| C6 | (Futuro) `src/domain/x.js` importando `@prisma/client` | **exit ≠ 0** | FR-006 |
| C7 | PR que altera só `docs/` | **exit 0** (nenhuma fronteira tocada) | edge "PR só de docs" |

## Regras exigidas (todas `severity: error`)

1. **`no-src-to-dashboard`** — `from.path ^src/`, `to.path ^dashboard/`,
   `from.pathNot` = exatamente os 2 arquivos de baseline.
2. **`routes-must-use-manager`** — `from.path ^src/api/routes/`,
   `to.path src/core/sessionCore\.js$`.
3. **`domain-no-infra`** — `from.path ^src/domain/`, `to.path` = Prisma/Baileys/Redis.

## Invariantes de não-regressão

- A execução **não** modifica nenhum arquivo (`depcruise` é read-only).
- Nenhuma exceção nova além das 2 de baseline (FR-003).
- Rodar local e no CI produz o mesmo exit code (FR-007).
