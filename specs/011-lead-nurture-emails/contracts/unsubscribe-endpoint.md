# Contract — Unsubscribe endpoint (LGPD opt-out)

Rota pública **fina**, sem autenticação (o token assinado é a credencial). Registrada em
`src/api/routes/leadNurture.js` e montada no `src/api/server.js`.

## `GET /api/lead-nurture/unsubscribe`

Descadastra um contato da trilha de nutrição. Idempotente.

### Request

| Param | Local | Tipo | Obrigatório | Notas |
|---|---|---|---|---|
| `token` | query | string | sim | `base64url(userId).HMAC_SHA256(userId, JWT_SECRET)` (ver E5). |

Sem corpo, sem cookie, sem header especial. Aparece como link clicável em **todo** e-mail da trilha.

### Comportamento

1. Verifica o `token` (HMAC em tempo constante). Extrai `userId`.
2. Se válido → grava (idempotente) `AnalyticsEvent { userId, event: 'nurture_unsubscribed',
   metadata: { via: 'link' } }` via `writeAnalyticsEvent`/`trackAnalyticsEventSafe`. Reexecução não
   duplica efeito (a leitura é "existe ≥1 evento").
3. Responde **200** com página HTML pt-BR simples confirmando o descadastro (marca BOTinho).

### Responses

| Status | Quando | Corpo |
|---|---|---|
| `200` | token válido (ou já descadastrado) | HTML "Você foi descadastrada. Não enviaremos mais e-mails desta sequência." |
| `400` | `token` ausente/malformado/HMAC inválido | HTML amigável genérico; **não** revela se o userId existe |

### Invariantes (FR-004, FR-005, SC-003, SC-004)

- Nunca exige login (o e-mail é enviado a quem talvez não tenha sessão).
- Nunca ecoa o e-mail nem o `userId` cru na página (privacidade).
- Após 200 de sucesso, `isUnsubscribed(userId)` passa a ser `true` para sempre; a passada e a
  semeadura no `/register` respeitam isso antes de qualquer envio.
- Resposta é sempre 200/400 — nunca 500 por token inválido (entrada não confiável tratada).
