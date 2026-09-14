# Fila de revisão das ofertas automáticas — especificação técnica

**Status:** proposta, sem implementação
**Data:** 2026-09-13
**Objetivo:** permitir que a cliente veja e descarte produtos antes da
publicação, preservando integralmente o envio automático que já funciona.

O plano executável, dividido em sprints e issues com gates de não regressão,
está em
`docs/superpowers/plans/2026-09-13-fila-revisao-ofertas-automaticas.md`.

## 1. Problema observado

Hoje uma automação busca produtos quando vence o seu intervalo e, na mesma
execução, monta a mensagem e publica nos destinos. A tela oferece uma busca de
prévia, mas essa prévia é pontual: ela não é a lista real que será publicada,
não fica salva e não permite aprovar ou remover itens futuros.

Isso deixa a cliente sem controle sobre dois casos comuns:

- o produto é tecnicamente elegível, mas não é relevante para o público dela;
- produtos muito parecidos ainda parecem repetidos para uma pessoa, mesmo
  depois das deduplicações automáticas por item, produto, grupo e preço.

O pedido não é transformar o recurso em operação totalmente manual. A cliente
quer continuar dizendo o que procura e deixar o sistema garimpar, mas quer uma
**mesa de revisão antes do envio**.

## 2. Decisão de produto

Adicionar à automação um modo de publicação explícito:

1. **Publicar automaticamente** — comportamento atual, permanece como padrão.
2. **Revisar antes de publicar** — o garimpo abastece uma fila própria; somente
   itens aprovados podem ser publicados.

O modo atual precisa continuar sendo o default tanto para automações existentes
quanto para novas automações durante o rollout inicial. Assim, migration,
deploy ou ativação da feature não mudam cadência, conteúdo ou destinos de
ninguém.

### Experiência recomendada para a primeira versão

- A cliente ativa “Quero revisar antes de publicar” em uma automação.
- O sistema busca e prepara ofertas **antes** de precisar enviá-las.
- A tela da automação mostra contadores: `Aguardando revisão`, `Aprovadas` e
  `Enviadas`.
- Cada card mostra exatamente a foto e o texto congelados para publicação,
  preço, desconto, vendidos, loja, destino e previsão de envio.
- Ações por item: **Aprovar**, **Remover** e **Abrir produto**.
- Ações em lote: **Aprovar selecionadas** e **Remover selecionadas**.
- Itens aprovados saem automaticamente na cadência já configurada. A aprovação
  não significa “enviar agora”.
- Sem aprovação, nada é publicado. A interface deixa isso explícito: “A fila
  está esperando sua revisão”.
- A cliente pode repor candidatos com “Buscar mais ofertas”, com limite e
  cooldown para não pressionar a API da Shopee.

Editar texto, reordenar cards, aprovação automática por prazo e filtros
aprendidos ficam fora do MVP. Eles aumentam bastante os estados e podem ser
decididos depois de medir o uso real de aprovar/remover.

## 3. O ponto mais importante: separar garimpo de publicação

No modo atual, o `lastSentAt` controla quando uma automação está pronta para
rodar. No modo revisado passam a existir dois relógios diferentes:

- **`lastDiscoveryAt`**: quando o sistema buscou candidatos;
- **`lastSentAt`**: quando uma oferta aprovada foi efetivamente aceita pelos
  canais de entrega.

Usar `lastSentAt` para os dois criaria um loop: enquanto a cliente não aprova,
a automação pareceria permanentemente vencida e buscaria ofertas a cada tick.
Atualizar `lastSentAt` ao apenas gerar a fila também seria incorreto, pois a
tela e os limites passariam a afirmar que houve envio sem ter havido.

Portanto, a execução revisada deve ser uma máquina com dois passos independentes:

```text
cron de descoberta -> busca/dedup/formatação -> item awaiting_review
                                               |
cliente aprova --------------------------------+-> item approved
                                                    |
cron de entrega + cadência atual ------------------> sending -> sent
                                                               -> approved (retry)
                                                               -> failed (terminal)
```

