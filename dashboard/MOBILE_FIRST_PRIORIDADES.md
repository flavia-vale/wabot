# Prioridades Mobile-First (Fase 1)

## Objetivo
Mapear as áreas mais críticas para a primeira rodada de conversão Mobile-First sem alterar backend (rotas, controladores, API ou banco).

## Escopo técnico permitido
- Alterar somente Front-End: HTML, CSS/Tailwind e componentes de interface.
- Não alterar rotas, controladores, contratos de API, schemas de banco, autenticação ou regras de negócio.

## Matriz de prioridade (ordem de execução)
1. `/login` (P0)
2. `/dashboard` (layout e navegação principal) (P0)
3. `/dashboard/envio` (P0)
4. `/dashboard/grupos` (P1)
5. `/dashboard/configuracoes` (P1)
6. `/dashboard/credenciais` (P1)
7. `/admin` (P1)
8. `/` landing/home (P1)
9. `/dashboard/planos` (P1)

---

## Issue 1 — Mobile-First `/login` (P0)
**Problema:** risco alto de abandono em celular por fricção no primeiro acesso.

**Análise detalhada (o que alterar):**
1. Garantir largura fluida no card/form (`w-full`, `max-w-*`) com padding lateral seguro para telas 320px.
2. Aplicar `min-h-screen` no container para estabilizar composição vertical em diferentes alturas.
3. Ajustar campos e botões para `min-h-[44px]` e espaçamento vertical consistente (`gap-3`/`gap-4`).
4. Melhorar legibilidade com tipografia responsiva (`text-sm` base, títulos `text-lg`/`text-xl`) e `leading` adequado.
5. Reorganizar hierarquia: título + CTA principal primeiro, links secundários (ex.: ajuda) após ação primária.
6. Preservar estado visual de foco/erro em toque (`focus-visible`, contraste de borda/mensagem).

**Critérios de aceite:**
- Todos os elementos interativos >= 44x44px.
- Nenhum overflow horizontal em 320px.
- Ação principal visível sem rolagem excessiva na primeira dobra em aparelhos comuns.

---

## Issue 2 — Navegação principal `/dashboard` (P0)
**Problema:** navegação densa em desktop pode gerar atrito e cliques acidentais no mobile.

**Análise detalhada (o que alterar):**
1. Converter menu lateral/horizontal em padrão mobile (drawer/hamburger) abaixo de `md`.
2. Definir cabeçalho fixo compacto com ações essenciais (abrir menu, contexto da página, ação primária).
3. Garantir área tocável de itens do menu (`min-h-[44px]`, `px-4`, espaçamento por grupo).
4. Priorizar conteúdo crítico acima da dobra; mover widgets secundários para blocos colapsáveis.
5. Ajustar grid para coluna única no mobile e reidratar colunas em `md/lg`.
6. Validar estados de loading/skeleton para evitar layout shift entre troca de páginas internas.

**Critérios de aceite:**
- Navegação utilizável com uma mão.
- Sem sobreposição entre header, drawer e conteúdo.
- CLS perceptível reduzido em carregamento inicial.

---

## Issue 3 — Fluxo operacional `/dashboard/envio` (P0)
**Problema:** tela crítica com formulários/listas densas tende a erro operacional em toque.

**Análise detalhada (o que alterar):**
1. Transformar formulários longos em seções progressivas (passos visuais) mantendo mesma lógica atual.
2. Fixar CTA primário de envio em área previsível no mobile (rodapé sticky opcional).
3. Aumentar alvo de checkboxes/radios/switches via wrappers clicáveis (`label` com padding).
4. Reordenar campos por prioridade operacional (dados obrigatórios primeiro).
5. Tratar mensagens de erro/sucesso com blocos legíveis e próximos ao campo relevante.
6. Evitar tabelas largas; usar cards/listas empilhadas para pré-visualizações no mobile.

