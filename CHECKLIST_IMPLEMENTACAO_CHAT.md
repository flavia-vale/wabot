# Checklist de Implementação: Mobile "Conversa"

**Status:** Planejamento  
**Estimativa:** 4-6 sprints  
**Prioridade:** P1 (Core feature pós v2 refactor)  
**Dependências:** PR #679 (mobile v2 rotas) ✅ + Redis operacional

---

## Fase 1: Schema & Persistência (Sprint 1)

### 1.1 Prisma Schema
- [ ] Estender MessageLog com campo `role` (incoming|outgoing|system)
  - [ ] Migration: `001_add_message_role.sql`
  - [ ] Backward compat: default 'outgoing' para linhas sem role
  - [ ] Validar teste com bancos de staging e prod simulados
  
- [ ] Criar model SessionMetadata (novo)
  - [ ] Campos: userId, jid (PK composta), displayName, profileUrl, isGroup, lastMessageAt, lastMessagePreview, isMuted, unreadCount, createdAt, updatedAt
  - [ ] Migration: `002_create_session_metadata.sql`
  - [ ] Índices: (userId, lastMessageAt DESC) + (userId, jid UNIQUE)
  
- [ ] Criar índices críticos
  - [ ] `(userId, destJid, sentAt DESC)` para histórico
  - [ ] `(userId, destJid, status)` para contagem de unread
  - [ ] Validar plano de execução: explain plan com tabelas > 1M rows

### 1.2 Migração de Dados
- [ ] Backfill MessageLog.role:
  - [ ] Script: `scripts/backfill_message_role.js` (zero-downtime)
  - [ ] Teste em staging: run + validar contagens antes/depois
  - [ ] Rollback plan: script inverso pronto
  
- [ ] Seed SessionMetadata (inicial):
  - [ ] Extrair unique (userId, destJid) de MessageLog
  - [ ] Preencher displayName vazio (TBD via API depois)
  - [ ] Script: `scripts/seed_session_metadata.js`

### 1.3 Testes DB
- [ ] Teste unitário: Prisma schema é válido
  - [ ] `npm run prisma:validate`
  - [ ] `npm run prisma:generate`
  
- [ ] Teste de migração:
  - [ ] Aplicar em dev.db vazio
  - [ ] Aplicar em dev.db com 1M+ rows (staging snapshot)
  - [ ] Validar tempo: < 30s
  
- [ ] Teste de índices:
  - [ ] Query histórico com (userId, jid) = 100 rows
  - [ ] Query unread count com (userId, jid, status='queued')
  - [ ] Latência < 100ms

---

## Fase 2: API Endpoints (Sprint 1-2)

### 2.1 Estrutura de Rotas
- [ ] Criar `src/api/routes/chat.js` (novo arquivo)
- [ ] Registrar em `src/api/server.js`: `fastify.register(require('./routes/chat.js'))`
- [ ] Middleware de autenticação JWT em todas as rotas

### 2.2 Endpoint: GET /api/chat/sessions
- [ ] Implementação:
  - [ ] Query Prisma: `findMany(SessionMetadata, where: { userId })`
  - [ ] Enriquecer com status do Baileys (online/offline)
  - [ ] Ordenar por lastMessageAt DESC
  - [ ] Paginar: limit (default 20, max 100) + offset
  
- [ ] Validação:
  - [ ] JWT presente
  - [ ] User não acessa outros users
  
- [ ] Teste:
  - [ ] Listar 10 sessões
  - [ ] Validar response JSON
  - [ ] Latência < 200ms

### 2.3 Endpoint: GET /api/chat/history
- [ ] Implementação:
  - [ ] Parâmetros: sessionId, jid, limit (50, max 200), offset
  - [ ] Query Prisma: `findMany(MessageLog, where: { userId, destJid }, orderBy: { sentAt: 'desc' })`
  - [ ] Mapear role, status, ackLevel
  - [ ] Validar jid é válido WA JID
  
- [ ] Paginação:
  - [ ] Response: `{ thread: [...], hasMore: boolean, total: number }`
  - [ ] Client pode implementar infinite scroll
  
- [ ] Teste:
  - [ ] Histórico de 1000 mensagens, paginar por 50
  - [ ] Latência < 300ms
  - [ ] hasMore=true/false correto

### 2.4 Endpoint: POST /api/chat/send
- [ ] Validação:
  - [ ] Campos obrigatórios: sessionId, jid, text
  - [ ] text: não-vazio, max 4096 chars
  - [ ] jid: match `/^\d+@(s\.)?whatsapp\.net$/`
  - [ ] User owns sessionId (JWT subject == sessionId)
  
