# Search Console — Otimização pós-deploy da campanha

Este playbook começa somente depois de validar em staging e publicar em produção. Não substitui o fluxo canônico: feature → develop → staging 3006 → validação manual → main/produção.

## Checklist logo após produção

1. Confirmar que `/sitemap.xml` contém as rotas P0/P1/P2.
2. Inspecionar no Search Console:
   - `/bot-canais-whatsapp`
   - `/diagnostico-antiban-whatsapp`
   - `/materiais/checklist-antiban-whatsapp`
   - `/ferramentas/calculadora-risco-whatsapp`
   - `/bot-comum-vs-botinho`
   - `/faq-antiban-whatsapp`
   - `/como-funciona-botinho-canais`
   - `/protecao-antiban-botinho`
3. Solicitar indexação apenas depois de confirmar render e canonical.
4. Registrar data de envio no relatório da campanha.

## Rotina de 14 dias

| Dia | Ação | Critério |
|---|---|---|
| 1 | Enviar sitemap e pedir indexação das páginas principais | URLs válidas e indexáveis |
| 3 | Checar cobertura | Sem erro 404/canonical divergente |
| 7 | Exportar queries iniciais | Separar brand, “anti-ban”, canais, bot e migração |
| 10 | Revisar links internos | Páginas com impressão e pouco clique recebem CTA contextual |
| 14 | Primeira rodada de title/meta | Ajustar páginas com impressões e CTR baixo |

## Rotina de 28 dias

| Métrica | Ação se estiver fraca |
|---|---|
| Impressões baixas | Criar mais links internos dos posts e hubs para a página. |
| CTR baixo | Testar title mais específico com dor + promessa honesta. |
| Posição média ruim | Adicionar seção de resposta direta e FAQ mais alinhada à query. |
| Página indexada sem conversão | Revisar CTA acima da dobra e destino da intenção. |
| Query sensível “anti-ban 100%” | Reforçar copy honesta e evitar promessa absoluta. |

## Titles alternativos para testes futuros

| Página | Variação de title |
|---|---|
| `/bot-canais-whatsapp` | Bot para Canais do WhatsApp com preservação avançada |
| `/diagnostico-antiban-whatsapp` | Diagnóstico “anti-ban” WhatsApp: veja sua exposição operacional |
| `/materiais/checklist-antiban-whatsapp` | Checklist “anti-ban” WhatsApp: preservação sem promessa falsa |
| `/ferramentas/calculadora-risco-whatsapp` | Calculadora de risco no WhatsApp para afiliados |
| `/bot-comum-vs-botinho` | Bot comum vs BOTinho: cadência, canais e preservação |
| `/faq-antiban-whatsapp` | FAQ anti-ban WhatsApp: o que existe e o que é promessa falsa |
| `/como-funciona-botinho-canais` | Como funciona o BOTinho para Canais do WhatsApp |
| `/protecao-antiban-botinho` | Módulo de Preservação Avançada do BOTinho |

## Planilha mínima de acompanhamento

| Data | URL | Query | Impressões | Cliques | CTR | Posição média | Ação |
|---|---|---|---:|---:|---:|---:|---|
|  |  |  |  |  |  |  |  |

## Regras de decisão

- Não mudar title/meta antes de ter impressões suficientes, exceto se houver erro claro de copy.
- Não adicionar promessa “anti-ban 100%” para aumentar CTR.
- Priorizar páginas com impressão alta e CTR baixo.
- Toda mudança relevante deve ser validada primeiro em staging.
