## Status
Concluída em 05 de maio de 2026. Implementada e testada no repositório.

## Contexto
O fluxo atual cria preferência de checkout no Mercado Pago e ativa plano por 30 dias quando o pagamento é aprovado. Porém a comunicação visual usa linguagem de planos mensais e o webhook só valida assinatura quando `MP_WEBHOOK_SECRET` está configurado.

## Objetivo
Deixar a jornada de pagamento segura, honesta e pronta para venda MVP.

## Escopo
- Decidir e documentar o modelo comercial do MVP:
  - opção A: acesso por 30 dias renovável manualmente;
  - opção B: assinatura recorrente real.
- Ajustar copy da tela de planos conforme o modelo escolhido.
- Se mantiver MVP como acesso por 30 dias, trocar linguagem de “assinatura mensal” para “acesso por 30 dias”.
- Tornar `MP_WEBHOOK_SECRET` obrigatório em produção ou criar alerta/falha segura quando ausente.
- Garantir que `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `FRONTEND_URL` e `API_URL` estejam documentados para deploy.
- Ajustar retorno pós-pagamento para não exibir “plano ativado” apenas com base em `?status=success`.
- Após retorno do Mercado Pago, consultar `/api/payments/status` e exibir ativação somente quando backend confirmar plano ativo.
- Exibir estado “pagamento em confirmação” quando webhook ainda não processou.

## Critérios de aceite
- [x] Tela de planos comunica exatamente o modelo implementado.
- [x] Checkout ainda redireciona corretamente para Mercado Pago.
- [x] Webhook rejeita requisições sem assinatura válida em produção, quando aplicável.
- [x] Mensagem de sucesso pós-checkout depende do status real retornado pelo backend.
- [x] Pagamento pendente/falha mostra orientação clara para o usuário.
- [x] Histórico de pagamentos continua visível.
- [x] Variáveis de ambiente de pagamento estão documentadas.

## Fora de escopo
- Nota fiscal automática.
- Portal completo de billing.
- Cupons e descontos.
- Recuperação automática de checkout abandonado.

## Testes sugeridos
- Criar checkout Basic e Pro em ambiente sandbox.
- Simular retorno `success`, `failure` e `pending`.
- Simular webhook aprovado e confirmar atualização do plano.
- Simular webhook sem assinatura/assinatura inválida.
- Validar tela de planos antes e depois da confirmação do webhook.
- Rodar testes/lint/build aplicáveis.

## Prioridade
P0 — Blocker de lançamento.

## Labels sugeridas
`mvp`, `launch-readiness`, `payments`, `security`, `p0`