- [ ] Rate limiting:
  - [ ] Redis counter: `ratelimit:chat_send:${sessionId}:${jid}`
  - [ ] 1 msg/sec per (jid) + 100/min per (sessionId)
  - [ ] Response 429 com Retry-After: 60
  
- [ ] Enfileiramento:
  - [ ] Criar MessageLog: role='outgoing', status='queued'
  - [ ] BullMQ job (ou memory queue)
  - [ ] Publish Redis: `user:${userId}:chat` → { type: 'message_queued' }
  
- [ ] Teste:
  - [ ] Enviar 1 msg → status='queued'
  - [ ] Validar rate limit (enviar 101 em 60s → 429)
  - [ ] Latência POST → response: < 100ms

### 2.5 WebSocket: GET /api/chat/stream
- [ ] Setup Fastify WebSocket plugin:
  - [ ] `npm install @fastify/websocket`
  - [ ] Registrar em server.js
  
- [ ] Autenticação:
  - [ ] Extrair JWT de query parameter ou header
  - [ ] Validar JWT
  - [ ] Manter sessionId do JWT
  
- [ ] Redis pub/sub subscriber:
  - [ ] Subscribe: `user:${sessionId}:*`
  - [ ] Forward events ao cliente
  - [ ] Limpar subscription em disconnect
  
- [ ] Heartbeat:
  - [ ] Server envia { type: 'ping' } a cada 30s
  - [ ] Client responde { type: 'pong' }
  - [ ] Timeout 60s → close(4002)
  
- [ ] Evento: new_message
  - [ ] Payload: id, jid, role, text, sentAt, status, ackLevel
  - [ ] Emitido por bot-worker
  
- [ ] Evento: message_status
  - [ ] Payload: messageId, status, ackLevel, deliveredAt
  - [ ] Emitido por bot-worker pós-Baileys ack
  
- [ ] Teste:
  - [ ] Conectar WS
  - [ ] Receber ping a cada 30-31s
  - [ ] Desconectar após 60s sem pong
  - [ ] Múltiplas conexões simultâneas: 10, 50, 100

### 2.6 Error Handling
- [ ] Implementar classe ChatError com subclasses:
  - [ ] InvalidJidError
  - [ ] MessageTooLongError
  - [ ] RateLimitError
  - [ ] UnauthorizedError
  
- [ ] Logging:
  - [ ] Winston: debug, info, warn em cada endpoint
  - [ ] Estruturado: { userId, jid, action, latency, error }

---

## Fase 3: Bot-Worker Integration (Sprint 2)

### 3.1 Incoming Message Flow
- [ ] Modificar `src/bot-worker.js`:
  - [ ] Detectar incoming message (já faz, apenas validar)
  - [ ] Criar MessageLog: role='incoming', status='success'
  - [ ] Publish Redis: `user:${userId}:chat` → { type: 'new_message' }
  
- [ ] Teste:
  - [ ] Simular incoming msg via mock Baileys
  - [ ] Validar MessageLog.role='incoming'
  - [ ] Validar Redis event dispara

### 3.2 Outgoing Message Flow (Manual)
- [ ] BullMQ job handler:
  - [ ] Get MessageLog by messageId
  - [ ] Get Baileys session (sessionCore ou supervisor client)
  - [ ] Call Baileys.sendMessage()
  - [ ] Aguardar ack (ackLevel progression)
  
- [ ] Update MessageLog:
  - [ ] status='sending' durante envio
  - [ ] status='success' após ack ≥ 1
  - [ ] Atualizar ackLevel, deliveredAt
  - [ ] status='error' se timeout ou Baileys erro
  
- [ ] Publish events:
  - [ ] Redis: `user:${userId}:chat` → { type: 'message_status' }
  - [ ] Após cada ack level
  
- [ ] Teste:
  - [ ] Simular job de envio com mock Baileys
  - [ ] Validar MessageLog.status='success'
  - [ ] Validar Redis events em sequência

### 3.3 Timeouts & Retries
- [ ] Respeitar `SEND_MESSAGE_TIMEOUT_BY_ATTEMPT_MS` (90, 60, 45)
- [ ] Retry logic: max 3 attempts
- [ ] Falha permanente → status='error', errorMsg='timeout:send:jid'
- [ ] Teste:
  - [ ] Simular timeout na 1ª tentativa
  - [ ] Validar retry automático
  - [ ] Validar falha após 3 tentativas

