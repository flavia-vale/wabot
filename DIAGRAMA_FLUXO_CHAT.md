# Diagrama Visual: Fluxos de Chat Mobile

## 1. Arquitetura em Camadas

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MOBILE CLIENT                                 │
│  /m/conversa → SessionList + ChatThreadView + ChatInput             │
│  • CSS v2 Design System (--ink, --surface, --accent)                │
│  • WebSocket listener para eventos em tempo real                    │
│  • React hooks: useState, useRef, useEffect                         │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ↓              ↓              ↓
         HTTP Sync   │  WebSocket   │  WebSocket
         (1 req)     │  (bidir)     │  (listen)
                    │              │
        ┌────────────┴─────────────┴──────────────┐
        │         FASTIFY API (Node.js)           │
        │                                          │
        │  POST /api/chat/send                    │
        │  GET  /api/chat/history                 │
        │  GET  /api/chat/sessions                │
        │  WS   /api/chat/stream                  │
        │  (todos com middleware JWT)             │
        └────────────┬─────────────────────────────┘
                     │
        ┌────────────┴──────────────┐
        ↓                           ↓
    [Prisma]                  [Redis pub/sub]
    MessageLog              user:${userId}:chat*
    SessionMetadata         (eventos em vôo)
        │                           │
        ↓                           ↓
    [SQLite]                    [Redis Server]
    (persistência)              (cache + filas)
        │                           │
        └────────────┬──────────────┘
                     ↓
        ┌────────────────────────────┐
        │   BOT-SUPERVISOR / WORKER   │
        │                            │
        │  Baileys Session (libsignal)
        │  • handleIncomingMessage() │
        │  • sendMessage()           │
        │  • emit events             │
        └────────────┬───────────────┘
                     ↓
        ┌────────────────────────────┐
        │   WHATSAPP OFFICIAL        │
        │   • WebSocket protocol     │
        │   • Signal encryption      │
        │   • QR pairing             │
        └────────────────────────────┘
```

---

## 2. Fluxo 1: Receber Mensagem Incoming

```
User A envia "Oi!" via WhatsApp para bot de User B
         │
         ↓ (via libsignal)
    [Baileys WebSocket]
         │
         ↓ emit('message', msg)
    [bot-worker.js]
         │
         ├─→ Prisma: INSERT MessageLog {
         │   userId: "user-B",
         │   destJid: "5511988888@s.whatsapp.net",
         │   role: "incoming",
         │   text: "Oi!",
         │   status: "success",
         │   sentAt: now()
         │ }
         │
         ├─→ Redis: PUBLISH user:user-B:chat {
         │   type: "new_message",
         │   messageId: "msg-123",
         │   jid: "5511988888@s.whatsapp.net",
         │   text: "Oi!",
         │   role: "incoming"
         │ }
         │
         └─→ API WebSocket listeners:
             • Verificam se cliente está conectado
             • Encaminham evento ao client
                 │
                 ↓
        [Mobile WebSocket onmessage]
                 │
                 ├─→ Atualiza state.messages
                 ├─→ Renderiza <ChatMessage role="incoming" />
                 ├─→ Toca notificação sonora (opcional)
                 └─→ scrollToBottom()

