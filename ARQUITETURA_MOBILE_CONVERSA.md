# Arquitetura: Mobile "Conversa" (Chat Interface)
## Integração com Backoffice Existente

**Data:** 2026-05-28  
**Status:** Planejamento Arquitetural  
**Escopo:** Camada de comunicação mobile para sessões WhatsApp ativas

---

## 1. Visão Geral

O módulo "Conversa" (`/m/conversa`) será uma **interface de chat nativa mobile** que permite ao usuário:
- Visualizar mensagens em tempo real de suas sessões WhatsApp
- Enviar respostas manuais a chats específicos
- Monitorar status de entrega/leitura
- Receber notificações de novos textos

Conecta-se ao backoffice existente através de 4 camadas:

```
┌─────────────────────────────────────────────────────────────┐
│ MOBILE CLIENT (Next.js App Router)                          │
│ └─ /m/conversa/page.js (Chat UI, v2 Design System)         │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTP + WebSocket
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ FASTIFY API (src/api/routes/...)                           │
│ └─ POST /api/chat/send     (enviar mensagem)               │
│ └─ GET  /api/chat/stream   (WebSocket para tempo real)     │
│ └─ GET  /api/chat/history  (histórico de conversa)         │
│ └─ GET  /api/sessions      (listar sessões ativas)         │
└──────────────────┬──────────────────────────────────────────┘
                   │ Redis (BullMQ) + Prisma
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ BOT-SUPERVISOR + BOT-WORKERS (src/supervisor/, src/...)    │
│ └─ Sessões WhatsApp ativas (Baileys)                       │
│ └─ Fila de envio (QUEUE_BACKEND=memory|bullmq)             │
│ └─ Eventos em tempo real (Redis pub/sub)                   │
└──────────────────┬──────────────────────────────────────────┘
                   │ Baileys lib
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ WHATSAPP (Servidor oficial)                                │
│ └─ Protocolo Signal + WebSocket                            │
└─────────────────────────────────────────────────────────────┘

Persistência:
├─ SQLite (Prisma) → MessageLog, ConversationThread, SessionMetadata
├─ Redis → Cache de status, eventos em vôo, pub/sub
└─ File system → Logs de bot-worker
```

---

## 2. Fluxo de Dados: Receber Mensagem WhatsApp

```
[WhatsApp → Baileys]
         ↓
[bot-worker.js :: handleIncomingMessage()]
         ↓
[Salva em Prisma: MessageLog { role:'incoming', ... }]
         ↓
[Redis pub/sub: channel="user:${userId}:chat"]
         ↓
[API WebSocket: /api/chat/stream encaminha ao client]
         ↓
[Mobile: recepciona + renderiza em tempo real]
```

**Responsabilidades:**
- **Baileys** (libsignal): recebe bytes criptografados
- **bot-worker**: decodifica, classifica (incoming vs outgoing), persiste
- **Prisma**: MessageLog com `role IN ('incoming','outgoing','system')`
- **Redis pub/sub**: eventos "chat:new_message" → subscribers
- **API**: WebSocket listener na conexão do cliente
- **Mobile**: SSE ou WebSocket client que renderiza

---

## 3. Fluxo de Dados: Enviar Mensagem Manual

```
[Mobile: usuário digita + clica "Enviar"]
         ↓
[POST /api/chat/send { userId, jid, text }]
         ↓
[API: valida JWT, sanitiza, cria MessageLog como 'queued']
         ↓
[BullMQ ou Memory Queue: job de envio]
         ↓
[bot-worker: processa job, chama Baileys.sendMessage()]
         ↓
[Baileys: envia via WebSocket ao WhatsApp oficial]
         ↓
[MessageLog: status='sending' → 'success' ou 'error']
         ↓
[Redis pub/sub: evento "chat:message_status_changed"]
         ↓
[Mobile WebSocket: renderiza ✓ ou ✓✓ ou erro]
```

**Responsabilidades:**
- **Mobile**: validação de campo (não vazio, max length)
- **API**: autenticação, rate-limiting, sanitização
- **Queue**: persistência (memory default, Redis opt-in)
- **bot-worker**: execução real + retry logic + timeout
- **Prisma**: histórico atomicamente consistente

