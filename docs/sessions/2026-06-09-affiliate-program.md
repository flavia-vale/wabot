# Sessão — Programa de afiliados

Data: 2026-06-09
Commits: e11f690, a2342b7, d9a6358

## Resumo

Implementado programa de afiliados completo e independente do sistema de
indicação existente (referralCode → dias grátis). Cobre todo o ciclo:
candidatura → aprovação manual → rastreamento por cookie → comissão 30%
na 1ª compra do usuário indicado → painel de acompanhamento.

## Changes

### Features

- feat(affiliate): add AffiliateProfile, AffiliateCommission e AffiliateSettings ao schema Prisma
- feat(affiliate): add service com geração de código único (8 chars), re-candidatura de rejeitado e comissão idempotente via unique constraint em paymentId
- feat(affiliate): add 8 rotas REST (config pública, me CRUD, 4 admin com billing:read/write)
- feat(affiliate): inject tryCreateAffiliateCommission nos 3 pontos de ativação em payments.js (webhook, callback, recover)
- feat(affiliate/ui): add painel /painel/afiliados com 4 estados (sem candidatura, pendente, rejeitado, aprovado)
- feat(affiliate/ui): add painel admin /admin/afiliados com abas Candidaturas, Aprovados, Comissões, Configurações
- feat(affiliate/ui): add campo "Código de indicação" no login + cookie aff_code com duração configurável
- feat(affiliate/ui): add item Afiliados no nav do painel (grupo Configuração)

### Fixes (pós-review)

- fix(affiliate/ui): corrigir JSX sem Fragment wrapper em login/page.js (erro de build)
- fix(affiliate): corrigir select inválido referredUser._count em relação to-one (erro de runtime)
- fix(affiliate): add warn log quando payment é null em payments.js para evitar comissão perdida silenciosamente
- fix(affiliate): add @@index([status]) ausente no schema para eliminar drift com migration SQL

## Decisões técnicas

- Separação total do referralCode existente: os dois sistemas coexistem sem acoplamento. ReferralCode → dias grátis; AffiliateCode → comissão monetária.
- Idempotência da comissão via `paymentId @unique` — P2002 no upsert é silenciado, evitando dupla comissão se webhook/callback/recover dispararem para o mesmo payment.
- Apenas 1ª compra por `referredUserId @unique` em AffiliateCommission — comissão única por usuário indicado, não recorrente.
- `tryCreateAffiliateCommission` é fire-and-forget: erros logados como warn, nunca propagados para o fluxo de pagamento.
- Afiliado sem aprovação não gera comissão (`status !== 'approved'` retorna cedo no service).
- Cookie `aff_code` com duração configurável via AffiliateSettings.cookieDurationHours — singleton criado com defaults no primeiro acesso.
- Re-candidatura permitida apenas para status `rejected` (não para `pending` nem `approved`).

## Known Issues / Future Work

- Painel admin não tem paginação nas abas de Comissões e Aprovados — suficiente para o volume inicial.
- Exportação de relatório de comissões (CSV/PIX em lote) não implementada — previsto para fase seguinte.
