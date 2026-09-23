# Data Model — 018 Anti-banimento

**Nenhuma tabela nova, nenhuma coluna nova, nenhuma migration** (nem DDL, nem
DML). A feature muda como os valores já existentes são **lidos** e **exibidos**.
Detalhes e justificativa em `research.md` (R2, R3).

## Entidades existentes (sem mudança de schema)

### `PreservationPreset` — "Modelo de ritmo" na tela

| Coluna | Tipo / default | Situação após a feature |
|---|---|---|
| `name`, `isDefault` | — | editável (nome aparece como "modelo") |
| `minIntervalSec` | Int, 30 | **editável** — "esperar pelo menos X minutos entre uma oferta e outra" |
| `dailyCap` | Int?, null | **editável** — "no máximo X ofertas por dia" |
| `operatingHoursEnabled`, `operatingHoursJson` | Bool false / JSON 8–22 | **editável** — "enviar só entre Xh e Yh" |
| `queueMaxAgeMin` | Int, 300 | **editável** (recolhido) |
| `burstCap` | Int, 6 | **dormente na tela**; lido pelo piso (`min(gravado, 6)`) |
| `burstWindowSec` | Int, 600 | **dormente na tela**; lido pelo piso (`max(gravado, 600)`) |
| `throttleEnabled` | Bool, true | **dormente na tela**; lido pelo piso (sempre `true`) |

### `Group` (role `post`) — "Ritmo de um destino"

Mesmos campos acima, todos **nuláveis** (`null` = herda do modelo). O piso é
aplicado **depois** da herança (sobre o valor efetivo resolvido) — como o piso é
monotônico (min/max/constante), aplicar depois da herança dá o mesmo resultado
que aplicar em cada nível, e a ordem de precedência não muda (FR-014).

### `BotConfig` — "Ajustes da conta"

| Coluna | Default | Situação |
|---|---|---|
| `channelStaggerJitterMs` | 20000 | **dormente na tela**; piso `max(gravado, 20000)` |
| `maxDailyFollows` | — | **editável** — "seguir no máximo X canais por dia" |
| `imageMutationActive` (API: `imageMutationEnabled`) | **false** | **editável** (proposta; ver R3 Achado A — pendente de aprovação) |
| `probeEnabled` | false | **editável** (parte Situação) — "vigiar se seus canais estão sendo escondidos" |
| `followGuardEnabled` | false | sem mudança |
| `channelMinIntervalSec`, `channelBurstCap`, `channelBurstWindowSec`, `channelThrottleEnabled`, `channelQuietHoursJson`, `quietHoursEnabled` | — | já dormentes; continuam |

### `User`
`plan`, `accessExpiresAt` — lidos por `canUseAdvancedPreservation`
(fonte única, R5). Sem mudança.

## Conceito novo (só em código, puro): piso anti-banimento

`src/core/antiBanFloor.js` — sem banco, sem rede.

```text
ANTI_BAN_FLOOR = {
  burstCap:               6      (menor é mais conservador)
  burstWindowSec:         600    (maior é mais conservador)
  throttleEnabled:        true   (ligado é mais conservador)
  channelStaggerJitterMs: 20000  (maior é mais conservador)
}
```

Funções (contrato em `contracts/anti-ban-floor.md`):

- `applyDestinationFloor(effective)` → cópia com os 3 campos de destino no piso;
  demais campos intocados. Entrada inválida/ausente em um campo → valor do piso.
- `applyAccountFloor(botConfig)` → cópia com `channelStaggerJitterMs` no piso.
- `describeDestinationFloor(stored)` → `{ ritmoMaisCuidadoso, camposNoPiso[] }`
  (`ritmoMaisCuidadoso` = algum campo gravado é **estritamente** mais conservador
  que o piso; `camposNoPiso` = campos cujo gravado era menos conservador e foi
  neutralizado — usado só pelo diagnóstico e logs, nunca na tela).
- `describeAccountFloor(botConfig)` → idem para a conta.
- `isAntiBanFloorEnabled(env)` → `false` só para `ANTI_BAN_FLOOR === 'off'`.

### Regras de validação

- Comparação **campo a campo**, nunca pela taxa combinada (spec FR-011).
- Valor igual ao piso = nada muda, sem etiqueta.
- `null`/não numérico num campo já resolvido → piso (fail-safe para o lado seguro;
  hoje o resolver já cai no `HARD_DEFAULT`, então isso só cobre dado corrompido).
- Piso desligado por env → funções devolvem a entrada inalterada (escape hatch).

## Transições de estado (acesso por plano, FR-019)

```text
com acesso ──(plano vence / vira Basic)──▶ sem acesso
  tela: editável                          tela: bloqueada com selo PRO (FR-017)
  API PUT: grava                          API PUT: 402/403 leigo, nada gravado
  robô: gravado + piso                    robô: gravado + piso  (inalterado)
sem acesso ──(volta a assinar)──▶ com acesso: reencontra os mesmos valores
```

Defesas de conta que dependem de plano (variação de imagem, vigia de seguidas,
observador, variação de texto) seguem gated como hoje (`preservationActive`).