---

## 4. Endpoints da API (Novos ou Existentes)

### 4.1 Listar Sessões Ativas com Chat Aberto

```
GET /api/chat/sessions
Authorization: Bearer <JWT>

Response:
{
  "sessions": [
    {
      "sessionId": "user123",
      "jid": "5511999999999@s.whatsapp.net",
      "displayName": "João Silva",
      "status": "connected|disconnected",
      "unreadCount": 3,
      "lastMessageAt": "2026-05-28T14:48:00Z"
    }
  ]
}
```

**Dados necessários:**
- `sessionId` (FK → SessionMetadata ou User)
- `jid` (contato/grupo no WhatsApp)
- `displayName` (nome do contato ou grupo)
- `status` (online/offline no Baileys)
- `unreadCount` (flag no MessageLog)
- `lastMessageAt` (timestamp mais recente)

**Onde vem:**
- `sessionId`: Prisma User ou SessionMetadata (novo model)
- `jid`: contato já conectado no Baileys
- `displayName`: raspado do WhatsApp ou armazenado no DB
- `status`: Redis cache ou direto do bot-worker via IPC
- `unreadCount`: MessageLog.isRead filter

---

### 4.2 Histórico de Conversa Paginada

```
GET /api/chat/history?sessionId=user123&jid=5511999999999@s.whatsapp.net&limit=50&offset=0
Authorization: Bearer <JWT>

Response:
{
  "thread": [
    {
      "id": "msg-abc123",
      "role": "incoming|outgoing|system",
      "text": "Oi, tudo bem?",
      "sentAt": "2026-05-28T14:48:00Z",
      "status": "success|error|queued",
      "sender": { "name": "João" },
      "mediaUrl": null,
      "errorMsg": null
    }
  ],
  "hasMore": true
}
```

**Dados necessários:**
- MessageLog rows filtradas por `(userId, jid)` + order by sentAt DESC
- Campos: id, role, text, sentAt, status, sender.name, mediaUrl, errorMsg
- Paginação: limit (default 50, max 200) + offset

**Onde vem:**
- Prisma MessageLog table
- Existente no schema: temos `userId`, `destJid` (análogo a `jid`)
- Novo: campo `role` ou usar `status` enum redefinido

---

### 4.3 Enviar Mensagem Manual

```
POST /api/chat/send
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "sessionId": "user123",
  "jid": "5511999999999@s.whatsapp.net",
  "text": "Olá, tudo bem?",
  "mediaUrl": null,
  "quotedMessageId": null
}

Response:
{
  "messageId": "msg-abc123",
  "status": "queued",
  "sentAt": "2026-05-28T14:48:15Z"
}
```

**Fluxo interno:**
1. API valida `sessionId` (JWT scope)
2. API valida `jid` (user owns this session)
3. API cria `MessageLog { userId, destJid: jid, text, role: 'outgoing', status: 'queued' }`
4. API enfileira job em BullMQ/memory com payload
5. Responde imediatamente com `{ messageId, status: 'queued', sentAt }`
6. bot-worker pega o job, envia via Baileys, atualiza `status='success'` ou `'error'`
7. Redis pub/sub dispara evento `chat:message_${messageId}:status_changed`

**Rate limiting:**
- Por sessionId + jid: máx 1 msg/segundo (evita spam)
- Por sessionId: máx 100 msgs/minuto
- Fallback: error 429 com retry-after

---

### 4.4 WebSocket para Chat em Tempo Real

```
GET /api/chat/stream?sessionId=user123
Upgrade: websocket

Events (server → client):
{
  "type": "new_message",
  "payload": {
    "messageId": "msg-abc123",
    "jid": "5511999999999@s.whatsapp.net",
    "role": "incoming",
    "text": "Oi!",
    "sentAt": "2026-05-28T14:48:00Z"
  }
}

{
  "type": "message_status",
  "payload": {
    "messageId": "msg-abc123",
    "status": "success",
    "deliveredAt": "2026-05-28T14:48:05Z"
  }
}

{
  "type": "session_status",
  "payload": {
    "jid": "5511999999999@s.whatsapp.net",
    "status": "connected|disconnected"
  }
}

Client → Server (heartbeat):
{ "type": "ping" }
```