Latência esperada: < 2s (socket + decode + DB + pub/sub)
```

---

## 3. Fluxo 2: Enviar Mensagem Manual (Outgoing)

```
User B digita "Tudo bem!" no mobile e clica "Enviar"
         │
         ↓ POST /api/chat/send
        [API receives]
         │
         ├─→ Validações:
         │   • JWT válido
         │   • User owns sessionId
         │   • jid is valid WA JID
         │   • text length ≤ 4096
         │
         ├─→ Rate limit check:
         │   • ratelimit:chat_send:${sessionId}:${jid}
         │   • Max 1 msg/sec + 100/min
         │
         ├─→ Prisma: INSERT MessageLog {
         │   userId: "user-B",
         │   destJid: "5511988888@s.whatsapp.net",
         │   role: "outgoing",
         │   text: "Tudo bem!",
         │   status: "queued",
         │   sentAt: now()
         │ }
         │
         ├─→ BullMQ/Memory Queue: add({
         │   messageId: "msg-456",
         │   sessionId: "user-B",
         │   jid: "5511988888@s.whatsapp.net",
         │   text: "Tudo bem!"
         │ })
         │
         ├─→ Redis: PUBLISH user:user-B:chat {
         │   type: "message_queued",
         │   messageId: "msg-456"
         │ }
         │
         └─→ API response: { messageId: "msg-456", status: "queued" }
             (Imediato ao client)
                 │
                 ↓ [Mobile]
             • Renderiza message com status='queued'
             • Exibe ícone de "enviando..."
             • Aguarda WebSocket para status update

               [bot-worker dequeue & process]
                 │
                 ├─→ await Baileys.sendMessage({
                 │   to: "5511988888@s.whatsapp.net",
                 │   text: "Tudo bem!"
                 │ })
                 │
                 ├─→ Status: pending → sent → delivered (ackLevel++)
                 │
                 ├─→ Prisma: UPDATE MessageLog SET {
                 │   status: "success",
                 │   ackLevel: 1,
                 │   deliveredAt: now()
                 │ }
                 │
                 ├─→ Redis: PUBLISH user:user-B:chat {
                 │   type: "message_status",
                 │   messageId: "msg-456",
                 │   status: "success",
                 │   ackLevel: 1
                 │ }
                 │
                 └─→ [Mobile WebSocket onmessage]
                     • Atualiza message.status = "success"
                     • Exibe ✓✓ (dois checkmarks)

Latência esperada:
  • POST → response: 50ms
  • response → WebSocket status: 200-2000ms (Baileys round-trip)
```

---

## 4. Fluxo 3: Carregar Histórico (Paginado)

```
User B abre /m/conversa/[sessionId]?jid=5511988888@s.whatsapp.net
         │
         ↓ GET /api/chat/history?limit=50&offset=0
        [API receives]
         │
         ├─→ Validações JWT + ownership
         │
         ├─→ Prisma query:
         │   SELECT * FROM MessageLog
         │   WHERE userId = "user-B"
         │   AND destJid = "5511988888@s.whatsapp.net"
         │   ORDER BY sentAt DESC
         │   LIMIT 50 OFFSET 0
         │
         └─→ Response: {
            "thread": [
              {
                id: "msg-123",
                role: "incoming",
                text: "Oi!",
                sentAt: "2026-05-28T14:48:00Z",
                status: "success"
              },
              {
                id: "msg-456",
                role: "outgoing",
                text: "Tudo bem!",
                sentAt: "2026-05-28T14:48:05Z",
                status: "success",
                ackLevel: 2
              }
            ],
            "hasMore": false
          }
             │
             ↓ [Mobile]
          • setMessages(thread.reverse())
          • Renderiza ChatMessage items
          • Implementa infinite scroll para offset += 50

Latência esperada: 100-300ms (índice SQL + rede)
```

---

## 5. Fluxo 4: WebSocket Keep-Alive

```
[Mobile conecta] GET /api/chat/stream?sessionId=user-B
      │
      ↓
  [API opens WS connection]
      │
      ├─→ Subscreve Redis: "user:user-B:chat*"
      ├─→ Inicia heartbeat timer (60s)
      │
      └─→ Aguarda eventos:
          • new_message
          • message_status
          • session_status
          • user_presence
      
      [Client ping a cada 30s]
           │
           ├─→ { type: "ping" }
           │
           └─→ Server responde { type: "pong" }

      [Inatividade 60s+]
           │
           └─→ Server fecha conexão com code 4002

      [Server error ou disconnect]
           │
           └─→ Client reconecta automaticamente
               (exponential backoff: 1s, 2s, 4s, 8s)

Timeout esperado: 60s
Reconexão esperada: < 10s
```

---

## 6. Integração com Modo Remote (Futuro)

```
[MODO INLINE - Histórico]
API ← fork(bot-worker) ← Baileys
Problema: API restart → cai tudo

