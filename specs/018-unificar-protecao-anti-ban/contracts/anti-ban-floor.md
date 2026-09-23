# Contrato — módulo puro `src/core/antiBanFloor.js`

Ponto ÚNICO da regra "vale o mais conservador entre o gravado e o fixo"
(spec FR-011/FR-013). Sem banco, sem rede, sem env lida no topo do módulo
(env entra por parâmetro, para teste). Consumidores permitidos:

| Consumidor | Uso |
|---|---|
| `src/core/preservationConfig.js` → `resolveDestinationPreservation` | aplica `applyDestinationFloor` no retorno (único caminho do robô para destino) |
| `src/bot-worker.js` → `getConfig()` | aplica `applyAccountFloor` no `botConfig` carregado (único caminho do robô para conta) |
| `src/api/routes/preservation.js` (GET `/config`, `/presets`, `/destinations`) | `describe*` para a etiqueta de R6 e valor efetivo |
| `scripts/diag-antiban-valores.mjs` | medir impacto (import, nunca cópia) |

Nenhum outro arquivo pode comparar `burstCap`/`burstWindowSec`/`throttleEnabled`/
`channelStaggerJitterMs` contra o fixo. Guarda estrutural no teste.

## Exports

```text
ANTI_BAN_FLOOR : frozen { burstCap: 6, burstWindowSec: 600, throttleEnabled: true, channelStaggerJitterMs: 20000 }

isAntiBanFloorEnabled(env = process.env) : boolean
  false somente se env.ANTI_BAN_FLOOR === 'off'

applyDestinationFloor(effective, { enabled } = {}) : object
  entrada: config efetiva já resolvida (formato de resolveDestinationPreservation)
  saída: nova cópia; burstCap=min(v,6), burstWindowSec=max(v,600), throttleEnabled=true
  demais campos idênticos; não muta a entrada; enabled=false → cópia inalterada

applyAccountFloor(botConfig, { enabled } = {}) : object
  saída: nova cópia; channelStaggerJitterMs = max(v, 20000); resto idêntico

describeDestinationFloor(stored) : { ritmoMaisCuidadoso: boolean, camposNoPiso: string[] }
describeAccountFloor(botConfig)  : { ritmoMaisCuidadoso: boolean, camposNoPiso: string[] }
  stored = valores GRAVADOS (override ou modelo); null/undefined = herdando → ignorado
```

## Tabela de verdade mínima (vira teste)

| Entrada | Saída efetiva | ritmoMaisCuidadoso |
|---|---|---|
| burstCap 6, window 600, throttle true | 6 / 600 / true | false |
| burstCap 3 | 3 | true |
| burstCap 10 | 6 | false (camposNoPiso: burstCap) |
| window 3600 | 3600 | true |
| window 120 | 600 | false |
| throttle false | true | false (camposNoPiso: throttleEnabled) |
| "Leve" 10 / 3600 | 6 / 3600 | true (mais lento que o fixo — Achado B) |
| stagger 0 | 20000 | false |
| stagger 60000 | 60000 | true |
| burstCap null (herda) após resolver | valor do modelo com piso | — |
| enabled=false | entrada inalterada | — |