**Implementação:**
- Usar Fastify plugin `@fastify/websocket`
- Subscribe a Redis pub/sub channel `user:${userId}:*`
- Filtrar eventos por `jid` (opcionalmente; ou enviar todos do user)
- Timeout: desconectar se não houver ping 60s

---

## 5. Modelo de Dados (Prisma Schema)

### 5.1 MessageLog (existente, com extensão)

```prisma
model MessageLog {
  id                 String    @id @default(cuid())
  
  userId             String    @db.Text
  destJid            String    @db.Text  // contato/grupo WhatsApp
  
  // Novo: role substitui a lógica implícita de "is_sent"
  role               String    // 'incoming' | 'outgoing' | 'system'
  
  text               String?
  mediaUrl           String?
  mediaType          String?   // 'image' | 'document' | 'audio' | 'video'
  
  // Status durante envio
  status             String    // 'queued' | 'sending' | 'success' | 'error' | 'skipped'
  errorMsg           String?   // prefixo tipo "timeout:send", "error:baileys", etc
  
  // Metadados WhatsApp
  quotedMessageId    String?   // ID da mensagem citada
  ackLevel           Int?      // 0=enviada, 1=entregue, 2=lida
  
  // Timestamps
  sentAt             DateTime  @db.DateTime
  deliveredAt        DateTime? @db.DateTime
  readAt             DateTime? @db.DateTime
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  
  // Índices para chat
  @@index([userId, destJid, sentAt])
  @@index([userId, destJid, status])
}
```

### 5.2 SessionMetadata (novo model)

```prisma
model SessionMetadata {
  id                 String    @id @default(cuid())
  
  userId             String    @db.Text
  jid                String    @db.Text  // contato/grupo
  
  displayName        String?   // nome do contato ou grupo
  profileUrl         String?   // avatar
  isGroup            Boolean   @default(false)
  
  lastMessageAt      DateTime?
  lastMessagePreview String?   // primeiros 100 chars da última mensagem
  
  // Notificações
  isMuted            Boolean   @default(false)
  unreadCount        Int       @default(0)
  
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  
  @@unique([userId, jid])
  @@index([userId, lastMessageAt])
}
```

### 5.3 SessionStatus (em Redis, não persistido)

```
Key: "chat:session:${userId}:${jid}"
Value: JSON {
  "status": "connected|disconnected",
  "lastSeenAt": "2026-05-28T14:48:00Z",
  "typing": false,
  "presenceType": "available|unavailable|composing"
}
```

---

## 6. Rotas Mobile (Next.js)

### 6.1 Estrutura de Pastas

```
dashboard/app/m/conversa/
├─ page.js                      # Chat list + launcher
├─ [sessionId]/
│  └─ page.js                   # Chat thread para um sessionId
└─ components/
   ├─ ChatThreadView.js         # Exibe histórico + WebSocket
   ├─ ChatInput.js              # Campo de digitação + envio
   ├─ ChatMessage.js            # Item da mensagem (incoming/outgoing)
   └─ SessionList.js            # Seletor de sessões abertas
```

### 6.2 Fluxo no /m/conversa

```
┌─ MobileShell (header + nav)
├─ SessionList (WSS: /api/chat/sessions)
│  └─ Ativa: 
│     - Carrega últimas 3 mensagens
│     - Exibe unreadCount badge
│     - Click → abre ChatThreadView
└─ ChatThreadView (WSS: /api/chat/stream)
   ├─ Histórico (GET /api/chat/history, paginado)
   ├─ ChatMessage items (incoming/outgoing, status icon)
   ├─ ChatInput (debounce, validação)
   └─ Status indicator (connected/disconnected)
```

---

## 7. Fluxo de Integração com Bot-Supervisor

### 7.1 Modo Inline (histórico)

```
API → fork() bot-worker → Baileys sesssion
   ↓
MessageLog (INSERT incoming)
   ↓
App cria evento QR/status
```

**Problema:** API restart derruba todas as sessões.  
**Solução no chat:** Cache via Redis de status de sessão + retry automático de reconexão.

