# Data Model — 018 Anti-banimento

**Nenhuma tabela nova, nenhuma coluna nova, nenhuma coluna renomeada, nenhuma
migration** (nem DDL, nem DML). A feature muda como valores já existentes são
**lidos**, **exibidos** e, no caso do intervalo entre destinos, **aplicados**.
Justificativa em `research.md` (R2, R3, R10, R11).

## Entidades existentes (sem mudança de schema)

### `PreservationPreset` — "Modelo de ritmo" na tela

| Coluna | Tipo / default | Situação após a feature |
|---|---|---|
| `name`, `isDefault` | — | editável (nome aparece como "modelo") |
| `minIntervalSec` | Int, 30 | **editável** — "esperar pelo menos X minutos entre uma oferta e outra neste grupo" |
| `dailyCap` | Int?, null | **editável** — "no máximo X ofertas por dia" |
| `operatingHoursEnabled`, `operatingHoursJson` | Bool false / JSON 8–22 | **editável** — "enviar só entre Xh e Yh" |
| `queueMaxAgeMin` | Int, 300 | **editável** (recolhido) |
| `burstCap` | Int, 6 | **dormente na tela**; piso `min(gravado, 6)` |
| `burstWindowSec` | Int, 600 | **dormente na tela**; piso `max(gravado, 600)` |
| `throttleEnabled` | Bool, true | **dormente na tela**; efetivo sempre `true` (ver exceção abaixo) |

### `Group` (role `post`) — "Ritmo de um destino"

Mesmos campos acima, todos **nuláveis** (`null` = herda). O piso é aplicado
**depois** da herança, sobre o valor efetivo resolvido; a ordem de precedência
(destino → modelo atribuído → modelo padrão da conta → padrão do sistema) não muda.

#### Exceção: limites do destino que estavam desligados

Regra geral (limites ligados): rajada e janela valem o mais conservador entre
gravado e fixo; intervalo mínimo e limite diário ficam como gravados.

Exceção (decisão da dona do produto, "zerar e recomeçar do padrão"): se o
`throttleEnabled` **efetivo** resolvido for `false`, o piso devolve os valores
de `HARD_DEFAULT_PRESERVATION` para os campos governados pelo liga/desliga,
**ignorando** o que estava gravado:

| Campo | Efetivo quando os limites estavam desligados |
|---|---|
| `throttleEnabled` | `true` |
| `minIntervalSec` | 30 (padrão do sistema) |
| `dailyCap` | `null` (padrão do sistema: sem limite diário) |
| `burstCap` | 6 |
| `burstWindowSec` | 600 |
| `operatingHoursEnabled`, `operatingHoursJson`, `queueMaxAgeMin` | como resolvidos (não são governados pelo liga/desliga) |

"Padrão do sistema" = `HARD_DEFAULT_PRESERVATION` (`src/core/preservationConfig.js`),
não o modelo padrão da conta. Os valores gravados continuam no banco (dormentes);
se a cliente depois gravar valores novos pelo destino/modelo, eles valem
normalmente (o `throttleEnabled` gravado continua `false` e dormente, e a
exceção continuaria trocando `minIntervalSec`/`dailyCap` pelo padrão — por isso
a tela nova, ao salvar um destino/modelo, **grava `throttleEnabled: true`**
junto, saindo do estado de exceção pelo caminho normal de escrita).

### `BotConfig` — "Ajustes da conta" (nenhum campo fixo)

