## Status
Concluída em 05 de maio de 2026. Implementada e testada no repositório.

## Contexto
Hoje a raiz do dashboard redireciona direto para `/dashboard`, sem uma camada pública mínima para venda, confiança e validação legal. Para abrir vendas com tráfego frio ou checkout público, precisamos de páginas públicas básicas.

## Objetivo
Criar uma camada pública mínima de confiança para permitir venda profissional do BOTinho.

## Escopo
- Criar landing pública em `/` com proposta de valor clara, público-alvo, benefícios, CTA para login/cadastro e CTA para planos.
- Criar página `/termos` com Termos de Uso mínimos.
- Criar página `/privacidade` com Política de Privacidade mínima.
- Criar página `/quem-somos` com apresentação simples do produto/empresa responsável.
- Criar página `/suporte` com canal de atendimento, horários/expectativa de resposta e orientações iniciais.
- Adicionar links de Termos, Privacidade, Quem Somos e Suporte no login e/ou rodapé público.

## Critérios de aceite
- [x] `/` não redireciona automaticamente para o dashboard; apresenta landing pública.
- [x] Usuário consegue acessar Termos de Uso sem estar logado.
- [x] Usuário consegue acessar Política de Privacidade sem estar logado.
- [x] Usuário consegue acessar Quem Somos sem estar logado.
- [x] Usuário consegue encontrar um caminho claro de suporte antes e depois do login.
- [x] Login/cadastro exibem links para Termos e Privacidade.
- [x] Conteúdo não promete assinatura recorrente se o modelo implementado for acesso por 30 dias.

## Fora de escopo
- Landing page com CRO avançado.
- Blog, SEO programático ou páginas de comparação.
- Chat online em tempo real.

## Testes sugeridos
- Acessar `/`, `/termos`, `/privacidade`, `/quem-somos` e `/suporte` sem autenticação.
- Validar responsividade mobile das páginas públicas.
- Validar que `/dashboard` continua exigindo autenticação.
- Rodar lint/build do dashboard.

## Prioridade
P0 — Blocker de lançamento.

## Labels sugeridas
`mvp`, `launch-readiness`, `legal`, `trust`, `p0`
