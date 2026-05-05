# Issues de Design — Conexão WhatsApp

Este arquivo registra issues prontas para serem copiadas para o GitHub Issues. Elas foram derivadas da auditoria de UI/UX da tela `dashboard/app/dashboard/page.js`, responsável por conectar o WhatsApp ao bot via QR Code ou código de pareamento.

## Issue 1 — Exibir erro recuperável quando o status da conexão falhar

**Tipo:** UX / Feedback de sistema / Recuperação de erro  
**Prioridade:** P0  
**Status recomendado:** 🚨 Crítico  
**Tela:** Conexão WhatsApp  
**Arquivos relacionados:**
- `dashboard/app/dashboard/page.js`

### Problema
A função `fetchStatus()` captura erro e retorna `null` sem informar o usuário. O carregamento inicial também silencia falhas com `.catch(() => {})`. Isso pode deixar a tela exibindo um estado incompleto ou incorreto sem explicar o problema.

### Impacto no usuário
- Usuário pode ver “Desconectado” ou uma tela sem status real mesmo quando houve falha de rede/API.
- A interface perde confiabilidade em um fluxo crítico.
- Usuário não sabe se deve tentar novamente, aguardar ou verificar conexão.

### Critérios de aceite
- Falhas ao buscar status devem exibir mensagem clara e recuperável.
- Deve existir ação “Tentar novamente” ou equivalente.
- A tela não deve mascarar erro como estado desconectado real.
- A correção não deve quebrar os fluxos de QR Code, código de pareamento, desligar ou esquecer sessão.
- Rodar lint e build após a alteração.

### Sugestão de solução
Adicionar estados como `statusError` e `statusLoading`, e exibir um alerta:

```text
Não foi possível carregar o status da conexão. Tente novamente.
```

---

## Issue 2 — Substituir feedback de erro/sucesso por componente `Alert`

**Tipo:** UI / Acessibilidade / Design System  
**Prioridade:** P0  
**Status recomendado:** 🚨 Crítico  
**Tela:** Conexão WhatsApp  
**Arquivos relacionados:**
- `dashboard/app/dashboard/page.js`
- `dashboard/components/Alert.js`

### Problema
Mensagens de erro, sucesso e aviso são exibidas como parágrafos coloridos simples. Isso é inconsistente com outras telas que usam `Alert`, reduz a visibilidade de mensagens importantes e não garante semântica acessível robusta.

### Impacto no usuário
- Erros críticos podem passar despercebidos.
- Feedback visual fica inconsistente entre telas do dashboard.
- Leitores de tela podem não anunciar mudanças de estado corretamente.

### Critérios de aceite
- Erros devem usar `Alert type="error"` ou padrão equivalente.
- Sucessos devem usar `Alert type="success"`.
- Avisos de WebSocket/conexão instável devem usar `Alert type="warning"`.
- Mensagens devem ter `aria-live` apropriado, respeitando a futura padronização do componente `Alert`.

### Sugestão de solução
Importar e usar `Alert` na tela:

```jsx
{error && <Alert type="error" title="Falha na conexão" message={error} />}
{feedback && <Alert type="success" title="Tudo certo" message={feedback} />}
```

---

## Issue 3 — Adicionar loading inicial para o status da conexão

**Tipo:** UX / Feedback de sistema  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Conexão WhatsApp  
**Arquivos relacionados:**
- `dashboard/app/dashboard/page.js`

### Problema
A tela chama `api.sessionStatus()` ao montar, mas não possui um estado de loading específico para o status inicial. Como `status` começa como `null`, a interface pode parecer “Desconectado” antes de confirmar o estado real.

### Impacto no usuário
- Usuário pode receber falso feedback de desconexão.
- A tela parece instável nos primeiros segundos.
- Pode gerar ações desnecessárias, como tentar reconectar quando já está conectado.

