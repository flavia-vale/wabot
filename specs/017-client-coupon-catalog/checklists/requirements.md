# Specification Quality Checklist: Cupons de desconto da própria cliente

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-19
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
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

Validação executada em 2 iterações.

**Ajustes feitos durante a validação:**

1. **Teto do cupom em reais (FR-009)** — a descrição original comparava apenas
   "percentual × preço vs valor fixo". Sem teto, um cupom de R$ 500 venceria a
   comparação numa oferta de R$ 50, o que não é economia real. Adicionado como
   requisito e como caso de borda.
2. **Momento da decisão (FR-014)** — a fila de ofertas guarda a mensagem já
   pronta e a envia depois, às vezes horas depois. Sem essa regra explícita, um
   cupom desligado ou vencido nesse intervalo ainda seria publicado. Registrado
   como requisito, caso de borda e premissa.
3. **Nomes de arquivo e de função removidos** do corpo da spec (ficaram só os
   nomes de variável visíveis para a cliente, como `{linhaDeCupom}`, que são
   parte da superfície do produto e não detalhe de implementação).

**Premissas que o planejamento precisa respeitar** (declaradas na spec, não são
pendências): comparação simplificada por ausência de valor mínimo/teto/limite de
usos; painel "Criar oferta" fora de escopo; sem verificação do cupom junto à
loja.

**Revalidado em 2026-09-19 após duas decisões novas da dona do produto** —
checklist segue 16/16, zero [NEEDS CLARIFICATION]:

4. **Preço com o cupom aplicado** (FR-018a a FR-018g): formato "de R$ 300 por
   R$ 270 com o cupom", calculado por nós, nunca lido da loja; sem preço
   confiável não existe "de X por Y"; preço final nunca zero ou negativo; a
   regra pura passa a devolver também o preço calculado.
5. **Segurança operacional** (FR-028a a FR-028d): cache em memória para não
   consultar banco por envio na fila serial, best-effort absoluto, nenhuma
   leitura nova da loja, uma leitura por lote nas automáticas.
6. **Nota de verificação da trava de repetição**: registrada como achado já
   verificado no código, com a propriedade que o plano precisa preservar.

**Pontos de atenção para `/speckit-plan`**:

- A nota de operação no fim da spec (efeito no espelhamento e na fila só vale
  após reinício do supervisor, que reconecta todas as sessões) precisa virar
  passo explícito no plano de entrega.
- FR-028a (cache) e FR-014 (decisão no momento do envio) puxam em direções
  opostas se mal implementados: a validade do cache precisa ser curta e a
  invalidação precisa disparar no salvar/editar/ligar/desligar/apagar, senão um
  cupom desligado continua saindo.
- A palavra "com o cupom" no texto é requisito (FR-018e) e mitigação de risco
  declarada nas Assumptions — não é detalhe de copy livre para edição futura.