## 4. Modelo de dados proposto

### 4.1 Mudança aditiva em `OfferAutomation`

| Campo | Tipo | Default | Uso |
|---|---|---:|---|
| `publicationMode` | `String` | `direct` | `direct` preserva o fluxo atual; `review` ativa a fila |
| `lastDiscoveryAt` | `DateTime?` | `null` | relógio da reposição da fila |
| `reviewTargetSize` | `Int` | `10` | quantidade desejada de itens aguardando/aprovados |

O domínio deve aceitar apenas `direct` e `review`, mesmo que o SQLite não
imponha enum. `reviewTargetSize` deve ter teto pequeno (sugestão: 30) e limite
global por usuário para evitar crescimento acidental.

### 4.2 Nova tabela `OfferAutomationReviewItem`

Não reutilizar `OfferQueueItem` diretamente. A fila manual existente é um
produto com configurações próprias de destino, intervalo, limites e fallback
legado para grupos. Acoplar os dois faria uma automação herdar duas fontes de
cadência e permitiria apagar ou reconfigurar sua infraestrutura pela tela de
Filas. Podemos extrair e compartilhar primitivas de claim/retry, mas não a
entidade de negócio.

Campos mínimos:

| Campo | Finalidade |
|---|---|
| `id`, `automationId`, `userId` | identidade e isolamento por tenant |
| `status` | `awaiting_review`, `approved`, `sending`, `sent`, `removed`, `expired`, `failed` |
| `productKey`, `itemId`, `priceCents` | deduplicação e auditoria |
| `productUrl`, `imageUrl`, `imageRefererUrl` | snapshot necessário ao envio |
| `productSnapshot` | JSON com título, preço anterior, desconto, nota, vendidos e loja |
| `renderedText` | mensagem exata congelada no momento do garimpo |
| `targetSnapshot` | JSON dos destinos válidos no momento da geração |
| `position` | ordem estável da fila |
| `discoveredAt`, `reviewedAt`, `reviewedAction`, `sentAt` | histórico da decisão |
| `claimedAt`, `attemptCount`, `nextAttemptAt`, `lastError` | lease e retry seguro |
| `expiresAt` | impede publicar oferta/preço antigo depois de longa espera |

Índices recomendados:

- `(automationId, status, position)` para tela e próximo envio;
- `(userId, status, createdAt)` para limite, suporte e limpeza;
- `(automationId, productKey, priceCents)` para impedir duplicata viva;
- índice parcial não existe no SQLite usado pelo projeto; a unicidade entre
  estados vivos deve ser garantida por transação/claim no serviço.

`userId` é redundante de propósito: todas as mutações devem usar
`id + automationId + userId`, como proteção de tenant e padrão já adotado nas
filas existentes.

## 5. Serviços e responsabilidades

### 5.1 Extração sem mudar o comportamento atual

Antes de introduzir a fila, dividir conceitualmente o dispatcher atual em
funções testáveis:

1. `discoverCandidates(automation)` — credencial, paginação, filtros e dedup;
2. `materializeCandidate(automation, offer)` — template, variação, snapshot e
   identidade;
3. `deliverCandidate(automation, candidate)` — WhatsApp/Instagram, logs e
   resultado por canal.

`runAutomation()` continua chamando as três em sequência no modo `direct`.
Essa compatibilidade deve ter testes de caracterização antes da refatoração:
mesmos parâmetros Shopee, mesma copy, imagem, destinos, `sentItemIds`, página,
dedup cruzada e tratamento de falha parcial.

### 5.2 Descoberta no modo `review`

Um `reviewDiscoveryService`:

1. verifica plano e credencial como hoje;
2. calcula quantas vagas faltam até `reviewTargetSize` considerando
   `awaiting_review` + `approved`;
3. busca somente o necessário, com o mesmo teto de candidatos e rotação atual;
4. aplica a dedup existente **e** exclui produtos vivos ou recentemente
   removidos na própria fila;
