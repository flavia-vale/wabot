# Auditoria SEO & Conversão — `/dashboard/inicio`

## Contexto da página
Página de ativação inicial. Resume o status do bot por checklist: WhatsApp, credenciais, grupo monitorado e grupo de envio.

## ISSUE INICIO-001 — Transformar checklist em progresso de ativação
- **Diagnóstico:** ❌ Precisa de ajuste.
- **Ponto analisado:** Lista de etapas do status do bot.
- **Observação técnica:** A página mostra itens ok/pendentes, mas não informa percentual de conclusão nem prioriza a próxima ação.
- **Impacto em CRO/ativação:** Usuário pode não saber o quanto falta para o bot começar a gerar valor.
- **Sugestão de melhoria:** Adicionar barra de progresso “3 de 4 etapas concluídas” e destacar o próximo passo recomendado.
- **Critérios de aceite:**
  - Progresso calcula concluídas/total com base nos mesmos dados do checklist.
  - Próxima etapa pendente aparece com CTA primário.
  - Estado 100% concluído mostra mensagem de sucesso e CTA para envio/logs.
- **Testes sugeridos:** Validar 0/4, 2/4 e 4/4 etapas concluídas.

## ISSUE INICIO-002 — Melhorar copy de orientação por etapa
- **Diagnóstico:** ⚠️ Parcialmente otimizado.
- **Ponto analisado:** Textos pendentes das etapas.
- **Observação técnica:** As mensagens explicam o que falta, mas não deixam claro o benefício de completar cada passo.
- **Impacto em onboarding:** Usuário pode concluir tarefas sem entender prioridade operacional.
- **Sugestão de melhoria:** Reescrever pendências com benefício: “Conecte seu WhatsApp para permitir que o bot monitore e poste ofertas”.
- **Critérios de aceite:**
  - Cada etapa possui uma frase orientada a resultado.
  - Textos cabem em mobile sem truncar informação essencial.
- **Testes sugeridos:** Validar renderização em largura mobile e desktop.

## ISSUE INICIO-003 — Adicionar CTA de retomada após erro de status
- **Diagnóstico:** ✅ Parcialmente coberto, com melhoria possível.
- **Ponto analisado:** Estado de erro ao carregar status.
- **Observação técnica:** Há botão “Tentar novamente”, mas não há orientação alternativa caso o erro persista.
- **Impacto em suporte:** Usuário pode ficar bloqueado sem saber se deve checar conexão, login ou WhatsApp.
- **Sugestão de melhoria:** Adicionar mensagem secundária: “Se continuar, confira sua conexão e tente recarregar o painel.”
- **Critérios de aceite:**
  - Estado de erro mantém retry.
  - Mensagem não expõe detalhes técnicos internos.
- **Testes sugeridos:** Simular falha da API de status.
