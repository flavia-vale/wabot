# Phase 1 — Data Model

## Entidade: `Group` (grupo monitorado / destino)

Sem novas entidades. A feature altera apenas o campo `imageMode` de uma tabela
existente. Nenhuma coluna é adicionada ou removida.

### Campo afetado

| Campo | Tipo | Antes | Depois |
|---|---|---|---|
| `imageMode` | `String` | `@default("none")`; valores `preview`/`fetch`/`original`/`none`; editável pelo cliente | `@default("preview")`; valor canônico `preview` para todos os grupos; **não** editável pelo cliente (UI removida); coluna mantida |

`prisma/schema.prisma:94` hoje: `imageMode String @default("none")` → passa a
`imageMode String @default("preview")`.

### Regras de validação / invariantes

- **INV-1 (efetivo)**: o valor efetivo de `imageMode` consumido pelo pipeline é
  **sempre** `'preview'`, garantido em `resolveGroupEntitlements()` (defesa em
  profundidade), qualquer que seja o valor persistido. (FR-001, FR-009)
- **INV-2 (persistido)**: após a migração, todo `Group.imageMode` persistido é
  `'preview'` (nenhum nulo/legado/`fetch`/`original`/`none`). (FR-002, SC-001)
- **INV-3 (criação)**: novos grupos nascem com `imageMode = 'preview'` por dois
  níveis — app (`groups.js`) e schema (`@default`). (FR-003, SC-002)
- **INV-4 (coluna preservada)**: a coluna `imageMode` continua existindo e a rota
  `PUT /groups/:id` continua aceitando/validando o campo (dormante), para
  reativação futura sem migration de schema. (Assumption do spec)

### Transição de estado (migração de dados)

```
imageMode ∈ { null, 'none', 'fetch', 'original', <legado> }  ──migração──▶  'preview'
imageMode == 'preview'                                        ──migração──▶  'preview' (inalterado)
```

Idempotente: aplicar a migração N vezes converge para o mesmo estado (`preview`
para todos). (FR-002, AC-2)

### Migration SQL (não-destrutiva)

```sql
-- Fixa a fonte de imagem de toda oferta espelhada em 'preview'
-- (Preview clicável do WhatsApp). A escolha por grupo foi removida da UET;
-- migra qualquer valor legado/nulo/não-preview para 'preview'. Idempotente,
-- não toca nenhuma outra coluna. Ver specs/001-image-mode-preview-default.
UPDATE "Group" SET "imageMode" = 'preview'
WHERE "imageMode" IS NULL OR "imageMode" <> 'preview';
```

Segue o precedente de `20260628120000_group_image_mode_choice/migration.sql`
(mesmo padrão de `UPDATE "Group" SET "imageMode" = ...`).
