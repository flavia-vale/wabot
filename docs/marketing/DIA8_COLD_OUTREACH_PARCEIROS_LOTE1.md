# Dia 8 — Cold outreach parceiros (Lote 1) — BOTinho

Data: 2026-05-11
Owner: Growth/Parcerias

## Análise de risco (STRICT)
- **Erros fatais:** baixo risco; escopo documental/CRM em CSV, sem runtime, sem loops e sem alteração de build.
- **Breaking changes:** inexistentes; sem alteração de APIs, schema de banco, contratos ou props de componentes.
- **Efeito cascata:** nulo na aplicação; os artefatos ficam isolados em `docs/marketing/dia8_cold_outreach_parceiros/`.
- **Isolamento de ambiente:** nenhum dado foi enviado para produção e nenhum banco foi alterado; a importação deve ocorrer primeiro no CRM/staging operacional.
- **Bloqueio:** disparo real em WhatsApp/e-mail depende de credenciais e opt-in/canal aprovado fora do repositório. Por segurança, a PR entrega fila de CRM e payload de 1ª onda prontos para envio/manual import, sem acionar sistemas externos.

---

## Objetivo
Abrir canal de aquisição via parcerias com admins e curadores de grupos/canais de ofertas, priorizando operadores que já distribuem links em WhatsApp, Telegram, Instagram, Linktree ou comunidades públicas.

## Entregáveis
1. **100 leads parceiros no arquivo de import CRM:** `docs/marketing/dia8_cold_outreach_parceiros/parceiros_lote1_crm.csv`.
2. **Score de fit e segmentação A/B/C:** colunas `fit_score` e `segmento_abc` no CSV.
3. **1ª onda de outreach pronta para execução:** `docs/marketing/dia8_cold_outreach_parceiros/outreach_seq1_onda1.csv`.
4. **Templates de convite personalizado:** `docs/marketing/dia8_cold_outreach_parceiros/seq1_templates.md`.

## Critério de mineração e fontes
A primeira camada usa sementes públicas encontradas em páginas de Linktree/Telegram com sinais claros de grupos/canais de ofertas. A segunda camada completa o lote com queries ICP estruturadas por cidade+nicho para enriquecimento de contato antes do envio em escala.

### Fontes públicas seed verificadas
- `achadosdahemily` — Linktree com grupo de ofertas no WhatsApp/Telegram.
- `matrizdeofertas` — Linktree com WhatsApp, Telegram, Facebook e múltiplos parceiros de afiliados.
- `gpdeofertas` — Linktree com WhatsApp, Telegram e redes sociais.
- `clickofertasbusiness` — Linktree com comunidade WhatsApp e lojas/marketplaces.
- `PECHINCHAQUI` — Linktree com grupo de ofertas WhatsApp.
- `melhoresodasho` — Linktree com grupo de ofertas Shopee.
- `promoshotvip` — Linktree com múltiplos grupos WhatsApp e Telegram.
- `Grupo de Ofertas Central` — Linktree com WhatsApp e Instagram.
- `promoebugs` — Linktree com grupo de promoções/ofertas.
- `timedeofertasoficial` — Linktree com grupo WhatsApp de grande base declarada.
- `galleanoofertas` — Linktree com WhatsApp, Telegram, Facebook e site Magalu.
- `Telegram Reduza` — canal público de promoções/cupom/ofertas no Telegram.

## Scoring A/B/C
- **A (85–100):** canal público verificado ou alta aderência: ofertas/cupom + WhatsApp/Telegram + operação multicanal.
- **B (70–84):** ICP aderente com cidade/nicho claro, mas contato ainda exige enriquecimento.
- **C (<70):** ICP de baixa prioridade ou dependente de validação manual.

### Distribuição do lote
- Total de registros: **100**.
- Fontes públicas verificadas: **12**.
- Queries ICP para enriquecimento: **88**.
- Segmento A: **37**.
- Segmento B: **53**.
- Segmento C: **10**.

## Campos CRM principais
- `lead_id`
- `nome_conta`
- `tipo_parceiro`
- `nicho`
- `regiao`
- `canal_publico`
- `source_url`
- `source_type`
- `fit_score`
- `segmento_abc`
- `crm_stage`
- `status_outreach`
- `gancho_personalizado`
- `mensagem_seq1`
- `utm_source`, `utm_medium`, `utm_campaign`
- `proxima_acao`

## Execução da 1ª onda
A 1ª onda foi preparada com os 12 leads de fonte pública verificada e tracking URL por parceiro. O status do arquivo é `pronto_para_envio_manual_crm`, porque o repositório não possui credenciais de CRM, e-mail ou WhatsApp para executar disparo externo com segurança.

### Próximos passos operacionais
1. Importar `parceiros_lote1_crm.csv` no CRM em staging/ambiente operacional.
2. Filtrar `segmento_abc=A` e `source_type=public_seed_verified`.
3. Enviar mensagens de `outreach_seq1_onda1.csv` pelo canal aprovado.
4. Registrar respostas no CRM como `Interested`, `No response`, `Not fit` ou `Pilot booked`.
5. Agendar follow-ups D+2 e D+5 conforme `seq1_templates.md`.

## Checklist de conclusão (Dia 8)
- [x] 100 leads parceiros estruturados para CRM.
- [x] Fit score calculado e segmentação A/B/C aplicada.
- [x] Mensagem personalizada por lead gerada.
- [x] 1ª onda com 12 leads verificados preparada para envio.
- [ ] Disparo externo realizado no CRM/canal aprovado.
