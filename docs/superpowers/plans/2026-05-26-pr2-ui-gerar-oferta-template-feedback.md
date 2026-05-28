# PR2 — UI/UX do Gerar Oferta (template oculto + status de conversão) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar no frontend da ferramenta “Gerar oferta” o novo template padrão, oculto por default, com feedback visual claro (verde/vermelho) sobre conversão do link retornada por `/scrape-offer`.

**Architecture:** Reusar `OfferBuilder` como componente central para os modos `standalone` e `inline`, adicionando estado de `conversionStatus` baseado no payload da API (`offerUrl` + `conversion`). A UX seguirá progressão: colar link → gerar oferta → exibir status de conversão + preview editável. O editor de template ficará em disclosure progressivo (“Editar template”) para reduzir carga cognitiva inicial.

**Tech Stack:** Next.js App Router, React Client Components, Tailwind utilitário já existente no dashboard, API client em `dashboard/lib/api.js`.

---

## Classificação da demanda
- **[HÍBRIDO]**: envolve engenharia frontend (estado/integração API) + UX de conversão e confiança operacional.

## Risco (STRICT) — pré-análise
1. **Erros fatais:** risco de regressão em `OfferBuilder` afetando duas superfícies (`/dashboard/gerar-oferta` e card inline de `/dashboard/converte-links`). Mitigar com testes de interface/componentes e smoke manual.
2. **Breaking changes:** sem breaking de API (backend já entregue na PR1); só consumo de novos campos opcionais.
3. **Efeito cascata:** mudanças no template default e toggles podem afetar copy final e operação de envio manual.
4. **Isolamento:** sem alteração de DB/ENV/infra; validar apenas em `develop` (3006).
5. **Bloqueio:** não há bloqueio fatal. Seguir staging-first obrigatório.

---

## Regras de UI/UX aplicadas (ui-ux-pro-max + frontend-design)
- **Progressive disclosure:** esconder editor avançado por padrão e revelar sob ação “Editar template”.
- **Feedback sem ambiguidade:** status de conversão com cor + ícone + texto explícito (não depender só da cor).
- **Acessibilidade:** usar `role="status"`/`aria-live="polite"` para mensagens dinâmicas.
- **Touch targets:** botões com altura confortável (mínimo ~44px em mobile).
- **Consistência visual:** manter linguagem dos cards de alerta do dashboard (`Alert`) e tons semânticos.
- **Resiliência UX:** se falhar conversão, oferta continua gerada com link original e instrução clara para revisão.

---

## File structure (PR2)
- **Modify:** `dashboard/components/OfferBuilder.js`
  - Novo template default solicitado.
  - Template hidden by default (todos os modos).
  - Estado de `conversionStatus` e banner visual.
  - Uso de `offerUrl` retornado pela API na mensagem gerada.
- **Modify:** `dashboard/app/dashboard/gerar-oferta/page.js`
  - Ajuste de microcopy para refletir conversão automática + edição opcional.
- **Modify (se necessário):** `dashboard/lib/api.js`
  - Tipagem/documentação informal do retorno de `scrapeOffer` (sem quebra).
- **Create tests:** `dashboard/components/__tests__/OfferBuilder.test.js` (ou caminho de testes equivalente já usado no dashboard)
  - Cobertura do comportamento de template oculto e status de conversão.

---

### Task 1: Red — testes de comportamento UX esperado

**Files:**
- Test: `dashboard/components/__tests__/OfferBuilder.test.js`

- [ ] **Step 1: Escrever teste para template oculto por padrão**

```js
it('inicia com editor de template oculto', () => {
  render(<OfferBuilder mode="standalone" />)
  expect(screen.queryByLabelText(/variáveis/i)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /editar template/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Escrever teste para expandir editor ao clicar em Editar template**

```js
await user.click(screen.getByRole('button', { name: /editar template/i }))
expect(screen.getByRole('textbox', { name: /template/i })).toBeInTheDocument()
```

- [ ] **Step 3: Escrever teste para status verde quando `conversion.success=true`**

```js
mockScrapeOffer({ offerUrl: 'https://afiliado...', conversion: { attempted: true, success: true, usedOriginalUrl: false } })
await user.click(screen.getByRole('button', { name: /gerar oferta/i }))
expect(screen.getByText(/link convertido com sucesso/i)).toBeInTheDocument()
```

- [ ] **Step 4: Escrever teste para status vermelho quando `conversion.success=false`**

```js
mockScrapeOffer({ offerUrl: 'https://original...', conversion: { attempted: true, success: false, usedOriginalUrl: true, reasonCode: 'UNSUPPORTED_PLATFORM' } })
await user.click(screen.getByRole('button', { name: /gerar oferta/i }))
expect(screen.getByText(/link não convertido/i)).toBeInTheDocument()
```

- [ ] **Step 5: Rodar testes e confirmar FAIL inicial**

Run: `cd dashboard && npm test -- OfferBuilder`
Expected: FAIL nos novos cenários (ainda não implementados).

---

### Task 2: Green — implementar novo template padrão e disclosure do editor

**Files:**
- Modify: `dashboard/components/OfferBuilder.js`

- [x] **Step 1: Atualizar `DEFAULT_TEMPLATE` para exatamente o formato solicitado**

```txt
🛍️ {{title}}{{oldPriceBlock}}{{newPriceBlock}}

