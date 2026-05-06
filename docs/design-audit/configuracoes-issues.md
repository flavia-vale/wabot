# Auditoria SEO & Conversão — `/dashboard/configuracoes`

## Contexto da página
Página para ajustar comportamento do bot: delays, plataformas habilitadas, palavras bloqueadas e mensagem de boas-vindas.

## ISSUE CONFIG-001 — Adicionar recomendações de delay por perfil de uso
- **Diagnóstico:** ⚠️ Parcialmente otimizado.
- **Ponto analisado:** Delay mínimo/máximo.
- **Observação técnica:** A página explica que delay evita bloqueios, mas não recomenda valores seguros.
- **Impacto em operação:** Usuário pode configurar delay muito agressivo e aumentar risco de bloqueio.
- **Sugestão de melhoria:** Adicionar presets “Conservador”, “Padrão” e “Rápido” com descrições.
- **Critérios de aceite:**
  - Preset preenche mínimo/máximo sem salvar automaticamente.
  - Validação mínimo <= máximo permanece.
- **Testes sugeridos:** Validar aplicação de presets e erro de intervalo inválido.

## ISSUE CONFIG-002 — Explicar impacto de desabilitar plataformas
- **Diagnóstico:** ❌ Precisa de ajuste.
- **Ponto analisado:** Checkboxes de plataformas habilitadas.
- **Observação técnica:** Usuário pode desmarcar plataforma sem entender que links dela deixarão de ser convertidos.
- **Impacto em suporte:** Gera impressão de falha no bot.
- **Sugestão de melhoria:** Adicionar microcopy: “Links de plataformas desabilitadas serão ignorados pelo conversor.”
- **Critérios de aceite:**
  - Texto aparece próximo aos checkboxes.
  - Se nenhuma plataforma estiver marcada, alerta antes de salvar.
- **Testes sugeridos:** Validar salvar com todas desmarcadas.

## ISSUE CONFIG-003 — Transformar palavras bloqueadas em chips
- **Diagnóstico:** ❌ Precisa de ajuste.
- **Ponto analisado:** Campo de palavras bloqueadas.
- **Observação técnica:** Campo de texto livre separado por vírgulas pode gerar erros de espaço/duplicidade.
- **Impacto em UX:** Usuário não sabe quais termos estão ativos.
- **Sugestão de melhoria:** Usar input com chips removíveis e normalização de vírgulas/espaços.
- **Critérios de aceite:**
  - Adicionar/remover palavra sem editar string inteira.
  - Duplicatas são evitadas.
  - Payload mantém formato compatível com backend atual.
- **Testes sugeridos:** Validar termos com espaços, vírgulas e duplicados.

## ISSUE CONFIG-004 — Adicionar prévia da mensagem de boas-vindas
- **Diagnóstico:** 💡 Oportunidade.
- **Ponto analisado:** Textarea de mensagem de boas-vindas.
- **Observação técnica:** Usuário escreve mensagem sem visualizar como aparecerá.
- **Impacto em qualidade de comunicação:** Reduz erros antes de salvar.
- **Sugestão de melhoria:** Mostrar preview estilo balão de WhatsApp abaixo do textarea.
- **Critérios de aceite:**
  - Preview preserva quebras de linha.
  - Estado vazio mostra exemplo.
- **Testes sugeridos:** Validar texto vazio, multilinha e longo.
