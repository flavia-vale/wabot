# Mobile "Conversa" — Quick Start Guide

## O que é?

Interface de chat nativa mobile (`/m/conversa`) que permite:
- ✅ Ver mensagens WhatsApp em tempo real
- ✅ Responder manualmente a chats
- ✅ Acompanhar status de entrega/leitura  
- ✅ Navegar por histórico de conversas

**Conexão:** Mobile (Next.js) → API Fastify → bot-supervisor (Baileys) → WhatsApp

---

## Documentação Completa

### 1. **ARQUITETURA_MOBILE_CONVERSA.md** (⭐ COMECE AQUI)
Especificação técnica completa:
- Visão geral dos 4 camadas
- Fluxos de dados (7 exemplos)
- Endpoints REST (`GET /api/chat/sessions`, `POST /api/chat/send`, `WS /api/chat/stream`)
- Schema Prisma (MessageLog + SessionMetadata)
- Exemplos de código (API + Mobile)

**Leia:** 15 min | **Use para:** design review, code guidelines

### 2. **DIAGRAMA_FLUXO_CHAT.md**
Visualizações e sequências:
- Arquitetura em camadas (ASCII)
- 4 fluxos principais com timeline
- Integração com modo remote (futuro)
- Estados de mensagem (status machine)
- Wire format JSON

**Leia:** 10 min | **Use para:** onboarding, whiteboarding

### 3. **CHECKLIST_IMPLEMENTACAO_CHAT.md**
Roadmap tático (4-6 sprints):
- Fase 1: Schema & Persistência
- Fase 2: API Endpoints
- Fase 3: Bot-Worker Integration
- Fase 4: Mobile UI
- Fase 5: Testes & QA
- Fase 6: Produção & Refinement

**Leia:** 20 min | **Use para:** sprint planning, daily tracking

---

## Como Começar

### Pré-requisitos
```bash
# Conferir que tem:
cd /home/user/wabot

git branch -a | grep claude/epic-bardeen-ipF65  # deve estar aqui
npm -v && node -v                                 # npm 10.x, node 20.x
git status                                        # deve estar clean

# Se não tiver develop atualizado:
git fetch origin && git checkout develop && git pull
```

### Opção A: Estou desenhando (arquiteto)
1. Leia **ARQUITETURA_MOBILE_CONVERSA.md** inteiro
2. Revise endpoints (seção 4) — qualquer mudança?
3. Revise schema Prisma (seção 5) — falta algum campo?
4. Crie PR com feedback/sugestões

### Opção B: Vou implementar a API (backend)
1. Leia **ARQUITETURA_MOBILE_CONVERSA.md** seções 2-5
2. Siga **CHECKLIST_IMPLEMENTACAO_CHAT.md** Fases 1-3
3. Comece Fase 1.1: criar migration para `MessageLog.role`
   ```bash
   # Branch local para esta tarefa
   git checkout -b feat/chat-schema-phase1
   
   # Editar schema
   vim prisma/schema.prisma
   
   # Criar migration
   npx prisma migrate dev --name add_message_role
   ```
4. Teste em staging
5. Abra PR → develop

### Opção C: Vou implementar mobile (frontend)
1. Leia **ARQUITETURA_MOBILE_CONVERSA.md** seções 2, 4, 6
2. Espere Fase 2 (API endpoints) estar pronto em develop
3. Siga **CHECKLIST_IMPLEMENTACAO_CHAT.md** Fase 4
4. Crie componentes:
   ```bash
   # Branch para mobile
   git checkout -b feat/chat-mobile-phase4
   
   # Criar estrutura
   mkdir -p dashboard/app/m/conversa/components
   touch dashboard/app/m/conversa/page.js
   touch dashboard/app/m/conversa/\[sessionId\]/page.js
   touch dashboard/app/m/conversa/components/ChatSessionList.js
   touch dashboard/app/m/conversa/components/ChatThreadView.js
   touch dashboard/app/m/conversa/components/ChatMessage.js
   touch dashboard/app/m/conversa/components/ChatInput.js
   ```
5. Integrar v2 Design System (CSS vars)
6. Abra PR → develop

### Opção D: Vou testar (QA)
1. Leia **DIAGRAMA_FLUXO_CHAT.md** seção 2-3 (happy path)
2. Siga **CHECKLIST_IMPLEMENTACAO_CHAT.md** Fase 5 (Smoke Tests)
3. Quando staging estiver pronto:
   ```
   $ curl http://178.105.54.0:3006/m/conversa
   200 OK  ✅
   
   $ # Abrir em navegador mobile
   # http://178.105.54.0:3006/m/conversa
   # • Deve listar sessões ativas
   # • Click em sessão → thread
   # • Digitar + enviar mensagem
   # • Ver status ✓ / ✓✓
   ```

---

## Estrutura de Arquivos (Futura)

