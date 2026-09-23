# Contrato — rotas `/api/preservation/*` e gate de plano

**Nenhuma rota nova, nenhuma rota removida, nenhum campo renomeado.**
Compatibilidade retroativa total.

## Escrita (PUT/POST) — formato inalterado

| Rota | Campo | Comportamento |
|---|---|---|
| `PUT /api/preservation/config` | `channelStaggerJitterMs` ("Intervalo entre destinos") | **editável, sem piso**; aceita 0..600000 como hoje e grava; efeito no envio = espera fixa entre destinos diferentes, por adiamento (FR-022–FR-026). Nenhum nome alternativo aceito |
| `PUT /api/preservation/config` | `imageMutationEnabled`, `maxDailyFollows`, `probeEnabled` etc. | inalterados |
| `POST /presets`, `PUT /presets/:id` | `burstCap`, `burstWindowSec`, `throttleEnabled` (fixos) | aceita e grava; efeito = piso (`contracts/anti-ban-floor.md`), inclusive a exceção "limites desligados → padrão do sistema" |
| `PUT /destinations/:id` | idem (nulável = herdar) | aceita e grava; efeito = piso |

Nenhum campo da mesma requisição é descartado (FR-013). Validação de faixa e
mensagens ficam como estão. A **tela nova** não envia `burstCap`/`burstWindowSec`;
ao salvar um destino/modelo ela envia `throttleEnabled: true` junto dos campos
editáveis (é o caminho normal para um destino que estava com limites desligados
sair da exceção e passar a usar os valores que a cliente acabou de gravar).

## Leitura (GET) — campos ADITIVOS

- `GET /config` → soma `effective: { destinationIntervalSec }` (valor em
  segundos, como a tela mostra). **Sem** `ritmoMaisCuidadoso` de conta (nenhum
  campo de conta tem piso).
- `GET /presets` → cada preset soma `ritmoMaisCuidadoso` e `recomecouDoPadrao`.
- `GET /destinations` → cada destino soma `ritmoMaisCuidadoso`,
  `recomecouDoPadrao` e `effective` (config resolvida com piso).

Campos antigos continuam no payload (cliente antigo não quebra).

## Gate de plano

- Fonte única: `canUseAdvancedPreservation` (`src/billing/plans.js`).
- Códigos HTTP inalterados: `preservation.js` → 402, `config.js`/`groups.js` → 403.
- Corpo (`buildFeatureGateError(ADVANCED_PRESERVATION)`): `code`, `feature`,
  `requiredPlan` inalterados; **`error` muda** para
  `"O Anti-banimento é um recurso do plano PRO."` — sem prometer que não bane.
- O gate controla só gravação/tela; o robô não checa plano para ritmo por
  destino nem para o intervalo entre destinos (FR-019).
