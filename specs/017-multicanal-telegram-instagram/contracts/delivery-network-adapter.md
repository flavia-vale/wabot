# Contrato: adaptador de rede de entrega

**Feature**: 017 | **Consumido por**: `src/core/delivery/networks.js` (registro) e pelos módulos compartilhados.

Este é o contrato que **toda** rede implementa. É o que faz US7/FR-031 ser verificável: uma rede nova é apenas mais uma implementação registrada, e nenhum módulo compartilhado muda.

## Superfície

```js
registerDeliveryNetwork({
  id,                    // 'whatsapp' | 'telegram' | 'instagram' | (teste) 'fake'
  capabilities,          // declaração — ver data-model.md §4.1
  describeDestination(destinationId),   // -> { nome, identificadorExibido }
  isOwnDestination(destinationId),      // -> boolean (reconhece o próprio formato)
  async readiness(userId),              // -> { pronto, motivo, comoResolver }
  async listDestinations(userId),       // -> [{ destinationId, nome, pronto, motivo }]
  async listSources(userId),            // só se capabilities.canReadSource
  async send(ofertaNeutra, destino, ctx),// -> { ok, motivo?, reducoes? }
})
```

## Regras do contrato

1. **O adaptador não decide política.** Ritmo, repetição, roteamento, direito de plano, idade na fila e taxonomia de erro são dos módulos compartilhados. O adaptador só sabe **falar** com o aplicativo.
2. **`send` nunca lança para o chamador.** Devolve `{ ok: false, motivo }` com um motivo da taxonomia. Exceção não tratada aborta lote, e isso é proibido (FR-024).
3. **`readiness` é a única fonte dos três estados** que a cliente lê: não adicionado / adicionado sem permissão / pronto (FR-018). O texto final é montado fora do adaptador, em linguagem leiga.
4. **O adaptador nunca escreve no histórico.** Quem grava é o chamador, para que a linha seja idêntica em forma para todas as redes.
5. **Nenhum segredo sai do adaptador.** Nem em retorno, nem em erro, nem em log (FR-016).
6. **`capabilities` é estático e puro.** Não consulta rede. É o que permite a tela decidir o que oferecer sem nenhuma chamada externa (FR-008).

## Implementação do WhatsApp — restrição especial

`src/delivery/whatsapp/send.js` é a função `sendPreparedPayload` de hoje, **com o corpo inalterado**. Ela mantém as quatro rotas (`relayMessage`; `primary`; `fallbacks`; `sendMessage` default), o `messageId` estável derivado do `logId`, o `stripChannelUnsafeFields` para destino canal e o `withSendTimeout` por tentativa.

O que **não** entra no adaptador e continua exatamente onde está no `bot-worker.js`: injeção do botão "Ver canal", `waitDestinationRateLimit`, atraso de digitação, `lastSendByDest`, atualização do `MessageLog`, preservação e smart delay.

**Guarda**: `test/delivery-whatsapp-send-inalterado.test.js` falha se a forma mudar.

## Rede fictícia (só em teste)

Registrada por `test/helpers/`, **nunca** por código de produção. Declara `singleDestination: true`, `requiresImage: true`, `acceptsButton: false`, `canReadSource: false` — as quatro divergências que o Instagram trará. É a prova executável de SC-009.
