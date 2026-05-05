# Issues de Design — Grupos

Este arquivo registra issues prontas para serem copiadas para o GitHub Issues. Elas foram derivadas da auditoria de UI/UX da tela `dashboard/app/dashboard/grupos/page.js`, responsável por configurar grupos de origem, grupos de destino e opções avançadas de grupo.

## Issue 1 — Adicionar loading inicial para grupos cadastrados

**Tipo:** UX / Feedback de sistema / Estado vazio  
**Prioridade:** P0  
**Status recomendado:** 🚨 Crítico  
**Tela:** Grupos  
**Arquivos relacionados:**
- `dashboard/app/dashboard/grupos/page.js`

### Problema
A tela busca grupos cadastrados com `api.groups()` no carregamento inicial, mas não possui estado de loading para essa lista. Como `groups` começa como array vazio, as seções podem exibir “Nenhum grupo cadastrado” antes de a requisição terminar.

### Impacto no usuário
- Usuário pode acreditar que perdeu configurações já salvas.
- O dashboard pode mostrar um estado vazio falso.
- A confiança na configuração de grupos diminui.

### Critérios de aceite
- Exibir loading contextual enquanto grupos cadastrados estão sendo carregados.
- Só mostrar empty state após o carregamento concluir.
- Em falha, exibir erro recuperável.
- Não bloquear o carregamento de grupos do WhatsApp além do necessário.
- Rodar lint e build após a alteração.

### Sugestão de solução
Adicionar estado `loadingGroups`:

```js
const [loadingGroups, setLoadingGroups] = useState(true)
```

E exibir:

```jsx
<LoadingState message="Carregando grupos configurados..." />
```

---

## Issue 2 — Padronizar erros com `Alert` ou `ErrorState`

**Tipo:** Acessibilidade / Feedback de sistema / Design System  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Grupos  
**Arquivos relacionados:**
- `dashboard/app/dashboard/grupos/page.js`
- `dashboard/components/Alert.js`
- `dashboard/components/States.js`

### Problema
Erros como `actionError`, `waError` e `manualError` são exibidos como parágrafos vermelhos simples. Isso é inconsistente com outras telas e pode não comunicar a falha adequadamente para tecnologias assistivas.

### Impacto no usuário
- Erros podem passar despercebidos.
- Falhas de conexão com WhatsApp ficam pouco orientadas à ação.
- A experiência visual fica inconsistente com o restante do dashboard.

### Critérios de aceite
- Erros globais devem usar `Alert` ou `ErrorState`.
- Erro ao listar grupos do WhatsApp deve explicar que o bot precisa estar conectado, quando aplicável.
- Erro manual deve aparecer dentro do formulário avançado com semântica acessível.
- Mensagens devem ser limpas ao tentar a ação novamente.

### Sugestão de solução
Substituir parágrafos por blocos como:

```jsx
<Alert type="error" title="Falha ao carregar grupos" message={actionError} />
```

---

## Issue 3 — Adicionar loading por item ao adicionar grupo do WhatsApp

**Tipo:** UX / Prevenção de erro / Feedback de ação  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Grupos  
**Arquivos relacionados:**
- `dashboard/app/dashboard/grupos/page.js`

### Problema
Ao clicar em “Monitorar” ou “Postar” em um grupo listado do WhatsApp, não há estado de carregamento por item. O botão não muda para “Adicionando...” e não fica desabilitado durante a requisição.

### Impacto no usuário
- Usuário pode clicar múltiplas vezes e gerar requisições duplicadas.
- Não fica claro se a ação foi recebida pelo sistema.
- A lista pode parecer travada em conexões lentas.

### Critérios de aceite
- Cada ação de adicionar deve ter loading próprio por `waJid + role`.
- O botão clicado deve ficar desabilitado até a ação terminar.
- O texto deve comunicar “Adicionando...” ou equivalente.
- Em erro, exibir feedback claro sem remover a opção indevidamente.

### Sugestão de solução
Adicionar estado:

```js
const [addingKey, setAddingKey] = useState('')
```

Usar chave:

```js
const key = `${g.waJid}::${role}`
```

---

## Issue 4 — Melhorar responsividade da lista de grupos do WhatsApp

**Tipo:** UI / Responsividade / Lista  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Grupos  
**Arquivos relacionados:**
- `dashboard/app/dashboard/grupos/page.js`

### Problema
A lista de grupos do WhatsApp usa layout horizontal com nome à esquerda e ações à direita. Em telas pequenas ou grupos com nomes longos, os botões podem ficar espremidos ou o conteúdo pode quebrar mal.

### Impacto no usuário
- Nomes longos podem prejudicar leitura.
- Botões de ação podem ficar difíceis de tocar em mobile.
- A experiência de configuração fica frágil em celular.

