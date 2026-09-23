# Specification Quality Checklist: Anti-banimento — unificar a proteção do número num lugar só (recurso PRO)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-23
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — resolvidos em 2026-09-23: FR-008 = "Anti-banimento"; FR-011 = opção C (vale o mais conservador entre o valor da conta e o fixo, campo a campo, nos 3 campos fixos — revisado após as decisões A e B da fase de plano); FR-016 = PRO + Premium + Trial ativo (tela passa a usar a regra do backend, corrigindo o Premium)
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- A seção "Contexto" cita nomes de campos do banco de propósito: são necessários para a regra de campo dormente e compatibilidade retroativa exigidas pelo AGENTS.md.
- Localização (FR-003) e comportamento para não-PRO (FR-017: visível bloqueado com selo PRO e botão de upgrade) mantidos como decididos.
- Clarificações registradas na seção "Clarifications" da spec.
- 2ª rodada (2026-09-23), decisões A–E da fase de plano incorporadas: variação de imagem sai dos fixos e continua sem mudança (A); "Atraso entre canais" vira "Intervalo entre destinos", editável, com correção de causa raiz do RCA 2026-07-28 — vale para grupo e canal e espera por adiamento, sem travar a fila (B, FR-022 a FR-026, US4); preset "Leve" indo de 10 para 6 envios/hora registrado como intencional (C, Edge Cases); FR-019 reescrito — perder o plano bloqueia só a tela, nada é resetado (D); cutover = reinício anunciado do bot-supervisor no deploy de main (E, "Notas de implantação").
- Campos fixos agora são 3 (tamanho da rajada, janela da rajada, liga/desliga dos limites do destino); nenhum campo de nível da conta vira fixo.
- Pontos em aberto deliberadamente deixados para o plan.md (seção "Pontos em aberto para a fase de plano"): confirmar que a tela de Conexão WhatsApp não tem controles a mover (FR-006a); medir contas com valor menos conservador que o fixo; onde aplicar a regra de FR-011; como a tela exibe destino com ritmo mais cuidadoso; garantir que perder o plano não resete valores (FR-019); faixa e impacto do intervalo entre destinos (FR-026); anúncio do reinício do bot-supervisor.
