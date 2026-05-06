# Issues de Design — Planos

Este arquivo registra issues prontas para serem copiadas para o GitHub Issues. Elas foram derivadas da auditoria de UI/UX da tela `dashboard/app/dashboard/planos/page.js`, responsável por status de assinatura, checkout, comparativo de planos, indicação e histórico de pagamentos.

## Issue 1 — Padronizar erros de checkout e cópia com `Alert`

**Tipo:** UX / Acessibilidade / Feedback de sistema  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Planos  
**Arquivos relacionados:**
- `dashboard/app/dashboard/planos/page.js`
- `dashboard/components/Alert.js`

### Problema
Erros de checkout e cópia aparecem como textos vermelhos simples. Isso reduz visibilidade em ações financeiras/importantes.

### Impacto no usuário
- Falha de checkout pode passar despercebida.
- Feedback visual fica inconsistente.
- Leitores de tela podem não ser notificados adequadamente.

### Critérios de aceite
- Erros de checkout devem usar `Alert type="error"`.
- Sucesso/erro de cópia deve ter feedback acessível.
- Mensagens devem orientar próxima ação.
- Rodar lint e build após a alteração.

### Sugestão de solução
Usar alertas locais para checkout e indicação.

---

## Issue 2 — Melhorar clareza de plano atual e estados de acesso

**Tipo:** UX / Assinatura / Hierarquia visual  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Planos  
**Arquivos relacionados:**
- `dashboard/app/dashboard/planos/page.js`

### Problema
A tela informa plano atual e validade, mas os cards de Basic/Pro ainda competem visualmente com o status de acesso. O estado expirado poderia ter CTA mais direto.

### Impacto no usuário
- Usuário pode não entender rapidamente se precisa agir.
- Plano atual pode ficar pouco destacado entre ofertas.
- Acesso expirado precisa de caminho claro de recuperação.

### Critérios de aceite
- Plano atual deve ter badge clara no card correspondente.
- Acesso expirado deve mostrar CTA primário para renovar.
- Dias restantes devem ser destacados sem competir com preços.

### Sugestão de solução
Adicionar bloco de status com CTA contextual e badge “Seu plano”.

---

## Issue 3 — Explicar melhor diferenças entre Basic e Pro

**Tipo:** UX Writing / Conversão / Comparação  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Planos  
**Arquivos relacionados:**
- `dashboard/app/dashboard/planos/page.js`

### Problema
Os cards de plano listam poucos benefícios e “Anúncio a cada 50 envios” pode não explicar impacto real para o usuário.

### Impacto no usuário
- Usuário pode escolher sem entender trade-offs.
- Pro pode parecer apenas “sem anúncios”, sem argumento operacional completo.
- A decisão de compra fica menos informada.

### Critérios de aceite
- Explicar limitações e benefícios em linguagem clara.
- Destacar cenário recomendado de cada plano.
- Evitar jargão ou ambiguidades.

### Sugestão de solução
Adicionar bullets como “Ideal para X grupos/volume” se houver critério real.

---

## Issue 4 — Melhorar feedback de redirecionamento para checkout

**Tipo:** UX / Pagamento / Feedback de sistema  
**Prioridade:** P1  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Planos  
**Arquivos relacionados:**
- `dashboard/app/dashboard/planos/page.js`

### Problema
Durante checkout, o botão mostra “Redirecionando...”, mas não há mensagem contextual informando que o usuário será levado para ambiente de pagamento.

### Impacto no usuário
- Em conexões lentas, pode parecer travamento.
- Usuário pode estranhar sair do painel.
- A confiança no pagamento diminui.

### Critérios de aceite
- Mostrar feedback contextual durante redirecionamento.
- Desabilitar ambos os CTAs enquanto checkout está em andamento.
- Em falha, mostrar erro com alternativa de tentar novamente.

### Sugestão de solução
Adicionar texto abaixo dos botões: “Vamos abrir o checkout seguro em instantes.”

---

## Issue 5 — Melhorar responsividade do link de indicação

**Tipo:** UI / Responsividade / Compartilhamento  
**Prioridade:** P2  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Planos  
**Arquivos relacionados:**
- `dashboard/app/dashboard/planos/page.js`

### Problema
O campo de link de indicação e o botão de copiar ficam em linha. Em telas pequenas, URLs longas podem ficar difíceis de revisar/copiar.

### Impacto no usuário
- Link pode ficar espremido no mobile.
- Botão pode perder área de toque confortável.
- A ação de indicação perde fluidez.

### Critérios de aceite
- Layout deve empilhar input e botão em telas pequenas.
- Botão deve ter área de toque adequada.
- Feedback “Copiado!” deve ser acessível.

### Sugestão de solução
Usar `flex-col sm:flex-row` e `aria-live` para resultado de cópia.

---

## Issue 6 — Tornar histórico de pagamentos mais escaneável

**Tipo:** UI / Dados financeiros / Histórico  
**Prioridade:** P3  
**Status recomendado:** ⚠️ Melhorar  
**Tela:** Planos  
**Arquivos relacionados:**
- `dashboard/app/dashboard/planos/page.js`

### Problema
O histórico usa linhas simples com data, plano, valor e status. Funciona para poucos itens, mas pode ficar pouco escaneável com muitos pagamentos.

### Impacto no usuário
- Usuário pode ter dificuldade para revisar pagamentos antigos.
- Status e valores podem competir visualmente.
- Não há empty state explicando ausência de histórico.

### Critérios de aceite
- Melhorar espaçamento e hierarquia dos itens.
- Adicionar empty state quando não houver pagamentos.
- Considerar tabela em desktop e cards em mobile se histórico crescer.

### Sugestão de solução
Criar componente `PaymentHistoryItem` e empty state “Nenhum pagamento registrado ainda.”