5. congela texto, mídia, preço e destinos em uma transação;
6. avança `page` e atualiza `lastDiscoveryAt`, nunca `lastSentAt` nem
   `sentItemIds`;
7. não chama `sendBroadcast` nem o runtime do Instagram.

Produto removido não deve reaparecer imediatamente. Sugestão: conservar a linha
`removed` por sete dias para a dedup de revisão e depois limpá-la. Isso resolve
o relato de “apaguei e voltou” sem transformar uma rejeição pontual em bloqueio
eterno.

### 5.3 Aprovação e remoção

As transições precisam ser condicionais e idempotentes:

- aprovar: `awaiting_review -> approved`;
- remover: `awaiting_review|approved -> removed`;
- uma segunda chamada devolve o estado atual, sem erro destrutivo;
- `sending`, `sent`, `failed` e `expired` não podem ser removidos como se ainda
  estivessem aguardando;
- toda query inclui `userId` e `automationId`.

Se a automação for pausada, a fila permanece visível, mas descoberta e entrega
param. Se for excluída, o `onDelete: Cascade` remove a fila. Se o plano vencer,
listar e remover continuam permitidos, mas descobrir, aprovar e enviar ficam
bloqueados, seguindo os gates atuais.

### 5.4 Entrega aprovada

Um `reviewDeliveryService` seleciona apenas `approved`, por `position`, e faz
claim atômico `approved -> sending`. Deve reutilizar o padrão já comprovado na
fila manual: trava em memória por automação, lease, tentativas com backoff e
recuperação de itens presos.

A cadência continua pertencendo à automação:

- no máximo `offersPerSend` aprovadas por execução vencida;
- intervalo e horário diário continuam com a semântica atual;
- a aprovação não burla horário, preservação, plano ou disponibilidade do bot;
- o snapshot de destinos evita que uma edição concorrente mande o item para um
  local que a cliente não viu. Alternativamente, uma mudança de destino pode
  expirar os itens ainda não enviados e pedir nova revisão; essa é a opção mais
  segura e recomendada;
- `sentItemIds`, `OfferAutomationSentLog` e `lastSentAt` só avançam quando o
  canal correspondente aceita a entrega, como no fluxo atual;
- Instagram mantém a idempotência por automação + destino + item de revisão.

Falha transitória volta para `approved` com `nextAttemptAt`; ao esgotar as
tentativas vira `failed`, permanece visível e oferece “Tentar novamente”. O
watchdog deve recuperar `sending` com lease expirada após restart.

## 6. API proposta

Rotas sob `/api/offer-automations/:id/review-items`, sempre autenticadas e com
ownership da automação:

| Método | Rota | Comportamento |
|---|---|---|
| `GET` | `/review-items?status=awaiting_review,approved&cursor=...` | lista paginada e contadores |
| `POST` | `/discover` | busca mais itens, com idempotência/cooldown |
| `POST` | `/:itemId/approve` | aprova um item |
| `POST` | `/:itemId/remove` | remove um item |
| `POST` | `/bulk-approve` | aprova IDs selecionados, com teto |
| `POST` | `/bulk-remove` | remove IDs selecionados, com teto |
| `POST` | `/:itemId/retry` | devolve falha terminal para `approved` |

O `PUT /api/offer-automations/:id` ganha `publicationMode` e
`reviewTargetSize`. A listagem de automações ganha apenas contadores agregados;
os cards completos vêm da rota paginada para não aumentar memória/resposta em
todas as visitas.

Não criar endpoint de “enviar agora” no MVP. Ele mistura aprovação com bypass
de cadência e reabre riscos de rajada/ban que o pipeline atual evita.

## 7. Interface

Manter a configuração na página **Ofertas automáticas**, em vez de mandar a
cliente para a página genérica **Filas**. O modelo mental é “o robô encontrou
estas ofertas”, não “eu criei mensagens numa fila manual”.

