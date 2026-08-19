# Quickstart — validação da feature 013

Guia de execução e verificação. Nada aqui altera produção, `.env` ou banco de produção
(FR-035).

## Pré-requisitos

```bash
cd /home/user/wabot
git branch --show-current      # precisa ser claude/inbound-leads-strategy-yqtajg
npm ci
cd dashboard && npm ci && cd ..
```

**Não criar nem trocar de branch.** O PR final é contra `develop`, nunca `main`.

---

## Portões — rodar sempre nesta ordem

```bash
# 1) raiz — suíte inteira (FR-040)
npm test

# 2) dashboard — os seis validadores (FR-038, FR-039)
cd dashboard
npm run guard:config-page
npm run guard:seo-registry
npm run lint:seo-metadata
npm run validate:seo-consistency
npm run validate:editorial-freshness
npm run validate:schema-templates
cd ..
```

> **Ordem importa em P2:** `guard:seo-registry` compara as rotas do disco com
> `getIndexableSeoRoutes()`. Marcar a primeira rota como `indexable: false` **antes** de trocar
> a base do guard para `getAllSeoRoutes()` reprova o portão. Ajuste o guard primeiro.

---

## P1 — clique

```bash
node --test test/inbound-titulos-clique.test.js
```

**Esperado:** os 11 títulos de FR-004 com ≤ 55 caracteres no texto da página; a mensagem de
falha mostra também o título entregue (texto + `' | Espelha Grupos'`). Descrições ≤ 160.
`/bot-achadinhos-whatsapp` intocado, ainda passando em
`test/pagina-achadinhos-clique.test.js` com o teto de 60 que já tinha.

Conferência manual do que o teste não mede (o motivo aparecer no começo):

```bash
cd dashboard && node -e "
import('./lib/seo-registry.mjs').then(m=>{
  for (const r of m.SEO_ROUTES.filter(r=>r.title)) {
    console.log(String(r.title.length).padStart(3), r.title.slice(0,55) + '…', '|', r.path)
  }
})"
```

Ler as 55 primeiras posições em voz alta: se o motivo para clicar não apareceu ali, o trabalho
não está feito (edge case da spec).

**Resultado de campo:** Search Console, 30 dias depois (SC-002, SC-003, SC-004).

---

## P2 — indexação

```bash
node --test test/seo-noindex-guard.test.js
cd dashboard && npm run validate:seo-consistency && npm run guard:seo-registry && cd ..
```

Verificação de que o sinal chega ao HTML de verdade (não só ao registro):

```bash
cd dashboard && npm run build && npm start &
curl -s http://localhost:3000/<rota-marcada> | grep -i '<meta name="robots"'
# esperado: content="noindex, follow"
curl -s http://localhost:3000/sitemap.xml | grep -c '<rota-marcada>'   # esperado: 0
```

**Nenhuma página apagada (FR-010, SC-007):** a contagem de rotas públicas antes e depois tem
que ser igual ou maior.

```bash
cd dashboard && node -e "
import('./lib/seo-registry.mjs').then(m=>{
  console.log('total no registro:', m.SEO_ROUTES.length)
  console.log('indexáveis:', m.getIndexableSeoRoutes().length)
})"
```

**Registro escrito exigido por FR-012 e FR-013:**
`specs/013-inbound-leads-strategy/triagem-indexacao.md`, com a decisão por página (as duas
evidências de R9) e a conclusão sobre `/promo-vip-7dias` (já pronta em `research.md` R7).

---

## P3 — aviso de credencial

```bash
node --test test/painel-aviso-credencial.test.js test/painel-linguagem-leiga.test.js
```

Teste de ponta a ponta, manualmente, em staging:

1. Conta com WhatsApp conectado e **nenhuma** credencial de loja.
2. Deixar um envio ser recusado (linha `skip:no_valid_conversions` em `MessageLog`).
3. Abrir `/painel` e `/painel/checklist`: o aviso aparece **sem abrir o histórico** (FR-015).
4. Conferir o texto por loja:
   - Shopee → "as ofertas … **param de sair**";
   - Mercado Livre / Amazon → "**continuam saindo**, só com link mais comprido".
5. Cadastrar a credencial → recarregar → o aviso some (FR-021).
6. Conta com tudo em ordem → nenhum aviso (US3, cenário 6).
7. Conta com credencial **cadastrada e vencida** → aparece o aviso antigo de código vencido, e
   **não** o novo (FR-020).

Checagem direta da rota:

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3004/api/logs/credential-block | jq
```

**Resultado de campo:** SC-008 (60% → ≥80% de quem conecta e cadastra), 60 dias.

---

## P4, P5, P6 — conteúdo

```bash
node --test test/marketing-limites-que-nao-se-cruzam.test.js
cd dashboard && npm run validate:editorial-freshness && npm run validate:schema-templates && cd ..
```

**Esperado (FR-029..FR-034, SC-013):**
- zero promessa de não-banimento em qualquer texto publicado;
- todo preço de concorrente rastreável a um `slug` de `dashboard/lib/competitors-data.js` com
  `verifiedAt` e `source`;
- toda página de comparação com o bloco `bestFit` (onde o concorrente é a melhor escolha);
- nenhuma rota nova de cidade, de nicho novo, de Magalu como frente, nem de "automação
  whatsapp"/"disparo em massa";
- nenhuma página antiga das linhas congeladas apagada.

**Portão de publicação (FR-014):** P5 e P6 só entram depois de P2 concluído e verificado. A
próxima página de comparação da fila só sai depois que a de Achadinho Pro entrar no índice
(SC-011, ≤ 14 dias) — regra registrada no checklist de FR-026.

---

## Antes de abrir o PR

```bash
npm test && (cd dashboard && npm run guard:config-page && npm run validate:seo-p0 \
  && npm run validate:seo-consistency && npm run validate:seo-p2 \
  && npm run validate:schema-templates)
git status                     # nenhum .env, nenhum .db
git branch --show-current      # ainda claude/inbound-leads-strategy-yqtajg
```

PR **contra `develop`**. Depois do merge, validar em staging (`http://178.105.54.0:3006`) antes
de qualquer PR para `main`.
