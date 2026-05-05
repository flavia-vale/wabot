## Contexto
Existem logs operacionais de envio, mas não há analytics de funil para entender onde usuários abandonam: cadastro, conexão, credenciais, grupos, checkout, pagamento e primeiro envio.

## Objetivo
Implementar analytics mínimo de produto e conversão para medir readiness comercial e otimizar lançamento.

## Escopo
- Escolher ferramenta de analytics para MVP: GA4, PostHog, Plausible, Meta Pixel ou eventos internos simples.
- Documentar variáveis de ambiente necessárias.
- Implementar tracking dos eventos mínimos:
  - cadastro criado;
  - login realizado;
  - WhatsApp conectado;
  - credencial salva;
  - grupo monitorado criado;
  - grupo destino criado;
  - checkout iniciado;
  - pagamento aprovado;
  - primeiro envio com sucesso;
  - erro de envio.
- Garantir que eventos sensíveis não exponham credenciais, tokens, cookies, mensagens privadas completas ou dados pessoais desnecessários.
- Criar uma visualização ou checklist de como conferir esses eventos na ferramenta escolhida.

## Critérios de aceite
- [ ] Eventos principais são disparados nos pontos corretos do funil.
- [ ] Não há envio de credenciais/tokens/cookies para analytics.
- [ ] Eventos de pagamento distinguem checkout iniciado, pendente, aprovado e falho.
- [ ] Evento de primeiro envio com sucesso pode ser identificado.
- [ ] Variáveis de ambiente estão documentadas.
- [ ] Analytics pode ser desabilitado em ambiente local/teste.

## Fora de escopo
- Data warehouse.
- Dashboard executivo completo.
- A/B testing.
- Automação de e-mail baseada em eventos.

## Testes sugeridos
- Criar conta teste e validar evento de cadastro.
- Conectar WhatsApp e validar evento correspondente.
- Salvar credencial fake/sandbox e validar evento sem dados sensíveis.
- Iniciar checkout e validar evento.
- Simular pagamento aprovado e validar evento.
- Gerar envio com sucesso e validar evento.
- Rodar lint/build do dashboard e checks de backend aplicáveis.

## Prioridade
P1 — Recomendado antes de lançamento aberto; obrigatório antes de tráfego pago relevante.

## Labels sugeridas
`mvp`, `launch-readiness`, `analytics`, `growth`, `p1`
