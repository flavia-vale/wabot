# Issues de Design — Início / Status do Bot

Este arquivo registra issues prontas para serem copiadas para o GitHub Issues. Elas foram derivadas da auditoria de UI/UX da tela `dashboard/app/dashboard/inicio/page.js` e de sua função como checklist de ativação do bot.

## Issue 1 — Corrigir retry para limpar erro e reativar loading ao recarregar status

**Tipo:** UX / Feedback de sistema / Recuperação de erro  
**Prioridade:** P0  
**Status recomendado:** 🚨 Crítico  
**Tela:** Início / Status do Bot  
**Arquivos relacionados:**
- `dashboard/app/dashboard/inicio/page.js`

### Problema
A função `fetchStatus()` é usada pelo botão “Tentar novamente”, mas não limpa `loadError` antes da nova tentativa e não reativa `loading`. Se a tentativa seguinte for bem-sucedida, a mensagem de erro anterior pode continuar visível, confundindo o usuário.

### Impacto no usuário
- Usuário pode acreditar que a tela ainda está com erro mesmo após recuperar o status.
- A ação “Tentar novamente” não comunica claramente que está processando.
- Reduz confiança no estado exibido pelo dashboard.

### Critérios de aceite
- Ao clicar em “Tentar novamente”, a mensagem de erro anterior deve ser limpa imediatamente.
- A tela deve indicar que está carregando novamente.
- Após sucesso, o status atualizado deve aparecer sem erro residual.
- Após nova falha, a mensagem de erro deve reaparecer.
- Rodar lint e build após a alteração.

### Sugestão de solução
Atualizar `fetchStatus()` para limpar erro e ativar loading:

```js
async function fetchStatus() {
  setLoadError('')
  setLoading(true)
  try {
    const data = await api.dashboardStatus()
    setStatus(data)
  } catch {
    setLoadError('Não foi possível carregar o status agora. Verifique sua conexão e tente novamente.')
  } finally {
    setLoading(false)
  }
}
```

---

## Issue 2 — Renomear título e subtítulo para comunicar checklist de ativação

**Tipo:** UX Writing / Onboarding  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Início / Status do Bot  
**Arquivos relacionados:**
- `dashboard/app/dashboard/inicio/page.js`

### Problema
O título “Início” e o subtítulo “Status do seu bot” são corretos, mas genéricos. Eles não comunicam claramente que a tela orienta o usuário a completar o setup necessário para ativar o bot.

### Impacto no usuário
- Usuário novo pode não entender que esta é a tela principal de onboarding.
- A tela parece passiva, como um status técnico, em vez de uma jornada guiada.
- O valor dos passos fica menos evidente.

### Critérios de aceite
- O título deve comunicar que a tela é um checklist/setup/onboarding.
- O subtítulo deve explicar o objetivo da sequência de passos.
- A nova copy deve continuar curta e adequada ao espaço atual.
- Validar visualmente em mobile e desktop.

### Sugestão de solução
Trocar para algo como:

```text
Checklist de ativação
Complete estes passos para deixar o bot pronto para converter e postar links.
```

---

## Issue 3 — Exibir progresso numérico do setup

**Tipo:** UX / Motivação / Onboarding  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Início / Status do Bot  
**Arquivos relacionados:**
- `dashboard/app/dashboard/inicio/page.js`

### Problema
A tela informa se o bot está ativo ou se ainda existem passos pendentes, mas não mostra quantos passos já foram concluídos.

### Impacto no usuário
- Usuário perde senso de avanço.
- A checklist não reforça progresso ou recompensa parcial.
- Fica menos claro o esforço restante para ativar o bot.

### Critérios de aceite
- Exibir progresso no formato `X de 4 passos concluídos` ou equivalente.
- O progresso deve ser calculado a partir de `STEPS` e `status`.
- Quando tudo estiver concluído, o progresso deve comunicar conclusão total.
- Não quebrar o estado de erro/loading.

### Sugestão de solução
Calcular:

```js
const completedCount = STEPS.filter((step) => status?.[step.key]).length
```

E exibir no banner geral ou abaixo do cabeçalho.

---

## Issue 4 — Destacar o primeiro passo pendente como “Próximo passo”

**Tipo:** UX / Priorização / Onboarding  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Início / Status do Bot  
**Arquivos relacionados:**
- `dashboard/app/dashboard/inicio/page.js`

### Problema
Todos os cards pendentes recebem o mesmo tratamento visual. A tela informa o que falta, mas não guia claramente por onde começar.

### Impacto no usuário
- Usuário precisa decidir sozinho qual pendência resolver primeiro.
- A jornada fica menos guiada, especialmente para usuários novos.
- Pode aumentar abandono antes de completar o setup.

### Critérios de aceite
- Identificar o primeiro passo pendente.
- Exibir badge ou destaque visual “Próximo passo”.
- Apenas um card deve receber o destaque por vez.
- Cards concluídos devem continuar reconhecíveis.

### Sugestão de solução
Calcular o primeiro pendente:

```js
const nextStepKey = STEPS.find((step) => !status?.[step.key])?.key
```

E renderizar uma badge no card correspondente.

---

## Issue 5 — Contextualizar o loading da tela de status

**Tipo:** UX / Feedback de sistema / Acessibilidade  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Início / Status do Bot  
**Arquivos relacionados:**
- `dashboard/app/dashboard/inicio/page.js`
- `dashboard/components/States.js`