| Coluna | Default | Situação |
|---|---|---|
| `channelStaggerJitterMs` | 20000 (ms) | **editável**, rótulo **"Intervalo entre destinos"** (segundos na tela, 0–600). **Significado novo**: espera fixa entre dois envios consecutivos da conta para destinos diferentes (grupo, canal ou status), aplicada por adiamento. Sem piso. Coluna e nome de API mantidos (R10). Padrão 20 s **provisório** até o gate humano (plan.md) |
| `maxDailyFollows` | — | **editável** — "seguir no máximo X canais por dia" |
| `imageMutationActive` (API: `imageMutationEnabled`) | **false** | **editável, sem nenhuma mudança** (decisão A) |
| `probeEnabled` | false | **editável** (parte Situação) — "vigiar se seus canais estão sendo escondidos" |
| `followGuardEnabled` | false | sem mudança |
| `channelMinIntervalSec`, `channelBurstCap`, `channelBurstWindowSec`, `channelThrottleEnabled`, `channelQuietHoursJson`, `quietHoursEnabled` | — | já dormentes; continuam |

### `User`
`plan`, `accessExpiresAt` — lidos por `canUseAdvancedPreservation` (fonte única,
R5). Controla só tela e gravação, nunca o que o robô usa (FR-019).

### `MessageLog`
Sem mudança de schema. Envio adiado pelo intervalo entre destinos volta a
`status='queued'` com `errorMsg` leigo (motivo `destination_spacing`), como já
acontece com os outros adiamentos. `enqueuedAt` do job é preservado → o tempo de
espera conta para o descarte por idade (`queueMaxAgeMin`).

## Conceitos novos (só em código, puros)

### Piso anti-banimento — `src/core/antiBanFloor.js`

```text
ANTI_BAN_FLOOR = {
  burstCap:        6      (menor é mais conservador)
  burstWindowSec:  600    (maior é mais conservador)
  throttleEnabled: true   (ligado; desligado → recomeça do padrão do sistema)
}
```

Funções (contrato em `contracts/anti-ban-floor.md`): `applyDestinationFloor`,
`describeDestinationFloor`, `isAntiBanFloorEnabled`. **Não há mais**
`applyAccountFloor`/`describeAccountFloor` nem campo de conta no piso.

Regras:
- comparação **campo a campo**, nunca pela taxa combinada;
- valor igual ao piso = nada muda, sem etiqueta;
- `null`/não numérico num campo já resolvido → valor do piso (fail-safe);
- `ritmoMaisCuidadoso` só quando os limites estavam ligados **e** algum dos três
  campos gravados é estritamente mais conservador;
- piso desligado por env → entrada inalterada.

### Intervalo entre destinos — `src/core/destinationSpacing.js`

Estado **em memória do worker** (um por conta; não persistido; zera no restart):

```text
SpacingState = {
  lastSendAt:     number|null   // ms do último envio liberado para QUALQUER destino
  lastDestJid:    string|null   // destino desse envio
  nextFreeSlotAt: number|null   // cursor: próxima vaga livre já prometida a um job adiado
}
```

Regras (contrato em `contracts/destination-spacing.md`):
- aplica entre envios consecutivos para destinos **diferentes**; mesmo destino é
  isento (quem manda é `minIntervalSec`);
- espera = `max(lastSendAt + intervalo, nextFreeSlotAt) − agora`, fixa;
- combinação com o gate do destino: **vale a maior espera**; `allow` só se ambos
  liberam; a reserva do destino só acontece quando a decisão combinada libera;
- qualquer espera vinda do espaçamento → adiamento (`deferSendJob`/`notBefore`),
  nunca `sleep` no consumidor;
- intervalo 0 ou `DESTINATION_SPACING=off` → sempre libera.

## Transições de estado (acesso por plano, FR-019)

```text
com acesso ──(plano vence / vira Basic)──▶ sem acesso
  tela: editável                          tela: bloqueada com selo PRO (FR-017)
  API PUT: grava                          API PUT: 402/403 leigo, nada gravado
  robô: gravado + piso + intervalo        robô: gravado + piso + intervalo  (inalterado)
sem acesso ──(volta a assinar)──▶ com acesso: reencontra os mesmos valores
```

Defesas de conta que já dependem de plano (variação de imagem, vigia de
seguidas, observador, variação de texto) seguem gated como hoje
(`preservationActive`). O intervalo entre destinos **não** é gated no robô.
