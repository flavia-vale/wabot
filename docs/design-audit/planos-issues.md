# Auditoria SEO & Conversão — `/dashboard/planos`

## Contexto da página
Página de monetização e retenção. Mostra plano atual, feedback pós-checkout, comparação Basic/Pro, CTAs de assinatura, link de indicação e histórico de pagamentos.

## ISSUE PLANOS-001 — Reforçar recomendação de plano e diferença de valor
- **Diagnóstico:** ❌ Precisa de ajuste.
- **Ponto analisado:** Comparativo rápido e cards Basic/Pro.
- **Observação técnica:** A página informa preço e benefícios, mas ainda não deixa claro qual plano é melhor para cada perfil de afiliado nem o impacto operacional de anúncios/interrupções.
- **Impacto em marketing/CRO:** O usuário pode comparar apenas preço e escolher Basic por economia imediata, sem entender o custo de interrupções durante campanhas.
- **Sugestão de melhoria:** Adicionar uma faixa “Recomendado para você” baseada em volume/uso e uma linha de ROI: “Se você divulga ofertas todos os dias, o Pro evita anúncios e reduz interrupções em campanhas”.
- **Critérios de aceite:**
  - Card Pro mantém destaque visual como plano recomendado.
  - A diferença entre Basic e Pro é descrita em linguagem de operação, não só lista de recursos.
  - CTA Pro reforça resultado: “Assinar Pro sem anúncios”.
- **Testes sugeridos:** Validar renderização mobile/desktop, estado de plano atual e checkout de Basic/Pro.

## ISSUE PLANOS-002 — Adicionar microcopy de segurança antes do checkout
- **Diagnóstico:** ❌ Precisa de ajuste.
- **Ponto analisado:** Botões “Assinar Basic” e “Assinar Pro”.
- **Observação técnica:** Os CTAs redirecionam para checkout externo, mas a página não antecipa que o usuário sairá do painel nem informa segurança do pagamento.
- **Impacto em marketing/CRO:** Pode gerar hesitação no clique, principalmente em usuários novos.
- **Sugestão de melhoria:** Inserir abaixo dos cards: “Você será redirecionado para um checkout seguro. Após a aprovação, o acesso é atualizado automaticamente.”
- **Critérios de aceite:**
  - Microcopy aparece antes de qualquer erro de checkout.
  - Não promete aprovação instantânea quando houver status pendente.
  - Mantém consistência com mensagens success/failure/pending.
- **Testes sugeridos:** Simular retorno `status=success`, `status=failure` e `status=pending`.

## ISSUE PLANOS-003 — Melhorar bloco de indicação com termos e benefício claro
- **Diagnóstico:** ⚠️ Parcialmente otimizado.
- **Ponto analisado:** Seção “Indique e ganhe”.
- **Observação técnica:** O benefício de +7 dias aparece, mas não explica limite, validade ou o que o indicado precisa fazer.
- **Impacto em marketing/CRO:** Usuário pode copiar menos o link por não confiar na regra ou não entender quando ganha o benefício.
- **Sugestão de melhoria:** Adicionar texto curto: “Válido quando o convidado cria a conta pelo seu link. Benefício limitado conforme regras do programa.”
- **Critérios de aceite:**
  - Explica quando o benefício é aplicado.
  - Não expõe regras técnicas internas desnecessárias.
  - Mantém fallback de cópia manual.
- **Testes sugeridos:** Testar `navigator.clipboard` disponível/indisponível e presença/ausência de `referralCode`.

## ISSUE PLANOS-004 — Criar estado vazio para histórico de pagamentos
- **Diagnóstico:** ❌ Precisa de ajuste.
- **Ponto analisado:** Histórico de pagamentos.
- **Observação técnica:** Quando não há pagamentos, a área simplesmente não aparece.
- **Impacto em UX/CRO:** Usuário em trial pode não entender que ainda não possui histórico.
- **Sugestão de melhoria:** Exibir estado vazio: “Você ainda não possui pagamentos. Escolha um plano para ativar seu acesso.”
- **Critérios de aceite:**
  - Estado vazio aparece quando `payments` está vazio.
  - Histórico continua aparecendo normalmente quando há registros.
- **Testes sugeridos:** Mockar `payments: []` e `payments` com múltiplos status.