**Critérios de aceite:**
- Fluxo principal executável sem zoom.
- Redução de erros de toque em ações críticas.
- Campos obrigatórios claramente identificados e acessíveis.

---

## Issue 4 — Gestão `/dashboard/grupos` (P1)
**Problema:** listagens e ações por item podem ficar comprimidas em telas pequenas.

**Análise detalhada (o que alterar):**
1. Substituir layout tabular por cards no mobile com metadados essenciais em duas linhas.
2. Levar ações primárias do item para botão único “Ações” (menu contextual) quando faltar espaço.
3. Inserir busca/filtros com posicionamento sticky leve no topo da lista.
4. Garantir paginação/scroll infinito com feedback visual claro.
5. Ajustar estados vazios/erro para CTA de recuperação rápido.

**Critérios de aceite:**
- Nenhum texto crítico truncado sem alternativa.
- Ação por item concluída com até 2 toques.

---

## Issue 5 — Formulários `/dashboard/configuracoes` (P1)
**Problema:** telas de configuração tendem a densidade alta e baixa escaneabilidade no mobile.

**Análise detalhada (o que alterar):**
1. Agrupar campos por seções com títulos curtos e descrição de contexto.
2. Padronizar componentes de entrada para altura mínima 44px.
3. Melhorar distância entre toggles e labels para evitar toque indevido.
4. Posicionar botão “Salvar” de forma persistente em telas longas.
5. Exibir mensagens de validação inline e sumarização no topo quando necessário.

**Critérios de aceite:**
- Configuração editável sem erros de toque recorrentes.
- Hierarquia visual clara entre seção, campo e ação.

---

## Issue 6 — Credenciais `/dashboard/credenciais` (P1)
**Problema:** exposição de dados sensíveis pode ficar confusa em telas pequenas.

**Análise detalhada (o que alterar):**
1. Reorganizar blocos de credenciais por prioridade de uso (copiar/visualizar/renovar).
2. Garantir botões de copiar e revelar com tamanho de toque adequado.
3. Evitar quebra de layout em strings longas (token/chave) com wrappers e truncamento inteligente.
4. Fornecer feedback imediato de cópia/erro em toast não intrusivo.
5. Manter avisos de segurança visíveis sem competir com CTA principal.

**Critérios de aceite:**
- Usuário consegue copiar credenciais sem zoom.
- Texto sensível não quebra layout nem sobrepõe botões.

---

## Issue 7 — Painel `/admin` (P1)
**Problema:** telas administrativas com tabelas e múltiplas ações sofrem em viewport reduzida.

**Análise detalhada (o que alterar):**
1. Adaptar tabelas para modo responsivo (cards por linha ou colunas prioritárias + detalhes expansíveis).
2. Compactar barra de filtros em acordeão no mobile.
3. Preservar ações críticas no topo com botões grandes e claros.
4. Definir estratégia de ações em lote para não conflitar com toques acidentais.
5. Melhorar feedback de carregamento e de operações concluídas.

**Critérios de aceite:**
- Operações administrativas possíveis sem rolagem horizontal obrigatória.
- Ações destrutivas com confirmação clara e segura.

---

## Issue 8 — Landing `/` (P1)
**Problema:** risco de perda de conversão por poluição visual e CLS no mobile.

**Análise detalhada (o que alterar):**
1. Reordenar hero para CTA principal e proposta de valor aparecerem imediatamente.
2. Ajustar tipografia responsiva por bloco (hero, benefícios, prova social, FAQ).
3. Garantir dimensões reservadas para imagens/mockups para reduzir layout shift.
4. Revisar espaçamentos verticais para ritmo de leitura em rolagem.
5. Otimizar blocos longos com componentes colapsáveis quando necessário.

**Critérios de aceite:**
- CTA primário visível na primeira dobra em mobile.
- Layout estável sem “pulos” perceptíveis durante carregamento.

---

## Issue 9 — Conversão `/dashboard/planos` (P1)
**Problema:** comparação de planos pode ficar ilegível em telas pequenas.

