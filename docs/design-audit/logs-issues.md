# Issues de Design — Logs de Envio

Este arquivo registra issues prontas para serem copiadas para o GitHub Issues. Elas foram derivadas da auditoria de UI/UX da tela `dashboard/app/dashboard/logs/page.js`, responsável por listar envios, erros, filtros, busca, paginação e limpeza de logs.

## Issue 1 — Adicionar labels acessíveis para abas/filtros e busca

**Tipo:** Acessibilidade / Navegação / Busca  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Logs de Envio  
**Arquivos relacionados:**
- `dashboard/app/dashboard/logs/page.js`

### Problema
As abas de status são botões visuais sem semântica de tabs ou `aria-pressed`, e o campo de busca não possui label visível/associado.

### Impacto no usuário
- Usuários de leitores de tela podem não entender o estado do filtro ativo.
- Busca depende de placeholder, que desaparece ao digitar.
- Navegação por teclado fica menos clara.

### Critérios de aceite
- Filtros devem expor estado ativo com `aria-pressed` ou padrão de tabs.
- Campo de busca deve ter label visível ou `aria-label` adequado.
- Estado ativo visual deve permanecer claro.
- Rodar lint e build após a alteração.

### Sugestão de solução
Adicionar:

```jsx
aria-pressed={tab === value}
aria-label="Buscar logs por conteúdo, grupo ou plataforma"
```

---

## Issue 2 — Evitar renderização mobile condensada em uma linha de JSX

**Tipo:** Manutenibilidade / UI / Responsividade  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Logs de Envio  
**Arquivos relacionados:**
- `dashboard/app/dashboard/logs/page.js`

### Problema
A renderização dos cards mobile está condensada em uma linha muito longa. Isso dificulta manutenção, revisão de acessibilidade e evolução visual.

### Impacto no usuário
- Não afeta diretamente o uso atual.
- Aumenta risco de regressões em melhorias mobile.
- Dificulta adicionar botões, detalhes de erro e labels acessíveis.

### Critérios de aceite
- Extrair componente `LogMobileCard` ou quebrar JSX em blocos legíveis.
- Preservar visual atual.
- Facilitar inclusão de detalhes de erro.

### Sugestão de solução
Criar componente local:

```jsx
function LogMobileCard({ log }) { ... }
```

---

## Issue 3 — Exibir detalhes de erro de forma acessível e descobrível

**Tipo:** UX / Diagnóstico / Acessibilidade  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Logs de Envio  
**Arquivos relacionados:**
- `dashboard/app/dashboard/logs/page.js`

### Problema
No desktop, erros aparecem com `title={log.errorMsg}`. Tooltips nativos não são acessíveis o suficiente e não funcionam bem em touch/mobile.

### Impacto no usuário
- Usuário pode não conseguir ver o motivo do erro no celular.
- Diagnóstico de falhas fica difícil.
- Suporte e investigação ficam prejudicados.

### Critérios de aceite
- Erros devem ter ação “Ver detalhes” ou expansão acessível.
- Detalhes devem funcionar em mobile e desktop.
- Não depender apenas de atributo `title`.

### Sugestão de solução
Adicionar botão/accordion no card/linha para mostrar `errorMsg`.

---

## Issue 4 — Melhorar segurança da ação “Limpar logs”

**Tipo:** UX / Ação destrutiva / Prevenção de erro  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Logs de Envio  
**Arquivos relacionados:**
- `dashboard/app/dashboard/logs/page.js`
- `dashboard/components/ConfirmDialog.js`

### Problema
“Limpar logs” é uma ação destrutiva global. Embora exista confirmação, a ação fica disponível de forma discreta no cabeçalho e pode não comunicar impacto total.

### Impacto no usuário
- Usuário pode apagar histórico importante sem entender a irreversibilidade.
- Falta contexto de quantos registros serão removidos.
- A ação compete pouco visualmente com a gravidade.

### Critérios de aceite
- Modal deve informar que a ação é permanente.
- Mostrar quantidade aproximada/total de registros quando disponível.
- Botão destrutivo deve ter texto claro: “Limpar todos os logs”.

### Sugestão de solução
Atualizar copy do modal com total e impacto.

---

## Issue 5 — Exibir estado de busca sem resultados separadamente de lista vazia

**Tipo:** UX / Estado vazio / Busca  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Logs de Envio  
**Arquivos relacionados:**
- `dashboard/app/dashboard/logs/page.js`

### Problema
Quando a busca local filtra tudo, a tela mostra “Nenhum log encontrado”, igual ao estado de não haver logs. Isso não diferencia “não existem logs” de “nenhum resultado para sua busca”.

### Impacto no usuário
- Usuário pode achar que não há logs no sistema.
- Fica menos claro como recuperar resultados.
- Busca parece menos confiável.

### Critérios de aceite
- Se houver termo de busca, empty state deve mencionar a busca.
- Oferecer ação para limpar busca.
- Estado sem logs deve continuar separado.

### Sugestão de solução
Se `query` existir, usar mensagem:

```text
Nenhum log encontrado para “termo”. Limpar busca.
```

---

## Issue 6 — Melhorar paginação quando há busca local

**Tipo:** UX / Dados / Paginação  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Logs de Envio  
**Arquivos relacionados:**
- `dashboard/app/dashboard/logs/page.js`

### Problema
A busca filtra apenas os logs carregados na página atual, mas a paginação mostra total do backend. Isso pode confundir: resultados em outras páginas não aparecem na busca atual.

### Impacto no usuário
- Usuário pode acreditar que a busca cobre todo o histórico quando cobre apenas a página carregada.
- Dados relevantes podem ficar ocultos em outra página.
- Paginação e busca entram em conflito conceitual.

### Critérios de aceite
- Deixar claro que a busca é na página atual; ou
- Implementar busca server-side; ou
- Resetar/consultar backend com termo de busca.

### Sugestão de solução
Preferível: adicionar parâmetro de busca na API de logs e paginar resultados filtrados no servidor.
