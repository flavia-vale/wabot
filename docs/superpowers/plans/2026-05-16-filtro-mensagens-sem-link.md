# Filtro de Mensagens Sem Link por Grupo Monitorado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir configurar por grupo monitorado se mensagens sem link serão encaminhadas e com qual escopo, preservando o padrão atual de somente link.

**Architecture:** Adicionar dois campos de configuração na entidade de grupo monitorado, propagar esses campos pelos endpoints de create/update/read e aplicar uma função de decisão no pipeline de forwarding para mensagens sem link. O dashboard expõe toggle + seletor condicional no formulário de grupo monitorado.

**Tech Stack:** Node.js, Prisma/SQLite, API Express (ou equivalente atual do projeto), Next.js dashboard, testes Node.

---

### Task 1: Mapear entidade, rotas e formulário atuais

**Files:**
- Modify: `src/**` (mapear handlers de grupo monitorado)
- Modify: `dashboard/**` (mapear tela de cadastro/edição do grupo monitorado)
- Test: `test/**` (identificar suíte existente de forwarding e API)

- [ ] **Step 1: Localizar pontos de extensão**
Run: `rg -n "monitorad|monitored|group|forward|link" src dashboard test`
Expected: lista de arquivos do modelo, serviço de forwarding, rotas e formulário.

- [ ] **Step 2: Documentar o mapa antes de editar**
Criar notas de implementação (comentário no PR) com:
- arquivo de schema/model
- arquivo do filtro/forward
- endpoints create/update/read
- componente/form de grupo monitorado

- [ ] **Step 3: Commit de descoberta (opcional)**
```bash
git add -A
git commit -m "chore: map monitor group flow for no-link filter feature"
```

### Task 2: Persistir configuração no banco e domínio

**Files:**
- Modify: `prisma/schema.prisma`
- Create/Modify: `prisma/migrations/*`
- Modify: arquivos de acesso a dados da entidade de grupo monitorado em `src/**`
- Test: testes de modelo/repositório em `test/**`

- [ ] **Step 1: Escrever teste de persistência/validação (falhando)**
Criar teste garantindo default `LINK_ONLY` e aceitação de `noLinkScope` quando `ALLOW_NO_LINK`.

- [ ] **Step 2: Aplicar migration e tipos**
Adicionar enums/campos:
- `forwardMode` default `LINK_ONLY`
- `noLinkScope` nullable

- [ ] **Step 3: Atualizar camada de acesso a dados**
Garantir leitura/escrita dos novos campos em create/update/read do grupo monitorado.

- [ ] **Step 4: Executar testes desta task**
Run: `npm test -- --runInBand`
Expected: testes de persistência verdes.

- [ ] **Step 5: Commit**
```bash
git add prisma src test
git commit -m "feat: persist forwarding mode and no-link scope per monitored group"
```

### Task 3: Atualizar API (contratos + validação)

**Files:**
- Modify: controladores/rotas de grupo monitorado em `src/**`
- Modify: schemas/validators DTO em `src/**`
- Test: integração API em `test/**`

- [ ] **Step 1: Escrever testes de API (falhando)**
Casos:
- create sem campos novos => `LINK_ONLY`
- update para `ALLOW_NO_LINK` + `TEXT_ONLY` => sucesso
- `ALLOW_NO_LINK` sem scope => fallback `TEXT_ONLY` (ou erro 400 se optar validação estrita)

- [ ] **Step 2: Implementar validação de contrato**
- aceitar somente enums permitidos
- combinação inválida deve retornar erro claro (ou fallback conforme decisão final)

- [ ] **Step 3: Implementar resposta da API**
Incluir `forwardMode` e `noLinkScope` no payload de leitura/listagem.

- [ ] **Step 4: Rodar testes de API**
Run: `npm test -- --runInBand`
Expected: endpoints de grupo monitorado verdes.

- [ ] **Step 5: Commit**
```bash
git add src test
git commit -m "feat: expose no-link forwarding configuration in monitored group API"
```

### Task 4: Aplicar filtro no pipeline de forwarding

**Files:**
- Modify: serviço/conversor de forwarding em `src/**`
- Test: testes unitários do filtro em `test/**`

- [ ] **Step 1: Escrever testes unitários da decisão de encaminhamento (falhando)**
Cobrir matriz:
- com link => encaminha
- sem link + `LINK_ONLY` => bloqueia
- sem link + `ALL` => encaminha
- sem link + `TEXT_ONLY` => só texto
- sem link + `TEXT_IMAGE_WITH_CAPTION` => texto e imagem com legenda

- [ ] **Step 2: Implementar função pura de decisão**
Criar helper isolado (ex: `shouldForwardMessage`) para reduzir risco de regressão.

- [ ] **Step 3: Integrar helper ao fluxo real**
Usar configuração do grupo monitorado no momento da decisão.

- [ ] **Step 4: Rodar suíte de forwarding**
Run: `node --test test/*.test.js` (ou comando específico do projeto)
Expected: suíte sem regressões.

- [ ] **Step 5: Commit**
```bash
git add src test
git commit -m "feat: apply per-group no-link forwarding policy in message pipeline"
```

### Task 5: Expor configuração no Dashboard (cadastro/edição do grupo monitorado)

**Files:**
- Modify: formulário de grupo monitorado em `dashboard/**`
- Modify: client API/types em `dashboard/**`
- Test: testes de UI (se existentes) em `dashboard/**` ou `test/**`

- [ ] **Step 1: Escrever teste de UI (falhando)**
Casos:
- default toggle desligado
- ligando toggle exibe select
- salvar envia payload correto

- [ ] **Step 2: Implementar campos de formulário**
- Toggle “Incluir mensagens sem link”
- Select condicional com 3 opções
- helper text de risco de volume

- [ ] **Step 3: Integrar com API**
Mapear form <-> payload:
- desligado => `LINK_ONLY`
- ligado + opção => `ALLOW_NO_LINK` + scope selecionado

- [ ] **Step 4: Rodar build/test do dashboard**
Run: `cd dashboard && npm test && npm run build`
Expected: testes e build OK.

- [ ] **Step 5: Commit**
```bash
git add dashboard
git commit -m "feat: add no-link forwarding controls to monitored group form"
```

### Task 6: Validação integrada em staging

**Files:**
- Modify: `docs/` (checklist operacional opcional)

- [ ] **Step 1: Executar checks locais**
Run:
```bash
npm ci
npm test
cd dashboard && npm ci && npm run build
```
Expected: checks verdes.

- [ ] **Step 2: Validar cenários em staging (3006)**
Cenários esperados:
- grupo default (`LINK_ONLY`) não replica sem link
- `TEXT_ONLY` replica somente texto sem link
- `TEXT_IMAGE_WITH_CAPTION` replica texto e imagem com legenda
- `ALL` replica demais formatos suportados

- [ ] **Step 3: Confirmar ausência de regressão em links**
Mensagens com link continuam sendo encaminhadas em todos os modos.

- [ ] **Step 4: Commit final de docs/checklist**
```bash
git add docs
git commit -m "docs: add staging validation checklist for no-link forwarding policy"
```
