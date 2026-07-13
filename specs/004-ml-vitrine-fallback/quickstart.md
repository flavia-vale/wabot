# Quickstart — Validação do fallback de vitrine do ML

Guia para provar, ponta a ponta, que a correção funciona e não regride. Referencia
o [contract](./contracts/vitrine-fallback.md) e o [data-model](./data-model.md) em
vez de duplicar detalhes.

## Pré-requisitos

- Repo em `~/wabot-staging` (branch `develop`) para validação em staging.
- Node instalado (mesma versão do runtime do worker).
- Para o passo de produção (diagnóstico): acesso SSH à VPS de produção,
  `~/wabot/prisma/prod.db`, `/home/deploy/BOTinho-shared/logs/bot.log`.

## Passo 0 — Diagnóstico em produção (obrigatório antes de codar — FR-008)

Rodar os comandos da seção "Investigação obrigatória em produção" de
[research.md](./research.md) e registrar a evidência (linha de `MessageLog`, estado
do `vitrineUrl` na credencial, linhas de `bot.log`). **Só declarar a causa raiz
depois disso.** Expectativa: identificar qual das hipóteses A/B/C/D ocorreu no
evento de 12/07/2026 21:14.

## Passo 1 — Testes automatizados (node:test)

```bash
cd ~/wabot            # ou ~/wabot-staging
node --test test/ml-vitrine-fallback.test.js
node --test test/mercadolivre-resolve.test.js   # regressão do conversor existente
```

Esperado: verde. O novo arquivo cobre os 6 casos do contrato — em especial:
- vitrine cadastrada → fallback usa a vitrine (não "ignorado");
- link de produto → NÃO substituído pela vitrine (zero falso positivo);
- coerência mensagem×status (nunca "saiu usando sua vitrine" junto de "ignorado").

Um teste que falha **antes** do fix e passa **depois** é o critério de FR-007/SC-006.

## Passo 2 — Validação manual em staging

1. Merge da feature em `develop` → autodeploy staging (`api-staging`,
   `visual-staging`). Staging canônico em `inline`.
2. Garantir que a credencial ML de teste em staging tem um `vitrineUrl` próprio
   válido cadastrado (Painel → IDs de afiliada → Mercado Livre).
3. Provocar/espelhar uma mensagem de **vitrine/perfil de terceiro** do ML
   (link `/social/...` ou lista de recomendações não convertível).
   - **Esperado (US1)**: a oferta sai para o grupo de destino com o link da vitrine
     cadastrada; no painel de logs, status de **sucesso** e `convertedUrl` = vitrine;
     a copy exibida é coerente ("saiu usando sua vitrine"). Sem linha "ignorado"
     contraditória para a mesma mensagem.
4. Espelhar uma mensagem com **link de produto** ML conversível.
   - **Esperado (US2)**: sai com o link de produto convertido (afiliado da usuária);
     a vitrine NÃO é usada.
5. Testar credencial **sem** `vitrineUrl` + vitrine de terceiro.
   - **Esperado (US1.3 / FR-004)**: a copy orienta cadastrar a vitrine e **não**
     afirma que a oferta saiu.

Painel de logs staging: `http://178.105.54.0:3006` → Logs.

## Passo 3 — Verificação de invariantes (checar em staging)

- **FR-003 (segurança)**: em nenhum caso o link original de terceiro aparece no
  `convertedUrl`/mensagem enviada.
- **FR-006 (recusa ambígua)**: link ML via encurtador não resolvido + recusa não
  vira "vitrine"; mantém descarte seguro.
- **SC-004 (coerência)**: nenhuma mensagem "saiu usando sua vitrine" coexistindo com
  status "ignorado".

## Passo 4 — Promoção a produção

Só após staging validado: PR `develop → main` (FR-009). Merge dispara autodeploy de
prod. Confirmar no painel de prod que uma oferta de vitrine com vitrine cadastrada
sai corretamente (não "ignorado").

> Nota (Assumptions da spec): a atribuição de comissão do ML ao clicar na vitrine só
> se confirma em **dispositivo real** — esta feature garante a **saída correta do
> link**, não a atribuição de comissão do ML em si.
