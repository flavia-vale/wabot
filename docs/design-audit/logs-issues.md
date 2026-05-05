# Auditoria SEO & Conversão — `/dashboard/logs`

## Contexto da página
Página para acompanhar histórico de envios, status, grupos, plataformas, busca, paginação e limpeza de logs.

## ISSUE LOGS-001 — Adicionar filtros avançados por status/plataforma/data
- **Diagnóstico:** ❌ Precisa de ajuste.
- **Ponto analisado:** Busca e abas de logs.
- **Observação técnica:** Há busca textual, mas filtros operacionais importantes exigem leitura manual.
- **Impacto em suporte/diagnóstico:** Usuário demora para encontrar falhas específicas.
- **Sugestão de melhoria:** Adicionar filtros por status, plataforma e intervalo de datas.
- **Critérios de aceite:**
  - Filtros combinam com busca textual.
  - Estado vazio mostra filtros aplicados.
- **Testes sugeridos:** Validar combinações e reset de filtros.

## ISSUE LOGS-002 — Criar detalhe expandido do log
- **Diagnóstico:** ❌ Precisa de ajuste.
- **Ponto analisado:** Tabela/cards de logs.
- **Observação técnica:** Mensagens longas são truncadas, dificultando auditoria.
- **Impacto em operação:** Usuário pode não conseguir entender por que um envio falhou.
- **Sugestão de melhoria:** Adicionar drawer/modal com mensagem completa, origem, destino, plataforma, data e erro.
- **Critérios de aceite:**
  - Detalhe abre por item.
  - Mensagem completa é copiável.
  - Funciona em mobile.
- **Testes sugeridos:** Validar log sucesso, log erro e mensagem longa.

## ISSUE LOGS-003 — Reforçar irreversibilidade ao limpar logs
- **Diagnóstico:** ⚠️ Parcialmente otimizado.
- **Ponto analisado:** Confirmação “Limpar logs”.
- **Observação técnica:** Existe confirmação, mas pode reforçar que a ação é permanente e remove evidências de auditoria.
- **Impacto em segurança operacional:** Evita perda acidental de histórico.
- **Sugestão de melhoria:** Ajustar modal: “Esta ação apaga permanentemente o histórico usado para auditoria de envios.”
- **Critérios de aceite:**
  - Modal mantém estilo destrutivo.
  - Usuário precisa confirmar explicitamente.
- **Testes sugeridos:** Validar cancelar/confirmar e recarregamento.

## ISSUE LOGS-004 — Adicionar exportação CSV
- **Diagnóstico:** 💡 Oportunidade.
- **Ponto analisado:** Auditoria externa de envios.
- **Observação técnica:** Não há exportação visível de logs.
- **Impacto em valor percebido:** Afiliados podem querer analisar performance fora do painel.
- **Sugestão de melhoria:** Adicionar botão “Exportar CSV” respeitando filtros atuais.
- **Critérios de aceite:**
  - CSV contém data, plataforma, origem, destino, status e mensagem.
  - Exportação respeita filtros aplicados.
- **Testes sugeridos:** Validar conteúdo do CSV e encoding UTF-8.
