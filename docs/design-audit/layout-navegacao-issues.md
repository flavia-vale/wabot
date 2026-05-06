# Issues de Design — Layout / Navegação

Este arquivo registra issues prontas para serem copiadas para o GitHub Issues. Elas foram derivadas da auditoria de UI/UX do layout autenticado em `dashboard/app/dashboard/layout.js` e de sua relação com o fluxo de login em `dashboard/app/login/page.js`.

## Issue 1 — Implementar navegação responsiva para mobile

**Tipo:** UX / Responsividade / Navegação  
**Prioridade:** P0  
**Status recomendado:** 🚨 Crítico  
**Tela:** Layout principal / Navegação lateral  
**Arquivos relacionados:**
- `dashboard/app/dashboard/layout.js`

### Problema
O dashboard renderiza uma sidebar fixa com `w-56` dentro de um container `flex`, sem alternativa para telas pequenas. Em mobile, a sidebar pode comprimir o conteúdo principal ou gerar overflow horizontal, prejudicando o uso do painel.

### Impacto no usuário
- Usuários em celular podem ter dificuldade para navegar e ler o conteúdo.
- A primeira experiência pós-login pode parecer quebrada em telas menores.
- Funcionalidades importantes ficam menos acessíveis fora do desktop.

### Critérios de aceite
- Desktop mantém sidebar lateral funcional.
- Mobile exibe uma topbar com botão de menu.
- Mobile abre a navegação em drawer ou painel equivalente.
- Drawer fecha ao tocar fora, ao pressionar Escape e ao selecionar um link.
- Não deve haver overflow horizontal em larguras comuns de mobile.
- Rodar lint e build após a alteração.

### Sugestão de solução
Usar breakpoints responsivos:
- Desktop: sidebar com `hidden md:flex` ou equivalente.
- Mobile: topbar com botão “Menu” e drawer `fixed`.
- Overlay escuro para foco contextual.

---

## Issue 2 — Concluir ou remover estado `menuOpen` e função `handleNavigate`

**Tipo:** UX / Dívida técnica / Responsividade  
**Prioridade:** P0  
**Status recomendado:** 🚨 Crítico  
**Tela:** Layout principal / Navegação lateral  
**Arquivos relacionados:**
- `dashboard/app/dashboard/layout.js`

### Problema
O layout declara `menuOpen`, `setMenuOpen` e `handleNavigate`, mas esses elementos não são usados no JSX renderizado. Isso sugere uma implementação de menu mobile incompleta.

### Impacto no usuário
- O comportamento mobile esperado não existe.
- O código comunica uma intenção que não está entregue na interface.
- Manutenção futura fica mais confusa.

### Critérios de aceite
- Se houver menu mobile, `menuOpen` deve controlar abertura/fechamento do drawer.
- `handleNavigate` deve ser chamado ao clicar em links dentro do menu mobile.
- Se o projeto decidir não ter drawer, remover estado/função não usados.
- Não deixar variáveis/funções mortas relacionadas à navegação.

### Sugestão de solução
Implementar o menu mobile usando o estado existente:
- Botão abre com `setMenuOpen(true)`.
- Overlay e botão de fechar usam `setMenuOpen(false)`.
- Links chamam `handleNavigate`.

---

## Issue 3 — Ajustar hierarquia semântica da marca no layout

**Tipo:** Acessibilidade / Semântica HTML  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Layout principal / Navegação lateral  
**Arquivos relacionados:**
- `dashboard/app/dashboard/layout.js`

### Problema
A marca “Bot Conversor para Afiliados” é renderizada como `<h1>` dentro da sidebar. Como o layout envolve todas as páginas internas, esse `h1` pode competir com o título principal de cada tela.

### Impacto no usuário
- Leitores de tela podem interpretar a marca como título principal de todas as páginas.
- A estrutura de headings fica inconsistente entre telas.
- Páginas que já usam `h1` podem ficar com hierarquia duplicada.

### Critérios de aceite
- A marca do produto não deve ser o heading principal global das páginas internas.
- Cada página deve poder controlar seu próprio `h1`/título principal.
- A aparência visual da marca deve ser preservada.

### Sugestão de solução
Trocar o elemento da marca para `p`, `div` ou link para o início, mantendo as classes visuais:

```jsx
<p className="text-xl font-bold">🤖 Bot Conversor para Afiliados</p>
```

---

## Issue 4 — Adicionar `aria-current` ao link ativo da navegação

**Tipo:** Acessibilidade / Navegação  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Layout principal / Navegação lateral  
**Arquivos relacionados:**
- `dashboard/app/dashboard/layout.js`

### Problema
A navegação tem estado ativo visual, mas o link ativo não expõe `aria-current="page"` para tecnologias assistivas.

### Impacto no usuário
- Usuários de leitores de tela podem ter mais dificuldade para identificar a página atual.
- A navegação fica dependente apenas de indicação visual.

### Critérios de aceite
- Link ativo deve receber `aria-current="page"`.
- Links não ativos não devem receber `aria-current`.
- O estado visual ativo deve continuar igual.
- Rodar lint após a alteração.

### Sugestão de solução
Calcular `const active = isActive(item.href)` dentro do map e aplicar:

```jsx
aria-current={active ? 'page' : undefined}
```

---

## Issue 5 — Adicionar foco visível consistente nos links e no logout

**Tipo:** Acessibilidade / Teclado  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Layout principal / Navegação lateral  
**Arquivos relacionados:**
- `dashboard/app/dashboard/layout.js`