**Análise detalhada (o que alterar):**
1. Converter grade comparativa para cards empilhados no mobile.
2. Destacar plano recomendado com hierarquia visual simples e clara.
3. Priorizar preço, benefícios-chave e CTA de assinatura acima de detalhes secundários.
4. Garantir botões de assinatura com 44x44 e área de toque segura.
5. Exibir detalhes extras em acordeão para reduzir ruído visual.

**Critérios de aceite:**
- Escolha de plano possível sem zoom e sem ambiguidade.
- CTA de compra/upgrade sempre visível na interação principal.

---

## Critérios globais de revisão (todas as issues)
- Touch targets mínimos de 44x44px em botões/links.
- Reorganização hierárquica do conteúdo em telas pequenas (CTA e ações primárias primeiro).
- Navegação adaptada (hamburger/drawer/bottom pattern quando aplicável).
- Tipografia e espaçamento com legibilidade para viewport reduzido.
- Proteção contra layout shift (dimensões reservadas e comportamento consistente de mídia).
- Reuso de componentes/classes existentes com modificadores responsivos (evitar redundância).

## Dependências e ordem recomendada
- Executar primeiro P0 (`/login`, `/dashboard`, `/dashboard/envio`) por risco de operação/conversão.
- Em seguida P1, priorizando `/dashboard/grupos` e `/admin` antes de páginas de menor risco operacional.

## Limite de atuação
Somente Front-End (HTML/CSS/Tailwind/componentes). Sem mudanças de contrato, API, DB ou lógica de backend.


## Detalhamento adicional obrigatório para **todas** as issues

### Padrão de entrega por issue (usar em todas)
1. Escopo de arquivos Front-End afetados (componentes/páginas/estilos).
2. Lista de mudanças visuais e de interação (itens enumerados).
3. Riscos e mitigação (fatal, breaking e cascata).
4. Cenários de teste por breakpoint (320, 375, 390, 414, 768).
5. Resultado esperado + checklist de aceite.
6. Evidências (print mobile + gravação curta do fluxo crítico quando aplicável).

### Template de issue (copiar para as 9 issues)
**Prioridade:** P0/P1  
**Rota:** `/exemplo`  
**Tipo:** Front-End only

**Diagnóstico Mobile**
- [ ] Problema 1
- [ ] Problema 2

**Mudanças técnicas (sem backend)**
1. [ ] Ajuste de layout responsivo (classes `sm/md/lg`).
2. [ ] Garantia de touch target >= 44x44.
3. [ ] Reordenação de conteúdo por prioridade.
4. [ ] Ajuste de tipografia/line-height para legibilidade.
5. [ ] Proteção contra layout shift.

**Análise de risco (obrigatória antes de codar)**
- **Detecção de Erros Fatais:**
  - Validar se não há loop de renderização por estado/efeito.
  - Validar se não há erro de build por classe/componente inválido.
- **Breaking Changes:**
  - Confirmar que não altera props públicas reutilizadas sem fallback.
  - Confirmar que não altera contratos de API/rotas/schema.
- **Efeito Cascata:**
  - Avaliar impacto em layout compartilhado, menu global e estados comuns.
- **Protocolo:**
  - Se risco alto, parar implementação e propor estratégia segura.

**Cenários de teste (obrigatórios)**
1. [ ] Viewport 320px: sem overflow horizontal.
2. [ ] Viewport 375/390/414px: CTA primário visível e clicável.
3. [ ] Viewport 768px: transição correta para tablet.
4. [ ] Navegação por toque: sem cliques acidentais em ações próximas.
5. [ ] Estados de loading/erro/sucesso: sem layout jump crítico.

**Checklist de aceite**
- [ ] Touch targets >= 44x44 em 100% dos elementos interativos críticos.
- [ ] Leitura confortável sem zoom.
- [ ] Navegação mobile consistente e previsível.
- [ ] Sem regressão visual relevante em `md` e `lg`.
