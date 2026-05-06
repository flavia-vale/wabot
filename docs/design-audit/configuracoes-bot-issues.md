# Issues de Design — Configurações do Bot

Este arquivo registra issues prontas para serem copiadas para o GitHub Issues. Elas foram derivadas da auditoria de UI/UX da tela `dashboard/app/dashboard/configuracoes/page.js`, responsável por ajustar delay, plataformas habilitadas, palavras bloqueadas e mensagem de boas-vindas.

## Issue 1 — Impedir ou confirmar salvamento sem plataformas habilitadas

**Tipo:** UX / Prevenção de erro / Regra operacional  
**Prioridade:** P0  
**Status recomendado:** 🚨 Crítico  
**Tela:** Configurações do Bot  
**Arquivos relacionados:**
- `dashboard/app/dashboard/configuracoes/page.js`

### Problema
A tela permite desmarcar todas as plataformas e salvar `platforms` vazio. Isso pode deixar o bot sem conversores ativos, embora a seção seja apresentada como “Plataformas habilitadas”.

### Impacto no usuário
- O bot pode parar de converter links sem o usuário perceber.
- A falha pode aparecer somente na operação diária, longe da tela de configuração.
- A configuração fica sem prevenção para um estado potencialmente inválido.

### Critérios de aceite
- Ao salvar, validar que pelo menos uma plataforma está habilitada; ou
- Se o produto permitir desligar todas, exibir confirmação explícita com impacto.
- Erro/aviso deve aparecer no card de plataformas.
- Rodar lint e build após a alteração.

### Sugestão de solução
Antes de salvar:

```js
if (!form.platforms.split(',').filter(Boolean).length) {
  setError('Selecione pelo menos uma plataforma para o bot converter links.')
  return
}
```

---

## Issue 2 — Padronizar feedback de salvar com `Alert`

**Tipo:** UI / Acessibilidade / Feedback de sistema  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Configurações do Bot  
**Arquivos relacionados:**
- `dashboard/app/dashboard/configuracoes/page.js`
- `dashboard/components/Alert.js`

### Problema
Erro e sucesso de salvamento aparecem como parágrafos simples, apesar de já existirem padrões de feedback como `Alert` e `ErrorState` no dashboard.

### Impacto no usuário
- Feedback de erro/sucesso tem baixa hierarquia visual.
- A experiência fica inconsistente com outras telas.
- Leitores de tela podem ter comportamento inconsistente entre páginas.

### Critérios de aceite
- Erro de salvamento deve usar `Alert type="error"` ou equivalente.
- Sucesso deve usar `Alert type="success"` ou equivalente.
- Mensagens devem continuar com semântica acessível.
- Erro deve ser limpo em nova tentativa.

### Sugestão de solução
Usar:

```jsx
{error && <Alert type="error" title="Não foi possível salvar" message={error} />}
{success && <Alert type="success" title="Configurações salvas" />}
```

---

## Issue 3 — Explicar formato e efeito das palavras bloqueadas

**Tipo:** UX Writing / Prevenção de erro / Formulário  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Configurações do Bot  
**Arquivos relacionados:**
- `dashboard/app/dashboard/configuracoes/page.js`

### Problema
O campo “Palavras bloqueadas” é um input livre com placeholder de exemplo, mas não explica separador, aplicação da regra, case sensitivity ou se termos parciais contam.

### Impacto no usuário
- Usuário pode digitar em formato diferente do esperado.
- Mensagens podem ser bloqueadas ou permitidas de forma inesperada.
- A configuração parece simples, mas tem consequência operacional alta.

### Critérios de aceite
- Informar como separar palavras, por exemplo vírgulas.
- Informar o efeito: mensagens contendo essas palavras serão ignoradas/bloqueadas.
- Se houver regra de maiúsculas/minúsculas, documentar.
- Considerar chips/tags em melhoria futura.

### Sugestão de solução
Adicionar microcopy:

