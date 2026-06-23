# Plano B — Config de preservação direcionada (design + sign-off)

- **Data:** 2026-06-22
- **Status:** design aprovado (decisões 3.6 batidas) — pronto para implementar em fases
- **Origem:** Plano B de `2026-06-22-fila-serial-throttle-e-config-direcionada.md`.
  O Plano A (itens 1–3) já foi entregue em PRs separados; o Item 4 (renomeação +
  migração de nomenclatura) é **absorvido** por este design (a config nasce já
  com a nomenclatura "horário de funcionamento", então não há migração separada
  de quiet→funcionamento no global).

> Fluxo canônico (AGENTS.md): branch a partir de `develop` → PR para `develop`
> (autodeploy staging, validar em `http://178.105.54.0:3006`) → só depois
> `develop`→`main`. TDD com `node:test`. Migrações passam por staging antes de
> prod. Não importar `sessionCore` direto — sempre via `manager.js`. Nunca existe
> um momento sem proteção anti-ban (multi-tenant, ban irreversível).

---

## 0. Decisões batidas (sign-off 2026-06-22)

| # | Decisão | Escolha |
|---|---------|---------|
| 1 | Onde mora a config anti-ban | **No DESTINO** (`Group` role=post). Encaminhamento herda do grupo onde posta. |
| 2 | Granularidade de edição | **Presets + override por grupo.** Preset = base reutilizável; campos setados no grupo sobrepõem o preset. |
| 3 | Default de conta (ex-global) | **Remover de vez.** A global é usada só uma vez para semear a migração; depois é aposentada. O papel de "template para novos destinos" passa a ser do **preset default**. |
| 4 | Nomenclatura | **"Horário de funcionamento"** em tudo (janela de quando ENVIA). Silêncio é implícito ("fora do horário, em silêncio"). |

Consequência da #3: não há mais config de preservação no nível da conta. Todo
destino-post tem (a) um preset atribuído **ou** (b) campos próprios. Um destino
sem nenhum dos dois cai no **preset default da conta** (criado na migração a
partir da ex-global). Isso garante "nunca sem proteção".

---

## 1. Modelo de dados proposto

### 1.1 Novo model `PreservationPreset` (por usuário)

Base reutilizável de limites anti-ban + horário de funcionamento.

```prisma
model PreservationPreset {
  id                     String   @id @default(cuid())
  userId                 String
  user                   User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name                   String
  isDefault              Boolean  @default(false)   // 1 default por usuário (semeia novos destinos)

  // Horário de FUNCIONAMENTO (quando ENVIA). Fora dele = silêncio implícito.
  // operatingHoursEnabled=false → sem restrição de horário (envia 24h).
  operatingHoursEnabled  Boolean  @default(false)
  operatingHoursJson     String   @default("{\"startHour\":8,\"endHour\":22,\"tz\":\"America/Sao_Paulo\"}")

  // Anti-ban (cadência por destino).
  throttleEnabled        Boolean  @default(true)
  minIntervalSec         Int      @default(30)
  burstCap               Int      @default(6)
  burstWindowSec         Int      @default(600)
  dailyCap               Int?

  groups                 Group[]
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  @@index([userId])
}
```

> Pausa de saúde (403) **não** entra no preset: é reativa e por-destino
> (`ChannelHealth`), sempre ligada, não configurável pelo usuário (decisão de
> risco do plano original — não pode virar opção que se desliga sem saber).

### 1.2 Campos novos em `Group` (destino-post)

`Group` ganha (a) o vínculo opcional ao preset e (b) campos de override
**nuláveis** — `null` = "herda do preset". A nomenclatura migra de
`quietHours*` (bloqueio) para `operatingHours*` (funcionamento).

```prisma
// dentro de model Group:
preservationPresetId   String?
preservationPreset     PreservationPreset? @relation(fields: [preservationPresetId], references: [id], onDelete: SetNull)

// Overrides por destino (null = herda do preset). Espelham os campos do preset.
operatingHoursEnabled  Boolean?
operatingHoursJson     String?
throttleEnabled        Boolean?
minIntervalSec         Int?
burstCap               Int?
burstWindowSec         Int?
dailyCap               Int?
```

> Os campos legados `quietHoursEnabled`/`quietHoursJson` do `Group` (override de
> janela silenciosa por grupo, já existente) são **migrados** para
> `operatingHoursEnabled`/`operatingHoursJson` com **inversão de semântica**
> (ver 2.2) e depois removidos numa migração posterior (fase 3), quando nada mais
> lê os campos antigos.

### 1.3 Resolução efetiva da config (camada de leitura)

Função pura `resolveDestinationPreservation(group, preset)` → objeto com os
limites efetivos:

```
campo_efetivo = group.<campo> != null ? group.<campo> : preset.<campo>
```

Se o grupo não tem preset nem override para um campo → usa o **preset default**
da conta. Nunca retorna "sem proteção": ausência total = preset default.

`decide()` (`src/core/channelThrottle.js`) passa a receber esses limites já
resolvidos em vez de ler `botConfig.*`. A semântica de horário inverte: hoje
`decide` bloqueia DENTRO da janela (quiet); passa a bloquear **FORA** da janela
de funcionamento (envia dentro, silêncio fora). `quietHoursState` vira
`operatingHoursState` (ou um wrapper que nega o resultado).

---

