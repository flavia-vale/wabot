# Twin Development Plan
Generated: 2026-06-01
Task: Implementar ofertas automáticas Shopee — /home/user/wabot/docs/superpowers/plans/2026-05-31-offer-automation.md
Branch: claude/shopee-affiliate-offers-api-ADOlJ
Quality Level: pragmatic

---

## Análise Técnica

**Estado atual:** Nenhum arquivo da feature existe. `BotConfig` já tem `copyVariationPoolJson` no schema (linha 194). `applyVariation`/`pickVariant` não suportam modo random. `GET/PUT /api/config` não expõe `copyVariationPoolJson`. `CopyVariationPoolEditor` existe em `dashboard/components/preservacao/`.

**Constraints críticos:**
- `GET /api/config` retorna `cfg ?? { ...DEFAULTS, userId }` — fallback não inclui `copyVariationPoolJson: '{}'`. Sem correção, página de variações lança erro de parse em usuários sem BotConfig.
- Migration `CREATE TABLE OfferAutomation` falha com SQLITE_BUSY se API estiver rodando (pegadinha #8 AGENTS.md). Rodar apenas com API parada.
- `sendBroadcast` requer bot rodando — cron retorna `skipped: 'bot_not_running'` silenciosamente se offline.
- `sentItemIds` como JSON string: envolver `JSON.parse` em try/catch no dispatcher, tratar falha como array vazio.
- `isAMSOffer` e `isKeySeller` ficam no backend mas **fora** do formulário da UI (campos avançados omitidos intencionalmente).

---

## Plano de Implementação

### Arquivos a Criar:
- `src/offerAutomation/shopeeOffers.js` — `buildOffersQuery`, `filterOffers`, `fetchOffers`
- `src/offerAutomation/dispatcher.js` — `formatOfferMessage`, `runAutomation` (com try/catch em JSON.parse de sentItemIds)
- `src/offerAutomation/cron.js` — `startOfferAutomationCron` (setInterval 60s, `.unref()`)
- `src/api/routes/offerAutomation.js` — CRUD Fastify + `/trigger`
- `test/offer-automation.test.js` — 13 testes (7 fetcher + 2 dispatcher + 4 rotas)
- `dashboard/app/dashboard/ofertas-automaticas/page.js` — CRUD page com link "Editar ganchos e CTAs →"
- `dashboard/app/dashboard/variacoes-de-texto/page.js` — editor com `CopyVariationPoolEditor`

### Arquivos a Modificar:
- `prisma/schema.prisma` — relação `offerAutomations OfferAutomation[]` em User (após `followLogs`) + model `OfferAutomation` completo ao final
- `src/core/copyVariation.js` — `pickVariant` ganha 4º param `random=false`; `applyVariation` desestrutura `random` e passa para pickVariant
- `src/api/routes/config.js` — GET: adicionar `copyVariationPoolJson: '{}'` no fallback DEFAULTS; PUT: desestruturar, validar JSON, incluir no update
- `src/api/server.js` — 2 imports + 1 `app.register` + `startOfferAutomationCron()` no boot
- `dashboard/lib/api.js` — 7 métodos novos (offerAutomations* + variationsGet + variationsUpdate)
- `dashboard/app/dashboard/DashboardClientLayout.js` — 2 itens em navGroups['Operação'] após 'Gerar oferta'

### Ordem de Implementação:

1. **Prisma schema + migration** — base de tudo; executar com API parada
   ```bash
   npx prisma migrate dev --name offer_automation && npx prisma generate
   ```
   Verificar: `npx prisma migrate status` → `Database schema is up to date`

2. **`src/core/copyVariation.js`** — independente, modifica 2 funções
   Verificar: `node --test test/` sem regressões

3. **`test/offer-automation.test.js` (parcial) + `src/offerAutomation/shopeeOffers.js`** — TDD
   Verificar: 7 testes passando

4. **`src/offerAutomation/dispatcher.js`** — depende de shopeeOffers + copyVariation
   Verificar: 9 testes passando (+ 2 de formatação)

5. **`src/api/routes/config.js`** — expor copyVariationPoolJson, sem gate
   Verificar: GET retorna campo; PUT aceita JSON válido, rejeita inválido

6. **`src/api/routes/offerAutomation.js`** + 4 testes de rota
   Verificar: 13 testes passando

7. **`src/offerAutomation/cron.js`** — infraestrutura, sem testes automáticos
   Verificar sintaxe: `node --input-type=module < src/offerAutomation/cron.js 2>&1 | head -5`

8. **`src/api/server.js`** — registrar rota + ligar cron
   Verificar: `node -e "import('./src/api/server.js')" 2>&1 | head -20`

9. **`dashboard/lib/api.js`** — métodos client

10. **`dashboard/app/dashboard/DashboardClientLayout.js`** — nav

11. **`dashboard/app/dashboard/ofertas-automaticas/page.js`** — CRUD page

12. **`dashboard/app/dashboard/variacoes-de-texto/page.js`** — editor de variações

13. **Suite completa + build**
    ```bash
    npm test
    cd dashboard && npm run build 2>&1 | tail -20
    ```

### Riscos Técnicos:

| Risco | Mitigação |
|---|---|
| SQLITE_BUSY na migration | Confirmar que nenhum processo PM2/node está com conexão no `.db` antes do migrate |
| `copyVariationPoolJson` undefined no fallback GET | Adicionar `copyVariationPoolJson: '{}'` no objeto DEFAULTS do config route |
| `JSON.parse(sentItemIds)` corrompido | try/catch no dispatcher, fallback para `[]` |
| Bot offline no trigger | Retorna `skipped: 'bot_not_running'` — exibido no card da UI |

---

## Próximo Passo
Para implementar este plano, digite: ok, continue, ou approve
Para cancelar, digite: cancel ou inicie uma nova tarefa
