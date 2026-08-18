# Quickstart — validar a SHEIN de ponta a ponta

Guia de execução/validação. Detalhes de implementação estão em `contracts/` e em `data-model.md`.

---

## Pré-requisitos

- branch a partir de `develop` (nunca direto para `main` — AGENTS.md);
- Node do projeto instalado, `npm ci` na raiz e em `dashboard/`;
- para os passos 4-6: um link de afiliada real da SHEIN da cliente e um `onelink.shein.com` de
  **outro** afiliado (o caso real do grupo monitorado).

Nenhuma env nova. Nenhum processo PM2 novo. Nenhuma dependência nova.

---

## 1. Testes locais (db-free, sem rede)

```bash
node --test test/converters-shein.test.js test/shein-shortlink-resolve.test.js \
             test/detector.test.js test/link-kind.test.js test/store-brand-card.test.js \
             test/product-info-scraper.test.js test/painel-linguagem-leiga.test.js
npm test          # suíte inteira — é o que prova FR-023 (zero regressão)
```

Esperado: tudo verde. Os testes da SHEIN **não** acessam a rede (`fetchImpl` injetado); se algum
teste demorar segundos, há chamada real vazando — corrigir antes de seguir.

## 2. Build do dashboard

```bash
cd dashboard && npm run build
```

Obrigatório: a lista de domínios suportados do painel vai para o bundle. Sem isso, o painel continua
dizendo "link não suportado" mesmo com o backend correto.

## 3. Migration

```bash
npx prisma migrate deploy
sqlite3 <db> "SELECT platforms FROM BotConfig LIMIT 3;"   # deve conter ',shein'
npx prisma migrate deploy                                  # rodar 2x: idempotente, sem efeito
```

A migration é DML puro — **não** exige parar API/supervisor (pegadinha #8 não se aplica).

## 4. Staging (`develop` → autodeploy → `http://178.105.54.0:3006`)

Merge em `develop` dispara o deploy. Depois:

**4a. Cadastro da loja (US1)**
- painel → IDs de afiliada → SHEIN aparece ao lado das outras quatro;
- colar o link de afiliada da cliente → salvar → status **"Pronta para usar"**;
- colar só o número → aceito igualmente;
- colar um link do botão "compartilhar" do aplicativo → **recusado**, com a mensagem dizendo onde
  pegar o link certo (SC-008);
- colar texto qualquer → recusado com mensagem clara;
- conferir que **não** aparece status de sessão nem aviso de vencimento (FR-008);
- "Apagar meus dados" → volta a "Ainda não cadastrada"; apagar de novo não dá erro.

**4b. Converte links (US2)**
- colar um link de produto da SHEIN → sai com a identificação da cliente;
- colar o `onelink` de **outro** afiliado → sai com a identificação da cliente e **sem** nenhum
  rastro do afiliado de origem;
- colar um link do formato de compartilhamento → falha honesta, nada é publicado.

**4c. Criar oferta**
- colar link da SHEIN → a loja é detectada; título/preço podem não aparecer (esperado, research.md
  D-004) — o importante é **não** aparecer erro na tela nem a frase promocional genérica como título.

**4d. Espelhamento real (US2 + US3)**
- postar um link de SHEIN num grupo monitorado;
- no destino: card clicável, **com foto do produto**, "SHEIN" no título do card, e o texto do grupo
  de origem preservado como descrição;
- conferir no painel de registros: linha `success`, loja identificada como SHEIN.

**4e. Cupom (US4)**
- postar um link de campanha/cupom da SHEIN → convertido, com o banner preto "CUPOM SHEIN".

**4f. Não regressão (FR-023)**
- postar um link de Amazon, um de Shopee, um de ML e um de Magalu → todos saem como antes.

## 5. Diagnóstico quando algo não bater

```bash
node scripts/diag-shein-affiliate-link.mjs '<oneLink da cliente>' '<link que falhou>'
```

Read-only: não toca no banco, não envia nada. Mostra a cadeia de hops, onde ela parou, os parâmetros
encontrados e a conferência de vazamento de identificador de terceiro.

## 6. Gate de comissão — o único que decide (fazer no celular)

Abrir, **no celular**, o link que saiu no grupo e confirmar no painel de afiliada da SHEIN que o
clique foi registrado. Fazer fora do WiFi de casa, para não confundir com clique anterior. O painel
pode levar horas para atualizar.

> O RCA da Amazon existe exatamente porque "a oferta saiu bonita" foi confundido com "a comissão foi
> creditada" — 8 dias de comissão perdida em silêncio. **Não promover para `main` sem este passo.**

## 7. Produção

Só depois do passo 6 aprovado: PR `develop` → `main`, autodeploy.

Se o modo efetivo for `remote`, lembrar do passo manual — senão os bot-workers seguem com o código
antigo e a SHEIN não converte nada (RCA 2026-08):

```bash
cd ~/wabot && pm2 restart bot-supervisor --update-env && pm2 save
```

Essa reinicialização reconecta **todas** as sessões WhatsApp de uma vez: anunciar/agendar antes.

---

## Critérios de aceite (mapeados no spec)

| Passo | Cobre |
|---|---|
| 1, 3 | FR-023, FR-025, D-013 |
| 2 | as 6 duplicações de domínio |
| 4a | US1, FR-004..FR-010, SC-001, SC-006, SC-008 |
| 4b | US2, FR-011..FR-017, SC-002, SC-003 |
| 4c, 4d | US3, FR-018..FR-021, SC-004, SC-005 |
| 4e | US4, FR-016, FR-022 |
| 4f | FR-023, SC-007 |
| 6 | premissa de comissão (research.md D-001) |
