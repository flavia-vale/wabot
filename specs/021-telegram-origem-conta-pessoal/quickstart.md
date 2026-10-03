# Quickstart — roteiro de validação (feature 021)

Roteiro para provar, em staging (`http://178.105.54.0:3006`, `~/wabot-staging`), que a
feature funciona e que o WhatsApp não mudou. Detalhes de forma em
[data-model.md](./data-model.md) e [contracts/](./contracts/). ⛔🔑 = precisa da conta de
teste do Telegram e de `TELEGRAM_API_ID`/`TELEGRAM_API_HASH` de **staging** (criados pela
dona em my.telegram.org).

## 0. Pré-requisitos

- Conta Premium de teste no Espelha Grupos (staging) com WhatsApp de teste conectado.
- Conta de teste do Telegram (celular com o app), com e sem senha de duas etapas.
- No Telegram de teste: 1 canal próprio "origem-canal", 1 grupo "origem-grupo", 1 grupo
  "destino-tg" com o robô do Espelha Grupos de **staging** já ligado (fluxo da 017).
- No WhatsApp de teste: 1 grupo "destino-wa" e 1 grupo de origem "origem-wa" já usados hoje.
- `.env` de staging: `TELEGRAM_ORIGIN_ENABLED=1`, `TELEGRAM_ORIGIN_ALLOWLIST=<id da conta de teste>`,
  `DELIVERY_NETWORKS_ENABLED=whatsapp,telegram`, `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`,
  `TELEGRAM_LEITOR_PORT`, `TELEGRAM_LEITOR_INTERNAL_TOKEN`, `TELEGRAM_MEDIA_DIR`.
  Aplicar: `pm2 delete api-staging && pm2 start ecosystem.config.cjs --only api-staging` e
  `pm2 start ecosystem.config.cjs --only telegram-leitor-staging` (a partir de `~/wabot-staging`).
- Testes locais verdes: `npm test` (inclui T-E1..T-E10 do plan.md).

## 1. Fase 0 — medição (antes de qualquer código de produção) ⛔🔑

1. `cd ~/telegram-spike && pm2 start spike.mjs --name telegram-spike` (research R13).
2. Conectar 0 → 1 → 3 contas; deixar 3 contas por 24 h.
3. Decide: `awk -F, 'NR>1{print $3}' memoria.csv | sort -n | tail -n 1` (RSS máximo em MB).
   Se ficar acima do que a dona aprovar, vai para o plano B A1 (plan.md, sinalização de memória).
4. Conferir na conta de teste, por outro aparelho: aparece "online"? mensagens do canal ficam "vistas"? (esperado: não).
5. Publicar pelo robô no "destino-tg" (canal): o autor visto pelo spike é o canal ou o robô? (decide D5.a.2).
6. `pm2 delete telegram-spike`.

## 2. WhatsApp igual (SC-001) — logo após o PR-1

1. Sem conectar Telegram nenhum, publicar 10 ofertas variadas em "origem-wa" (Shopee, ML, Amazon, cupom, loja não suportada, palavra bloqueada).
2. Conferir no histórico: mesmos resultados e motivos de antes.
3. 24 h depois: `node scripts/diag-espelhamento-antes-depois.mjs --horas=24` → nenhuma diferença relevante de distribuição por `status`/`errorMsg` (o script imprime veredito).

## 3. Conectar a conta (US2) ⛔🔑

1. Painel → Aplicativos → "Sua conta do Telegram" → ler o aviso → aceitar.
2. Ler o QR pelo app (Configurações → Dispositivos → Conectar dispositivo). Esperado: "conectada" com o nome da conta, sem telefone.
3. Repetir com a conta que tem senha de duas etapas: a tela pede a senha; senha errada → "senha incorreta".
4. Esperar o QR vencer sem ler: aparece botão para gerar outro.
5. Segredo nunca aparece: `grep -ciE "stringsession|api_hash|1BQ" ~/.pm2/logs/telegram-leitor-staging-out.log` → **0** (SC-006).

