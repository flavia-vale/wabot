# Auditoria de Delay Antiban

## Diagnóstico atual

A rotina de espera base usa `sleep(ms)` com `setTimeout`, portanto é assíncrona e não bloqueia o event loop do Node.js, mas o job que ocupa o slot da fila permanece aguardando até o fim do delay. A fila de envios em memória é sequencial (`processing`) e possui limite por `SEND_QUEUE_MAX_SIZE`, rejeitando novos jobs quando a fila atinge o máximo configurado.

Antes desta correção, os campos `delayMin` e `delayMax` eram carregados da configuração, mas os envios automáticos de links convertidos chamavam `sendMessage`/`relayMessage` diretamente dentro do processamento da mensagem recebida. Broadcasts e mensagens agendadas eram enfileirados, porém com `delayMs: 0`. Na prática, o delay configurado pelo usuário não era aplicado aos principais caminhos de envio.

## Protocolo de teste realizado

Foram adicionados testes unitários para validar o núcleo do Smart Delay:

- Jitter inclusivo entre `delayMin` e `delayMax`, por exemplo 27s a 35s.
- Normalização de range invertido e range zerado.
- Delay progressivo quando a fila cruza o limiar configurado.
- Janela de descanso em múltiplos de envio configurados.
- Estimativa de tempo de “digitando...” limitada por mínimo e máximo.

## Proposta implementada de Delay Inteligente

A nova lógica calcula um delay randômico por job usando `delayMin`/`delayMax`, adiciona incremento progressivo conforme pressão da fila e permite uma janela de descanso via variáveis de ambiente:

- `SMART_DELAY_PROGRESSIVE_THRESHOLD` controla a partir de quantos jobs pendentes o acréscimo progressivo começa.
- `SMART_DELAY_PROGRESSIVE_STEP_MS` define o acréscimo por faixa de pressão.
- `SMART_DELAY_PROGRESSIVE_MAX_EXTRA_MS` limita o acréscimo progressivo.
- `SMART_DELAY_REST_EVERY` e `SMART_DELAY_REST_MS` ativam pausas periódicas após um número de envios bem-sucedidos.
- `SMART_DELAY_TYPING_ENABLED`, `SMART_DELAY_TYPING_MIN_MS`, `SMART_DELAY_TYPING_MAX_MS` e `SMART_DELAY_TYPING_CHARS_PER_SECOND` controlam a simulação de presença `composing` antes do envio.

## Mecanismo de segurança contra acúmulo

A fila em memória permanece limitada por `SEND_QUEUE_MAX_SIZE`; se o volume de entrada exceder a vazão causada por delays longos, novos jobs são rejeitados e marcados como erro no log, em vez de crescer indefinidamente até estouro de memória. Para múltiplas conexões/usuários, cada worker mantém sua própria fila e seu próprio limite. Para produção com alto volume, a recomendação é transformar os jobs em payloads serializáveis antes de usar backend persistente distribuído.
