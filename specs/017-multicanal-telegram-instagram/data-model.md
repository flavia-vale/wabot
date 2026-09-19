# Phase 1 — Data Model: arquitetura multicanal de entrega

**Feature**: 017-multicanal-telegram-instagram | **Data**: 2026-09-17

**Princípio inegociável**: **toda** mudança de banco desta feature é **aditiva**. Nenhuma coluna é renomeada, nenhuma é removida, nenhum índice existente é recriado, nenhum dado é reescrito. `Group.waJid`, `OfferAutomation.destGroupJid`, `OfferAutomationSentLog.destGroupJid`, `OfferQueueItem.targetJids`, `ScheduledMessage.targetJids` e `MessageLog.destGroup` continuam com o mesmo nome, o mesmo tipo e o mesmo conteúdo (FR-012).

⚠️ Toda migration de schema desta feature é DDL e cai na pegadinha #8: o deploy para os processos que seguram o SQLite antes do `migrate deploy` e religa depois. O script de deploy já automatiza isso; a única consequência é a janela de indisponibilidade curta e, no modo `remote`, o reinício do supervisor já previsto na Fatia 1.

---

## 1. Entidades conceituais (da spec) → onde vivem

| Entidade da spec | Onde vive | Novo? |
|---|---|---|
| Rede de entrega | `src/core/delivery/networks.js` (constante em código, **não** tabela) | novo, sem banco |
| Declaração de capacidades | idem, ao lado de cada rede | novo, sem banco |
| Destino | `Group` (`role='post'`) + coluna nova `deliveryNetwork` | coluna |
| Origem monitorada | `Group` (`role='monitor'`) + a mesma coluna | coluna |
| Ligação da cliente com a rede | derivada: WhatsApp = `WaSession`; Telegram = presença e permissão do robô, consultadas ao vivo e **cacheadas em memória** | sem tabela |
| Robô do produto no Telegram | variável de ambiente (**segredo de infraestrutura**) + estado derivado em memória | sem tabela |
| Direito de plano ao multicanal | `FEATURE_CODES.MULTI_NETWORK` em `src/billing/plans.js` | sem banco |
| Oferta neutra | `src/core/delivery/neutralOffer.js` (estrutura em memória) | sem banco |
| Registro de envio | `MessageLog` + duas colunas novas | colunas |
| (implícito) fila de entrega fora do WhatsApp | `DeliveryOutbox` | **tabela nova** |
| (implícito) mensagem de origem já vista | `DeliveryInboxSeen` | **tabela nova** |

**Por que a rede NÃO é tabela**: o conjunto de redes é fechado e conhecido em código; a capacidade de cada uma é comportamento, não dado da cliente. Tabela aqui só criaria uma segunda fonte da verdade que pode divergir do código — o modo de falha que este repositório já pagou quando a mesma regra existiu em dois lugares.

**Por que a ligação do Telegram NÃO é tabela**: a verdade é do Telegram ("o robô está no grupo e pode publicar?"), muda sem nos avisar, e qualquer cópia nossa envelhece. Consultar ao vivo com cache curto é honesto; guardar é inventar um estado que pode mentir.

---

## 2. Colunas novas em tabelas existentes

### 2.1 `Group`

```prisma
// Aplicativo por onde este destino publica, ou de onde esta origem lê.
// NULO = WhatsApp (todo grupo gravado até esta feature é WhatsApp).
// Nunca é lido cru: sempre por resolveDeliveryNetwork(), que devolve
// 'whatsapp' para nulo e para valor desconhecido.
deliveryNetwork String?
```

- **Validação**: só valores do registro são aceitos na escrita; leitura tolera qualquer coisa (cai em `whatsapp`).
- **Regra de identificador**: destino/origem de rede que não é WhatsApp grava `waJid` com **prefixo de rede** (`tg:<chatId>`). Como nenhum endereço de WhatsApp tem esse formato, `@@unique([userId, waJid, role])` **continua valendo sem alteração** e R10 é fechado por construção.
- **Transição de estado**: o aplicativo de um destino **não pode ser trocado** depois de criado (US3 cenário 5) — o identificador pertence a um aplicativo só. A rota de edição recusa a troca.

### 2.2 `MessageLog`

```prisma
// Por qual aplicativo este envio saiu. NULO = WhatsApp (linha anterior à
// feature). Não confundir com `platform`, que guarda a LOJA.
deliveryNetwork String?

// O que precisou ser reduzido para caber no aplicativo de destino, em
// códigos separados por vírgula. NULO = nada foi reduzido. Traduzido para
// linguagem leiga só na tela.
deliveryReductions String?
```

- **Sem backfill.** `null` já significa WhatsApp em toda leitura (FR-027/SC-003).
- **Índices**: nenhum novo. O índice `[userId, destGroup, convertedUrl, sentAt]` que sustenta a repetição continua servindo, porque o destino já é namespaceado por rede.

---

## 3. Tabelas novas

### 3.1 `DeliveryOutbox` — a oferta esperando para sair num aplicativo que não é WhatsApp

```prisma
model DeliveryOutbox {
  id              String   @id @default(cuid())
  userId          String
  deliveryNetwork String              // 'telegram' | (futuro) 'instagram'
  destinationId   String              // identificador namespaceado: 'tg:-100...'
  sourceId        String?             // origem, quando veio de espelhamento
  messageLogId    String?             // linha do histórico que esta entrega atualiza
  offerJson       String              // a oferta NEUTRA, serializada
  status          String   @default("pending")  // pending | sending | done | failed | dropped
  attempts        Int      @default(0)
  notBeforeAt     DateTime?           // espera por orçamento/limite do aplicativo
  enqueuedAt      DateTime @default(now())
  lastError       String?             // motivo próprio, já dentro da taxonomia
  updatedAt       DateTime @updatedAt

  @@index([status, notBeforeAt])
  @@index([userId, status])
  @@index([deliveryNetwork, status])
}
```