## 2. Migração (faseada, nunca sem proteção)

### Fase 0 — concluída
Plano A itens 1–3 (defer não congela, override de horário da fila no worker,
watchdog de `sending`). Independem do modelo de config.

### Fase 1 — fundação (schema + seed + leitura por destino)
1. Migration Prisma: cria `PreservationPreset`; adiciona campos novos em `Group`.
2. **Seed idempotente** (`scripts/seed-preservation-presets.mjs`): para cada
   usuário, cria um preset **default** a partir da ex-global do `BotConfig`
   (convertendo `channelQuietHoursJson` de bloqueio → `operatingHoursJson` de
   funcionamento = complemento `{ start: quiet.endHour, end: quiet.startHour }`;
   copiando `channelMinIntervalSec`/`channelBurstCap`/`channelBurstWindowSec`/
   `channelDailyCap`/`channelThrottleEnabled`). Atribui o preset default a todos
   os `Group` role=post do usuário. Comportamento idêntico ao dia anterior.
3. `decide()`/`checkAndReserve` passam a ler os limites via
   `resolveDestinationPreservation`, **com fallback para `botConfig.*`** enquanto
   a migração não cobre 100% (defesa em profundidade). Sem UI ainda.
4. Migração das linhas existentes do override por-grupo
   (`quietHoursJson`→`operatingHoursJson` invertido) — ver 2.2.
- **Deployável e reversível**: o fallback para global mantém o envio funcionando
  se o seed não tiver rodado.

### Fase 2 — UI direcionada
1. Tela de **presets** (CRUD) + tela de **edição por grupo** (escolher preset +
   overrides). UX de escala: aplicar preset a vários grupos de uma vez.
2. Renomeação visual completa para "horário de funcionamento"
   (`dashboard/components/preservacao/QuietHoursForm.js` →
   `OperatingHoursForm`), absorvendo o Item 4 do Plano A.
3. Validar em staging end-to-end.

### Fase 3 — aposentar o global
1. Remover o fallback para `botConfig.*` em `decide()` (a verdade é 100%
   por-destino).
2. Migration que **dropa** os campos de preservação do `BotConfig` e os
   `quietHours*` legados do `Group`.
3. Só depois de Fase 2 validada e todo tráfego coberto.

### 2.2 Conversão de semântica quiet → funcionamento
- Global/grupo guardavam **janela de bloqueio** (`{startHour, endHour}` = silêncio).
- Funcionamento = **complemento**: `operating = { start: quiet.endHour, end: quiet.startHour, tz }`.
  - Ex.: quiet `{0,6}` (silêncio 0h–6h) → funcionamento `{6,0}` (envia 6h–0h).
- Caso degenerado: quiet `{0,0}` (nunca silencia) → funcionamento `{0,0}` tratado
  como "24h" (`operatingHoursEnabled` decide se aplica). O seed seta
  `operatingHoursEnabled = quietHoursEnabled` para preservar o comportamento.

---

## 3. Pontos de código acoplados (todos precisam mudar juntos na Fase 1/3)

- `src/core/channelThrottle.js` — `decide()` lê limites resolvidos; horário inverte.
- `bot-worker.js` `processSendJob` — monta os limites do destino (lookup do
  `Group` + preset) e passa ao gate. Já faz lookup do `Group` por `waJid/role`.
- `src/offerQueue/dispatcher.js` — `ignoreGlobalQuietHours` continua válido como
  "a fila tem horário próprio que sobrepõe o do destino"? **Decisão de Fase 2**:
  com config por destino, a fila pode (a) herdar o horário do destino, ou (b)
  manter override próprio. Recomendado manter o override da fila (já entregue no
  Item 2) e documentar a precedência: fila > destino > preset default.
- UI: `dashboard/components/preservacao/*`, rotas de config.
- Encaminhamento (`bot-worker.js` caminho monitorado) — **nada a fazer**: herda
  do destino automaticamente (é o ganho principal).

---

## 4. Riscos / invariantes (não regredir)

- **Nunca sem proteção anti-ban** (multi-tenant, ban irreversível): toda fase é
  deployável e o fallback (Fase 1/2) garante limites mesmo sem seed.
- **Pausa de saúde (403)** segue por-destino e sempre ligada — não vira toggle.
- **Volume**: seed de N destinos por usuário; usar `updateMany`/batch e índices
  (`PreservationPreset.userId`, `Group.preservationPresetId`).
- **Idempotência** do seed: rodar 2x não duplica preset default nem reescreve
  overrides já editados pelo usuário.
- Migração de dados sempre via staging antes de prod; `scripts/backup_prod.sh`
  antes em prod (pegadinha #8: parar apps PM2 que seguram o SQLite antes de DDL).

---

## 5. Ordem de PRs

1. **PR B-1 (este doc).** Design + sign-off.
2. **PR B-2 (Fase 1a).** Migration de schema (`PreservationPreset` + campos em
   `Group`) + `resolveDestinationPreservation` (pura, testada) — sem alterar
   ainda o caminho de envio.
3. **PR B-3 (Fase 1b).** `decide()`/`checkAndReserve` leem por destino com
   fallback global + seed idempotente. TDD.
4. **PR B-4 (Fase 2).** UI de presets + edição por grupo + renomeação visual.
5. **PR B-5 (Fase 3).** Aposentar global (drop de colunas) após validação.
