# Contrato: caixa de saída e drenagem

**Feature**: 017 | **Tabela**: `DeliveryOutbox` (ver `data-model.md` §3.1)

## Quem escreve

| Origem da linha | Quem escreve | Observação |
|---|---|---|
| Espelhamento de origem de WhatsApp → destino de outra rede | `src/bot-worker.js`, no ponto em que o destino vira job | **Única** mudança funcional de worker da feature. Inalcançável com o interruptor no default. |
| Fila de ofertas / oferta automática / mensagem agendada → destino de outra rede | os dispatchers, que já rodam fora do worker | Nenhuma mudança de worker. |
| Origem de Telegram → destino de Telegram | `src/delivery/telegram/reader.js` | Fora do worker. |

Origem de Telegram → destino de **WhatsApp** **não** passa pela caixa: usa `sendBroadcast`, o caminho que os dispatchers já usam (ver `research.md` R0.3).

## Quem drena

`startDeliveryOutboxSweep()` — `setInterval` + `unref()` dentro do processo `api`, single-flight. **Não inicia** se a rede não estiver habilitada ou se o segredo do robô estiver ausente (fail-safe silencioso, no padrão do motor de e-mails sem SMTP).

## Ordem canônica de cada tick (não reordenar)

Espelha a ordem já canônica de `processSendJob` no worker, pelas mesmas razões:

1. **Selecionar** as linhas `pending` com `notBeforeAt` vencido.
2. **Repartir com justiça** entre contas (`fairShare.js`) sob o orçamento global.
3. **Descartar por idade** (`shouldDropExpiredQueueJob`) — antes de qualquer espera, porque não faz sentido segurar uma linha para depois jogá-la fora.
4. **Revalidar o destino**: ainda ligado à origem? plano ainda dá direito? rede ainda habilitada? Se não, `dropped` com motivo próprio.
5. **Degradar** pela capacidade da rede e registrar as reduções.
6. **Enviar** pelo adaptador, com isolamento por item.
7. **Gravar** resultado no `MessageLog` (sucesso, reduções ou motivo próprio).

## Invariantes

- **Adiar nunca é descartar.** Estouro de orçamento ou limite do aplicativo → `notBeforeAt` no futuro, `status` continua `pending` (FR-040).
- **Falha de um item não aborta o lote** nem apaga o progresso já gravado (FR-024).
- **Nenhuma linha vira "entregue" sem entrega.**
- **Robô indisponível** não consome tentativa em massa: o tick para cedo e registra o estado uma vez (evita transformar uma falha em rajada de tentativa e de aviso).
- **Poda por idade** de `done`/`dropped` no mesmo tick — sem ela a tabela cresce sem limite.
