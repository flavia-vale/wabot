# PR4 — Hardening crítico do fluxo conversão + OfferBuilder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir inconsistências entre lógica e UI do OfferBuilder, elevar cobertura de testes para componente real, robustecer classificação de timeout no backend e finalizar polimentos de UX para reduzir risco operacional na geração de oferta.

**Architecture:** O plano divide em quatro frentes: (1) consolidar render do banner usando `conversionPresentation` (fonte única de verdade), (2) adicionar testes de componente para validar comportamento no DOM real, (3) tornar timeout do backend determinístico via código explícito (não inferência por string), e (4) fazer regressão + validação em staging com checklist de aceite.

**Tech Stack:** Node.js (API Fastify), Next.js/React no dashboard, testes Node (`node:test`) já existentes, camada de lógica de UI em `dashboard/lib/offerBuilderUi.js`, validação manual em staging `http://178.105.54.0:3006`.

---

## Classificação da demanda
- **[HÍBRIDO]**: envolve backend reliability + frontend UX e confiança operacional de afiliados.

## Análise de risco (STRICT)
1. **Erros fatais:** risco de regressão no `OfferBuilder` compartilhado (`standalone` + `inline`) ao mexer em render de status.
2. **Breaking changes:** baixo risco no backend se mantivermos contrato; campos legados devem permanecer intactos.
3. **Efeito cascata:** mudanças de copy/status afetam percepção de confiança e decisão do usuário antes de copiar oferta.
4. **Isolamento:** sem alteração em banco/env/infra; somente código app + testes + staging manual.
5. **Bloqueio:** se não existir stack de teste de componente no dashboard, bloquear extensão excessiva e aplicar setup mínimo incremental.

---

## Scope check (PR4)
Inclui explicitamente os pontos levantados na revisão crítica:
1. **Inconsistência frontend:** `conversionPresentation` calculado mas não usado no JSX.
2. **Gap de testes:** ausência de teste de componente real para hidden/open/green/red.
3. **Timeout frágil no backend:** hoje inferido por substring da mensagem.
4. **Polimento UX:** fallback vermelho com hierarquia de mensagem (estado + ação recomendada).

Não inclui:
- alterações de portas, PM2, `.env`, banco, migrations;
- mudanças de regra de negócio fora do fluxo de gerar oferta.

---

## File structure
- **Modify:** `dashboard/components/OfferBuilder.js`
  - Usar `conversionPresentation` no render (remover duplicidade de branch manual).
  - Melhorar hierarquia visual da mensagem de fallback (linha principal + hint).
- **Modify:** `dashboard/lib/offerBuilderUi.js`
  - Padronizar payload de apresentação (`title`, `hint`, `tone`) para suportar render mais semântico.
- **Create/Modify tests:** `dashboard/components/__tests__/OfferBuilder.test.(js|jsx|ts|tsx)`
  - Testes de componente real: template oculto, abrir ao clicar, banners corretos.
- **Modify:** `src/api/routes/linkConversion.js`
  - Substituir detecção de timeout por string por código explícito no erro.
- **Modify tests:** `test/link-conversion-route.test.js`
  - Garantir assert de `CONVERSION_TIMEOUT` específico no `/scrape-offer` quando timeout ocorrer.
- **Modify docs:** `docs/superpowers/plans/2026-05-26-pr2-ui-gerar-oferta-template-feedback.md`
  - Atualizar status final pós-hardening.

---

### Task 1: Frontend — unificar source of truth do banner de conversão

**Files:**
- Modify: `dashboard/lib/offerBuilderUi.js`
- Modify: `dashboard/components/OfferBuilder.js`

- [ ] **Step 1: RED — escrever teste que falha para uso real de `conversionPresentation`**

```js
it('renderiza banner a partir da apresentação normalizada de conversão', async () => {
  // mock scrapeOffer com reasonCode conhecido
  // espera texto de ação recomendada no banner
})
```

- [ ] **Step 2: Rodar teste e validar falha inicial**

Run: `cd dashboard && npm test -- OfferBuilder`
Expected: FAIL (banner atual ainda usa branch manual no JSX).

- [ ] **Step 3: Refatorar helper para retornar estrutura semântica**

```js
return {
  tone: 'danger',
  title: '❌ Link não convertido. A oferta foi gerada com o link original enviado.',
  hint: 'Revise as credenciais da loja em Configurações > Credenciais.'
}
```

- [ ] **Step 4: Aplicar render único no componente**

```jsx
{conversionPresentation && (
  <div role="status" aria-live="polite" ...>
    <p>{conversionPresentation.title}</p>
    {conversionPresentation.hint ? <p>{conversionPresentation.hint}</p> : null}
  </div>
)}
```

- [ ] **Step 5: Rodar testes e confirmar PASS**

Run: `cd dashboard && npm test -- OfferBuilder`
Expected: PASS no cenário de banner por apresentação normalizada.

- [ ] **Step 6: Commit**

