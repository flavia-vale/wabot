# PR3 — Testes de UI + validação staging + polish de UX no Gerar Oferta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar os gaps da PR2 adicionando testes automatizados do `OfferBuilder`, refinando mensagens de UX por `reasonCode` e validando o fluxo E2E em staging (3006).

**Architecture:** Manter backend estável (PR1), com foco no frontend. Introduzir suíte de testes de componente para `OfferBuilder` com mocks do client `api.scrapeOffer`, consolidar mapeamento UX de erros de conversão em camada de apresentação e executar checklist operacional em staging antes de promover.

**Tech Stack:** Next.js + React Client Components, test runner do dashboard (Jest/Vitest conforme config do projeto), Testing Library (se já estiver disponível), Tailwind CSS utilitário, ambiente staging `develop` em `http://178.105.54.0:3006`.

---

## Classificação da demanda
- **[HÍBRIDO]**: engenharia frontend (testabilidade/estado) + UX operacional (mensagens de confiança e fallback para afiliados).

## Risco (STRICT) — pré-análise
1. **Erros fatais:** risco de quebrar renderização do `OfferBuilder` ao refatorar banners/mensagens.
2. **Breaking changes:** sem mudança de contrato API; risco é apenas de props/markup em componentes.
3. **Efeito cascata:** `OfferBuilder` é compartilhado entre `/dashboard/gerar-oferta` e `/dashboard/converte-links`.
4. **Isolamento:** sem alteração em DB/.env/infra; testes locais + validação manual em staging.
5. **Bloqueio:** se testes de componente exigirem stack inexistente no repo, bloquear implementação e registrar fallback técnico antes de continuar.

---

## Diretrizes UI/UX (ui-ux-pro-max + frontend-design)
- **Não depender só de cor:** todo estado verde/vermelho deve ter ícone e texto explícito.
- **Acessibilidade de status:** manter `role="status"` + `aria-live="polite"`.
- **Microcopy acionável:** mensagens de erro devem sugerir próxima ação (ex.: revisar credenciais).
- **Consistência cross-surface:** mesma semântica de mensagens no modo standalone e inline.
- **Mobile-first:** garantir legibilidade e wrapping em telas pequenas sem overflow.

---

## File structure (PR3)
- **Create:** `dashboard/components/__tests__/OfferBuilder.test.(js|jsx|ts|tsx)`
  - Testes para template oculto/expansão, status verde/vermelho, fallback de link.
- **Modify:** `dashboard/components/OfferBuilder.js`
  - Refinar texto exibido por `conversion.reasonCode` e preservar acessibilidade.
- **Modify (optional):** `dashboard/app/dashboard/gerar-oferta/page.js`
  - Ajustes finais de microcopy, se necessário após staging.
- **Modify docs:** `docs/superpowers/plans/2026-05-26-pr2-ui-gerar-oferta-template-feedback.md`
  - Atualizar status final após execução da PR3.

---

### Task 1: Levantar e preparar infraestrutura de testes do dashboard

**Files:**
- Inspect: `dashboard/package.json`
- Inspect: configs de teste já existentes no dashboard

- [ ] **Step 1: Mapear comando canônico de testes de componente no dashboard**

```bash
cd dashboard
cat package.json
```

- [ ] **Step 2: Validar se Testing Library/Jest/Vitest já estão disponíveis**

```bash
cd dashboard
npm ls @testing-library/react || true
npm ls vitest || true
npm ls jest || true
```

- [ ] **Step 3: Definir caminho mínimo sem overengineering**

Critério:
- Se stack já existir: reutilizar.
- Se não existir: adicionar configuração mínima estritamente necessária para `OfferBuilder`.

- [ ] **Step 4: Commit (se houver setup novo)**

```bash
git add dashboard/package.json dashboard/package-lock.json dashboard/<test-config-files>
git commit -m "test(dashboard): prepara infraestrutura minima para testes de componente"
```

---

### Task 2: TDD — testes do `OfferBuilder` (comportamento crítico)

**Files:**
- Create: `dashboard/components/__tests__/OfferBuilder.test.(js|jsx|ts|tsx)`

- [ ] **Step 1: RED — teste de template oculto por padrão**

```js
render(<OfferBuilder mode="standalone" />)
expect(screen.queryByLabelText(/template da oferta/i)).not.toBeInTheDocument()
expect(screen.getByRole('button', { name: /editar template/i })).toBeInTheDocument()
```

- [ ] **Step 2: RED — teste de expansão ao clicar em “Editar template”**

```js
await user.click(screen.getByRole('button', { name: /editar template/i }))
expect(screen.getByLabelText(/template da oferta/i)).toBeInTheDocument()
```

- [ ] **Step 3: RED — status verde para `conversion.success=true`**

