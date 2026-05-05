## Contexto
O produto depende de etapas técnicas como conexão do WhatsApp, credenciais de afiliados, grupos monitorados e grupos de destino. Sem suporte visível, usuários podem abandonar a configuração ou abrir muitos chamados manuais.

## Objetivo
Criar suporte mínimo e FAQ operacional para reduzir abandono e suporte repetitivo no lançamento.

## Escopo
- Criar página `/suporte` pública e/ou área de suporte dentro do dashboard.
- Adicionar item “Suporte” no menu do dashboard.
- Informar canal oficial de atendimento: e-mail, WhatsApp ou outro canal definido.
- Criar FAQ mínimo com:
  - como conectar WhatsApp por QR Code;
  - como conectar pelo número;
  - como cadastrar grupos;
  - como configurar credenciais por plataforma;
  - como testar se o bot está enviando;
  - o que fazer se o QR não aparece;
  - o que fazer se o pagamento está pendente;
  - como renovar acesso/plano.
- Adicionar links de ajuda contextual nas telas mais críticas: WhatsApp, Credenciais, Grupos e Planos.

## Critérios de aceite
- [ ] Usuário logado encontra suporte em até 1 clique no dashboard.
- [ ] Usuário não logado encontra suporte a partir da área pública/login.
- [ ] FAQ cobre as dúvidas operacionais mínimas do MVP.
- [ ] Textos de suporte não prometem SLA não definido.
- [ ] As páginas críticas apontam para ajuda contextual.

## Fora de escopo
- Sistema de tickets completo.
- Chatbot de suporte.
- Base de conhecimento extensa.

## Testes sugeridos
- Acessar suporte sem login.
- Acessar suporte logado pelo menu do dashboard.
- Validar links de ajuda nas telas críticas.
- Validar responsividade mobile.
- Rodar lint/build do dashboard.

## Prioridade
P1 — Muito importante para lançamento; pode ser simples, mas não deve faltar.

## Labels sugeridas
`mvp`, `launch-readiness`, `support`, `docs`, `p1`