### 3.4 Session Management
- [ ] SessionMetadata update:
  - [ ] lastMessageAt ← max(sentAt) incoming/outgoing
  - [ ] lastMessagePreview ← text[0:100]
  - [ ] unreadCount ← count(MessageLog where role='incoming' AND isRead=false)
  
- [ ] Cache em Redis:
  - [ ] Chave: `chat:session:${userId}:${jid}`
  - [ ] Valor: JSON { status, lastSeenAt, typing }
  - [ ] TTL: 1h
  
- [ ] Teste:
  - [ ] Receber msg → SessionMetadata.lastMessageAt atualiza
  - [ ] Enviar msg → lastMessageAt atualiza

---

## Fase 4: Mobile UI Components (Sprint 2-3)

### 4.1 Rotas & Componentes Estrutura
- [ ] Criar `dashboard/app/m/conversa/page.js`
  - [ ] SessionList (lista de conversas ativas)
  - [ ] Sem-conversa fallback ("Nenhuma conversa iniciada")
  
- [ ] Criar `dashboard/app/m/conversa/[sessionId]/page.js`
  - [ ] ChatThreadView (exibe thread para um sessionId)
  - [ ] URL: `/m/conversa/user-123?jid=5511999@s.whatsapp.net`
  
- [ ] Criar componentes:
  - [ ] `components/mobile/ChatSessionList.js`
  - [ ] `components/mobile/ChatThreadView.js`
  - [ ] `components/mobile/ChatMessage.js` (incoming/outgoing/system)
  - [ ] `components/mobile/ChatInput.js`

### 4.2 SessionList Component
- [ ] Dados:
  - [ ] GET /api/chat/sessions no useEffect
  - [ ] State: sessions[], isLoading, error
  
- [ ] Rendering:
  - [ ] Avatar + displayName + lastMessagePreview
  - [ ] Badge: unreadCount (se > 0)
  - [ ] Timestamp: lastMessageAt (hoje vs ontem vs data)
  - [ ] Click → navigate to ChatThreadView
  
- [ ] Styling v2:
  - [ ] --ink, --surface, --line, --success
  - [ ] Flexbox layout
  - [ ] Hover state (--surface-hover)
  
- [ ] Teste visual:
  - [ ] Renderizar 3 sessões
  - [ ] Click leva para thread certo

### 4.3 ChatThreadView Component
- [ ] Load histórico:
  - [ ] GET /api/chat/history no useEffect
  - [ ] State: messages[], isLoading, hasMore
  
- [ ] WebSocket:
  - [ ] Connect: `/api/chat/stream?sessionId=...`
  - [ ] Subscribe: onmessage → new_message, message_status
  - [ ] Auto-reconnect (exponential backoff)
  
- [ ] Rendering:
  - [ ] Lista inversa (oldest → newest)
  - [ ] Scroll to bottom ao carregar/nova mensagem
  - [ ] Separadores de dia (hoje vs ontem)
  
- [ ] Infinite scroll:
  - [ ] Ao chegar no topo, carregar 50 msgs anteriores
  - [ ] hasMore control
  
- [ ] Teste visual:
  - [ ] Renderizar thread com 10 msgs
  - [ ] Scroll down, receber nova msg, auto-scroll
  - [ ] Status indicator (connected/disconnected)

### 4.4 ChatMessage Component
- [ ] Props: message { id, role, text, status, sentAt, ackLevel }
- [ ] Renderização:
  - [ ] incoming: alinhado esquerda, --ink-soft bg
  - [ ] outgoing: alinhado direita, --accent bg
  - [ ] system: centralizado, --ink-faint
  
- [ ] Status indicator:
  - [ ] queued: relogio (⏱)
  - [ ] success + ackLevel 1: ✓
  - [ ] success + ackLevel 2: ✓✓
  - [ ] error: ✗ (cor --danger)
  
- [ ] Tooltip/hover:
  - [ ] Mostrar sentAt exacto (HH:MM)
  - [ ] Mostrar errorMsg se error

### 4.5 ChatInput Component
- [ ] Input field:
  - [ ] Placeholder: "Digitar mensagem..."
  - [ ] Auto-grow (max 5 linhas)
  - [ ] Max length: 4096 chars
  - [ ] Counter (opcional): "1250/4096"
  
- [ ] Send button:
  - [ ] Ativo se text.trim().length > 0
  - [ ] Ativo se status='connected'
  - [ ] Disabled se enviando
  - [ ] Loading spinner durante POST
  
- [ ] Validação:
  - [ ] Não enviar vazio
  - [ ] Trim whitespace
  - [ ] Mostrar erro (toast) se POST fails
  