### 7.2 Modo Remote (futuro recomendado)

```
bot-supervisor → fork() bot-worker → Baileys session
       ↓
API comunica via BullMQ (commands) + Redis pub/sub (events)
       ↓
MessageLog (INSERT incoming)
       ↓
Redis pub/sub: "user:${userId}:chat"
       ↓
API WebSocket escuta e retransmite ao client mobile
```

**Vantagem:** API reinicia sem derrubar chat.  
**Implementação no chat:** Mesmo código funciona, apenas diferença no backend.

---

## 8. Segurança & Rate Limiting

| Recurso | Limite | Janela | Resposta |
|---------|--------|--------|----------|
| POST /api/chat/send | 1 msg/seg por (jid) | per-call | 429 Retry-After |
| POST /api/chat/send | 100 msgs/min por (sessionId) | 60s | 429 |
| GET /api/chat/history | 10 req/min por (sessionId) | 60s | 429 |
| WS /api/chat/stream | 1 conexão por (sessionId) | session | close 4002 |

**Autenticação:**
- JWT obrigatório em todos os endpoints
- Validar `sub` do JWT contra `sessionId` (user owns session)
- Validar `jid` contra sessions ativas do user

**Sanitização:**
- Texto: strip whitespace, max 4096 chars
- mediaUrl: validar HTTPS, whitelist origins (ou confiar no media-scraper)
- quotedMessageId: validar que a mensagem pertence ao mesmo thread

---

## 9. Performance & Observabilidade

### 9.1 Índices Críticos

```sql
-- Para listar histórico de conversa
CREATE INDEX idx_messagelog_user_jid_sent 
ON MessageLog(userId, destJid, sentAt DESC);

-- Para contar unread
CREATE INDEX idx_messagelog_user_jid_status 
ON MessageLog(userId, destJid, status);

-- Para last message preview
CREATE INDEX idx_sessionmetadata_user_last 
ON SessionMetadata(userId, lastMessageAt DESC);
```

### 9.2 Métricas a Coletar

```
// Via /api/metrics ou OpenTelemetry
wabot_chat_message_send_latency_ms (histogram)
wabot_chat_websocket_connections (gauge)
wabot_chat_message_queue_depth (gauge)
wabot_chat_session_connected_count (gauge per user)
```

### 9.3 Logs

```
// Em bot-worker
[chat] incoming message: jid=55119999@s.w, role=incoming, text_len=42
[chat] outgoing queued: messageId=abc123, jid=55119999@s.w, queue_depth=5
[chat] send complete: messageId=abc123, ackLevel=2, latency_ms=1250

// Em API
[api] POST /api/chat/send: user=u123, latency_ms=45, status=queued
[api] WS /api/chat/stream: user=u123, event=new_message, jid=5511999@s.w
```

---

## 10. Fases de Implementação

### Fase 1: API & Backoffice (1-2 sprints)
- [ ] Criar endpoints `/api/chat/*`
- [ ] Estender MessageLog.role
- [ ] Criar SessionMetadata model
- [ ] Implementar WebSocket servidor
- [ ] Testes de carga: 100 conexões WebSocket simultâneas

### Fase 2: Mobile UI (1 sprint)
- [ ] Rota `/m/conversa/page.js`
- [ ] Componente SessionList
- [ ] Componente ChatThreadView
- [ ] Componente ChatInput
- [ ] Integração com v2 Design System (CSS vars)

### Fase 3: Modo Remote (1-2 sprints, futuro)
- [ ] Adaptar bot-supervisor para chat events
- [ ] Validar que API restart não derruba WebSocket
- [ ] Teste de failover

### Fase 4: Refinamento & GA (ongoing)
- [ ] Typing indicators
- [ ] Read receipts
- [ ] Search de histórico
- [ ] Export de conversa
- [ ] Notificações mobile (push)

---

## 11. Exemplos de Código

### API: Enviar Mensagem

