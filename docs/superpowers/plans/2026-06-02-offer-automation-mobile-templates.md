# Plano revisado — modelos mobile para automação de ofertas

> **Status em 2026-06-02:** este plano foi auditado contra o código atual do repositório. As tarefas antigas de implementação estão **defasadas**: quase todos os itens já foram implementados e não devem ser executados novamente. O que ainda faz sentido é validar regressões, fazer aceite em staging e corrigir apenas eventuais bugs encontrados nessa validação.

**Objetivo original:** fazer os envios automáticos de ofertas da Shopee usarem os mesmos modelos editáveis do “Gerar oferta”, expor esses modelos na página “Ganchos e CTAs”, adicionar o preset “Automático clássico” equivalente à copy automática antiga e mostrar as variáveis disponíveis para a usuária.

**Conclusão da auditoria:** o objetivo original já está implementado no código. O plano agora serve como checklist de verificação e handoff, não como roteiro para criar schema, rotas ou componentes do zero.

**Stack envolvida:** Node.js ESM, Fastify, Prisma + SQLite, Next.js dashboard, node:test.

---

## Análise STRICT atualizada

1. **Erros fatais:** não há nova mudança de runtime neste plano revisado. A maior ameaça agora é alguém reexecutar as etapas antigas e duplicar código/testes. Por isso, as tarefas antigas foram marcadas como concluídas e removidas do fluxo executável.
2. **Breaking changes:** a mudança de schema `OfferAutomation.templateKey` já existe. Qualquer deploy ainda precisa passar por `develop` → staging → validação manual antes de produção.
3. **Efeito cascata:** `mobileTemplatesJson` já é compartilhado entre “Gerar oferta”, automações e páginas de configuração. Alterações futuras devem preservar `{produto}`, `{preço}`, `{preço_de}` e `{link}` para modelos existentes.
4. **Isolamento de ambiente:** validações manuais devem acontecer em staging (`~/wabot-staging`, branch `develop`, dashboard `3006`, API `3004`). Não tocar em `.env`, banco ou PM2 de produção para esta feature.
5. **Bloqueio:** se `prisma migrate deploy`, testes, build do dashboard ou aceite em staging falharem, bloquear promoção para `main` e corrigir primeiro em `develop`/staging.

---

## Resultado da verificação item a item

| Item do plano antigo | Status no código atual | Evidência verificada | Decisão |
|---|---|---|---|
| Tarefa 1 — adicionar `templateKey` ao banco | **Feito** | `prisma/schema.prisma` já contém `templateKey String @default("automatico_classico")`; a migration `20260602120000_add_offer_automation_template_key` já existe. | **Não manter como tarefa executável.** Manter só como contexto de schema/migration já entregue. |
| Tarefa 2 — preset `automatico_classico` e variáveis novas | **Feito** | `dashboard/lib/mobileTemplateStore.js` já tem o preset; `dashboard/lib/mobileOfferComposer.js` já tem `automatico_classico`, grupos de variáveis e `OFFER_TEMPLATE_VARIABLES`; os testes cobrem o preset e tokens. | **Não reimplementar.** Manter apenas testes de regressão. |
| Tarefa 3 — dispatcher renderizar via modelos compartilhados | **Feito** | `src/offerAutomation/dispatcher.js` já importa `buildMobileOfferText`/`composeTemplates`, resolve `templateKey` e passa `templateBody` para `formatOfferMessage()`. | **Não reimplementar.** Validar por testes e envio manual em staging. |
| Tarefa 4 — API aceitar/persistir `templateKey` | **Feito** | `src/api/routes/offerAutomation.js` já valida `templateKey` com regex, persiste no POST e atualiza no PUT; testes de rota existem. | **Não reimplementar.** Manter como regressão. |
| Tarefa 5 — seletor de modelo nas telas de ofertas automáticas | **Feito** | `dashboard/app/dashboard/ofertas-automaticas/page.js` e `dashboard/app/m/op/automations/page.js` carregam templates, usam `templateKey` no formulário e mostram “Modelo da mensagem”. | **Não reimplementar.** Validar visualmente em staging. |
| Tarefa 6 — expor modelos/variáveis em “Ganchos e CTAs” | **Feito** | `dashboard/app/dashboard/variacoes-de-texto/page.js` já mostra “Variáveis dos modelos de oferta” e “Modelos de oferta”; `dashboard/app/m/account/variations/page.js` já aponta para edição de modelos e variáveis. | **Não reimplementar.** Validar UX em staging. |
| Tarefa 7 — regressão completa e aceite em staging | **Ainda faz sentido** | Testes e build precisam ser rodados na branch final; aceite manual depende do deploy em `develop` para staging. | **Manter como tarefa ativa.** |

---

## Mapa atual do código relevante