## 4. Origens e leitura (US3, US5.a) ⛔🔑

1. "Escolher origens": aparecem "origem-canal" e "origem-grupo"; **não** aparecem conversas privadas.
2. Marcar as duas; ligar "origem-canal" → "destino-wa" e "origem-grupo" → "destino-tg".
3. Tentar marcar "destino-tg" como origem: a tela bloqueia (mesmo grupo origem e destino).
4. Mandar mensagem em grupo **não** marcado e em conversa privada; depois:
   `sqlite3 prisma/staging.db "SELECT COUNT(*) FROM TelegramInboxMessage WHERE sourceId NOT IN (SELECT waJid FROM \"Group\" WHERE deliveryNetwork='telegram')"` → **0** (SC-005). (Ajustar o caminho do banco ao `DATABASE_URL` de staging.)

## 5. Tratar e entregar — 4 combinações (US3, US4, US5) ⛔🔑

1. Publicar oferta com link da Shopee em "origem-canal" → chega **uma vez** em "destino-wa", com link convertido, modelo/rodapé da origem, foto.
2. Publicar oferta em "origem-grupo" → chega em "destino-tg" **pelo robô** (autor = robô, nunca a conta pessoal).
3. Oferta com palavra bloqueada → histórico mostra o mesmo motivo do WhatsApp.
4. Desconectar o WhatsApp de teste e publicar em "origem-canal" → histórico mostra o motivo de WhatsApp desconectado.
5. Publicar o **mesmo link** em "origem-wa" (ligada a "destino-wa") logo após o passo 1 → bloqueado por repetição (trava b entre aplicativos).
6. Zero loop (SC-004): com a conta de teste dentro de "destino-tg", publicar 5 ofertas pelos caminhos acima e conferir:
   `sqlite3 <db> "SELECT destGroup, convertedUrl, COUNT(*) c FROM MessageLog WHERE status='success' AND sentAt > datetime('now','-1 hour') GROUP BY 1,2 HAVING c>1"` → **vazio**.
7. Tentar ligar caminho de ida e volta pela tela → recusado com a frase leiga.
8. Latência (SC-003): `node scripts/diag-telegram-leitor.mjs <email> --latencia` → p95 da diferença origem→envio.

## 6. Robustez (US6) ⛔🔑

1. No app do Telegram: Configurações → Dispositivos → encerrar a sessão do Espelha Grupos. Em até 15 min: tela "sua conta do Telegram foi desconectada", e-mail recebido (SC-008).
2. `pm2 stop telegram-leitor-staging` por 5 min → aviso interno ao admin + card "Leitura do Telegram" parado; WhatsApp segue espelhando (US6.5). `pm2 start` de volta → leitura recomeça sem reprocessar mensagens antigas fora da janela.
3. Rebaixar a conta de teste para Basic → leitura pausa, origens continuam salvas; voltar ao Premium → retoma (US6.6).

## 7. Desconectar apaga tudo (SC-007) ⛔🔑

1. "Desconectar" na tela.
2. `sqlite3 <db> "SELECT (SELECT COUNT(*) FROM TelegramAccount WHERE userId='<id>') + (SELECT COUNT(*) FROM \"Group\" WHERE userId='<id>' AND deliveryNetwork='telegram' AND role='monitor') + (SELECT COUNT(*) FROM TelegramInboxMessage WHERE userId='<id>')"` → **0**.
3. No app do Telegram, "Dispositivos" não lista mais o Espelha Grupos.

## 8. Antes de produção

- OK da dona com o número de RAM medido (passo 1) — sem ele, nada de `pm2 start telegram-leitor` em produção.
- PR-1 em produção com aviso às clientes (reinicia o `bot-supervisor`).
- Termos de uso e página de preços atualizados (PR-6); liberação gradual com 1–3 clientes.
