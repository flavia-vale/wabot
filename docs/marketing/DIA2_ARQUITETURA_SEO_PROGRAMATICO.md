# Dia 2 — Arquitetura de SEO Programático — wabot

Data: 2026-05-10
Owner: Growth/SEO

## Análise de risco (STRICT)
- **Erros fatais:** sem risco técnico de build/tipagem; mudanças apenas em documentação e backlog.
- **Breaking changes:** inexistentes (nenhuma API, schema, contrato ou código de execução alterado).
- **Efeito cascata:** sem impacto em dependências, estado global ou runtime.
- **Isolamento de ambiente:** nenhuma ação em produção/staging; entregáveis operacionais em arquivos `docs/` e `.csv`.
- **Bloqueio:** não aplicável para este escopo.

---

## Objetivo do Dia 2
Preparar escala de páginas orgânicas com estrutura reutilizável para LPs de alta intenção e pipeline de interlinking entre pilar, satélites e LPs programáticas.

---

## 1) Três templates de LP (aprovados)

## Template A — LP por Cidade
- **Slug:** `/espelhar-grupos-whatsapp-{cidade}`
- **Intenção:** transacional local
- **H1:** "Como espelhar grupos no WhatsApp em {cidade}"
- **Seções obrigatórias:**
  1. Dor local
  2. Benefícios do wabot para operação regional
  3. Passo a passo de ativação
  4. FAQ local
  5. CTA trial guiado
- **Schema recomendado:** FAQ + Product

## Template B — LP por Nicho
- **Slug:** `/bot-ofertas-{nicho}-whatsapp`
- **Intenção:** comercial investigativa
- **H1:** "Bot de ofertas para {nicho}: escale sua distribuição"
- **Seções obrigatórias:**
  1. Cenário do nicho
  2. Fluxo operacional antes/depois
  3. Checklist de setup
  4. Prova social por nicho
  5. CTA demo/trial
- **Schema recomendado:** HowTo + FAQ

## Template C — LP por Dor
- **Slug:** `/automatizar-divulgacao-{dor}`
- **Intenção:** solução direta de problema
- **H1:** "Como resolver {dor} com automação de grupos"
- **Seções obrigatórias:**
  1. Diagnóstico da dor
  2. Solução com wabot
  3. Métricas esperadas
  4. Perguntas frequentes
  5. CTA onboarding
- **Schema recomendado:** FAQ + Breadcrumb

---

## 2) Interlinking estratégico (pilar ↔ satélites ↔ LPs)

## Topologia
1. **Pilar** (conteúdo amplo da dor)
2. **Satélites** (subtemas e casos)
3. **LPs pSEO** (cidade/nicho/dor)

## Regras de linkagem
- Cada **Pilar** deve linkar para no mínimo **5 satélites** e **6 LPs**.
- Cada **Satélite** deve linkar para **1 pilar** + **3 LPs** relacionadas.
- Cada **LP** deve linkar para **1 pilar** + **2 satélites** para distribuir autoridade temática.
- Usar âncoras semânticas variantes (evitar repetição exata em massa).

## Hubs de conteúdo sugeridos
- Hub 1: "Escalar operação em grupos"
- Hub 2: "Automatização de ofertas e cupons"
- Hub 3: "Ativação rápida e consistência de postagem"

---

## 3) Critério de priorização das 50 LPs

Score final (0-100):
- **Volume relativo da long-tail** (0-30)
- **Intenção comercial/transacional** (0-30)
- **Aderência ao produto** (0-25)
- **Facilidade de rank inicial** (0-15)

Priorizar publicação em 3 ondas:
- **Onda 1 (Top 15):** alta intenção + alta aderência
- **Onda 2 (20):** média concorrência + bom fit
- **Onda 3 (15):** exploração de nichos e cidades secundárias

---

## Entregáveis do Dia 2
- [x] Backlog com 50 keywords long-tail priorizadas
- [x] Template SEO aprovado (cidade, nicho, dor)
- [x] Mapa de interlinking definido para arquitetura de cluster