```bash
git add dashboard/lib/offerBuilderUi.js dashboard/components/OfferBuilder.js dashboard/components/__tests__/OfferBuilder.test.*
git commit -m "refactor(ui): unifica banner de conversao via presentation model"
```

---

### Task 2: Testes de componente real — template hidden/open + verde/vermelho

**Files:**
- Create/Modify: `dashboard/components/__tests__/OfferBuilder.test.(js|jsx|ts|tsx)`

- [ ] **Step 1: RED — template inicia oculto**

```js
render(<OfferBuilder mode="standalone" />)
expect(screen.queryByLabelText(/template da oferta/i)).not.toBeInTheDocument()
```

- [ ] **Step 2: RED — abre ao clicar em “Editar template”**

```js
await user.click(screen.getByRole('button', { name: /editar template/i }))
expect(screen.getByLabelText(/template da oferta/i)).toBeInTheDocument()
```

- [ ] **Step 3: RED — banner verde quando `success=true`**

```js
expect(screen.getByText(/link convertido com sucesso/i)).toBeInTheDocument()
```

- [ ] **Step 4: RED — banner vermelho quando `success=false`**

```js
expect(screen.getByText(/link não convertido/i)).toBeInTheDocument()
expect(screen.getByText(/revise as credenciais/i)).toBeInTheDocument()
```

- [ ] **Step 5: Rodar teste e validar falha inicial**

Run: `cd dashboard && npm test -- OfferBuilder`
Expected: FAIL antes da implementação final.

- [ ] **Step 6: GREEN — implementar ajustes mínimos para passar**

- [ ] **Step 7: Rodar novamente e confirmar PASS**

Run: `cd dashboard && npm test -- OfferBuilder`
Expected: PASS completo.

- [ ] **Step 8: Commit**

```bash
git add dashboard/components/__tests__/OfferBuilder.test.* dashboard/components/OfferBuilder.js
git commit -m "test(ui): cobre hidden/open e banners de conversao no OfferBuilder"
```

---

### Task 3: Backend — timeout robusto com código explícito

**Files:**
- Modify: `src/api/routes/linkConversion.js`
- Modify: `test/link-conversion-route.test.js`

- [ ] **Step 1: RED — criar teste de timeout explícito no `/scrape-offer`**

```js
assert.equal(body.conversion.reasonCode, 'CONVERSION_TIMEOUT')
```

- [ ] **Step 2: Rodar teste e validar falha inicial**

Run: `node --test test/link-conversion-route.test.js`
Expected: FAIL (classificação atual depende de substring).

- [ ] **Step 3: Implementar erro com código no `withTimeout` path**

```js
const timeoutErr = new Error(message)
timeoutErr.code = 'CONVERSION_TIMEOUT'
reject(timeoutErr)
```

```js
if (err?.code === 'CONVERSION_TIMEOUT') {
  return { reasonCode: 'CONVERSION_TIMEOUT', reasonMessage: err.message }
}
```

- [ ] **Step 4: Rodar teste e confirmar PASS**

Run: `node --test test/link-conversion-route.test.js`
Expected: PASS no cenário específico de timeout.

- [ ] **Step 5: Commit**

```bash
git add src/api/routes/linkConversion.js test/link-conversion-route.test.js
git commit -m "fix(api): torna classificacao de timeout deterministica no scrape-offer"
```

---

### Task 4: Regressão completa + staging + fechamento de docs

**Files:**
- Modify: `docs/superpowers/plans/2026-05-26-pr2-ui-gerar-oferta-template-feedback.md`

- [ ] **Step 1: Rodar suíte de regressão local**

Run:
- `node --test test/offer-builder-ui-logic.test.js`
- `node --test test/link-conversion-route.test.js`
- `node --test test/image-scrapers.test.js`
- `cd dashboard && npm run build`

Expected: PASS geral.

- [ ] **Step 2: Validar manualmente em staging (3006) após merge em develop**

Checklist:
- template oculto inicialmente;
- abre ao clicar “Editar template”;
- banner verde no sucesso;
- banner vermelho no fallback com ação recomendada;
- modo inline continua funcional.

- [ ] **Step 3: Atualizar plano PR2 para status final**

- [ ] **Step 4: Commit final**

```bash
git add docs/superpowers/plans/2026-05-26-pr2-ui-gerar-oferta-template-feedback.md
git commit -m "docs(plan): fecha PR2 apos hardening e validacoes da PR4"
```

---

## Critérios de aceite PR4
1. `conversionPresentation` é efetivamente a única fonte de verdade do banner no componente.
2. Existem testes de componente do `OfferBuilder` cobrindo hidden/open/verde/vermelho.
3. Timeout no backend classificado por código explícito, não por texto.
4. Build e regressões locais passam.
5. Checklist de staging 3006 executado e plano PR2 atualizado.

## Self-review (cobertura dos pontos levantados)
- ✅ Inconsistência frontend (`conversionPresentation` não usado).
- ✅ Gap de teste de componente real.
- ✅ Timeout frágil por substring.
- ✅ Polimento de UX com mensagem principal + ação recomendada.
- ✅ Governança: regressão + staging + atualização de docs.