**Regras que não podem ser afrouxadas:**
- `notBeforeAt` é **adiamento**, nunca descarte (FR-040). Uma linha adiada continua `pending`.
- **Idade** usa `enqueuedAt` e reaproveita `shouldDropExpiredQueueJob` (`src/core/queueExpiry.js`), produzindo `skip:queue_expired` — o mesmo motivo que a cliente já sabe ler. **Sem `enqueuedAt` confiável não descarta** (fail-safe existente: descartar por dúvida perderia oferta legítima).
- **Revalidação no momento de sair**: antes de publicar, confere que o destino ainda está ligado à origem, que o plano ainda dá direito e que a rede ainda está habilitada — mesmo princípio de `shouldDropUnlinkedDestination`, que existe porque um envio saiu 1,5 s depois de a cliente apagar o destino.
- **Falha de um item não aborta o lote** e não apaga o progresso — a lição do RCA de 2026-07-20.
- **Retenção**: linhas `done`/`dropped` são podadas por idade na própria passada. Sem poda, a tabela cresce sem limite (a lição da DLQ, que nunca completa e por isso precisou de poda por idade).

**Por que a oferta neutra é serializada aqui**: a mensagem de origem é efêmera e vive dentro do worker. Se a caixa guardasse só uma referência, uma entrega adiada por horas não teria como ser reconstruída. Guardar a oferta pronta é o que faz "esperar sem se perder" ser verdade.

### 3.2 `DeliveryInboxSeen` — esta mensagem de origem já foi processada

```prisma
model DeliveryInboxSeen {
  id              String   @id @default(cuid())
  deliveryNetwork String
  sourceId        String              // grupo de origem, namespaceado
  messageId       String              // id da mensagem no aplicativo de origem
  seenAt          DateTime @default(now())

  @@unique([deliveryNetwork, sourceId, messageId])
  @@index([seenAt])
}
```

**A gravação acontece ANTES do fan-out.** Colisão na chave única = mensagem já processada, e o processamento para ali. É isto que faz FR-055/SC-016 valerem **mesmo entre processos diferentes** — o que uma janela em memória não garantiria depois de um restart da API.

**Retenção**: poda por idade na mesma passada, com janela folgada (a mensagem reentregue pelo aplicativo pode voltar horas depois).

**Por que não reaproveitar `SendDedupKey`**: aquela tabela guarda a reserva de **envio** por destino, uma etapa depois. A repetição que R16 descreve é de **entrada**, antes de existir qualquer destino — são momentos diferentes do fluxo e misturá-los tornaria as duas regras impossíveis de raciocinar.

---

## 4. Estruturas em memória (sem banco)

### 4.1 Declaração de capacidades da rede (FR-007)

```js
{
  id: 'telegram',
  available: true,              // 'instagram' entra com available:false (FR-034)
  displayName: 'Telegram',      // o que a cliente lê
  acceptsText: true,
  acceptsImage: true,
  requiresImage: false,         // rede fictícia e Instagram: true
  acceptsButton: false,         // botão "Ver canal" é exclusivo do WhatsApp
  acceptsClickableCard: false,
  acceptsVideo: true,
  acceptsWatermark: true,
  singleDestination: false,     // rede fictícia e Instagram: true
  canReadSource: true,          // rede fictícia e Instagram: false
  rateLimits: { globalPerSecond, perDestinationPerMinute },
}
```

**Regra de uso**: todo módulo compartilhado decide lendo esta declaração. `if (rede === 'telegram')` só é legítimo **dentro** de `networks.js` e dentro do adaptador da própria rede. Guarda estrutural de teste varre o resto do código atrás de comparação literal.

### 4.2 Oferta neutra

`{ texto, linkConvertido, imagem: { url, bytes? }, produto: { titulo, preco }, botao?, marca? }`

`degradeFor(oferta, capabilities)` → `{ oferta, reducoes: [códigos] }`. A oferta **sai** na melhor forma possível (FR-009); o que caiu é registrado, nunca silenciado.

### 4.3 Estado do robô único

`{ estado: 'funcionando' | 'limitado' | 'bloqueado' | 'indisponivel' | 'sem_medicao', motivo, desde }`, derivado das últimas respostas. **Sem medição confiável → `sem_medicao`, nunca vermelho.**

---

## 5. Compatibilidade — o que garante que nada quebra

| Garantia | Como |
|---|---|
| Destino antigo sem aplicativo gravado funciona | `deliveryNetwork` nulo → `resolveDeliveryNetwork` → `whatsapp` (FR-013) |
| Registro antigo aparece como WhatsApp no histórico | mesma regra, na leitura do `MessageLog` (FR-027) |
| Identificadores iguais em aplicativos diferentes coexistem | prefixo de rede + índice único inalterado (R10) |
| Nada gravado é recusado | nenhuma restrição nova sobre dado existente |
| Repetição não vaza entre aplicativos | destino namespaceado entra na chave de `buildMirrorDedupKeys` (FR-023/R4) |
| Rebaixamento de plano não apaga nada | o bloqueio é **filtro** em `buildEntitledGroupConfig` e na drenagem; nenhuma linha é removida (FR-049/SC-015) |
| Destino de publicação ("o próprio perfil") cabe | `singleDestination: true` na capacidade e `destinationId` opaco — sem campo vazio forçado (FR-033) |
