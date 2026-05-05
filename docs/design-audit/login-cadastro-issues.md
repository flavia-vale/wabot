# Issues de Design — Login / Cadastro

Este arquivo registra issues prontas para serem copiadas para o GitHub Issues. Elas foram derivadas da auditoria de UI/UX da tela `dashboard/app/login/page.js` e do componente compartilhado `dashboard/components/Alert.js`.

## Issue 1 — Corrigir contraste dos labels no modo cadastro

**Tipo:** Acessibilidade / UI  
**Prioridade:** P0  
**Status recomendado:** 🚨 Crítico  
**Tela:** Login / Cadastro  
**Arquivos relacionados:**
- `dashboard/app/login/page.js`

### Problema
No modo cadastro, o card usa fundo escuro (`bg-emerald-950/95`), mas os labels dos campos continuam com `text-gray-700`, uma cor pensada para fundo claro. Isso pode deixar os textos “Email” e “Senha” com contraste insuficiente e prejudicar leitura.

### Impacto no usuário
- Usuários podem não perceber os labels dos campos.
- Usuários com baixa visão ou em telas com brilho reduzido podem ter dificuldade para preencher o formulário.
- A experiência do modo cadastro parece menos polida que o modo login.

### Critérios de aceite
- Labels têm contraste adequado tanto no login quanto no cadastro.
- O modo cadastro deve usar labels claros quando o card for escuro, ou o card deve voltar a ser claro.
- Validar visualmente em desktop e mobile.
- Rodar lint após a alteração.

### Sugestão de solução
Adicionar classes condicionais aos labels, por exemplo:
- Login: `text-gray-700`
- Cadastro: `text-emerald-100`

Ou padronizar o card como claro nos dois modos e diferenciar cadastro por badge/CTA.

---

## Issue 2 — Definir cores explícitas nos inputs para evitar herança visual inadequada

**Tipo:** Acessibilidade / UI  
**Prioridade:** P1  
**Status recomendado:** 🚨 Crítico  
**Tela:** Login / Cadastro  
**Arquivos relacionados:**
- `dashboard/app/login/page.js`

### Problema
Os inputs de email e senha não definem explicitamente cor de fundo, cor do texto e cor do placeholder. Como o card de cadastro é escuro, há risco de inconsistência visual ou herança indesejada entre modos/temas/navegadores.

### Impacto no usuário
- Texto digitado ou placeholder pode ficar com baixo contraste em determinados estados.
- Pode haver inconsistência visual entre login e cadastro.
- Reduz confiança na qualidade da interface.

### Critérios de aceite
- Inputs têm `bg-white`, `text-gray-900` e placeholder com contraste adequado.
- Estados de foco continuam visíveis.
- Aparência consistente em login e cadastro.
- Rodar lint após a alteração.

### Sugestão de solução
Adicionar classes explícitas aos inputs:
- `bg-white`
- `text-gray-900`
- `placeholder:text-gray-400`

---

## Issue 3 — Reestruturar hierarquia da tela separando marca e ação principal

**Tipo:** UX / Conteúdo / Conversão  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Login / Cadastro  
**Arquivos relacionados:**
- `dashboard/app/login/page.js`

### Problema
O título principal do card é o nome do produto: “Bot Conversor para Afiliados”. A ação real da tela (“Entrar na sua conta” ou “Criar sua conta”) aparece como subtítulo pequeno. Isso reduz clareza imediata sobre o que o usuário deve fazer.

### Impacto no usuário
- Usuário entende a marca, mas não recebe uma orientação forte sobre a ação.
- Cadastro e login parecem variações visuais, mas não ficam semanticamente claros.
- Pode reduzir conversão no cadastro.

### Critérios de aceite
- Marca aparece em uma área menor e consistente.
- Título principal muda conforme o modo:
  - Login: “Entrar na sua conta”
  - Cadastro: “Criar sua conta”
- Subtítulo explica o benefício ou próximo passo.
- Layout continua responsivo.

### Sugestão de solução
Exemplo de estrutura:

```text
🤖 Bot Conversor para Afiliados

Entrar na sua conta
Acesse seu painel para conectar o WhatsApp e gerenciar seus grupos.
```

No cadastro:

```text
🤖 Bot Conversor para Afiliados

Criar sua conta
Comece configurando seu WhatsApp e suas credenciais de afiliado.
```

---

## Issue 4 — Melhorar feedback de carregamento do CTA principal

**Tipo:** UX / Feedback de sistema  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Login / Cadastro  
**Arquivos relacionados:**
- `dashboard/app/login/page.js`

### Problema
Durante submit, o botão exibe apenas “Aguarde...”. O texto é genérico e não comunica claramente se o sistema está fazendo login, criando conta ou redirecionando.

### Impacto no usuário
- O usuário recebe pouco feedback sobre o que está acontecendo.
- Em conexões lentas, a espera pode parecer travamento.
- A percepção de velocidade e controle diminui.

### Critérios de aceite
- Login em andamento mostra “Entrando...” ou equivalente.
- Cadastro em andamento mostra “Criando conta...” ou equivalente.
- Após sucesso, a mensagem de sucesso continua comunicando redirecionamento.
- Botão permanece desabilitado durante a operação.

### Sugestão de solução
Trocar a lógica do texto do botão para algo como:
- `loading && isRegister`: “Criando conta...”
- `loading && !isRegister`: “Entrando...”
- Sem loading: CTA padrão do modo.

---

## Issue 5 — Adicionar atributos de autocomplete aos campos de autenticação

**Tipo:** UX / Acessibilidade / Mobile  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Login / Cadastro  
**Arquivos relacionados:**
- `dashboard/app/login/page.js`

### Problema
Os campos de email e senha não usam `autoComplete`. Isso reduz a eficiência em navegadores e dispositivos móveis, além de limitar suporte a gerenciadores de senha.

### Impacto no usuário
- Preenchimento mais lento, principalmente no celular.
- Gerenciadores de senha podem identificar menos precisamente os campos.
- Experiência de login/cadastro menos fluida.

### Critérios de aceite
- Campo de email usa `autoComplete="email"`.
- Campo de senha usa:
  - Login: `autoComplete="current-password"`
  - Cadastro: `autoComplete="new-password"`
- Nenhuma regressão no submit.
- Rodar lint após a alteração.

### Sugestão de solução
Adicionar os atributos diretamente nos inputs e condicionar a senha ao modo atual.

---

## Issue 6 — Exibir indicação visual quando cadastro vier com parâmetro `ref`

**Tipo:** UX / Confiança / Conversão  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Login / Cadastro  
**Arquivos relacionados:**
- `dashboard/app/login/page.js`

### Problema
A tela lê o parâmetro `ref` da URL e envia esse valor no cadastro, mas o usuário não vê nenhuma confirmação de que o convite/indicação foi aplicado.

### Impacto no usuário
- Usuário pode ficar inseguro se o link de indicação funcionou.
- O benefício de indicação fica invisível no cadastro.
- Pode reduzir confiança e conversão.

### Critérios de aceite
- Quando `ref` existir, exibir uma mensagem discreta e clara no modo cadastro.
- A mensagem não deve aparecer no login, a menos que faça sentido para a estratégia de produto.
- A mensagem deve ser acessível e não bloquear o formulário.

### Sugestão de solução
Exibir um alerta informativo, por exemplo:

```text
🎁 Convite aplicado: ao criar sua conta por este link, quem te indicou recebe o bônus.
```

Se houver benefício para o novo usuário, incluir o benefício na mensagem.

---

## Issue 7 — Avaliar substituição do botão de alternância por tabs Login/Cadastro

**Tipo:** UX / Navegação interna  
**Prioridade:** P3  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Login / Cadastro  
**Arquivos relacionados:**
- `dashboard/app/login/page.js`

### Problema
A alternância entre login e cadastro é feita por um botão textual abaixo do formulário. Embora funcione, o padrão pode ser menos reconhecível que tabs/segmented control.

