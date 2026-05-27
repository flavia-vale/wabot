# Twin Development Plan

**Data:** 2026-05-27
**Branch:** `claude/focused-edison-ELWTB`
**Task:** Reimplementar assinatura via Mercado Pago na página de assinaturas; PIX vira fallback abaixo. Cobrança única mensal (Preference). Entregar no final a lista de configurações manuais no painel do MP.
**Quality Level:** pragmatic

---

## Análise Técnica

O backend (`src/api/routes/payments.js`) já está completo: cria Preference, recebe webhook, ativa conta, reconcilia pagamentos. Não há migration nova.

O frontend (`dashboard/app/dashboard/assinaturas/page.js`) já possui `handleCheckout(planId)` implementado e `api.paymentsCheckout` em `dashboard/lib/api.js` — mas nenhum botão chama `handleCheckout`. Os cards de plano apenas chamam `setSelectedPlanId`. O único CTA visível é o bloco PIX manual.

O estado de erro do checkout (`checkoutError`) já é renderizado, mas fica no topo da página — longe de onde o botão estará. O estado de loading (`checkoutPlan`) já controla o lock da função.

`dashboard/lib/api.js` está adequado — `paymentsCheckout` já existe e faz o POST correto.

---

## Plano de Implementação

### Arquivos a Modificar

**`dashboard/app/dashboard/assinaturas/page.js`**

1. Adicionar botão "Assinar com Mercado Pago" dentro de cada card de plano (após a seleção), ou — mais simples e consistente com o UX atual — adicionar um CTA primário fixo abaixo dos cards, visível ao selecionar qualquer plano, que chama `handleCheckout(selectedPlanId)`.
   - O botão deve mostrar estado de loading quando `checkoutPlan === selectedPlanId` (texto "Aguarde..." + `disabled`).
   - O botão deve ficar `disabled` também enquanto outro plano está em checkout (`checkoutPlan && checkoutPlan !== selectedPlanId`).

2. Mover o bloco `checkoutError` para imediatamente acima do botão MP (não no topo da página), para que o erro apareça próximo da ação que o causou.

3. Reorganizar layout: o bloco PIX manual existente vira uma seção separada abaixo do botão MP, com framing "Prefere pagar via PIX manual?" como título da seção.

4. Remover o bloco `checkoutError` do topo da página (atualmente em destaque antes dos cards) — ele vai existir só próximo do botão.

**`AGENTS.md`**

