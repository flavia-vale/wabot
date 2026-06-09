# Programa de Afiliados — Design Spec

**Data:** 2026-06-09
**Status:** Aprovado pela usuária

---

## Visão geral

Programa de afiliados para o Espelha Grupos onde usuários aprovados recebem um código e link únicos, divulgam o produto, e ganham 30% de comissão sobre a primeira compra de cada usuário que indicaram.

Pagamento via PIX manual realizado pela operadora todo mês (ciclo mensal com dia fixo). O programa de afiliados é **independente** do sistema de referral existente (`referralCode` → dias grátis), que permanece intacto.

---

## Modelos de dados

### `AffiliateProfile`
Representa um afiliado (em análise, aprovado ou rejeitado).

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | cuid | PK |
| `userId` | String (unique FK → User) | Um afiliado por usuário |
| `code` | String (unique) | Código de 8 chars (ex: `FLAVE123`), gerado automaticamente |
| `status` | Enum `pending \| approved \| rejected` | Estado da candidatura |
| `pixKey` | String | Chave PIX para recebimento |
| `pixKeyType` | Enum `cpf \| email \| phone \| random` | Tipo da chave PIX |
| `appliedAt` | DateTime | Data da candidatura |
| `approvedAt` | DateTime? | Data de aprovação |
| `rejectedAt` | DateTime? | Data de rejeição |
| `adminNotes` | String? | Notas internas da operadora |

### `AffiliateCommission`
Uma comissão por venda rastreada. Uma por `Payment` (idempotência garantida).

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | cuid | PK |
| `affiliateId` | String (FK → AffiliateProfile) | Quem ganha a comissão |
| `paymentId` | String (unique FK → Payment) | 1 pagamento = no máximo 1 comissão |
| `referredUserId` | String (FK → User) | Usuário que comprou |
| `saleAmountCents` | Int | Valor da venda em centavos |
| `commissionAmountCents` | Int | 30% do saleAmountCents |
| `status` | Enum `pending \| paid` | Estado do pagamento da comissão |
| `cycleMonth` | String | Mês de referência, ex: `"2026-06"` |
| `paidAt` | DateTime? | Quando foi marcada como paga |
| `paidByUserId` | String? (FK → User) | Admin que marcou como paga |
| `createdAt` | DateTime | Data de criação |

### `AffiliateSettings`
Singleton (uma linha). Configurações globais do programa.

| Campo | Tipo | Default | Descrição |
|---|---|---|---|
| `id` | Int (PK, default 1) | 1 | Sempre 1 |
| `cookieDurationHours` | Int | 24 | Duração do cookie de rastreamento |
| `commissionPercent` | Int | 30 | Percentual de comissão |

### Campo adicionado em `User`
- `affiliateProfileId` — String? (FK → AffiliateProfile): preenchido no cadastro quando o usuário chega via link/código de afiliado. Só na primeira compra desse User é gerada comissão.

---

## Cookie de rastreamento

**Objetivo:** atribuir a comissão ao afiliado mesmo que o usuário não se cadastre imediatamente ao clicar no link.

**Fluxo:**
1. Usuário clica em `https://espelhagrupos.com.br/cadastro?aff=FLAVE123`
2. Frontend seta cookie `aff_code=FLAVE123` com expiração configurável (padrão 24h)
3. A duração é lida dinamicamente via `GET /api/affiliate/config` — mudança no admin tem efeito imediato
4. Ao abrir o formulário de cadastro, o campo "Código de indicação" é pré-preenchido a partir do cookie (ou da query string `?aff=`)
5. O campo é editável — o usuário pode digitar um código diferente ou apagá-lo
6. Se o usuário clicar num link de outro afiliado, o cookie é sobrescrito (último clique vence)
7. Após 24h (ou o tempo configurado), o cookie expira e o campo fica vazio

**Implementação:** hook `useAffiliateTracking` no frontend (landing page Vite e cadastro Next.js).

---

## Formulário de cadastro

Campo novo "Código de indicação" (opcional) adicionado ao formulário `/login?mode=register` (Next.js) e ao formulário da landing page (Vite):
- Pré-preenchido via query `?aff=` ou cookie `aff_code`
- Editável pelo usuário
- Validado no backend (código deve existir e pertencer a afiliado aprovado; se inválido, ignora silenciosamente — não bloqueia o cadastro)

