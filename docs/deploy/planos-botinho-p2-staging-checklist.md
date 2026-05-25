# P2 — Validação integrada em staging (Planos BOTinho)

> Escopo: validar em `develop` + staging (`http://178.105.54.0:3006`) tudo que foi implementado nas fases de gate por plano (canais + Módulo de Preservação Avançada).

## 1) Preparação (staging)

```bash
cd ~/wabot-staging && git pull origin develop && npm install && cd dashboard && npm install && cd .. && npx prisma migrate deploy && pm2 restart api-staging visual-staging
```

Checklist rápido:
- [ ] API saúde: `curl -sS http://127.0.0.1:3004/health`
- [ ] Login carregando: `curl -sS -o /dev/null -w "%{http_code}\n" http://178.105.54.0:3006/login` retorna `200`
- [ ] Proxy auth não retorna 404 do Next

## 2) Matriz de contas para teste

Use 3 contas distintas:
- **Conta A (Basic)**: plano `basic`
- **Conta B (Trial ativo)**: plano `trial` com `accessExpiresAt` no futuro
- **Conta C (Pro)**: plano `pro`

## 3) Cenários funcionais obrigatórios

### 3.1 Dashboard Grupos (`/dashboard/grupos`)

**Conta A (Basic)**
- [ ] Botão “+ Adicionar canal” aparece com estado Pro/bloqueado
- [ ] Tentar abrir/cadastrar canal deve falhar com mensagem de upgrade
- [ ] Canais legados (se existirem) continuam visíveis com indicação de bloqueio Pro
- [ ] Grupo normal (`@g.us`) continua criando e editando normalmente

**Conta B (Trial ativo)**
- [ ] Consegue cadastrar canal (monitor/post)
- [ ] Consegue resolver link/JID de canal
- [ ] Consegue configurar targets incluindo canal

**Conta C (Pro)**
- [ ] Mesmo comportamento da Trial ativa para canais

### 3.2 Broadcast (`/dashboard/envio` + API)

**Conta A (Basic)**
- [ ] Envio manual para `@newsletter` retorna bloqueio `FEATURE_REQUIRES_PRO`
- [ ] Agendamento para `@newsletter` retorna bloqueio `FEATURE_REQUIRES_PRO`

**Conta B/C (Trial ativo/Pro)**
- [ ] Envio manual para canal é aceito
- [ ] Agendamento para canal é aceito

### 3.3 Configurações (`/dashboard/configuracoes`)

**Conta A (Basic)**
- [ ] Banner informando Pro para preservação avançada aparece
- [ ] `feedGlobal=true` bloqueado via API
- [ ] `postToStatus=true` bloqueado via API
- [ ] `forwardMode=ALLOW_NO_LINK` bloqueado via API em grupos

**Conta B/C (Trial ativo/Pro)**
- [ ] `feedGlobal=true` permitido
- [ ] `postToStatus=true` permitido
- [ ] `forwardMode=ALLOW_NO_LINK` permitido

### 3.4 Assinaturas + LP

- [ ] `/dashboard/assinaturas` mostra Basic (grupos) vs Pro (grupos+canais+preservação)
- [ ] Landing pública mostra copy nova de Trial/Basic/Pro
- [ ] `LpPlan` persistido está alinhado (sem copy antiga de anúncios como diferencial principal)

## 4) Verificações técnicas (automação local/CI)

Rodar no repositório:

```bash
DATABASE_URL='file:./tmp/test.db' npx prisma migrate deploy
DATABASE_URL='file:./tmp/test.db' node --test test/api/routes/config.plan-gates.test.js test/api/routes/groups.channel.test.js test/api/routes/broadcast.plan-gates.test.js test/billing-plans.test.js test/group-entitlements.test.js
cd dashboard && npm run build
```

Critério:
- [ ] 100% dos testes acima verdes
- [ ] build do dashboard verde

## 5) Critério de aceite para promover develop -> main

Somente promover quando:
- [ ] Matriz Basic/Trial ativo/Pro validada ponta a ponta na porta `3006`
- [ ] Nenhuma regressão de grupos (`@g.us`) para Basic
- [ ] Gates de canal e preservação avançada consistentes entre UI e API
- [ ] Checkout e copy de planos coerentes com decisão de produto

## 6) Evidências mínimas para anexar no PR

- [ ] Capturas de tela de:
  - `/dashboard/grupos` (Basic com bloqueio Pro)
  - `/dashboard/configuracoes` (banner de preservação avançada)
  - `/dashboard/assinaturas`
- [ ] Resultado dos comandos de teste
- [ ] Notas de qualquer desvio e correção aplicada