🛒 Compre aqui 👉 {{link}}
```

- [x] **Step 2: Remover sufixos não solicitados por default**

```js
// remover bloco padrão de aviso de promoção do template default
// manter suporte opcional de groupCtaBlock apenas se usuário habilitar CTA
```

- [x] **Step 3: Garantir `showTemplate` default false**

```js
const [showTemplate, setShowTemplate] = useState(false)
```

- [x] **Step 4: Melhorar label do toggle e acessibilidade**

```js
<button aria-expanded={showTemplate} aria-controls="offer-template-editor">Editar template</button>
```

- [ ] **Step 5: Rodar testes-alvo e confirmar PASS parcial**

Run: `cd dashboard && npm test -- OfferBuilder`
Expected: PASS para template oculto/revelado.

---

### Task 3: Green — status visual de conversão (verde/vermelho) + fallback explícito

**Files:**
- Modify: `dashboard/components/OfferBuilder.js`

- [x] **Step 1: Consumir `offerUrl` e `conversion` retornados por `api.scrapeOffer`**

```js
setGenerated({
  title: info?.title || '',
  oldPrice: info?.oldPrice || '',
  newPrice: info?.newPrice || '',
  link: info?.offerUrl || trimmed,
})
setConversionStatus(info?.conversion || null)
```

- [x] **Step 2: Renderizar banner de sucesso (verde) quando convertido**

```js
if (conversionStatus?.attempted && conversionStatus?.success) {
  // badge/alert success com role="status"
}
```

- [x] **Step 3: Renderizar banner de atenção (vermelho) quando fallback original**

```js
if (conversionStatus?.attempted && !conversionStatus?.success) {
  // mensagem: link não convertido; oferta gerada com original
  // incluir reasonCode/reasonMessage de forma amigável
}
```

- [x] **Step 4: Garantir que preview e cópia usem `generated.link` efetivo**

```js
link: generated?.link || link
```

- [x] **Step 5: Rodar testes-alvo e confirmar PASS**

Run: `cd dashboard && npm test -- OfferBuilder`
Expected: PASS nos cenários verde/vermelho.

---

### Task 4: Polimento de UX em página standalone + regressão rápida

**Files:**
- Modify: `dashboard/app/dashboard/gerar-oferta/page.js`
- Modify: `dashboard/components/OfferBuilder.js` (se necessário)

- [x] **Step 1: Ajustar microcopy da página para refletir novo fluxo**

```txt
Cole seu link e clique em gerar oferta. Vamos tentar converter automaticamente; se não der, seguimos com o link original e avisamos você.
```

- [x] **Step 2: Verificar mobile states (botões, wrapping, status banners)**

```bash
cd dashboard && npm run build
```
Expected: build verde e sem regressão de SSR/CSR para página.

- [ ] **Step 3: Executar validação manual em staging (3006) após merge em develop**

Checklist:
- link convertido: banner verde + mensagem com link convertido;
- link sem conversão: banner vermelho + fallback claro;
- template não aparece inicialmente;
- ao clicar “Editar template”, editor aparece;
- mensagem final segue template padrão solicitado.

- [x] **Step 4: Commit**

```bash
git add dashboard/components/OfferBuilder.js dashboard/app/dashboard/gerar-oferta/page.js dashboard/components/__tests__/OfferBuilder.test.js
git commit -m "feat(dashboard): aplica UX de conversao e template oculto no gerar oferta"
```

---

## Critérios de aceite PR2
1. Template padrão exatamente:
   - `🛍️ {{title}}{{oldPriceBlock}}{{newPriceBlock}}`
   - `🛒 Compre aqui 👉 {{link}}`
2. Editor de template oculto por padrão e visível somente após clique em “Editar template”.
3. Banner verde em conversão bem-sucedida e vermelho em fallback original.
4. Oferta sempre gerada, mesmo sem conversão (com aviso explícito).
5. Fluxo standalone e inline continuam funcionais.

## Pós-PR2 (handoff)
- Validar manualmente na staging `http://178.105.54.0:3006`.
- Se aprovado, seguir fluxo normal `feature -> develop` e só depois `develop -> main`.



## Status de execução (atualizado em 2026-05-26)

### ✅ Feito na PR2
- `OfferBuilder` atualizado com template padrão solicitado exatamente.
- Editor de template agora inicia oculto por padrão e abre via “Editar template”.
- Acessibilidade do toggle aplicada (`aria-expanded`, `aria-controls`, `aria-label` no editor).
- Consumo de `offerUrl` e `conversion` do `/scrape-offer` implementado.
- Feedback visual implementado:
  - verde para conversão bem-sucedida,
  - vermelho para fallback com link original + motivo.
- Microcopy da página `/dashboard/gerar-oferta` atualizada para o novo fluxo.
- Build do dashboard validado com sucesso (`cd dashboard && npm run build`).

### 🟡 Ainda falta
1. **Validação manual em staging (3006):**
   - executar checklist E2E após merge em `develop`.
