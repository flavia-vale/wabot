# Quickstart — Validar o smoke (Etapa 0.5)

Guia de validação end-to-end da feature. Não contém implementação — só como
provar que os entregáveis atendem os critérios de aceitação.

## Pré-requisitos

- Repo no branch `003-smoke-list` (a partir de `develop`).
- `npm ci` executado (Prisma client gerado).
- Nenhum `.env` de staging/prod é necessário nem tocado.

## Cenário 1 — Smoke sai verde e é rápido (SC-001, SC-002, FR-002, FR-004)

```bash
time npm run smoke
```

**Esperado**:
- exit code `0`;
- resumo `node:test` com `# fail 0` cobrindo os 26 arquivos curados;
- tempo de parede perceptivelmente menor que `time npm test` (que roda 176).

## Cenário 2 — Env igual ao `test`, banco isolado (FR-005)

- Confirmar que `npm run smoke` prepara o banco de teste via `presmoke`
  (`prisma db push --force-reset` em `file:/tmp/wabot-test.db`) e que **não** há
  referência a `staging.db`/`prod.db` ou a `.env` reais no comando.

## Cenário 3 — Falha visível em regressão (FR-007, Acceptance US1.3)

- Introduzir temporariamente uma quebra num eixo coberto (ex.: editar uma
  asserção em `test/reconnect-policy.test.js` **localmente, sem commitar**) e
  rodar `npm run smoke` → exit ≠ 0 apontando o arquivo. Reverter em seguida.
- Renomear temporariamente um arquivo listado → `npm run smoke` falha por
  arquivo não encontrado (não pula em silêncio). Reverter.

## Cenário 4 — Doc de regressão presente e completo (SC-004, FR-008..FR-011)

Abrir `docs/testing/regression-checklist.md` e confirmar:
- **Nível 1**: tabela eixo→arquivo + `npm run smoke` + marcação de quais tocam DB.
- **Nível 2**: itens acionáveis — QR ponta-a-ponta; `pm2 restart api-staging`
  mantém sessão conectada; espelhamento chega **com foto** + link convertido +
  cupom preservado; clique no celular credita comissão (ML com cupom);
  dashboard (`/login`, "Criar oferta", grupos); pagamento sandbox ativa plano.
- Referência (não duplicação) aos 3 smoke de `scripts/deploy_safe_staging.sh`.
- Seção "comportamento > regex de source" com o exemplo dos testes estruturais.

## Cenário 5 — Diff mínimo (SC-005, FR-012)

```bash
git diff --name-only develop...HEAD
```

**Esperado**: apenas `package.json` e `docs/testing/regression-checklist.md`
(mais os artefatos de spec em `specs/003-smoke-list/`). Nenhum arquivo sob
`src/`, nenhum teste existente, nenhum `.env`/banco/porta/`deploy.yml`.