```javascript
// src/api/routes/chat.js
fastify.post('/api/chat/send', async (req, reply) => {
  const { sessionId, jid, text, mediaUrl, quotedMessageId } = req.body;
  
  // Validate
  if (!text?.trim()) throw new BadRequest('text required');
  if (text.length > 4096) throw new BadRequest('text too long');
  if (!jid.match(/^\d+@(s\.)?whatsapp\.net$/)) throw new BadRequest('invalid jid');
  
  // Check ownership
  const user = req.user; // from JWT middleware
  if (user.id !== sessionId) throw new Unauthorized();
  
  // Rate limit
  const rateLimitKey = `ratelimit:chat_send:${sessionId}:${jid}`;
  const count = await redis.incr(rateLimitKey);
  if (count === 1) await redis.expire(rateLimitKey, 60);
  if (count > 100) throw new TooManyRequests();
  
  // Create MessageLog
  const msg = await prisma.messageLog.create({
    data: {
      userId: sessionId,
      destJid: jid,
      text: text.trim(),
      role: 'outgoing',
      status: 'queued',
      sentAt: new Date(),
    },
  });
  
  // Enqueue job
  const queue = getOrCreateQueue(sessionId);
  const job = await queue.add('send', {
    messageId: msg.id,
    sessionId,
    jid,
    text,
    mediaUrl,
  });
  
  // Notify
  await redis.publish(`user:${sessionId}:chat`, JSON.stringify({
    type: 'message_queued',
    messageId: msg.id,
  }));
  
  return { messageId: msg.id, status: 'queued', sentAt: msg.sentAt };
});
```

### Mobile: ChatThreadView

```javascript
// dashboard/app/m/conversa/[sessionId]/page.js
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MobileShell } from '@/components/mobile/MobileShell';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';

export default function ChatThreadPage({ params }) {
  const { sessionId } = params;
  const router = useRouter();
  const jid = useSearchParams().get('jid'); // e.g., 5511999@s.whatsapp.net
  
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | connected | error
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  
  // Load histórico
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetch(
          `/api/chat/history?sessionId=${sessionId}&jid=${encodeURIComponent(jid)}&limit=50`
        );
        if (!res.ok) throw new Error(res.statusText);
        const data = await res.json();
        setMessages(data.thread.reverse());
      } catch (e) {
        setStatus('error');
      }
    };
    loadHistory();
  }, [sessionId, jid]);
  
  // Connect WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/chat/stream?sessionId=${sessionId}`);
    
    ws.onopen = () => setStatus('connected');
    ws.onmessage = (e) => {
      const evt = JSON.parse(e.data);
      if (evt.type === 'new_message' && evt.payload.jid === jid) {
        setMessages((prev) => [...prev, evt.payload]);
        scrollToBottom();
      }
      if (evt.type === 'message_status') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === evt.payload.messageId
              ? { ...m, status: evt.payload.status }
              : m
          )
        );
      }
    };
    ws.onerror = () => setStatus('error');
    ws.onclose = () => setStatus('disconnected');
    
    wsRef.current = ws;
    return () => ws.close();
  }, [sessionId, jid]);
  
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => scrollToBottom(), [messages]);
  
  const handleSendMessage = async (text) => {
    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, jid, text }),
      });
      if (!res.ok) throw new Error(res.statusText);
      const { messageId } = await res.json();
      // Message aparece via WebSocket quando status muda
    } catch (e) {
      // Show error toast
    }
  };
  
  return (
    <MobileShell title="Conversa" onBack={() => router.back()}>
      <div style={styles.container}>
        <div style={styles.messages}>
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
        <ChatInput onSend={handleSendMessage} disabled={status !== 'connected'} />
      </div>
    </MobileShell>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: 'var(--bg)',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    gap: '8px',
  },
};
```

---

## 12. Próximos Passos

1. **Revisão arquitetural:** feedback de segurança + performance
2. **Especificação de endpoints:** documentação OpenAPI
3. **Database migration:** Prisma schema + SQL scripts
4. **Implementation kickoff:** Sprint 1 = API + testes
5. **Mobile sprint:** Sprint 2 = UI + integração
6. **Staging validation:** E2E test com sessão real
7. **Production rollout:** Faseado (beta flag → GA)

---

**Autor:** Senior Architect | **Última atualização:** 2026-05-28