- [ ] Teste:
  - [ ] Digitar → send ativado
  - [ ] Click send → POST /api/chat/send
  - [ ] Response imediato → input limpa
  - [ ] Rate limit error → toast

### 4.6 v2 Design System Integration
- [ ] Cores:
  - [ ] --ink, --ink-soft, --ink-faint
  - [ ] --surface, --surface-hover, --bg, --bg-soft
  - [ ] --line (border)
  - [ ] --accent, --success, --danger, --warn
  
- [ ] Spacing:
  - [ ] 8px base unit
  - [ ] Padding: 16px page, 8px items
  - [ ] Gap: 8px, 12px, 16px
  
- [ ] Typography:
  - [ ] Body: 13px, color --ink
  - [ ] Label: 12px, color --ink-soft
  - [ ] Heading: 16-18px, color --ink, weight 500-600
  
- [ ] Componentes reutilizáveis:
  - [ ] Badge (unreadCount)
  - [ ] Button (enviar, tentar novamente)
  - [ ] Spinner (loading)
  - [ ] Toast (erro)

---

## Fase 5: Testes & QA (Sprint 3)

### 5.1 Testes Unitários
- [ ] API endpoint tests (Jest + Supertest)
  - [ ] POST /api/chat/send com dados válidos
  - [ ] POST /api/chat/send com campos inválidos
  - [ ] GET /api/chat/history com paginação
  - [ ] GET /api/chat/sessions
  - [ ] Validar JSON schema responses
  
- [ ] Componentes React (Vitest + React Testing Library)
  - [ ] ChatSessionList renderiza sessões
  - [ ] ChatMessage renderiza role correto
  - [ ] ChatInput envia texto
  - [ ] ChatThreadView carrega histórico
  
- [ ] Integração DB:
  - [ ] MessageLog.create e role é salvo
  - [ ] SessionMetadata.update e lastMessageAt
  - [ ] Indices são usados (explain plan)

### 5.2 Testes de Integração
- [ ] Fluxo incoming (API + DB + bot-worker mock)
  - [ ] bot-worker envia incoming → API WebSocket recebe
  
- [ ] Fluxo outgoing (API + queue + bot-worker mock)
  - [ ] POST /api/chat/send → job enfileirado
  - [ ] bot-worker processa → status atualiza
  - [ ] WebSocket notifica mobile
  
- [ ] Rate limiting
  - [ ] Enviar 101 msgs em 60s → 429 na 101ª
  
- [ ] WebSocket reconnect
  - [ ] Fechar conexão → cliente reconecta
  - [ ] Mensagens em vôo não são perdidas

### 5.3 Testes de Performance
- [ ] Histórico com 10k+ mensagens
  - [ ] GET /api/chat/history offset 0, 50: < 300ms
  - [ ] Paginação suave no mobile
  
- [ ] WebSocket com 100 conexões simultâneas
  - [ ] Broadcast de event → latência < 500ms
  - [ ] Memory usage: < 100MB
  
- [ ] MessageLog volume: 1M rows
  - [ ] Índices mantêm performance

### 5.4 Testes de Segurança
- [ ] JWT validation:
  - [ ] Request sem JWT → 401
  - [ ] JWT inválido → 401
  - [ ] JWT de outro user → 403
  
- [ ] Sanitização:
  - [ ] SQL injection: ' OR '1'='1
  - [ ] XSS: <script>alert(1)</script>
  - [ ] Path traversal: ../../../etc/passwd
  
- [ ] Rate limiting bypass:
  - [ ] Tentar burlar via IP spoofing → rate limit persiste

### 5.5 Smoke Test Staging
- [ ] Deploy a staging
  - [ ] Rotas respondendo: GET /m/conversa → 200
  
- [ ] Teste E2E:
  - [ ] Abrir /m/conversa
  - [ ] Listar sessões
  - [ ] Abrir thread
  - [ ] Enviar mensagem manual
  - [ ] Receber incoming de teste
  - [ ] WebSocket status atualiza
  
- [ ] Validar com usuário real:
  - [ ] 1-2 accounts reais (sandbox)
  - [ ] Enviar msgs, validar delivery
  - [ ] Verificar UI responsiva no mobile

---

## Fase 6: Refinamento & Produção (Sprint 4+)

### 6.1 Features Adicionais
- [ ] Typing indicators:
  - [ ] Enviado quando user digita
  - [ ] Exibido "User está digitando..."
  - [ ] Cancelado após 3s inatividade
  
- [ ] Read receipts:
  - [ ] MessageLog.isRead flag
  - [ ] Ao abrir thread → marcar incoming como read
  - [ ] Exibir "lido às HH:MM"
  