### Critérios de aceite
- A tela deve diferenciar “Carregando status” de “Desconectado”.
- Enquanto carrega, exibir mensagem contextual, por exemplo “Carregando status do WhatsApp...”.
- Após carregamento, exibir o estado real.
- Em falha, mostrar erro recuperável.

### Sugestão de solução
Adicionar estado `statusLoading` inicializado como `true` e desligá-lo no `finally` da busca inicial.

---

## Issue 4 — Melhorar instruções do QR Code com passo a passo no WhatsApp

**Tipo:** UX Writing / Ajuda contextual  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Conexão WhatsApp  
**Arquivos relacionados:**
- `dashboard/app/dashboard/page.js`

### Problema
Quando o QR Code aparece, a tela informa “Escaneie o QR Code com o WhatsApp”, mas não explica o caminho dentro do aplicativo para usuários menos experientes.

### Impacto no usuário
- Usuário pode não saber onde abrir o scanner de dispositivos conectados.
- A conexão pode demorar por falta de orientação.
- Aumenta a chance de abandono em onboarding.

### Critérios de aceite
- Exibir instrução curta com o caminho no WhatsApp.
- Incluir orientação para manter a tela aberta até concluir.
- A instrução deve ser legível em mobile sem poluir o card.

### Sugestão de solução
Adicionar abaixo do QR:

```text
No WhatsApp: Configurações → Dispositivos conectados → Conectar um dispositivo.
Mantenha esta tela aberta até a conexão ser concluída.
```

---

## Issue 5 — Melhorar validação e entrada do telefone no pareamento por número

**Tipo:** UX / Prevenção de erro / Formulário  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Conexão WhatsApp  
**Arquivos relacionados:**
- `dashboard/app/dashboard/page.js`

### Problema
O campo de telefone orienta “Apenas números, sem espaços ou símbolos”, mas o input aceita caracteres livres e o submit valida apenas se existe algum texto (`pairingPhone.trim()`).

### Impacto no usuário
- Usuário pode enviar telefone inválido e receber erro só depois da API.
- O texto de ajuda não é reforçado pelo comportamento do campo.
- A experiência mobile fica menos eficiente.

### Critérios de aceite
- Campo deve usar `inputMode="numeric"` e `autoComplete="tel"`.
- Caracteres não numéricos devem ser removidos automaticamente ou gerar erro inline antes do submit.
- O botão deve continuar desabilitado quando não houver número válido.
- Não rejeitar de forma brusca números colados com `+`, espaços ou parênteses; preferir normalizar.

### Sugestão de solução
Normalizar no `onChange`:

```js
const digits = e.target.value.replace(/\D/g, '')
setPairingPhone(digits)
```

---

## Issue 6 — Separar e explicar ações destrutivas de sessão

**Tipo:** UX / Prevenção de erro / Ações destrutivas  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Conexão WhatsApp  
**Arquivos relacionados:**
- `dashboard/app/dashboard/page.js`
- `dashboard/components/ConfirmDialog.js`

### Problema
“Desligar bot” e “Esquecer número” aparecem próximas, mas têm impactos diferentes. “Esquecer número” remove a sessão salva e exige novo pareamento, porém aparece com estilo cinza de ação secundária.

### Impacto no usuário
- Usuário pode subestimar o impacto de esquecer a sessão.
- Ações temporárias e destrutivas ficam pouco diferenciadas.
- A confirmação atual poderia explicar melhor o que acontece depois.

### Critérios de aceite
- Separar visualmente ações operacionais de ações avançadas/destrutivas.
- Explicar a diferença entre desligar bot e esquecer sessão.
- Melhorar copy do modal de confirmação.
- Manter confirmação obrigatória para esquecer sessão.

### Sugestão de solução
Criar seção “Ações avançadas” e ajustar mensagem do modal:

```text
Isso vai desconectar o WhatsApp e remover a sessão salva neste painel. Para usar novamente, você precisará conectar por QR Code ou código.
```

---

## Issue 7 — Marcar emojis dos botões como decorativos