### No formulário

- seção “Como publicar” com as duas opções;
- ao escolher revisão: explicar “O bot prepara as ofertas, mas só publica as
  que você aprovar”;
- seletor simples de estoque desejado: 5, 10 ou 20 itens;
- aviso de que preço e disponibilidade podem mudar e itens vencem.

### No card da automação

- badge `Publicação automática` ou `Revisão ligada`;
- `N para revisar` como chamada principal;
- `N aprovadas` e próxima janela de envio;
- estado vazio instrutivo: buscando, sem resultados, fila cheia de aprovadas ou
  esperando a primeira busca;
- alerta persistente se a fila não tem aprovadas perto do próximo horário.

### No card da oferta

Usar a mensagem já renderizada, não remontá-la no navegador. Assim a prévia é
fiel ao que será enviado. Mostrar também um carimbo “Preparada há X” e
“Válida até ...”. No celular, ações ficam sempre acessíveis e a seleção em lote
não depende de hover.

## 8. Compatibilidade e rollout sem impacto

### Fase 0 — observação

- medir quantas automações rodam, quantos itens encontram e quantos são
  filtrados;
- registrar o tempo da busca e o tamanho típico dos lotes;
- nenhuma mudança funcional.

### Fase 1 — infraestrutura desligada

- migration somente aditiva, com `publicationMode='direct'`;
- tabela nova e serviços puros, protegidos por `OFFER_AUTOMATION_REVIEW_ENABLED`;
- testes de caracterização do dispatcher atual;
- nenhum cron novo: estender o tick existente reduz concorrência e operação.

### Fase 2 — piloto em staging e contas permitidas

- flag global + allowlist por usuário;
- a opção nem aparece fora da allowlist;
- validar primeiro com uma automação e um destino de teste;
- kill switch desliga **descoberta e entrega revisada**, sem tocar no modo
  `direct`;
- voltar uma automação de `review` para `direct` exige confirmação e mantém os
  itens revisados arquivados; nunca os envia de surpresa.

### Fase 3 — liberação opt-in

- continuar com `direct` como default;
- liberar revisão para clientes Pro/Trial;
- acompanhar remoção, aprovação, expiração, falha e tamanho de fila;
- só discutir tornar revisão padrão depois de dados e entrevistas.

### Rollback

Desligar a flag interrompe apenas os dois ramos novos. Automações `direct`
continuam no dispatcher antigo. Automações `review` ficam pausadas com itens
preservados e mensagem clara na interface; elas **não** devem cair
automaticamente para `direct`, pois isso publicaria conteúdo não aprovado.

## 9. Concorrência, segurança e custo

- Um tick não pode descobrir e entregar a mesma automação em paralelo; claims
  no banco são a fonte de verdade, a trava em memória é só otimização.
- Aprovar enquanto o worker tenta claim deve produzir exatamente uma transição.
- Nenhum item é enviado diretamente a partir do payload do navegador; a API
  carrega o snapshot pertencente ao usuário.
- Links e imagens passam pelas mesmas validações e pipeline existentes.
- A busca manual precisa de cooldown e limite por usuário; nunca aceitar número
  arbitrário de páginas ou itens.
- Lista sempre paginada e com seleção limitada; não carregar histórico inteiro.
- Job diário remove `sent`, `removed` e `expired` antigos conforme retenção
  documentada. Pode rodar dentro do processo atual; nenhum processo PM2 novo.
- A nova tabela entra na exportação/eliminação LGPD antes do rollout.

## 10. Observabilidade

Eventos sugeridos, sem título/texto/URL do produto para evitar conteúdo e dado
comercial desnecessários:

- `offer_review_discovered` — automação, quantidade e duração;
- `offer_review_approved` / `offer_review_removed` — individual ou lote;
- `offer_review_expired`;
- `offer_review_delivery_succeeded` / `offer_review_delivery_failed`;
- `offer_review_empty_at_due_time` — automação chegou à hora sem aprovação.

