# Issues de Design — Componentes Compartilhados

Este arquivo registra issues prontas para serem copiadas para o GitHub Issues. Elas foram derivadas da auditoria de UI/UX dos componentes `Alert`, `ConfirmDialog`, `LoadingState`, `ErrorState` e `EmptyState` em `dashboard/components/`.

## Issue 1 — Padronizar semântica acessível do `Alert` por tipo

**Tipo:** Acessibilidade / Design System  
**Prioridade:** P0  
**Status recomendado:** 🚨 Crítico  
**Componentes relacionados:**
- `dashboard/components/Alert.js`

### Problema
`Alert` sempre usa `role="alert"` e `aria-live="polite"`, independentemente do tipo. Erros deveriam ser assertivos; sucesso/info podem ser `status`/polite.

### Impacto no usuário
- Leitores de tela podem receber prioridade inadequada para erros.
- Mensagens informativas podem ser anunciadas como alertas críticos.
- Telas criam wrappers `aria-live` redundantes para compensar.

### Critérios de aceite
- `error` deve usar semântica assertiva.
- `success`, `info` e `warning` devem usar semântica apropriada.
- Permitir override via props quando necessário.
- Rodar lint e build após a alteração.

### Sugestão de solução
Adicionar props `role` e `ariaLive`, com defaults por tipo.

---

## Issue 2 — Melhorar acessibilidade do `ConfirmDialog`

**Tipo:** Acessibilidade / Modal / Design System  
**Prioridade:** P0  
**Status recomendado:** 🚨 Crítico  
**Componentes relacionados:**
- `dashboard/components/ConfirmDialog.js`

### Problema
`ConfirmDialog` não define `role="dialog"`, `aria-modal`, labels por id, fechamento por Escape ou gerenciamento de foco.

### Impacto no usuário
- Leitores de tela podem não identificar o modal corretamente.
- Usuários de teclado podem navegar para trás do overlay.
- Ações destrutivas ficam menos seguras/acessíveis.

### Critérios de aceite
- Modal deve ter `role="dialog"` e `aria-modal="true"`.
- Título e descrição devem ser ligados por `aria-labelledby`/`aria-describedby`.
- Foco inicial deve ir para ação segura ou título.
- Escape deve cancelar/fechar quando apropriado.

### Sugestão de solução
Implementar foco/ARIA no componente ou adotar biblioteca de dialog acessível.

---

## Issue 3 — Adicionar semântica de status ao `LoadingState`

**Tipo:** Acessibilidade / Feedback de sistema  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Componentes relacionados:**
- `dashboard/components/States.js`

### Problema
`LoadingState` renderiza apenas um parágrafo visual com mensagem. Não há `role="status"` ou `aria-live`.

### Impacto no usuário
- Leitores de tela podem não perceber carregamentos dinâmicos.
- Estados assíncronos ficam predominantemente visuais.
- Telas precisam repetir semântica manualmente.

### Critérios de aceite
- `LoadingState` deve usar `role="status"` ou aceitar prop para isso.
- Mensagem deve continuar customizável.
- Visual atual deve ser preservado.

### Sugestão de solução
Renderizar:

```jsx
<p role="status" aria-live="polite" className="...">{message}</p>
```

---

## Issue 4 — Melhorar `EmptyState` com título, descrição e ação opcional

**Tipo:** UX / Estado vazio / Design System  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Componentes relacionados:**
- `dashboard/components/States.js`

### Problema
`EmptyState` mostra apenas um parágrafo. Muitas telas precisam de empty states mais orientados à ação.

### Impacto no usuário
- Estados vazios ficam pouco explicativos.
- Usuário pode não saber o próximo passo.
- Telas repetem soluções locais.

### Critérios de aceite
- Permitir título, descrição, ação e callback/link opcional.
- Manter compatibilidade com uso atual por `message`.
- Visual deve seguir padrão do dashboard.

### Sugestão de solução
Expandir API do componente:

```jsx
<EmptyState title="Nenhum grupo" message="Carregue grupos do WhatsApp." actionLabel="Carregar" />
```

---

## Issue 5 — Padronizar foco visível em componentes compartilhados

**Tipo:** Acessibilidade / Design System / Teclado  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Componentes relacionados:**
- `dashboard/components/Alert.js`
- `dashboard/components/ConfirmDialog.js`
- `dashboard/components/States.js`

### Problema
Botões de componentes compartilhados não possuem um padrão explícito de `focus-visible`. Isso força cada tela a resolver foco isoladamente.

### Impacto no usuário
- Navegação por teclado fica inconsistente.
- Acessibilidade depende do estilo padrão do navegador.
- Componentes críticos como confirmação ficam menos seguros.

### Critérios de aceite
- Definir classes de foco para botões em componentes compartilhados.
- Garantir contraste adequado em botões destrutivos e neutros.
- Não remover estilos de hover existentes.

### Sugestão de solução
Adicionar classes `focus-visible:ring-*` aos botões de `ConfirmDialog` e ações de `ErrorState`.
