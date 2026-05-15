# Lote extra — Leads com perfis do Instagram — BOTinho

Data: 2026-05-11
Owner: Growth/Parcerias

## Análise de risco (STRICT)
- **Erros fatais:** baixo risco; entrega em CSV/Markdown, sem código executável, sem loops, sem build e sem runtime.
- **Breaking changes:** inexistentes; sem alteração de APIs, schema de banco, contratos ou props.
- **Efeito cascata:** nulo na aplicação; arquivos isolados em `docs/marketing/instagram_profiles_leads_lote1/`.
- **Isolamento de ambiente:** nenhum banco, CRM externo, Instagram ou produção foi alterado; a planilha é material de importação/enriquecimento.
- **Bloqueio:** disparo real de DM no Instagram deve ser manual ou via CRM aprovado. Não foi feito scraping autenticado, login automatizado ou envio automático.

---

## Objetivo
Gerar uma nova planilha de prospecção focada em perfis de Instagram com sinais de curadoria de ofertas, cupons, achadinhos, grupos WhatsApp/Telegram e links afiliados.

## Entregáveis
1. **Planilha CRM com 100 linhas:** `docs/marketing/instagram_profiles_leads_lote1/instagram_profiles_lote1_crm.csv`.
2. **1ª onda de DM com 25 perfis A:** `docs/marketing/instagram_profiles_leads_lote1/instagram_dm_seq1_onda1.csv`.
3. **Templates de DM e follow-up:** `docs/marketing/instagram_profiles_leads_lote1/instagram_dm_templates.md`.

## Critério de seleção
- Perfis com Linktree/página pública indicando Instagram e operação de ofertas/cupons/achadinhos.
- Sinais adicionais de fit: grupo WhatsApp, canal Telegram, WhatsApp Channel, Shopee, Amazon, Mercado Livre, Magalu, cupom, promoção diária ou comunidade.
- Para completar 100 linhas, o lote inclui queries ICP para validação manual de perfis Instagram por cidade/nicho.

## Distribuição do lote
- Total de registros: **100**.
- Perfis públicos verificados por Linktree/página pública: **55**.
- Queries Instagram/Google para validação manual: **45**.
- 1ª onda pronta para DM manual/aprovada: **25**.
- Segmento A: **65**.
- Segmento B: **35**.
- Segmento C: **0**.

## Campos principais
- `lead_id`
- `instagram_handle`
- `instagram_url`
- `nome_publico`
- `nicho`
- `regiao`
- `source_url`
- `source_type`
- `fit_score`
- `segmento_abc`
- `crm_stage`
- `status_outreach`
- `gancho_personalizado`
- `mensagem_dm_seq1`
- `utm_source`, `utm_medium`, `utm_campaign`
- `proxima_acao`

## Segmentação A/B/C
- **A (85–100):** perfil com Instagram + sinal explícito de ofertas/cupons + WhatsApp/Telegram/marketplaces.
- **B (70–84):** perfil aderente, mas com menor prova de comunidade ou nicho mais específico.
- **C (<70):** baixa prioridade ou pendente de validação mais forte.

## Fontes públicas usadas como sementes
Foram usadas páginas públicas de Linktree encontradas por busca web e/ou já presentes no lote anterior. Exemplos de sementes públicas:
- `https://linktr.ee/achadosdahemily`
- `https://linktr.ee/matrizdeofertas`
- `https://linktr.ee/promoshotvip`
- `https://linktr.ee/corre_e_aproveitaa`
- `https://linktr.ee/achadosginger`
- `https://linktr.ee/shopeeando_`
- `https://linktr.ee/achadonapromo.br`
- `https://linktr.ee/olhonodesconto`

## Próximos passos
1. Importar `instagram_profiles_lote1_crm.csv` no CRM/staging operacional.
2. Filtrar `segmento_abc=A` e `source_type=verified_public_linktree`.
3. Validar visualmente o perfil antes de qualquer DM.
4. Enviar manualmente a 1ª onda de `instagram_dm_seq1_onda1.csv` pelo canal aprovado.
5. Registrar respostas como `Interested`, `Pilot booked`, `No response`, `Not fit` ou `Do not contact`.

## Checklist de conclusão
- [x] Planilha extra com 100 leads/prospects Instagram criada.
- [x] Fit score e segmentação A/B/C aplicados.
- [x] Mensagem DM seq1 por perfil/prospect gerada.
- [x] 1ª onda com 25 perfis A preparada.
- [ ] Envio externo realizado pelo canal aprovado.