Adicionar seção "Configurações do Mercado Pago (envs obrigatórias)" documentando:
- `MP_ACCESS_TOKEN` — token de produção do MP (Credenciais → Produção)
- `MP_WEBHOOK_SECRET` — chave HMAC configurada no painel MP (Webhooks → assinatura). Sem ela, o endpoint `/api/payments/webhook` retorna 500 em produção.
- `BILLING_WEBHOOK_AUTOPROCESS=true` — ativa processamento automático do webhook. Default é `false` — sem isso, pagamentos aprovados não ativam a conta automaticamente (ficam na fila para reconciliação periódica em 1h).
- Nota sobre cutover PM2 (pegadinha #1): mudar `.env` exige `pm2 delete api && pm2 start ecosystem.config.cjs --only api`, não basta `pm2 restart --update-env`.
- URL de webhook a registrar no painel MP: `https://espelhagrupos.com.br/api/payments/webhook`

---

## Ordem de Implementação

1. **Modificar `dashboard/app/dashboard/assinaturas/page.js`**
   Primeiro porque é a única mudança de código. Reorganizar: mover `checkoutError` para junto do CTA, adicionar botão MP chamando `handleCheckout(selectedPlanId)` com estados de loading/disabled, rebatizar o bloco PIX como fallback com framing "Prefere pagar via PIX manual?".

2. **Modificar `AGENTS.md`**
   Adicionar seção sobre envs do MP logo após a seção de `.env` mínimo por ambiente. É documentação operacional — deve ser feita antes do deploy para que a usuária saiba o que configurar.

3. **Commit e push na branch `claude/focused-edison-ELWTB`**
   Incluir ambos os arquivos no mesmo commit.

4. **PR de `claude/focused-edison-ELWTB` → `develop`**
   Autodeploy staging via GitHub Actions. Validar em `http://178.105.54.0:3006/dashboard/assinaturas`:
   - Botão "Assinar com Mercado Pago" aparece e é clicável
   - Sem `MP_ACCESS_TOKEN` em staging, o erro retornado pela API deve acionar `checkoutError` com mensagem amigável (não 500 genérico)
   - Bloco PIX aparece abaixo com framing correto
   - Estado de loading funciona (botão desabilita ao clicar)

5. **Deliverable: instruções manuais do painel MP para a usuária** (incluído ao final deste plano)

---

## Riscos Técnicos

**`BILLING_WEBHOOK_AUTOPROCESS=false` em produção (default)**
Pagamentos aprovados pelo MP chegam via webhook mas não ativam a conta automaticamente. A reconciliação periódica (1h) vai processar, mas há janela de até 1h sem ativação. Para ativação imediata, setar `BILLING_WEBHOOK_AUTOPROCESS=true` no `.env` de prod e fazer `pm2 delete api && pm2 start ecosystem.config.cjs --only api`.

**`MP_WEBHOOK_SECRET` ausente em produção**
O endpoint `/api/payments/webhook` retorna 500 imediatamente quando em produção sem o secret (`shouldEnforceWebhookSignature` retorna true por default em NODE_ENV=production). Configurar antes de aceitar pagamentos reais.

**Pegadinha PM2 (AGENTS.md #1)**
Qualquer mudança nas envs do MP (`.env`) exige `pm2 delete api && pm2 start ecosystem.config.cjs --only api` — não `pm2 restart --update-env`. `dotenv` não sobrescreve variáveis já cacheadas pelo PM2.

**`MP_ACCESS_TOKEN` de staging vs produção**
O MP fornece tokens separados para sandbox e produção. Usar token de produção em staging dispara cobranças reais. Configurar token de teste no `.env` de staging se quiser testar o fluxo completo lá.

---

## Próximo Passo

Implementar `dashboard/app/dashboard/assinaturas/page.js` conforme o plano, depois `AGENTS.md`, depois commit + PR para `develop`.

---

## Deliverable: Configurações Manuais no Painel do Mercado Pago

A seguir o checklist de configurações a fazer no painel MP antes de ativar o fluxo em produção:

### 1. Obter credenciais de produção
- Acessar: https://www.mercadopago.com.br/settings/account/credentials
- Seção **Produção** → copiar o **Access Token** (começa com `APP_USR-...`)
- Adicionar ao `.env` de prod: `MP_ACCESS_TOKEN=APP_USR-...`

### 2. Configurar Webhook e obter o secret HMAC
- Acessar: https://www.mercadopago.com.br/developers/panel/app → seu app → **Webhooks**
- Criar notificação:
  - **URL:** `https://espelhagrupos.com.br/api/payments/webhook`
  - **Eventos:** marcar `payment` (pagamento)
- Após salvar, o painel exibe a **Chave secreta de assinatura** (string tipo `abc123...`)
- Adicionar ao `.env` de prod: `MP_WEBHOOK_SECRET=<chave-copiada>`

### 3. Ativar processamento automático do webhook
- Adicionar ao `.env` de prod: `BILLING_WEBHOOK_AUTOPROCESS=true`
- Sem isso, pagamentos aprovados ficam pendentes por até 1h (reconciliação)

### 4. Aplicar as envs (pegadinha PM2)
```bash
# No VPS, no diretório ~/wabot:
pm2 delete api
pm2 start ecosystem.config.cjs --only api
pm2 save
```

### 5. Verificar URLs de retorno (já hardcoded no backend)
O backend já configura automaticamente:
- `back_url.success` → `https://espelhagrupos.com.br/dashboard/assinaturas?status=approved`
- `back_url.failure` → `https://espelhagrupos.com.br/dashboard/assinaturas?status=rejected`
- `back_url.pending` → `https://espelhagrupos.com.br/dashboard/assinaturas?status=pending`
- `notification_url` → `https://espelhagrupos.com.br/api/payments/webhook`

Não é necessário configurar essas URLs manualmente no painel.

### 6. Validação pós-configuração
- Fazer um pagamento de teste com cartão de teste do MP sandbox (se usar token de sandbox)
- Ou fazer um pagamento real pequeno (R$1 não é possível — usar o valor mínimo do plano) em produção
- Verificar em `http://espelhagrupos.com.br/dashboard` que a conta foi ativada
- Verificar logs: `pm2 logs api --lines 50 | grep -i payment`
