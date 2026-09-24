# Contrato — módulo puro `src/core/antiBanFloor.js`

Ponto ÚNICO da regra dos **três** campos fixos (spec FR-011/FR-013): tamanho da
rajada, janela da rajada e liga/desliga dos limites do destino — todos por
destino/modelo. Nenhum campo de conta passa por aqui (o intervalo entre destinos
tem módulo próprio: `destination-spacing.md`; a variação de imagem não muda).
Sem banco, sem rede, sem env lida no topo do módulo (env entra por parâmetro).

| Consumidor | Uso |
|---|---|
| `src/core/preservationConfig.js` → `resolveDestinationPreservation` | aplica `applyDestinationFloor` no retorno (único caminho do robô para destino) |
| `src/api/routes/preservation.js` (GET `/presets`, `/destinations`) | `describeDestinationFloor` para a etiqueta (R6) e valor efetivo |
| `scripts/diag-antiban-valores.mjs` | medir impacto (import, nunca cópia) |

Nenhum outro arquivo pode comparar `burstCap`/`burstWindowSec`/`throttleEnabled`
contra o fixo, nem trocar valores pelo padrão do sistema por causa de limites
desligados. Guarda estrutural no teste. O `getConfig()` do worker **não** é
consumidor (não há campo de conta no piso).

## Exports

```text
ANTI_BAN_FLOOR : frozen { burstCap: 6, burstWindowSec: 600, throttleEnabled: true }

isAntiBanFloorEnabled(env = process.env) : boolean
  false somente se env.ANTI_BAN_FLOOR === 'off'

applyDestinationFloor(effective, { enabled = true, systemDefault = HARD_DEFAULT_PRESERVATION } = {}) : object
  entrada: config efetiva já resolvida (formato de resolveDestinationPreservation)
  se effective.throttleEnabled === false (limites desligados):
    saída: cópia com throttleEnabled=true, minIntervalSec=systemDefault.minIntervalSec,
           dailyCap=systemDefault.dailyCap, burstCap=6, burstWindowSec=600;
           operatingHours* e queueMaxAgeMin intocados
  senão (limites ligados):
    saída: cópia com burstCap=min(v,6), burstWindowSec=max(v,600), throttleEnabled=true;
           demais campos idênticos
  não muta a entrada; enabled=false → cópia inalterada

describeDestinationFloor(stored, { resolvedThrottleEnabled }) :
  { ritmoMaisCuidadoso: boolean, camposNoPiso: string[], recomecouDoPadrao: boolean }
  stored = valores GRAVADOS (override ou modelo); null/undefined = herdando → ignorado
  recomecouDoPadrao = limites efetivos estavam desligados (nunca tem etiqueta)
  ritmoMaisCuidadoso = !recomecouDoPadrao && (burstCap < 6 || burstWindowSec > 600)
  camposNoPiso = campos neutralizados (só diagnóstico e logs, nunca na tela)
```

## Tabela de verdade mínima (vira teste)

| Entrada efetiva | Saída efetiva | ritmoMaisCuidadoso | recomecouDoPadrao |
|---|---|---|---|
| throttle on, 6 / 600 | 6 / 600 / on | false | false |
| throttle on, burstCap 3 | 3 | true | false |
| throttle on, burstCap 10 | 6 | false (camposNoPiso: burstCap) | false |
| throttle on, window 3600 | 3600 | true | false |
| throttle on, window 120 | 600 | false | false |
| "Leve" on, 10 / 3600 | 6 / 3600 | true | false |
| throttle on, minInterval 120, dailyCap 5 | 120 / 5 (inalterados) | false | false |
| **throttle off**, minInterval 300, dailyCap 3, burst 2/3600 | on, **30 / null / 6 / 600** | **false** | **true** |
| throttle off, operatingHours on 9–18, queueMaxAgeMin 60 | horário e 60 mantidos | false | true |
| burstCap null (herda) após resolver | valor do modelo com piso | — | — |
| enabled=false | entrada inalterada | — | — |