---

## API Routes

### Públicas / autenticadas (usuário)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/affiliate/config` | Retorna `{ cookieDurationHours, commissionPercent }` — lido pelo frontend para configurar o cookie |
| `POST` | `/api/affiliate/apply` | Solicitar entrada no programa (body: `pixKey`, `pixKeyType`) |
| `GET` | `/api/affiliate/me` | Perfil, código, link, stats e comissões agrupadas por mês |
| `PUT` | `/api/affiliate/me` | Atualizar chave PIX |

### Admin (requer role admin)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/admin/affiliates` | Lista afiliados (filtro: `status`, paginação) |
| `POST` | `/api/admin/affiliates/:id/approve` | Aprova candidatura |
| `POST` | `/api/admin/affiliates/:id/reject` | Rejeita candidatura (body: `adminNotes`) |
| `GET` | `/api/admin/affiliates/commissions` | Lista comissões (filtro: `month`, `status`, `affiliateId`) |
| `POST` | `/api/admin/affiliates/commissions/:id/mark-paid` | Marca uma comissão como paga |
| `POST` | `/api/admin/affiliates/cycle/:month/mark-all-paid` | Marca todas as comissões do mês como pagas |
| `GET` | `/api/admin/affiliates/settings` | Lê configurações do programa |
| `PUT` | `/api/admin/affiliates/settings` | Atualiza configurações (cookieDurationHours, commissionPercent) |

---

## Integração com o webhook de pagamento

O handler existente em `src/api/routes/payments.js` (processa eventos do Mercado Pago) recebe a lógica de geração de comissão após confirmação de pagamento:

1. Pagamento confirmado como `approved` para `userId`
2. Carregar `user.affiliateProfileId`
3. Se preenchido, carregar `AffiliateProfile` — verificar se `status === 'approved'`
4. Verificar se já existe `AffiliateCommission` com `referredUserId === userId` (só primeira compra)
5. Se passou todos os critérios: criar `AffiliateCommission` com `commissionAmountCents = saleAmountCents * commissionPercent / 100` e `cycleMonth = YYYY-MM` atual
6. Ler `commissionPercent` de `AffiliateSettings` (não hardcoded)

---

## Painel do afiliado (usuário) — `/painel/afiliados`

**Estado: não candidato**
- Card explicando o programa (comissão, como funciona)
- Botão "Quero ser afiliado" → abre formulário com campos de chave PIX

**Estado: pendente**
- Mensagem "Sua candidatura está em análise"

**Estado: rejeitado**
- Mensagem de rejeição + `adminNotes` (se preenchido)
- Opção de re-candidatar (limpa a rejeição e cria novo `AffiliateProfile`)

**Estado: aprovado**
- Card com código e link copiável
- Cards de resumo: total de indicados registrados, total de vendas confirmadas, total ganho (lifetime)
- Tabela por mês: `cycleMonth`, valor a receber / recebido, status (`pending` / `paid`)

---

## Painel admin — `/painel/admin/afiliados`

**Aba: Candidaturas pendentes**
- Lista com nome, e-mail, chave PIX, data de candidatura
- Ações: Aprovar / Rejeitar (com campo de nota)

**Aba: Afiliados aprovados**
- Lista com nome, código, total de indicações, total de comissões pagas, saldo pendente

**Aba: Comissões**
- Filtro por mês (default: mês atual)
- Tabela: afiliado, usuário indicado, plano, valor da venda, comissão, status, data
- Botão "Marcar mês como pago" (bulk)

**Aba: Configurações**
- Campo: Duração do cookie de rastreamento (horas)
- Campo: Percentual de comissão (%)
- Botão Salvar

---

## Navegação no dashboard

- Sidebar usuário: nova entrada "Afiliados" (ícone: pessoas/link) na seção de configuração
- Sidebar admin: nova entrada "Admin / Afiliados" — visível apenas para role admin

---

## Fora do escopo (v1)

- Notificação por e-mail ao afiliado quando uma comissão é gerada
- Dashboard público de afiliados (landing page separada)
- Comissão recorrente em renovações
- Pagamento automático via PIX
- Ranking / leaderboard de afiliados