```text
Separe por vírgulas. O bot ignora mensagens que contenham qualquer uma dessas palavras.
```

---

## Issue 4 — Adicionar recomendação de valores para delay

**Tipo:** UX Writing / Ajuda contextual / Operação  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Configurações do Bot  
**Arquivos relacionados:**
- `dashboard/app/dashboard/configuracoes/page.js`

### Problema
A tela informa que o delay evita bloqueios, mas não recomenda valores seguros ou explica quando aumentar/reduzir.

### Impacto no usuário
- Usuário pode escolher delay muito baixo e aumentar risco operacional.
- Usuário pode escolher delay muito alto e reduzir velocidade sem necessidade.
- A configuração exige conhecimento prévio.

### Critérios de aceite
- Exibir faixa recomendada ou explicação curta.
- Manter validação de mínimo menor/igual ao máximo.
- Erro de delay deve aparecer próximo aos campos.

### Sugestão de solução
Adicionar texto:

```text
Recomendado: 5 a 15 segundos para operações leves. Use valores maiores em grupos com alto volume.
```

---

## Issue 5 — Contextualizar a mensagem de boas-vindas

**Tipo:** UX Writing / Clareza de recurso  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Configurações do Bot  
**Arquivos relacionados:**
- `dashboard/app/dashboard/configuracoes/page.js`

### Problema
A tela permite editar “Mensagem de boas-vindas”, mas não explica quando ela será enviada, para quem, nem se suporta variáveis ou formatação.

### Impacto no usuário
- Usuário pode configurar um texto sem saber se terá efeito real.
- Pode haver expectativa incorreta sobre o comportamento do bot.
- A seção fica ambígua.

### Critérios de aceite
- Explicar quando a mensagem é usada.
- Se não houver uso ativo, ocultar a seção ou marcar como futuro/experimental.
- Informar se variáveis são suportadas.

### Sugestão de solução
Adicionar descrição abaixo do título da seção, alinhada ao comportamento real do backend.

---

## Issue 6 — Contextualizar loading inicial da tela

**Tipo:** Acessibilidade / Feedback de sistema  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Configurações do Bot  
**Arquivos relacionados:**
- `dashboard/app/dashboard/configuracoes/page.js`
- `dashboard/components/States.js`

### Problema
Durante o carregamento inicial, a tela usa `<LoadingState />`, que mostra apenas “Carregando...”.

### Impacto no usuário
- Feedback é genérico.
- Usuário não sabe que as configurações do bot estão sendo carregadas.
- A experiência é menos polida em conexões lentas.

### Critérios de aceite
- Usar mensagem contextual como “Carregando configurações do bot...”.
- Manter o componente reutilizável.
- Considerar semântica `role="status"` no componente compartilhado.

### Sugestão de solução
Trocar para:

```jsx
<LoadingState message="Carregando configurações do bot..." />
```

---

## Issue 7 — Refatorar JSX condensado dos cards para melhorar manutenção

**Tipo:** Manutenibilidade / UI  
**Prioridade:** P3  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Configurações do Bot  
**Arquivos relacionados:**
- `dashboard/app/dashboard/configuracoes/page.js`

### Problema
Alguns cards estão escritos em linhas JSX muito longas, especialmente “Palavras bloqueadas” e “Mensagem de boas-vindas”. Isso dificulta revisão, evolução de UX e adição de ajuda/erros inline.

### Impacto no usuário
- Não afeta diretamente o uso atual.
- Aumenta risco de regressões em melhorias futuras.
- Dificulta adicionar validações e descrições por seção.

### Critérios de aceite
- Quebrar cards em JSX legível.
- Preservar comportamento e payload atual.
- Considerar componentes internos para seções complexas.

### Sugestão de solução
Extrair ou reorganizar em blocos:
- `DelaySettingsCard`
- `PlatformsSettingsCard`
- `BlockedKeywordsCard`
- `WelcomeMessageCard`