### Impacto no usuário
- Usuário pode não perceber rapidamente que existem dois modos.
- A troca entre estados depende de um link textual discreto.
- Pode haver menor clareza no cadastro.

### Critérios de aceite
- Login e cadastro devem ser apresentados como opções claramente reconhecíveis.
- O estado ativo deve ser visualmente evidente.
- Alternar modo deve limpar mensagens antigas de erro/sucesso, como já acontece hoje.
- Deve continuar acessível por teclado.

### Sugestão de solução
Implementar controle segmentado no topo do formulário:

```text
[ Entrar ] [ Criar conta ]
```

---

## Issue 8 — Padronizar semântica acessível do componente Alert

**Tipo:** Acessibilidade / Design System  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Componentes relacionados:**
- `dashboard/components/Alert.js`
- `dashboard/app/login/page.js`

### Problema
Na tela de login, os wrappers das mensagens já usam `aria-live` (`assertive` para erro e `polite` para sucesso). Porém, o componente `Alert` também define internamente `role="alert"` e `aria-live="polite"` para todos os tipos. Isso cria redundância e pode gerar comportamento inconsistente em leitores de tela.

### Impacto no usuário
- Leitores de tela podem anunciar mensagens de forma inconsistente.
- Erros podem não ter prioridade assertiva adequada.
- Como `Alert` é compartilhado, a inconsistência pode se repetir em outras telas.

### Critérios de aceite
- Erros devem usar semântica assertiva.
- Sucesso/info/warning devem usar semântica apropriada e menos intrusiva.
- Evitar `aria-live` duplicado entre wrapper e componente, ou documentar claramente a responsabilidade.
- Revisar telas que usam `Alert` para evitar regressões.

### Sugestão de solução
Permitir props opcionais no `Alert`, como:
- `role`
- `ariaLive`

Ou definir comportamento por tipo:
- `error`: `role="alert"`, `aria-live="assertive"`
- `success/info/warning`: `role="status"`, `aria-live="polite"`

---

## Issue 9 — Adicionar ajuda contextual e prevenção de erros para senha no cadastro

**Tipo:** UX / Prevenção de erro  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Login / Cadastro  
**Arquivos relacionados:**
- `dashboard/app/login/page.js`

### Problema
O cadastro usa apenas um campo de senha obrigatório, sem informar requisitos mínimos, sem confirmação de senha e sem validação visual antes do submit.

### Impacto no usuário
- Usuário pode enviar uma senha inválida e só descobrir após erro do backend.
- A experiência de cadastro fica menos previsível.
- Pode aumentar abandono no primeiro acesso.

### Critérios de aceite
- Exibir requisitos mínimos de senha, se existirem.
- Validar no cliente o mínimo necessário sem duplicar regras complexas do backend.
- Considerar confirmação de senha caso seja relevante para reduzir erro de digitação.
- Mensagens devem aparecer próximas ao campo ou em alerta claro.

### Sugestão de solução
Adicionar dica abaixo do campo no modo cadastro, por exemplo:

```text
Use pelo menos 8 caracteres.
```

Se a regra real do backend for diferente, usar a regra real.

---

## Issue 10 — Avaliar inclusão de “mostrar/ocultar senha”

**Tipo:** UX / Acessibilidade  
**Prioridade:** P3  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Login / Cadastro  
**Arquivos relacionados:**
- `dashboard/app/login/page.js`

### Problema
O campo de senha não oferece opção de visualizar temporariamente o valor digitado.

### Impacto no usuário
- Usuários em mobile podem errar a senha com mais frequência.
- A recuperação de erros fica limitada.
- Pode aumentar tentativas malsucedidas de login/cadastro.

### Critérios de aceite
- Botão de mostrar/ocultar senha deve ser acessível por teclado.
- Botão deve ter label acessível, por exemplo `aria-label="Mostrar senha"` / `aria-label="Ocultar senha"`.
- Não deve quebrar integração com gerenciadores de senha.

### Sugestão de solução
Adicionar um botão dentro/ao lado do input para alternar `type="password"` e `type="text"`.