Métricas operacionais: filas por estado, idade do item mais antigo, taxa de
remoção, tempo mediano até aprovação, expiração, retries e falha por canal.
Logs técnicos usam IDs e códigos; a tela traduz falhas para linguagem leiga.

## 11. Critérios de aceite

### Preservação do que existe

1. Toda automação antiga segue em `direct` após migration e publica exatamente
   como antes.
2. Com a flag desligada, nenhum item de revisão é criado ou enviado.
3. `direct` mantém paginação, dedup, template, variação, imagem, destinos,
   retry parcial e logs atuais.
4. Nenhuma mudança exige reiniciar ou separar novos processos PM2.

### Revisão

1. No modo `review`, descobrir nunca chama nenhum canal de entrega.
2. Item não aprovado nunca é publicado.
3. Item removido não é publicado nem reaparece durante a janela de rejeição.
4. A prévia exibe o mesmo `renderedText` e mídia consumidos pelo dispatcher.
5. Aprovados respeitam intervalo, horário, destinos, plano e controles de
   preservação existentes.
6. Duplo clique, duas abas ou dois ticks não enviam o mesmo item duas vezes.
7. Restart entre claim e envio recupera o item pelo lease.
8. Mudança de destinos não envia snapshot já aprovado para destino invisível à
   cliente; itens são expirados e precisam ser regerados/revisados.
9. Sem aprovados, a automação não atualiza `lastSentAt` e informa claramente o
   motivo de não haver publicação.
10. Mobile permite visualizar, selecionar, aprovar e remover sem conteúdo fora
    da tela.

## 12. Matriz mínima de testes antes do piloto

- testes puros da máquina de estados e transições inválidas;
- caracterização completa do modo `direct` antes/depois da extração;
- descoberta com credencial ausente/inválida, API vazia, filtros e paginação;
- dedup entre fila viva, rejeitados recentes, `sentItemIds` e log por grupo;
- isolamento entre dois usuários e IDs forjados;
- concorrência: dupla aprovação, duplo claim, delete durante claim e dois ticks;
- relógios separados (`lastDiscoveryAt` versus `lastSentAt`), inclusive horário
  diário em `America/Sao_Paulo`;
- WhatsApp offline, Instagram indisponível e sucesso parcial por canal;
- retry, backoff, lease expirada, falha terminal e retry manual;
- downgrade de plano, automação pausada/excluída, feature flag e rollback;
- responsividade e acessibilidade da revisão em 375 px;
- exportação e exclusão LGPD da nova entidade.

## 13. Decisões a validar com clientes antes de implementar

1. Elas preferem aprovar individualmente ou “aprovar tudo e remover exceções”?
2. Quanto tempo precisam entre a geração e a publicação: horas, um dia, ou uma
   semana?
3. Dez candidatos por automação são suficientes?
4. Ao editar destinos/template, preferem invalidar pendências ou ver uma nova
   prévia e reconfirmar?
5. Querem remover só este preço/oferta ou nunca mais ver aquele produto?

As respostas não bloqueiam o núcleo técnico. O desenho acima usa as opções mais
conservadoras: aprovação explícita, snapshot imutável, expiração e nenhuma
queda automática para envio direto.

## 14. Ordem recomendada de implementação futura

1. Testes de caracterização e extração das funções do dispatcher, sem UI.
2. Migration aditiva, estado puro e repositório da fila.
3. Descoberta sob flag, sem entrega.
4. API de listagem/aprovação/remoção e UI somente leitura, depois ações.
5. Entrega com claim/lease/retry sob segunda flag.
6. Staging com conta e grupo controlados; testar restart e concorrência.
7. Piloto allowlisted, métricas por pelo menos uma semana.
8. Liberação opt-in mantendo `direct` como padrão.

Essa ordem cria pontos de parada seguros: em todas as etapas anteriores à
entrega revisada, o pior resultado possível é uma fila que pode ser vista mas
não publica; o fluxo existente continua independente.