### Problema
Links da sidebar e botão de logout possuem hover, mas não definem estilos explícitos de `focus-visible`. Usuários que navegam por teclado podem ter dificuldade para acompanhar o foco.

### Impacto no usuário
- Navegação por teclado fica menos previsível.
- Usuários com deficiência motora ou que preferem teclado têm menor clareza de interação.
- A interface pode falhar em critérios básicos de acessibilidade de foco visível.

### Critérios de aceite
- Todos os links da navegação têm foco visível claro.
- O botão de logout tem foco visível claro.
- O estilo de foco deve ter contraste suficiente sobre fundo verde.
- Não remover estilos de hover existentes.

### Sugestão de solução
Adicionar classes como:

```text
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-white
focus-visible:ring-offset-2
focus-visible:ring-offset-green-700
```

---

## Issue 6 — Separar emojis dos textos de navegação para melhorar acessibilidade

**Tipo:** Acessibilidade / Design System / Navegação  
**Prioridade:** P3  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Layout principal / Navegação lateral  
**Arquivos relacionados:**
- `dashboard/app/dashboard/layout.js`

### Problema
Os emojis fazem parte da string do label, como “🏠 Início” e “📱 Conexão WhatsApp”. Leitores de tela podem anunciar os emojis de forma inconsistente, verbosa ou diferente entre sistemas.

### Impacto no usuário
- A experiência com leitor de tela pode ficar ruidosa.
- O label acessível pode variar conforme plataforma.
- Fica mais difícil evoluir para um sistema de ícones consistente.

### Critérios de aceite
- Ícone visual deve ser separado do texto.
- Ícone decorativo deve usar `aria-hidden="true"`.
- Texto acessível deve permanecer claro e direto.
- Visual deve continuar alinhado e escaneável.

### Sugestão de solução
Modelar os itens como `{ icon, label }` e renderizar:

```jsx
<span aria-hidden="true">🏠</span>
<span>Início</span>
```

---

## Issue 7 — Melhorar feedback e clareza do logout

**Tipo:** UX / Feedback de sistema / Conta  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Layout principal / Navegação lateral  
**Arquivos relacionados:**
- `dashboard/app/dashboard/layout.js`

### Problema
O botão de saída mostra “Sair →” e executa logout/redirecionamento, mas não há estado de carregamento, desabilitação temporária ou texto mais explícito.

### Impacto no usuário
- Em conexões lentas, o usuário pode clicar múltiplas vezes.
- A seta pode sugerir navegação comum, não encerramento de sessão.
- Falta percepção de que a ação está sendo processada.

### Critérios de aceite
- Botão deve comunicar claramente “Sair da conta”.
- Durante a operação, exibir estado “Saindo...” ou equivalente.
- Botão deve ficar desabilitado durante o logout.
- Redirecionamento para login deve continuar funcionando mesmo se a API de logout falhar, caso essa seja a estratégia desejada.

### Sugestão de solução
Adicionar estado `loggingOut` e atualizar o texto do botão:
- Normal: “Sair da conta”
- Loading: “Saindo...”

---

## Issue 8 — Melhorar feedback acessível de validação de sessão

**Tipo:** Acessibilidade / Feedback de sistema  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Layout principal / Navegação lateral  
**Arquivos relacionados:**
- `dashboard/app/dashboard/layout.js`

### Problema
Enquanto valida a autenticação, a tela mostra “Validando sessão...”, mas sem `role="status"`, `aria-live` ou indicador visual de carregamento.

### Impacto no usuário
- Usuários de leitores de tela podem não receber feedback adequado.
- Em conexões lentas, a tela pode parecer estática.
- A percepção de controle do sistema diminui.

### Critérios de aceite
- Loading de sessão deve usar semântica acessível (`role="status"` ou equivalente).
- Texto deve ser claro, por exemplo “Validando sua sessão...”.
- Opcionalmente, incluir spinner discreto.
- Não alterar a lógica de autenticação.

### Sugestão de solução
Renderizar o estado como:

```jsx
<div role="status" aria-live="polite">Validando sua sessão...</div>
```

---

## Issue 9 — Alinhar destino pós-login com a jornada de onboarding

**Tipo:** UX / Jornada / Onboarding  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Telas relacionadas:** Login / Layout / Início  
**Arquivos relacionados:**
- `dashboard/app/login/page.js`
- `dashboard/app/dashboard/layout.js`
- `dashboard/app/dashboard/inicio/page.js`

### Problema
Após login/cadastro, o usuário é redirecionado para `/dashboard`, que no menu corresponde à tela “Conexão WhatsApp”. Ao mesmo tempo, existe uma tela “Início” com checklist de ativação. A estratégia de entrada no painel não está totalmente clara.

### Impacto no usuário
- Usuários novos podem pular o checklist de setup.
- A tela “Início” perde força como orientação inicial.
- A navegação pode parecer inconsistente: “Início” não é a primeira tela.

### Critérios de aceite
- Definir a estratégia oficial de pós-login:
  - Sempre ir para `/dashboard/inicio`; ou
  - Redirecionar dinamicamente conforme status do setup; ou
  - Manter `/dashboard`, mas renomear “Início” para “Checklist”/“Setup”.
- A decisão deve estar refletida no texto dos menus e redirecionamentos.
- Validar o fluxo para usuário novo e usuário já configurado.

### Sugestão de solução
Recomendação de UX:
- Usuário com setup incompleto → `/dashboard/inicio`
- Usuário com setup completo → `/dashboard`

Se a implementação dinâmica for custosa, usar `/dashboard/inicio` como destino padrão após login.
