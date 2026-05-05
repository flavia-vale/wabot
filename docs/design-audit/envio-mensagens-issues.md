# Issues de Design — Envio de Mensagens

Este arquivo registra issues prontas para serem copiadas para o GitHub Issues. Elas foram derivadas da auditoria de UI/UX da tela `dashboard/app/dashboard/envio/page.js`, responsável por envio imediato, agendamento e gerenciamento de mensagens agendadas.

## Issue 1 — Substituir `confirm()` nativo por `ConfirmDialog` acessível

**Tipo:** UX / Acessibilidade / Ação crítica  
**Prioridade:** P0  
**Status recomendado:** 🚨 Crítico  
**Tela:** Envio de Mensagens  
**Arquivos relacionados:**
- `dashboard/app/dashboard/envio/page.js`
- `dashboard/components/ConfirmDialog.js`

### Problema
O envio imediato usa `confirm()` nativo para confirmar broadcast. Esse padrão é pouco customizável, inconsistente com o design system e oferece experiência limitada em acessibilidade/copy.

### Impacto no usuário
- Ação crítica de envio para todos os grupos fica com confirmação genérica.
- A UI fica inconsistente com outros fluxos que usam `ConfirmDialog`.
- A confirmação não consegue mostrar resumo, grupos afetados ou tamanho da mensagem.

### Critérios de aceite
- Usar `ConfirmDialog` ou modal equivalente para broadcast.
- Mostrar claramente que a mensagem será enviada para todos os grupos de destino.
- Preservar prevenção para primeira vez e mensagens longas, ou revisar a regra.
- Rodar lint e build após a alteração.

### Sugestão de solução
Criar estado `showBroadcastConfirm` e acionar `api.broadcastSend` somente após confirmação no modal.

---

## Issue 2 — Evitar ocultar confirmação de broadcast permanentemente via `localStorage`

**Tipo:** UX / Segurança operacional / Prevenção de erro  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Envio de Mensagens  
**Arquivos relacionados:**
- `dashboard/app/dashboard/envio/page.js`

### Problema
Após a primeira confirmação, a tela grava `broadcastConfirmShown` no `localStorage` e deixa de confirmar envios curtos. Isso pode reduzir proteção para uma ação de alto impacto.

### Impacto no usuário
- Usuário pode disparar mensagens para todos os grupos por engano em usos futuros.
- O risco aumenta em contas compartilhadas ou dispositivos reutilizados.
- A prevenção fica baseada no navegador, não no contexto da ação.

### Critérios de aceite
- Reavaliar se todo envio imediato deve exigir confirmação.
- Se houver opção “não perguntar novamente”, ela deve ser explícita.
- Mensagens para muitos grupos ou com links devem sempre ter confirmação, se aplicável.

### Sugestão de solução
Manter confirmação sempre, ou trocar por uma opção explícita e reversível nas configurações.

---

## Issue 3 — Exibir contagem de caracteres e prévia da mensagem

**Tipo:** UX / Prevenção de erro / Conteúdo  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Envio de Mensagens  
**Arquivos relacionados:**
- `dashboard/app/dashboard/envio/page.js`

### Problema
Os textareas de envio e agendamento não mostram contagem de caracteres, prévia ou resumo antes do envio/agendamento.

### Impacto no usuário
- Usuário pode enviar texto muito longo sem perceber.
- Erros de copy ficam mais prováveis.
- A regra especial para mensagens acima de 280 caracteres fica invisível.

### Critérios de aceite
- Mostrar contagem de caracteres nos campos de mensagem.
- Avisar quando mensagem for longa.
- Opcionalmente, mostrar prévia no modal de confirmação.

### Sugestão de solução
Adicionar contador abaixo do textarea:

```text
123 caracteres
```

---

## Issue 4 — Validar agendamento com feedback contextual de data/hora

**Tipo:** UX / Formulário / Agendamento  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Envio de Mensagens  
**Arquivos relacionados:**
- `dashboard/app/dashboard/envio/page.js`

### Problema
O campo `datetime-local` usa `min`, mas não há validação contextual ou mensagem se o usuário selecionar horário inválido, nem confirmação do horário final com fuso.

### Impacto no usuário
- Usuário pode se confundir com fuso local versus servidor.
- Erros aparecem apenas após submit/API.
- Agendamento pode parecer incerto.

### Critérios de aceite
- Validar data/hora antes do submit.
- Exibir resumo: “Será enviado em DD/MM/AAAA HH:mm (fuso X)”.
- Mensagem de erro deve aparecer perto do campo.

### Sugestão de solução
Calcular preview com `new Date(schedAt)` e exibir abaixo do input quando preenchido.

---

## Issue 5 — Melhorar filtros de mensagens agendadas em mobile

**Tipo:** UI / Responsividade / Filtros  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Envio de Mensagens  
**Arquivos relacionados:**
- `dashboard/app/dashboard/envio/page.js`

### Problema
Os filtros de status são renderizados em linha com botões pequenos. Em telas menores, podem ficar apertados ou quebrar sem hierarquia.

### Impacto no usuário
- Filtros ficam difíceis de tocar em mobile.
- A lista de mensagens agendadas fica menos navegável.
- Usuário pode não perceber o filtro ativo.

### Critérios de aceite
- Filtros devem quebrar linha de forma confortável.
- Estado ativo deve ser claro.
- Botões devem manter área de toque adequada.

### Sugestão de solução
Usar `flex-wrap`, espaçamento maior e `aria-pressed` no filtro ativo.

---

## Issue 6 — Adicionar contexto ao cancelamento de agendamento

**Tipo:** UX / Ação destrutiva / Prevenção de erro  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Envio de Mensagens  
**Arquivos relacionados:**
- `dashboard/app/dashboard/envio/page.js`
- `dashboard/components/ConfirmDialog.js`

### Problema
O cancelamento usa confirmação, mas a mensagem pode ser genérica e não mostra prévia da mensagem ou data agendada.

### Impacto no usuário
- Usuário pode cancelar o agendamento errado.
- Falta contexto em listas com mensagens parecidas.
- A prevenção de erro fica limitada.

### Critérios de aceite
- Modal deve mostrar data/hora e trecho da mensagem.
- A ação deve permanecer desabilitada durante cancelamento.
- Após cancelar, lista deve atualizar e mostrar feedback.

### Sugestão de solução
Guardar objeto do agendamento como alvo, não apenas `id`.
