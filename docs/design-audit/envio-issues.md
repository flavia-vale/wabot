# Auditoria SEO & Conversão — `/dashboard/envio`

## Contexto da página
Página para enviar mensagens imediatamente, agendar mensagens e gerenciar agendamentos.

## ISSUE ENVIO-001 — Adicionar prévia da mensagem antes de enviar/agendar
- **Diagnóstico:** ❌ Precisa de ajuste.
- **Ponto analisado:** Textareas de envio imediato e agendamento.
- **Observação técnica:** Usuário digita mensagem, mas não vê prévia de como será enviada.
- **Impacto em risco operacional:** Erros de texto/link podem ser enviados para vários grupos.
- **Sugestão de melhoria:** Exibir card de prévia com quebras de linha preservadas e contagem de caracteres.
- **Critérios de aceite:**
  - Prévia atualiza em tempo real.
  - Mostra aviso quando mensagem está vazia.
- **Testes sugeridos:** Validar texto curto, longo, multilinha e com link.

## ISSUE ENVIO-002 — Confirmar destino e volume antes do disparo
- **Diagnóstico:** ❌ Precisa de ajuste.
- **Ponto analisado:** CTA “Enviar agora”.
- **Observação técnica:** Disparos para grupos podem ter impacto alto e precisam de confirmação contextual.
- **Impacto em segurança/CRO:** Evita envios acidentais e aumenta confiança do operador.
- **Sugestão de melhoria:** Modal antes do envio: “Você está prestes a enviar para X grupos de destino.”
- **Critérios de aceite:**
  - Modal mostra quantidade de grupos destino.
  - Usuário pode cancelar sem disparar.
  - Estado loading impede duplo clique.
- **Testes sugeridos:** Validar sem grupos, com grupos e duplo clique.

## ISSUE ENVIO-003 — Melhorar clareza de fuso e agendamento
- **Diagnóstico:** ⚠️ Parcialmente otimizado.
- **Ponto analisado:** Texto “Fuso detectado”.
- **Observação técnica:** A página mostra fuso detectado, mas não explica como o horário será interpretado.
- **Impacto em operação:** Usuário pode agendar no horário errado.
- **Sugestão de melhoria:** Adicionar microcopy: “O horário abaixo será salvo no fuso detectado deste navegador.”
- **Critérios de aceite:**
  - Texto aparece próximo ao input de data/hora.
  - Não conflita com formatação backend.
- **Testes sugeridos:** Validar timezone local e payload enviado.

## ISSUE ENVIO-004 — Criar templates rápidos de mensagens
- **Diagnóstico:** 💡 Oportunidade.
- **Ponto analisado:** Criação de mensagens repetitivas.
- **Observação técnica:** Afiliados tendem a repetir estruturas de oferta.
- **Impacto em produtividade:** Templates reduzem tempo e erros.
- **Sugestão de melhoria:** Adicionar botões de template: “Oferta relâmpago”, “Cupom”, “Últimas unidades”.
- **Critérios de aceite:**
  - Template preenche textarea sem enviar automaticamente.
  - Usuário pode editar antes de enviar.
- **Testes sugeridos:** Validar aplicação e edição de templates.