```
wabot/
├─ ARQUITETURA_MOBILE_CONVERSA.md     ✅ (criado)
├─ DIAGRAMA_FLUXO_CHAT.md             ✅ (criado)
├─ CHECKLIST_IMPLEMENTACAO_CHAT.md    ✅ (criado)
│
├─ prisma/
│  ├─ schema.prisma                   (estender MessageLog + SessionMetadata)
│  └─ migrations/
│     ├─ 001_add_message_role.sql     (nova)
│     └─ 002_create_session_metadata.sql (nova)
│
├─ src/api/routes/
│  └─ chat.js                         (nova: GET /api/chat/*)
│
├─ src/api/
│  └─ server.js                       (registrar plugin WebSocket)
│
├─ src/bot-worker.js                  (adaptar para MessageLog.role)
│
└─ dashboard/app/m/conversa/
   ├─ page.js                         (SessionList)
   ├─ [sessionId]/
   │  └─ page.js                      (ChatThreadView)
   └─ components/
      ├─ ChatSessionList.js
      ├─ ChatThreadView.js
      ├─ ChatMessage.js
      └─ ChatInput.js
```

---

## Key Decisions (Já Decidido)

| Aspecto | Decisão | Razão |
|---------|---------|-------|
| **Protocolo real-time** | WebSocket (não SSE) | Bidirecional (mobile envia + recebe) |
| **Queue backend** | Memory default, BullMQ opt-in | Compatibilidade com staging sem Redis |
| **Persistência chat** | MessageLog + SessionMetadata | Reutilizar schema existente |
| **Design System** | v2 (CSS vars) | Consistência com outras rotas `/m` |
| **Autenticação** | JWT (existente) | Sem mudanças no middleware |
| **Rate limiting** | Redis + contador | Proteção contra spam |
| **Modo remote** | Suportado mas não obrigatório | Upgrade futuro sem quebra de contrato |

---

## Validação Prévia

Antes de começar qualquer implementação:

```bash
# 1. Conferir que temos o setup mínimo
npm list | grep -E "fastify|prisma|redis|websocket"

# 2. Conferir que banco staging está rodando
sqlite3 ~/wabot-staging/prisma/staging.db "SELECT COUNT(*) FROM User;" 

# 3. Se for implementar API, conferir que API está pronta
curl http://178.105.54.0:3004/health

# 4. Se for implementar mobile, rodar build local
cd dashboard && npm run build
```

---

## Dependências Novas (A Instalar)

```bash
# Backend
npm install --save @fastify/websocket

# Frontend
# (nenhuma nova)
```

---

## Timeline Estimado

```
Sprint 1 (5 dias):  Schema + API endpoints ✅
Sprint 2 (5 dias):  Bot-worker + Mobile UI ✅
Sprint 3 (5 dias):  Testes + staging validation ✅
Sprint 4 (5 dias):  Refinement + produção ✅
────────────────────────────
Total: ~20 dias de dev + 10 dias de QA
```

**Recomendação:** 2 devs em paralelo (1 API/backend, 1 mobile/frontend)

---

## Comunicação

### Dúvidas sobre arquitetura?
→ Refira **ARQUITETURA_MOBILE_CONVERSA.md** seção X  
→ Abra issue/PR com feedback

### Quando começar qual fase?
→ Veja **CHECKLIST_IMPLEMENTACAO_CHAT.md**  
→ Fases 1-2 podem rodar em paralelo com fases 3-4

### Como reportar problema em staging?
→ Ambiente de teste: `http://178.105.54.0:3006`  
→ Logs: `/home/deploy/wabot-staging-shared/logs/`  
→ Database: `~/wabot-staging/prisma/staging.db`

---

## Perguntas Frequentes

**P: O chat bloqueia se a API reiniciar?**  
R: Sim, temporariamente (WebSocket desconecta). Auto-reconnect em segundos. Com modo `remote` (futuro), não afeta.

**P: Quantas mensagens por dia podemos lidar?**  
R: SQLite com WAL + índices corretos aguenta 100k+ msgs/dia. Testar em staging antes de escalar.

**P: E se o Baileys cair?**  
R: MessageLog fica `status='error', errorMsg='timeout:send:...'`. User vê ✗ na UI. Retry manual possível.

**P: Histórico é criptografado?**  
R: Não. MessageLog.text armazenado em plaintext (como hoje). Adicionar criptografia é refactoring futuro.

**P: Posso usar em produção hoje?**  
R: Não. Fases 1-6 precisam ser completadas em staging antes.

---

## Próximos Passos

1. **Leia** ARQUITETURA_MOBILE_CONVERSA.md (15 min)
2. **Abra discussion** para feedback (1h)
3. **Planeje** qual tarefa você vai pegar (30 min)
4. **Comece** Fase 1 ou Fase 4 em paralelo (hoje)
5. **Relate** progresso em daily standup

---

**Documentação criada:** 2026-05-28  
**Status:** Pronto para implementação  
**Autor:** Senior Architect  

**Referências:**
- AGENTS.md (operacional)
- ARQUITETURA_MOBILE_CONVERSA.md (design)
- DIAGRAMA_FLUXO_CHAT.md (visuals)
- CHECKLIST_IMPLEMENTACAO_CHAT.md (tática)