**Tipo:** Acessibilidade / UI  
**Prioridade:** P3  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Conexão WhatsApp  
**Arquivos relacionados:**
- `dashboard/app/dashboard/page.js`

### Problema
Os botões de conexão usam emojis em `<span>`, mas sem `aria-hidden`. Leitores de tela podem anunciar os emojis de forma inconsistente junto com o texto.

### Impacto no usuário
- Labels podem ficar verbosos ou inconsistentes em tecnologias assistivas.
- Experiência de navegação por leitor de tela fica menos polida.
- Dificulta padronização futura de ícones.

### Critérios de aceite
- Emojis decorativos devem receber `aria-hidden="true"`.
- O texto acessível do botão deve continuar claro.
- Visual dos botões deve permanecer igual.

### Sugestão de solução
Usar:

```jsx
<span aria-hidden="true">📷</span>
```

---

## Issue 8 — Adicionar microcopy para ajudar na escolha entre QR Code e número

**Tipo:** UX Writing / Tomada de decisão  
**Prioridade:** P3  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Conexão WhatsApp  
**Arquivos relacionados:**
- `dashboard/app/dashboard/page.js`

### Problema
A tela oferece dois métodos de conexão, mas não explica quando escolher cada um. Para usuários novos, “Conectar via QR Code” e “Conectar pelo número” podem parecer equivalentes sem contexto.

### Impacto no usuário
- Usuário pode escolher um método menos adequado ao seu contexto.
- A primeira conexão pode exigir tentativa e erro.
- Aumenta fricção no onboarding.

### Critérios de aceite
- Cada método deve ter uma descrição curta.
- A copy deve ser simples e não técnica.
- A descrição deve funcionar em mobile sem aumentar demais a altura da tela.

### Sugestão de solução
Adicionar legendas:
- QR Code: “Mais rápido se você está com o celular em mãos.”
- Número: “Use um código para vincular pelo WhatsApp.”

---

## Issue 9 — Adicionar semântica acessível ao loading de geração do QR Code

**Tipo:** Acessibilidade / Feedback de sistema  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Conexão WhatsApp  
**Arquivos relacionados:**
- `dashboard/app/dashboard/page.js`

### Problema
O estado “Gerando QR Code...” usa spinner, contador e retry, mas não possui semântica explícita como `role="status"` ou `aria-live` para comunicar mudanças a leitores de tela.

### Impacto no usuário
- Usuários de leitores de tela podem não perceber que o sistema está processando.
- O contador pode não ser anunciado de forma adequada.
- Feedback de espera fica predominantemente visual.

### Critérios de aceite
- Container de loading deve usar semântica de status quando apropriado.
- O texto deve explicar o que está acontecendo.
- O botão de retry deve permanecer acessível por teclado.

### Sugestão de solução
Adicionar:

```jsx
<div role="status" aria-live="polite">Gerando QR Code...</div>
```

---

## Issue 10 — Transformar métodos de conexão em cards comparáveis

**Tipo:** UX / Arquitetura de informação / Onboarding  
**Prioridade:** P3  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Conexão WhatsApp  
**Arquivos relacionados:**
- `dashboard/app/dashboard/page.js`

### Problema
Os métodos de conexão são apresentados como dois botões lado a lado. Eles são claros, mas não comunicam diferenças, pré-requisitos ou vantagem de cada método.

### Impacto no usuário
- Usuário novo pode não saber qual método é recomendado.
- O fluxo parece mais técnico do que guiado.
- A escolha pode gerar insegurança no primeiro uso.

### Critérios de aceite
- Apresentar QR Code e número como opções comparáveis.
- Cada opção deve ter título, descrição curta e CTA.
- Layout deve continuar simples em mobile.
- Não alterar as chamadas de API sem necessidade.

### Sugestão de solução
Usar dois cards:

```text
Conectar via QR Code
Mais rápido se você está com o celular em mãos.
[Gerar QR Code]

Conectar pelo número
Use um código de pareamento no WhatsApp.
[Obter código]
```
