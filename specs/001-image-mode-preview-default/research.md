# Phase 0 — Research: Fixar imageMode em "preview"

Todas as incógnitas do plano foram resolvidas por leitura direta do código atual.
Nenhum `NEEDS CLARIFICATION` remanescente.

## Decisão 1 — Onde garantir o comportamento `preview` (chokepoint único)

**Decision**: Coagir o `imageMode` efetivo para `'preview'` em
`resolveGroupEntitlements()` (`src/billing/groupEntitlements.js`, hoje linha ~20:
`imageMode: group.imageMode ?? 'original'`). Passa a devolver sempre `'preview'`.

**Rationale**: Essa função é o funil por onde todo grupo monitorado vira o `cfg`
consumido pelo `bot-worker.js`. Coagir aqui cumpre FR-001 e FR-009 (defesa em
profundidade) em **um só lugar**, independentemente de resíduo na coluna. Os
call-sites do worker (`getImage`, `wantImage`, `shouldRelayOriginalMediaForImageMode`)
já tratam `preview`/`none` como "sem fetch/relay" — recebendo sempre `preview`, os
ramos `fetch`/`original` nunca executam, ficando naturalmente dormentes.

**Alternatives considered**:
- Coagir em cada call-site do `bot-worker.js`: espalha a regra por 3+ pontos, mais
  frágil e mais difícil de reverter. Rejeitado.
- Remover a coluna `imageMode` do schema: migração destrutiva, quebra defesa em
  profundidade e a reativação futura. Rejeitado (Assumption do spec: manter a coluna).

## Decisão 2 — Migração de dados dos grupos existentes

**Decision**: Migration Prisma nova com um único `UPDATE` idempotente:
`UPDATE "Group" SET "imageMode" = 'preview' WHERE "imageMode" IS NULL OR "imageMode" <> 'preview';`
Mais mudar o `@default` do schema de `"none"` para `"preview"`.

**Rationale**: Segue o precedente do repo — a migration
`20260628120000_group_image_mode_choice` já fez exatamente esse padrão (`UPDATE
"Group" SET "imageMode" = ...`). É DML puro (não DDL), convive com WAL, é
idempotente (rodar 2x dá o mesmo resultado — FR-002/AC-2) e não toca nenhuma outra
coluna. Cobre nulos e valores legados (Edge Case do spec).

**Alternatives considered**:
- Script `scripts/migrate-*.mjs` avulso (como os de crypto): útil quando precisa
  parar a API. Aqui é `UPDATE` leve e a migration entra no fluxo automático de
  deploy (`prisma migrate deploy`), então a migration Prisma é suficiente e mais
  rastreável. Mantém-se o backup de prod antes do deploy mesmo assim.

**SQLITE_BUSY/WAL**: `UPDATE` é DML e convive com WAL + `busy_timeout=5000`. Não
exige lock exclusivo (diferente de DDL — pegadinha #8 do AGENTS.md). Ainda assim, o
`deploy_safe_*.sh` já para apps PM2 quando há migration pendente, então o passo é
seguro por construção.

## Decisão 3 — Default de criação de grupo

**Decision**: Em `src/api/routes/groups.js` (~linha 105), trocar
`imageMode: role === 'monitor' ? 'original' : 'none'` por `imageMode: 'preview'`
para todo grupo criado. O `@default("preview")` do schema cobre qualquer caminho que
não passe `imageMode` explícito (FR-003/AC-2).

**Rationale**: Dois níveis (app + schema) garantem que novos grupos nasçam em
`preview` por qualquer caminho (painel/API).

## Decisão 4 — Remoção do seletor no painel

**Decision**: Remover o bloco `<CfgRow label="Imagem da oferta" …>` inteiro em
`dashboard/app/painel/grupos/page.js` (~linhas 314–360), incluindo o `<select>`,
os textos `info`/`hint` e os avisos condicionais `cfg-inline-warn` de `preview`/`fetch`.

**Rationale**: FR-004/SC-003 — a escolha some da experiência. O `onUpdate` do grupo
continua salvando as demais configs normalmente; como o campo não é mais enviado, o
backend mantém `imageMode` como está (e o chokepoint já força `preview` no runtime).

**Nota**: A rota `PUT /groups/:id` **mantém** a aceitação/validação de `imageMode`
(dormante) para não quebrar clientes/testes e permitir reativação futura — só a UI
para de enviar. Documentar esse ponto como dormante.

## Decisão 5 — Código de extração dormante (não remover)

**Decision**: Preservar `resolveMonitoredImage`, `fetchProductImage`,
`fetchImageBuffer`, `downloadOriginalImage`, os scrapers
(`src/converters/imageScrapers.js`) e `shouldRelayOriginalMediaForImageMode`. Adicionar
comentário claro nos ramos do `bot-worker.js` (`getImage`, `wantImage`, ramo `relay`,
ramo `imageMode === 'original'`) e em `monitoredRelayPolicy.js` explicando que a
escolha do usuário foi desativada (fixada em `preview`) e que o código fica dormente
para reativação futura.

**Rationale**: FR-006/SC-005 e regras invioláveis do AGENTS.md sobre `imageScrapers.js`
(não regredir, não apagar). Manter compilável/importado garante build e
`test/image-scrapers.test.js` verdes.

**Alternatives considered**: Apagar os ramos — rejeitado explicitamente pelo spec.

## Decisão 6 — Impacto em envio/dedup/taxonomia

**Decision**: Nenhuma alteração no pipeline de envio, dedup (`SendDedupKey`,
`dedupHits`), taxonomia `MessageLog.errorMsg` ou status de `MessageLog`. O único
efeito é qual `buildPayload` roda (sempre o ramo `preview`/`buildManualLinkPreview`).

**Rationale**: FR-005/SC-004. O offer automation dispatcher (`src/offerAutomation/`)
**não** consome `imageMode` (grep vazio) — já usa seu próprio caminho de preview —,
então ofertas automáticas ficam intocadas.