### Critérios de aceite
- Em mobile, nome e ações devem se adaptar sem overflow horizontal.
- Botões devem manter área de toque confortável.
- Nomes longos devem quebrar ou truncar de forma controlada.
- Desktop deve manter escaneabilidade.

### Sugestão de solução
Usar layout responsivo:

```text
flex-col gap-2 sm:flex-row sm:items-center sm:justify-between
```

E aplicar `min-w-0`, `break-words` ou `truncate` conforme necessário.

---

## Issue 5 — Explicar melhor as seções Monitorar e Postar

**Tipo:** UX Writing / Onboarding / Arquitetura de informação  
**Prioridade:** P3  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Grupos  
**Arquivos relacionados:**
- `dashboard/app/dashboard/grupos/page.js`

### Problema
As seções “Monitorar (origem)” e “Postar (destino)” são boas, mas ainda dependem de o usuário entender o fluxo origem → conversão → destino.

### Impacto no usuário
- Usuário novo pode confundir onde o bot lê mensagens e onde publica os links convertidos.
- Pode cadastrar grupos no papel errado.
- A configuração inicial pode exigir tentativa e erro.

### Critérios de aceite
- Cada seção deve ter uma frase curta explicando sua função.
- A copy deve ser simples e orientada ao resultado.
- Não aumentar excessivamente a altura dos cards.

### Sugestão de solução
Adicionar descrições:

```text
Monitorar: o bot lê mensagens desses grupos e procura links.
Postar: o bot publica os links convertidos nesses grupos.
```

---

## Issue 6 — Tornar opções de imagem mais compreensíveis

**Tipo:** UX Writing / Configuração avançada  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Grupos  
**Arquivos relacionados:**
- `dashboard/app/dashboard/grupos/page.js`

### Problema
A configuração “Imagem da mensagem” oferece “Nenhuma”, “Original” e “Buscar no site”, além de “Usar link: Primeiro/Último” e “Fallback para original”. Esses termos são funcionais, mas pouco explicativos para usuários não técnicos.

### Impacto no usuário
- Usuário pode escolher uma opção sem entender o resultado.
- “Fallback para original” pode ser incompreensível.
- Configuração avançada aumenta risco de erro operacional.

### Critérios de aceite
- Cada opção deve ter descrição curta ou tooltip.
- “Fallback para original” deve ser traduzido em linguagem comum.
- A interface deve continuar compacta em cards de grupo.
- Não alterar comportamento funcional sem necessidade.

### Sugestão de solução
Adicionar microcopy:
- Nenhuma: “Não envia imagem.”
- Original: “Reusa a imagem recebida no grupo de origem.”
- Buscar no site: “Tenta encontrar a imagem do produto no link.”
- Fallback: “Se não encontrar imagem no site, usa a imagem original.”

---

## Issue 7 — Exibir feedback por grupo ao salvar configurações de imagem

**Tipo:** UX / Feedback de sistema / Atualização otimista  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Grupos  
**Arquivos relacionados:**
- `dashboard/app/dashboard/grupos/page.js`

### Problema
`handleUpdateGroup` atualiza o estado local de forma otimista antes de salvar na API. Se falhar, exibe erro global e recarrega. Não há indicação de “Salvando...” ou erro contextual no grupo alterado.

### Impacto no usuário
- Usuário não sabe se a configuração de imagem foi salva.
- Em falha, não fica claro qual grupo/configuração teve problema.
- O estado otimista pode parecer confirmado antes da persistência real.

### Critérios de aceite
- Exibir estado “Salvando...” no grupo alterado.
- Exibir “Salvo” ou feedback breve após sucesso, se fizer sentido.
- Em erro, mostrar mensagem contextual no card do grupo.
- Manter rollback/reload em caso de falha.

### Sugestão de solução
Adicionar estados por grupo:

```js
const [savingGroupId, setSavingGroupId] = useState(null)
const [groupErrors, setGroupErrors] = useState({})
```

---

## Issue 8 — Melhorar copy da confirmação de remoção de grupo

**Tipo:** UX / Prevenção de erro / Ação destrutiva  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Grupos  
**Arquivos relacionados:**
- `dashboard/app/dashboard/grupos/page.js`
- `dashboard/components/ConfirmDialog.js`

### Problema
A confirmação de remoção usa mensagem genérica: “O grupo será removido desta configuração.” Ela não informa nome, papel ou impacto da remoção.

### Impacto no usuário
- Usuário pode remover o grupo errado.
- Fica menos claro se está removendo da origem ou do destino.
- A confirmação não ajuda suficientemente a prevenir erro.

