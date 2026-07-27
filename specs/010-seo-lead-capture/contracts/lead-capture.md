# Contract — Article Lead Capture (US3)

Reaproveita o fluxo existente `ArticleShell` → `LeadMagnetCard` → `/login?mode=register`.
Escopo de código = verificação + ajustes de validação/cópia, não construção nova. Ver D5.

## Componentes

- `dashboard/components/marketing/ArticleShell.jsx` — layout do artigo; já renderiza
  `<LeadMagnetCard origin={origin} compact />`.
- `dashboard/components/marketing/LeadMagnetCard.jsx` — formulário de captura; já posta
  `mode=register`, `email`, `utm_source=lead_magnet`, `origin` para `/login`.

## Contrato de UI/comportamento

1. **Presença (FR-010, SC-005)**: toda página de artigo/blog renderizada via `ArticleShell`
   exibe o bloco de captura de e-mail dentro do layout do artigo.
2. **Validação (FR-011)**:
   - E-mail vazio → mensagem amigável, sem submissão de lead.
   - E-mail com formato inválido → mensagem amigável, sem submissão de lead.
   - E-mail válido → segue o fluxo de register/lead-magnet existente; confirmação/acesso ao
     material.
3. **Idempotência (edge case)**: e-mail já cadastrado não gera erro bruto — sucesso
   idempotente ou mensagem amigável.
4. **Marca (FR-012)**: toda cópia/rótulo do card usa **BOTinho**.

## Invariantes (não regredir)

- Não criar endpoint/coleção de leads paralelo (FR-006/FR-010) — usar o fluxo existente.
- Não remover o `LeadMagnetCard` do `ArticleShell`.
- Sem provedor de e-mail novo; envio segue o comportamento no-op-sem-SMTP já documentado, se
  aplicável (Assumption da spec).

## Verificação

- Abrir uma rota de artigo → bloco visível.
- Submeter e-mail inválido/vazio → validação amigável, nenhum lead.
- Submeter e-mail válido → lead registrado pelo fluxo existente.
