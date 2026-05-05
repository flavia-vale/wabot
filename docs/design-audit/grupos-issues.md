# Auditoria SEO & Conversão — `/dashboard/grupos`

## Contexto da página
Página para carregar grupos do WhatsApp e definir grupos de origem/monitoramento e destino/postagem.

## ISSUE GRUPOS-001 — Explicar diferença entre monitorar e postar
- **Diagnóstico:** ❌ Precisa de ajuste.
- **Ponto analisado:** Seções “Monitorar (origem)” e “Postar (destino)”.
- **Observação técnica:** Os termos aparecem, mas usuários novos podem confundir origem com destino.
- **Impacto em ativação:** Configuração invertida pode causar falha operacional ou envios no grupo errado.
- **Sugestão de melhoria:** Adicionar bloco educativo: “Monitorar = onde o bot lê links. Postar = onde o bot publica links convertidos.”
- **Critérios de aceite:**
  - Texto aparece antes da seleção/listas.
  - Usa exemplos práticos.
- **Testes sugeridos:** Validar layout mobile e desktop.

## ISSUE GRUPOS-002 — Adicionar busca/filtro em grupos carregados
- **Diagnóstico:** ❌ Precisa de ajuste.
- **Ponto analisado:** Lista de grupos do WhatsApp.
- **Observação técnica:** Operações com muitos grupos podem ficar difíceis sem busca.
- **Impacto em UX:** Usuário demora para achar grupos, aumentando abandono.
- **Sugestão de melhoria:** Adicionar campo “Buscar grupo pelo nome” e filtros por já monitorado/postado.
- **Critérios de aceite:**
  - Busca filtra sem nova chamada API.
  - Estado vazio informa que nenhum grupo corresponde ao filtro.
- **Testes sugeridos:** Testar lista vazia, muitos grupos e busca sem resultado.

## ISSUE GRUPOS-003 — Criar confirmação para ações em lote ou troca de tipo
- **Diagnóstico:** ⚠️ Parcialmente otimizado.
- **Ponto analisado:** Ações “Monitorar” e “Postar”.
- **Observação técnica:** Ações de destino podem impactar onde ofertas serão enviadas.
- **Impacto em risco operacional:** Clique acidental pode postar em grupo errado.
- **Sugestão de melhoria:** Para alterações relevantes, confirmar com copy: “Este grupo passará a receber ofertas convertidas.”
- **Critérios de aceite:**
  - Confirmação aparece para ações de destino/postagem.
  - Ação de desfazer/remover é clara.
- **Testes sugeridos:** Validar confirmar/cancelar.

## ISSUE GRUPOS-004 — Adicionar contador e limite operacional visível
- **Diagnóstico:** ❌ Precisa de ajuste.
- **Ponto analisado:** Listas de origem e destino.
- **Observação técnica:** Usuário não vê rapidamente quantos grupos configurou em cada função.
- **Impacto em controle:** Dificulta auditoria da própria operação.
- **Sugestão de melhoria:** Mostrar “3 grupos monitorados” e “5 grupos de destino” nos títulos das seções.
- **Critérios de aceite:**
  - Contadores atualizam após adicionar/remover.
  - Estado zero orienta próxima ação.
- **Testes sugeridos:** Validar contadores após mutações.
