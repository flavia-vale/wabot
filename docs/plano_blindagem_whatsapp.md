# Plano de Blindagem de Conectividade WhatsApp (Anti-Quebra)

## Instrução inicial — mapeamento atual do projeto

### Onde a sessão do WhatsApp é salva hoje
- O estado de autenticação do Baileys usa `useMultiFileAuthState(AUTH_DIR)`, com `AUTH_DIR` vindo de `getAuthInfoDir(userId)`. Isso significa persistência em **arquivos locais** no filesystem do processo. 
- O diretório base é `AUTH_INFO_DIR` (env) ou fallback `./auth_info`. 
- Em desconexão `loggedOut`, o worker limpa esse diretório (`rm -rf`) para forçar novo QR no próximo start.
- Há persistência no banco apenas do **status da sessão** (`connected/connecting/disconnected`) via `waSession`, não dos credenciais/tokens do WhatsApp.

### Onde está a conversão de links e mídia
- Conversão centralizada em `convertLink(platform, url, credentials)` no fluxo do worker.
- Extração de links é feita por `detectLinks(text)`.
- Tratamento de imagem fica em `converters/imageScrapers.js` e no próprio fluxo do worker (`downloadOriginalImage`, `getImage`, `normalizeImageForWhatsApp`).
- O fanout/envio final (texto/imagem) acontece no `src/bot-worker.js` e é o caminho crítico que não deve ser impactado por mudanças de layout/faturamento.

---

## Diagnóstico de vulnerabilidade — por que as sessões caem hoje
1. **Acoplamento parcial ao processo**: o socket vive no processo filho (`fork`) supervisionado pelo manager. Reinícios do ecossistema PM2 derrubam esse processo e fecham o socket. 
2. **Persistência local depende do host/volume**: se `auth_info` estiver no disco efêmero do container ou em deploy que troca volume/cwd, a credencial pode sumir.
3. **Sem handoff entre processos**: não existe “socket standby” em outro processo para takeover; o reconnect depende do restart do mesmo worker.
4. **Autoreconnect existe, mas não cobre restart total**: há retry de 5s em `connection=close`, porém se `api`/PM2 reiniciar, todos workers caem juntos.
5. **Risco de impacto cruzado**: hoje a lógica de conversão + envio + sessão está no mesmo worker; uma regressão nesse arquivo pode afetar conectividade e entrega.

---

## Análise de risco (obrigatória)

### 1) Detecção de erros fatais
- **Risco de loop infinito**: médio se reconexão automática não tiver backoff/jitter e circuit-breaker. 
- **Risco de vazamento de memória**: médio na fila de mensagens e listeners se houver restart frequente sem limpeza robusta. 
- **Risco de quebrar build**: baixo para mudanças incrementais isoladas, mas médio se refatorar worker inteiro.

### 2) Breaking changes
- **API interna**: alto risco se mudar contrato de `manager.startBot/stopBot/onStatus` ou payload IPC (`process.send`).
- **Banco**: risco médio ao introduzir nova tabela para snapshots/heartbeat; exige migration compatível.
- **Sessão**: risco alto ao trocar mecanismo de auth sem fase de compatibilidade (ex.: mover de arquivo para DB direto).

### 3) Efeito cascata
- Mudanças na camada de sessão podem impactar:
  - rotas `/api/session/*`,
  - painel de conexão QR,
  - rotina de resume em boot (`resumePersistedBots`),
  - envio de links/imagens no worker.

### 4) Protocolo de resposta
- **PARE TUDO antes de codar** se for migração direta “big bang” de auth store.
- Estratégia segura: **migração em duas fases** (dual-write + cutover), feature flag e rollback simples por env.

---

## Mudança de estrutura (arquitetura defensiva)

### A. Persistência Cold & Hot da sessão
1. **Cold persistence (durável)**
   - Fixar `AUTH_INFO_DIR` em volume persistente dedicado (Hetzner): ex. `/var/lib/wabot/auth_info`.
   - Não depender de cwd do deploy.
2. **Hot state (coordenação/health)**
   - Adicionar Redis para heartbeat de worker (`wa:session:{userId}:heartbeat`) e lock distribuído.
   - Só 1 owner por sessão (evita socket duplicado em cluster).
3. **Dual-mode de auth (compatível)**
   - Fase 1: manter multi-file auth atual + snapshot metadata no DB/Redis.
   - Fase 2 (opcional): adapter para persistência em DB criptografado (apenas após estabilidade).

### B. Graceful shutdown real
- Ao receber `SIGTERM`:
  1) bloquear novas mensagens,
  2) flush dedup e filas,
  3) marcar estado `draining` no DB,
  4) publicar evento de handoff no Redis,
  5) encerrar processo.
- Novo worker só assume quando lock antigo expirar/for liberado.

### C. Isolamento de domínio (anti-cascata)
- Separar módulos por fronteira estável:
  - `session-core` (socket, auth, reconnect, health)
  - `message-core` (detecção/conversão/fanout)
  - `api-web` (dashboard, billing, admin)
- Mudanças de dashboard/billing **não importam** módulos do `session-core`.

---

## Fluxo de deploy Zero-Impacto (sem desconectar clientes)
1. Build e smoke test primeiro (gate obrigatório).
2. Start do novo processo em modo “warm” (sem assumir socket ainda).
3. Lock/leader election por sessão no Redis.
4. Handoff gracioso do owner antigo para novo.
5. Só depois reiniciar partes web (dashboard/api) que não detêm sessão.

> Com seu script atual (`deploy_safe_dashboard.sh`), a base já é boa para evitar restart cego. O próximo passo é separar o supervisor de sessão em processo dedicado (ex.: `pm2 app: wa-gateway`) para o deploy web não derrubar sockets.

---

## Garantia de Links/Imagens (proteção de regressão)

### Contrato imutável do core
- Criar testes de contrato para:
  - `detectLinks` (entradas reais)
  - `convertLink` por plataforma
  - pipeline de mídia (`original`, `fetch`, `fallback`)

### Regressão obrigatória pré-deploy
- Cenário fixo: URL `espelhagrupos.com.br` deve continuar sendo detectada/converter conforme regra esperada.
- Adicionar suíte smoke do worker com fixtures de mensagens.

### Guard rails de código
- CODEOWNERS ou regra de CI: mudanças em `src/bot-worker.js`, `src/detector.js`, `src/converters/**` exigem validação extra.
- “No touch zones” para billing/layout não alterarem core.

---

## Plano de implementação incremental (seguro)
1. Instrumentar heartbeat/zombie detect (sem trocar auth store).
2. Introduzir Redis lock por sessão + leader election.
3. Extrair `session-core` para processo PM2 dedicado.
4. Adicionar suíte de regressão links/imagens no CI.
5. (Opcional) migrar auth para DB criptografado com dual-write e cutover controlado.