### Critérios de aceite
- Modal deve mostrar nome do grupo.
- Modal deve mostrar papel do grupo: Monitorar/origem ou Postar/destino.
- A mensagem deve explicar que o grupo será removido apenas da configuração do bot.
- A ação deve continuar exigindo confirmação.

### Sugestão de solução
Guardar o objeto completo em vez de apenas o id:

```js
const [deleteTarget, setDeleteTarget] = useState(null)
```

E exibir:

```text
Remover “Grupo Ofertas” de Monitorar (origem)?
```

---

## Issue 9 — Adicionar labels visíveis ao formulário de JID manual

**Tipo:** Acessibilidade / Formulário / Modo avançado  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Grupos  
**Arquivos relacionados:**
- `dashboard/app/dashboard/grupos/page.js`

### Problema
O formulário manual usa placeholders para “Nome do grupo” e “JID do grupo”, mas não possui labels visíveis com `htmlFor`. Placeholders não substituem labels, especialmente para acessibilidade e preenchimento depois que o usuário começa a digitar.

### Impacto no usuário
- Usuários podem perder o contexto do campo durante digitação.
- Leitores de tela têm menos informação estruturada.
- O modo avançado fica mais propenso a erro.

### Critérios de aceite
- Campos do modo manual devem ter labels visíveis.
- Labels devem estar associados aos inputs com `htmlFor`/`id`.
- Select de papel também deve ter label.
- Placeholders podem continuar como exemplos, mas não como única identificação.

### Sugestão de solução
Adicionar labels:

```jsx
<label htmlFor="manual-name">Nome do grupo</label>
<input id="manual-name" ... />
```

---

## Issue 10 — Validar formato do JID no cadastro manual

**Tipo:** UX / Prevenção de erro / Validação  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Grupos  
**Arquivos relacionados:**
- `dashboard/app/dashboard/grupos/page.js`

### Problema
O campo JID manual é obrigatório, mas não valida formato antes do envio. O exemplo sugere `120363421377996844@g.us`, mas o usuário pode enviar qualquer texto.

### Impacto no usuário
- Erros aparecem somente após a API responder.
- Usuário pode cadastrar dados inválidos ou ficar sem orientação clara.
- A configuração avançada fica arriscada.

### Critérios de aceite
- Validar formato básico antes do submit.
- Exibir mensagem inline se o JID estiver inválido.
- Considerar formatos reais suportados pelo backend/Baileys antes de bloquear.
- Não impedir casos válidos não previstos sem validação técnica.

### Sugestão de solução
Validação inicial conservadora:

```js
const isGroupJid = manualForm.waJid.trim().endsWith('@g.us')
```

Se houver formatos adicionais válidos, documentar e ajustar a regra.

---

## Issue 11 — Adicionar ajuda para encontrar o JID manual

**Tipo:** UX Writing / Ajuda contextual / Modo avançado  
**Prioridade:** P3  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Grupos  
**Arquivos relacionados:**
- `dashboard/app/dashboard/grupos/page.js`

### Problema
O modo avançado informa “Use apenas se você já tiver o JID técnico do grupo”, mas não explica onde encontrar esse JID ou quando realmente usar o modo manual.

### Impacto no usuário
- Usuário avançado pode ficar sem orientação suficiente.
- Usuário iniciante pode tentar usar o modo manual sem entender o risco.
- A configuração manual pode gerar suporte adicional.

### Critérios de aceite
- Explicar quando usar o modo manual.
- Adicionar ajuda curta sobre onde obter o JID, se houver fluxo seguro/documentado.
- Reforçar que o carregamento pelo WhatsApp é o caminho recomendado.

### Sugestão de solução
Adicionar texto:

```text
Prefira carregar os grupos pelo WhatsApp. Use o JID manual apenas para casos de suporte ou migração.
```

---

## Issue 12 — Marcar emojis decorativos em botões/opções

**Tipo:** Acessibilidade / UI  
**Prioridade:** P3  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Grupos  
**Arquivos relacionados:**
- `dashboard/app/dashboard/grupos/page.js`

### Problema
Emojis como 👀 e 📢 aparecem nos botões/opções como parte do texto. Leitores de tela podem anunciá-los de forma ruidosa ou inconsistente.

### Impacto no usuário
- A experiência de leitores de tela fica menos previsível.
- Labels podem ficar verbosos.
- Dificulta evolução para um sistema de ícones consistente.

### Critérios de aceite
- Emojis decorativos devem usar `aria-hidden="true"` quando possível.
- Texto acessível deve continuar claro sem depender do emoji.
- Visual pode permanecer igual.

### Sugestão de solução
Separar ícone e texto:

```jsx
<span aria-hidden="true">👀</span>
<span>Monitorar</span>
```