```js
mockScrapeOffer({
  title: 'Produto',
  newPrice: '99,90',
  offerUrl: 'https://afiliado',
  conversion: { attempted: true, success: true, usedOriginalUrl: false, reasonCode: null, reasonMessage: null },
})
await user.click(screen.getByRole('button', { name: /gerar oferta/i }))
expect(screen.getByText(/link convertido com sucesso/i)).toBeInTheDocument()
```

- [ ] **Step 4: RED — status vermelho para fallback `success=false`**

```js
mockScrapeOffer({
  title: 'Produto',
  newPrice: '99,90',
  offerUrl: 'https://original',
  conversion: { attempted: true, success: false, usedOriginalUrl: true, reasonCode: 'MISSING_CREDENTIALS', reasonMessage: 'Credenciais ausentes' },
})
await user.click(screen.getByRole('button', { name: /gerar oferta/i }))
expect(screen.getByText(/link não convertido/i)).toBeInTheDocument()
expect(screen.getByText(/credenciais ausentes/i)).toBeInTheDocument()
```

- [ ] **Step 5: RED — usa `offerUrl` na prévia/mensagem final**

```js
expect(screen.getByText(/https:\/\/afiliado/i)).toBeInTheDocument()
```

- [ ] **Step 6: Rodar testes e confirmar FAIL inicial**

Run: `cd dashboard && npm test -- OfferBuilder`
Expected: FAIL pelos comportamentos ainda não implementados/mocados.

---

### Task 3: GREEN — refino de UX no `OfferBuilder` por reasonCode

**Files:**
- Modify: `dashboard/components/OfferBuilder.js`

- [ ] **Step 1: Criar mapper de mensagem amigável por `reasonCode`**

```js
function getConversionHint(status) {
  switch (status?.reasonCode) {
    case 'MISSING_CREDENTIALS': return 'Revise suas credenciais da loja em Configurações > Credenciais.'
    case 'UNSUPPORTED_PLATFORM': return 'Essa loja ainda não possui conversão automática. Revise o link antes de enviar.'
    case 'CONVERSION_TIMEOUT': return 'A conversão demorou demais agora. Você pode seguir com o link original e tentar novamente.'
    default: return status?.reasonMessage || 'A conversão não foi concluída. A oferta usou o link original.'
  }
}
```

- [ ] **Step 2: Exibir texto principal + hint secundário no banner vermelho**
- [ ] **Step 3: Garantir paridade visual entre standalone e inline**
- [ ] **Step 4: Verificar que o banner continua com `role="status"`/`aria-live="polite"`**

- [ ] **Step 5: Rodar testes do componente e confirmar PASS**

Run: `cd dashboard && npm test -- OfferBuilder`
Expected: PASS completo da suíte nova.

- [ ] **Step 6: Commit**

```bash
git add dashboard/components/OfferBuilder.js dashboard/components/__tests__/OfferBuilder.test.*
git commit -m "test+ux(dashboard): cobre OfferBuilder e melhora mensagens por reasonCode"
```

---

### Task 4: Regressão e validação final (local + staging)

**Files:**
- Modify docs status: `docs/superpowers/plans/2026-05-26-pr2-ui-gerar-oferta-template-feedback.md`

- [ ] **Step 1: Rodar build do dashboard**

Run: `cd dashboard && npm run build`
Expected: PASS sem regressão de renderização.

- [ ] **Step 2: Rodar testes backend sensíveis ao fluxo**

Run:
- `cd /workspace/wabot && node --test test/link-conversion-route.test.js`
- `cd /workspace/wabot && node --test test/image-scrapers.test.js`

Expected: PASS (garantir que PR3 frontend não tocou backend indiretamente).

- [ ] **Step 3: Validar staging manual (3006) — checklist obrigatório**

Checklist:
- fluxo com conversão bem-sucedida mostra banner verde;
- fluxo sem conversão mostra banner vermelho + dica acionável;
- template inicia oculto e abre ao clicar;
- mensagem final mantém template padrão solicitado;
- modo inline (`/dashboard/converte-links`) segue funcional.

- [ ] **Step 4: Atualizar plano PR2 com status final “concluído” (ou pendências reais)**

- [ ] **Step 5: Commit final PR3**

```bash
git add docs/superpowers/plans/2026-05-26-pr2-ui-gerar-oferta-template-feedback.md
git commit -m "docs(plan): fecha pendencias da PR2 apos execução da PR3"
```

---

## Critérios de aceite PR3
1. Existe suíte automatizada do `OfferBuilder` cobrindo estados críticos do fluxo.
2. Mensagem de fallback de conversão está mais clara e acionável por `reasonCode`.
3. Build dashboard passa sem regressões.
4. Checklist manual em staging 3006 validado.
5. Plano PR2 atualizado para refletir status final real.

