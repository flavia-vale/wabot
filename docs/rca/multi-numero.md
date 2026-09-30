# Vários números de WhatsApp na mesma conta (multi-número)

Plano de negócio aprovado pela dona do produto em 2026-09-30. Este arquivo é
a fonte da decisão: fase atual, preço, critérios de avanço e o que NÃO
prometer. Ler antes de mexer no assunto.

## Situação de partida (dados)

- Hoje é **1 número por conta**: `WaSession.userId @unique` (`prisma/schema.prisma`).
- Planos: Basic R$39, PRO R$69, plano acima do PRO ainda não lançado (`PLAN_IDS.PREMIUM`).
- Custo por número: ~R$1,75–3/mês de servidor; para capacidade conta
  **0,35 GB/número** (ver `memoria-e-capacidade.md`). Cada número extra ocupa
  **uma vaga** igual a uma conta nova.
- Procura já existente: clientes com **várias contas usando o mesmo número**
  (`WaPhoneOwnership`; medido: 12 contas em 4 pessoas). Hipótese: parte é
  procura por mais números, parte é reuso de teste grátis.

## Preço aprovado

| Produto | Preço |
|---|---|
| Número extra (só PRO; Trial ativo conta como PRO) | **R$29/mês por número** (`EXTRA_NUMBER_PRICE_CENTS`) |
| Plano "Escala" (Fase 3) | R$129–149 com 3 números + rodízio + Instagram (a fechar) |
| Proxy por número (opcional, Fase 3) | +R$15–20/número, só se os dados mostrarem ban em cascata |

R$29 fica abaixo de uma 2ª conta PRO (R$69), mas não tão baixo que derrube a
receita de quem já paga duas contas.

## Fases e critério de avanço

| Fase | Entrega | Meta para seguir |
|---|---|---|
| **0. Validar** ✅ em andamento | Lista de espera no painel (`/painel/whatsapp`, com robô conectado) + `scripts/diag-multi-numero-demanda.mjs` | ≥5 contas PRO na lista, ou ≥10% dos PROs (com ao menos 3) |
| 1. Número reserva | 2º número assume se o 1º cair ou for banido | Quem usa reserva cancela menos que quem não usa |
| 2. Rodízio | Envios alternados entre os números presentes em cada grupo, com teto por número | Menos bans por número, vazão igual ou maior |
| 3. Plano Escala | Até 5 números, descanso automático, saúde por número, proxy opcional | Receita média do PRO +20% |

## Fase 0 — como funciona

- Rotas: `GET/POST/DELETE /api/multi-number/waitlist` (`src/api/routes/multiNumber.js`).
- Regra: `src/domain/multiNumber/waitlist.js` (preço, opções, validação,
  intenção vigente, critério de decisão). O diagnóstico IMPORTA essa regra.
- Armazenamento: `AnalyticsEvent` com `multi_number_waitlist_joined` /
  `multi_number_waitlist_left` (sem migration). A intenção vigente é o
  evento mais recente da conta. Grava direto pelo `writeAnalyticsEvent`, sem
  depender de `ANALYTICS_ENABLED` — é dado de negócio, não telemetria.
- Não liga sessão, não reserva vaga, **não aumenta RAM**.
- Diagnóstico (read-only): `node scripts/diag-multi-numero-demanda.mjs [--lista]`
  → base PRO, lista (quantidade, motivo, receita potencial), contas que
  compartilham número e a decisão da Fase 1. `--lista` imprime e-mails para
  o contato de pré-venda.

## Não regredir / o que não prometer

- **Nunca vender como "anti-ban garantido".** O rodízio reduz o volume por
  número; não elimina o risco. Texto certo: "continuidade" e "envio dividido".
- Um número só envia para grupo em que está (membro/admin; admin no canal).
  O rodízio só pode escolher entre números presentes no destino.
- Só **um** número "ouve" cada grupo de origem, senão a oferta duplica.
- Todos os números saem do mesmo IP do servidor: ban em cascata é hipótese a
  medir na Fase 2 antes de vender proxy.
- **Fase 1 em diante aumenta RAM** (cada número = uma sessão, 0,35 GB para
  capacidade): Regra #1 da política de memória — estimativa + OK da usuária
  antes de liberar. A folga era de 24 vagas em 2026-09-18.