### Problema
Durante o carregamento inicial, a tela retorna `<LoadingState />`, que por padrão mostra apenas “Carregando...”. A mensagem não explica que o sistema está carregando o status do bot.

### Impacto no usuário
- Feedback menos informativo em conexões lentas.
- Usuário não entende exatamente o que está sendo carregado.
- Perde oportunidade de reforçar confiança no painel.

### Critérios de aceite
- A tela deve usar uma mensagem contextual, por exemplo “Carregando status do bot...”.
- O componente `LoadingState` deve continuar reutilizável.
- Opcionalmente, evoluir `LoadingState` para usar `role="status"` em uma issue de design system.

### Sugestão de solução
Trocar:

```jsx
<LoadingState />
```

Por:

```jsx
<LoadingState message="Carregando status do bot..." />
```

---

## Issue 6 — Avaliar uso de `Link` nos cards de navegação do checklist

**Tipo:** Acessibilidade / Semântica / Navegação  
**Prioridade:** P3  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Início / Status do Bot  
**Arquivos relacionados:**
- `dashboard/app/dashboard/inicio/page.js`

### Problema
Os cards do checklist são renderizados como `<button>` e navegam com `router.push(step.href)`. Embora funcione, visualmente e semanticamente eles representam links para outras telas.

### Impacto no usuário
- Usuários perdem comportamentos nativos de link, como abrir em nova aba ou copiar destino.
- A semântica de navegação fica menos explícita para tecnologias assistivas.
- A intenção do componente fica menos clara para manutenção futura.

### Critérios de aceite
- Avaliar substituir `button` por `Link` mantendo o mesmo visual.
- Garantir foco visível e área clicável equivalente.
- Preservar navegação para os mesmos destinos.
- Se mantiver `button`, adicionar `aria-label` mais descritivo.

### Sugestão de solução
Usar:

```jsx
<Link href={step.href} className="...">
  ...
</Link>
```

---

## Issue 7 — Adicionar microcopy de benefício em cada etapa do checklist

**Tipo:** UX Writing / Onboarding / Educação do usuário  
**Prioridade:** P3  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Início / Status do Bot  
**Arquivos relacionados:**
- `dashboard/app/dashboard/inicio/page.js`

### Problema
Os passos informam o que está pendente, mas explicam pouco por que cada etapa importa para o funcionamento do bot.

### Impacto no usuário
- Usuários menos técnicos podem não entender o valor de cada configuração.
- A tela orienta ação, mas não educa sobre o fluxo do produto.
- Pode gerar dúvidas como “por que preciso de dois tipos de grupo?”.

### Critérios de aceite
- Cada etapa deve ter uma frase curta de benefício ou impacto.
- A copy deve ser simples e orientada ao usuário.
- O card não deve ficar visualmente poluído.
- Validar quebra de linha em mobile.

### Sugestão de solução
Adicionar um campo `description` em `STEPS`, por exemplo:
- WhatsApp conectado: “Permite que o bot leia e envie mensagens.”
- Chaves de afiliado: “Garante que os links sejam convertidos com suas tags.”
- Grupo monitorado: “É onde o bot encontra os links originais.”
- Grupo de envio: “É onde os links convertidos serão publicados.”

---

## Issue 8 — Exibir CTA operacional quando o bot estiver pronto

**Tipo:** UX / Ativação / Operação diária  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Início / Status do Bot  
**Arquivos relacionados:**
- `dashboard/app/dashboard/inicio/page.js`

### Problema
Quando todos os passos estão completos, a tela mostra “Bot ativo e funcionando!”, mas não oferece uma ação principal para continuar a operação.

### Impacto no usuário
- Depois do setup, a tela perde utilidade prática.
- Usuário precisa decidir sozinho para onde ir em seguida.
- A transição entre ativação e operação diária fica menos fluida.

### Critérios de aceite
- Quando `allOk` for verdadeiro, exibir CTA principal operacional.
- Definir destino prioritário do CTA: Envio, Logs ou WhatsApp.
- CTA deve ser visualmente claro e não competir com o status geral.
- Validar com usuário novo e usuário recorrente.

### Sugestão de solução
Mostrar um bloco como:

```text
Tudo pronto! Seu bot está ativo.
[Enviar mensagem agora] [Ver logs]
```

---

## Issue 9 — Tornar o status dos cards explícito além de cor e símbolo

**Tipo:** Acessibilidade / UI / Checklist  
**Prioridade:** P3  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Início / Status do Bot  
**Arquivos relacionados:**
- `dashboard/app/dashboard/inicio/page.js`

### Problema
Os cards usam cor verde/âmbar e símbolos `✓`/`!` para indicar concluído ou pendente. Isso já evita depender somente da cor, mas o status textual “Concluído” ou “Pendente” não aparece explicitamente.

### Impacto no usuário
- Usuários podem interpretar o símbolo de forma diferente.
- Leitores de tela podem anunciar apenas o caractere visual sem contexto suficiente.
- A lista poderia ser mais clara para escaneamento rápido.

### Critérios de aceite
- Cards devem comunicar status textual ou via label acessível.
- Não depender apenas de cor e símbolo.
- Manter layout limpo e escaneável.

### Sugestão de solução
Adicionar badge pequena:
- `Concluído`
- `Pendente`

Ou adicionar `aria-label` contextual no indicador visual.
