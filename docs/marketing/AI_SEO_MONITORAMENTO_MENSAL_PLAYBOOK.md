# AI SEO — Playbook de monitoramento mensal

Data base: 2026-05-16
Cadência recomendada: mensal (D+1 do fechamento do mês)
Escopo: ChatGPT, Perplexity, Google AI Overviews

## Objetivo

Padronizar a rotina mensal de visibilidade em IA para responder:

1. Em quais consultas o BOTinho está sendo citado?
2. Em quais consultas concorrentes aparecem e o BOTinho não?
3. Quais páginas do domínio viraram fonte de citação?

## Entradas mínimas

- Lista de 20 consultas prioritárias (comercial + informacional).
- Planilha histórica de tracking (`docs/marketing/ai_visibility_tracking.csv`).
- Rotas SEO publicadas no domínio principal.

## Processo mensal (checklist)

1. Rodar as 20 consultas em cada plataforma:
   - ChatGPT
   - Perplexity
   - Google (com AI Overview quando disponível)
2. Para cada consulta, registrar:
   - Citação do BOTinho (sim/não)
   - URL citada do BOTinho (quando houver)
   - Concorrentes citados
   - Observação de qualidade (resposta correta/neutra/incorreta)
3. Calcular indicadores:
   - Taxa de citação da marca por plataforma
   - Share of voice relativo aos 3 principais concorrentes
   - Top páginas mais citadas no mês
4. Abrir backlog de otimização para páginas com baixa citação:
   - Atualização de dados/estatísticas
   - Melhorias de blocos FAQ/comparativo
   - Atualização de `updatedAt` editorial quando houver revisão real

## Saída obrigatória

Publicar relatório mensal em `docs/marketing/SEMANA_YYYY-MM-DD_ORGANICO_IA.md` contendo:

- Resumo executivo (ganhos/perdas)
- Consultas com maior oportunidade
- Ações executadas e próximas ações
- Data da próxima revisão

## Critérios de alerta

Abrir ação corretiva imediata se ocorrer qualquer cenário:

- Queda de >= 30% na taxa de citação mensal
- Queda simultânea em ChatGPT e Perplexity
- Página estratégica removida das citações por 2 ciclos