[MODO REMOTE - Recomendado para Chat]
bot-supervisor ← fork(bot-worker) ← Baileys
         ↓
    BullMQ
    (worker commands)
         ↓
      API
         ↓
   Mobile WebSocket

Vantagem: API restart ≠ chat down
Mudança necessária: nenhuma no mobile (mesma API)
Mudança em backend: src/manager.js já detecta BOT_SUPERVISOR_MODE=remote
```

---

## 7. Diagrama de Estado: MessageLog.status

```
    ┌─────────────────────────────────────────────────┐
    │ CREATE (POST /api/chat/send)                    │
    └────────────┬────────────────────────────────────┘
                 │
                 ↓
            ┌────────────┐
            │  "queued"  │ ← Esperando bot-worker pegar
            └────┬───────┘
                 │
        ┌────────┴────────┐
        ↓                 ↓
   "success"          "error"
   (msg enviada)      (falha permanente)
   ou "error"
   (timeout)

ou [INCOMING] →
   ┌────────────┐
   │ "success"  │ ← Msg recebida (final)
   └────────────┘

Status final: "success", "error", "skipped"
Status transiente: "queued", "sending" (raro)
```

---

## 8. Estrutura de Mensagem JSON (Wire Format)

### Request: POST /api/chat/send
```json
{
  "sessionId": "user-123",
  "jid": "5511999999999@s.whatsapp.net",
  "text": "Olá!",
  "mediaUrl": null,
  "quotedMessageId": null
}
```

### Response: POST /api/chat/send
```json
{
  "messageId": "msg-abc123",
  "status": "queued",
  "sentAt": "2026-05-28T14:48:00.000Z"
}
```

### WebSocket Event: new_message
```json
{
  "type": "new_message",
  "payload": {
    "id": "msg-abc123",
    "jid": "5511999999999@s.whatsapp.net",
    "role": "incoming|outgoing|system",
    "text": "Olá!",
    "mediaUrl": null,
    "sentAt": "2026-05-28T14:48:00.000Z",
    "status": "success",
    "ackLevel": 1
  }
}
```

### WebSocket Event: message_status
```json
{
  "type": "message_status",
  "payload": {
    "messageId": "msg-abc123",
    "status": "success",
    "ackLevel": 2,
    "deliveredAt": "2026-05-28T14:48:05.000Z"
  }
}
```

---

## 9. Sequência Temporal: Happy Path (5s)

```
t=0ms       User clica "Enviar" em ChatInput
t=0ms       POST /api/chat/send inicia
t=45ms      INSERT MessageLog + BullMQ enqueue → API responds
t=45ms      Mobile renderiza message com status='queued'
t=45ms      bot-worker pega job da fila
t=200ms     Baileys.sendMessage() enviado para WhatsApp
t=600ms     WhatsApp retorna ack level=1 (entregue)
t=605ms     Redis PUBLISH message_status event
t=610ms     Mobile recebe WebSocket message_status
t=610ms     Mobile renderiza ✓✓ (delivered)
────────────────────────────────────────────
Total: ~610ms, percebido pelo user: "rápido demais"
```

---

## 10. Tratamento de Erros: Error Path

```
[User envia message] → [timeout:send:jid]
         │
         └─→ Status: "error"
             errorMsg: "timeout:send:5511999@s.whatsapp.net"
             deliveredAt: null
                  │
                  ↓ [Mobile]
              Renderiza ✗ (red X)
              Tooltip: "Não foi possível enviar. Tentar novamente?"
              Button: [Retry] [Discard]

[Retry path]
    POST /api/chat/send (novo messageId)
    → Cria novo MessageLog
    → Enfileira novamente

[Discard path]
    DELETE /api/chat/message/:messageId
    → Marca como "discarded" ou DELETE
```

---

**Diagrama criado:** 2026-05-28  
**Referência:** ARQUITETURA_MOBILE_CONVERSA.md