- `prisma/schema.prisma` — `OfferAutomation` já possui `templateKey` com default `automatico_classico`.
- `prisma/migrations/20260602120000_add_offer_automation_template_key/migration.sql` — migration já adiciona a coluna `templateKey`.
- `dashboard/lib/mobileTemplateStore.js` — fonte dos presets e persistência em `BotConfig.mobileTemplatesJson`; inclui `automatico_classico`.
- `dashboard/lib/mobileOfferComposer.js` — fonte das opções de modelo, variáveis visíveis e renderização de `{produto}`, `{preço}`, `{preço_de}`, `{desconto}`, `{rating}`, `{vendas}`, `{link}` e `{loja}`.
- `src/offerAutomation/dispatcher.js` — automações resolvem o template salvo no `mobileTemplatesJson` e renderizam a mensagem via composer compartilhado antes de aplicar variações.
- `src/api/routes/offerAutomation.js` — POST/PUT aceitam e validam `templateKey`.
- `dashboard/app/dashboard/ofertas-automaticas/page.js` — formulário desktop de automações já permite escolher “Modelo da mensagem”.
- `dashboard/app/m/op/automations/page.js` — formulário mobile de automações já permite escolher “Modelo da mensagem”.
- `dashboard/app/dashboard/variacoes-de-texto/page.js` — desktop “Ganchos e CTAs” já mostra/edita modelos e lista variáveis.
- `dashboard/app/m/account/variations/page.js` — mobile “Ganchos e CTAs” já direciona a usuária para edição de modelos/variáveis.
- `test/mobile-offer-composer.test.js`, `test/offer-automation.test.js`, `test/offer-automation-extended.test.js` — testes já cobrem preset, variáveis, `templateKey`, fallback e rota.

---

## Tarefa ativa 1: rodar regressão local antes de qualquer merge/deploy

**Arquivos esperados:** nenhum arquivo novo. Se algum teste falhar e exigir correção, criar um novo plano ou uma tarefa específica para o bug encontrado.

- [ ] **Etapa 1: Rodar testes unitários/backend**

```bash
npm test
```

Esperado: PASS.

- [ ] **Etapa 2: Rodar typecheck**

```bash
npm run typecheck
```

Esperado: PASS.

- [ ] **Etapa 3: Rodar guard de configuração e build do dashboard**

```bash
cd dashboard && npm run guard:config-page && npm run build
```

Esperado: PASS.

- [ ] **Etapa 4: Confirmar que não há drift de implementação não intencional**

```bash
git status --short
```

Esperado: nenhum arquivo sem commit além de documentação ou correções intencionais relacionadas a bugs encontrados nos passos anteriores.

---

## Tarefa ativa 2: aceite manual em staging (`develop` → porta 3006)

**Pré-condição:** merge da branch em `develop` e deploy automático concluído em staging. Não executar validação em produção.

Validar em `http://178.105.54.0:3006`:

1. Abrir **Dashboard → Ganchos e CTAs**.
2. Confirmar que a página mostra **Modelos de oferta**.
3. Confirmar que a página lista visivelmente as variáveis `{produto}`, `{preço}`, `{preço_de}`, `{desconto}`, `{rating}`, `{vendas}`, `{link}` e `{loja}`.
4. Confirmar que existe o preset **Automático clássico**.
5. Confirmar que o corpo do preset mantém a copy clássica:

```txt
🏷️ *{produto}*

💰 ~{preço_de}~ → *{preço}* (*{desconto}*)
{rating} | {vendas}

👉 {link}
```

6. Criar ou editar uma automação de oferta e escolher **Automático clássico**.
7. Clicar em **Enviar agora** e confirmar que a mensagem no WhatsApp mantém o formato antigo.
8. Criar um modelo customizado com o corpo:

```txt
🔥 TESTE AUTOMÁTICO
{produto}
{preço}
{desconto}
{rating}
{vendas}
{link}
```

9. Editar a automação para usar esse modelo customizado.
10. Clicar em **Enviar agora** e confirmar que a mensagem no WhatsApp usa o formato customizado.
11. Abrir mobile `/m/op/offer` e confirmar que o **Gerar oferta** manual ainda usa modelos normalmente.
12. Abrir mobile `/m/account/variations` e confirmar que a tela direciona para edição de modelos/variáveis.

---

## Se a validação encontrar bug

Não voltar ao plano antigo. Criar uma correção pequena e específica a partir do bug observado:

1. Descrever o comportamento esperado vs. observado.
2. Adicionar ou ajustar teste focado no bug.
3. Corrigir o menor conjunto possível de arquivos.
4. Rodar o teste focado, depois a regressão relevante.
5. Fazer commit novo e validar novamente em staging.

---

## O que foi removido do fluxo executável

As instruções antigas para criar migration, adicionar preset, alterar dispatcher, alterar API e montar seletores foram removidas como tarefas executáveis porque já estão refletidas no código atual. Mantê-las como passos pendentes era perigoso: poderia levar a duplicação de testes, reimplementação de lógica já entregue ou regressões em telas que já funcionam.

---

## Handoff atual

Plano revisado e salvo em `docs/superpowers/plans/2026-06-02-offer-automation-mobile-templates.md`.

Próxima ação recomendada: executar a **Tarefa ativa 1** localmente e, após merge em `develop`, executar a **Tarefa ativa 2** em staging na porta `3006`.