- [ ] Search:
  - [ ] GET /api/chat/search?q=termo&sessionId=...
  - [ ] Full-text search em MessageLog.text
  - [ ] Paginar resultados
  
- [ ] Export:
  - [ ] GET /api/chat/export?sessionId=&jid=&format=json|csv
  - [ ] Baixar histórico da conversa
  
- [ ] Notificações:
  - [ ] Web push (SE Notification API)
  - [ ] Badge de unread

### 6.2 Monitoring
- [ ] Metrics:
  - [ ] wabot_chat_message_send_latency_ms (histogram)
  - [ ] wabot_chat_websocket_connections_active (gauge)
  - [ ] wabot_chat_session_count (gauge by user)
  
- [ ] Alertas:
  - [ ] WebSocket disconnect rate > 5%
  - [ ] P99 message latency > 5s
  - [ ] Queue depth > 1000
  
- [ ] Logging:
  - [ ] Estruturado: ECS format
  - [ ] Correlate via requestId
  - [ ] Retenção: 30 dias

### 6.3 Documentação
- [ ] API OpenAPI spec
- [ ] README.md: setup local, rodando testes
- [ ] Runbook: troubleshoot comum (desconexão, lag, etc)

### 6.4 Rollout
- [ ] Feature flag: `CHAT_MOBILE_ENABLED` (default false)
  - [ ] Mobile v2: mostrar /m/conversa se enabled
  
- [ ] Rollout gradual:
  - [ ] Beta: 10% de users
  - [ ] GA: 100% de users
  - [ ] Monitora: crash, latency, satisfaction
  
- [ ] Rollback plan:
  - [ ] Desabilitar feature flag
  - [ ] Revert DB migrations (if needed)
  - [ ] Timeline: < 5min

---

## Dependências Externas

| Recurso | Versão | Status |
|---------|--------|--------|
| Fastify | ^4.x | ✅ existente |
| Prisma | ^5.x | ✅ existente |
| Redis | 7.0+ | ✅ existente (staging+) |
| BullMQ | ^5.x | ⚠️ opt-in, requer Redis |
| @fastify/websocket | ^2.x | ❌ nova dependência |
| React | 19.x | ✅ existente |
| Next.js | 16.x | ✅ existente |

### Instalação
```bash
# Backend
npm install --save @fastify/websocket

# Frontend (já incluído)
# Nenhuma nova dependência de cliente
```

---

## Estimativa de Esforço

| Fase | Sprint | Dias | Dev | QA | Total |
|------|--------|------|-----|-----|-------|
| 1. Schema | S1 | 5 | 3 | 2 | 5 |
| 2. API | S1-2 | 10 | 7 | 3 | 10 |
| 3. Worker | S2 | 5 | 4 | 1 | 5 |
| 4. Mobile | S2-3 | 10 | 7 | 3 | 10 |
| 5. Testes | S3 | 5 | 3 | 2 | 5 |
| 6. Refinement | S4+ | 10+ | 5 | 5 | 10+ |
| **Total** | | **45** | **29** | **16** | **45** |

**Nota:** 1 sprint = 10 dias úteis

---

## Riscos & Mitigação

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Latência WebSocket > 5s | Média | Alto | Load test 100 conexões; Redis tunning |
| MessageLog volume explode | Média | Médio | Implementar TTL/archiving de msgs antigas |
| Rate limit bypass via race condition | Baixa | Médio | Usar Redis INCR (atomic), teste de concorrência |
| Modo remote não funciona com chat | Baixa | Alto | Testar em staging antes de prod |
| Mobile v2 design system incompatível | Baixa | Médio | Usar variáveis CSS, não colors hardcoded |

---

## Checklist Final (Antes de GA)

- [ ] Código revisado + aprovado (PR)
- [ ] Testes passando (unit + integration + e2e)
- [ ] Load test completado (100 WS, 1M+ rows)
- [ ] Security review completado
- [ ] Docs atualizadas (README, runbook, OpenAPI)
- [ ] Feature flag implementado
- [ ] Rollback plan testado
- [ ] Monitoring & alertas configurados
- [ ] Changelog atualizado
- [ ] Changelog push com migração
- [ ] Staging deployment validado (24h)
- [ ] Usuários beta testam (48h)
- [ ] Feedback coletado & bugs fixed
- [ ] Production deployment scheduled
- [ ] On-call engineer designado
- [ ] Post-launch monitoring (1 semana)

---

**Criado:** 2026-05-28  
**Próxima revisão:** Após Phase 1 (end of Sprint 1)
