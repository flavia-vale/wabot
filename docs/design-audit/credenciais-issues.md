# Auditoria SEO & Conversão — `/dashboard/credenciais`

## Contexto da página
Página para cadastrar credenciais/tags de afiliado por plataforma: Shopee, Amazon, Mercado Livre e Magazine Luiza.

## ISSUE CRED-001 — Adicionar orientação de segurança sobre credenciais
- **Diagnóstico:** ❌ Precisa de ajuste.
- **Ponto analisado:** Formulários de chaves, tags e cookies.
- **Observação técnica:** A página pede dados sensíveis, mas não reforça segurança, uso ou cuidado ao copiar cookies.
- **Impacto em confiança:** Usuário pode hesitar em preencher ou inserir dado errado sem entender finalidade.
- **Sugestão de melhoria:** Adicionar card: “Suas credenciais são usadas apenas para converter links. Nunca compartilhe essas chaves fora do painel.”
- **Critérios de aceite:**
  - Copy aparece antes dos formulários.
  - Diferencia tag pública de segredo/cookie sensível quando possível.
- **Testes sugeridos:** Validar renderização e responsividade.

## ISSUE CRED-002 — Mostrar status de completude por plataforma
- **Diagnóstico:** ❌ Precisa de ajuste.
- **Ponto analisado:** Cards de plataformas.
- **Observação técnica:** Usuário vê campos, mas não sabe rapidamente quais plataformas estão prontas.
- **Impacto em onboarding:** Pode sair sem configurar tudo necessário.
- **Sugestão de melhoria:** Exibir badge “Completa”, “Parcial” ou “Pendente” em cada plataforma com base nos campos exigidos.
- **Critérios de aceite:**
  - Status considera todos os campos obrigatórios da plataforma.
  - Status atualiza após salvar.
  - Não expõe valores sensíveis.
- **Testes sugeridos:** Validar plataforma sem dados, parcial e completa.

## ISSUE CRED-003 — Adicionar exemplos e links de ajuda por plataforma
- **Diagnóstico:** ⚠️ Parcialmente otimizado.
- **Ponto analisado:** Hints dos campos.
- **Observação técnica:** Há hints curtos, mas faltam instruções sobre onde encontrar cada credencial.
- **Impacto em suporte:** Usuário pode procurar fora do painel e abandonar configuração.
- **Sugestão de melhoria:** Adicionar acordeão “Onde encontro isso?” em cada plataforma, com instruções curtas e seguras.
- **Critérios de aceite:**
  - Ajuda não incentiva práticas inseguras.
  - Conteúdo fica recolhido para não poluir o formulário.
- **Testes sugeridos:** Validar abertura/fechamento dos acordeões.

## ISSUE CRED-004 — Permitir revelar/ocultar campos sensíveis
- **Diagnóstico:** ❌ Precisa de ajuste.
- **Ponto analisado:** Campos como Secret Key, SSID e CSRF.
- **Observação técnica:** Campos sensíveis devem equilibrar segurança e conferência visual.
- **Impacto em UX:** Usuário pode errar ao colar e não conseguir revisar.
- **Sugestão de melhoria:** Usar input tipo password com botão “Mostrar/Ocultar” em credenciais sensíveis.
- **Critérios de aceite:**
  - Campos sensíveis iniciam ocultos.
  - Alternância não altera valor.
  - Botão tem label acessível.
- **Testes sugeridos:** Testar alternância e salvamento.
