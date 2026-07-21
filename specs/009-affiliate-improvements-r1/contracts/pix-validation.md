# Contrato: Validação de chave PIX (US3) — extensão

Estende `POST /affiliate/apply` e `PUT /affiliate/me` (ambas `app.authenticate`). A validação de **formato** roda **antes** de `encryptCredential` (cifragem D-3 preservada intacta — FR-021).

## Módulo puro: `pixKeyValidation.js`
`validatePixKey({ pixKey, pixKeyType }) → { ok: boolean, error?: string }`

| `pixKeyType` | Regra de formato | Exemplo válido |
|---|---|---|
| `cpf` | 11 dígitos + dígito verificador válido | `12345678909` |
| `phone` | E.164 BR celular: `+55` + DDD (2) + `9` + 8 dígitos | `+5511987654321` |
| `email` | regex de e-mail | `a@b.com` |
| `random` | UUID v4 **ou** EVP 32 hex | `550e8400-e29b-41d4-a716-446655440000` |

Normalização: strip de espaços/`.`/`-`/`(`/`)` para CPF e telefone antes de validar. Titularidade **não** é checada aqui (segue no antifraude `pixMatchesReferredUser`).

## Rotas

### POST /affiliate/apply  ·  PUT /affiliate/me
- **Body**: `{ pixKey, pixKeyType }` (`pixKeyType` ∈ `cpf|email|phone|random` — já validado hoje).
- **400** `{ error }` — **novo**: `validatePixKey` retornou `ok:false`; mensagem específica por tipo (ex.: "CPF inválido", "Telefone deve estar no formato brasileiro com DDD").
- **200**: comportamento atual preservado (perfil criado/atualizado, chave cifrada em repouso).

## Invariantes
- Chave rejeitada nunca chega a `encryptCredential` nem ao banco.
- Sem a env `CREDENTIAL_ENCRYPTION_KEY`, `encryptCredential` continua no-op (dev/test) — a validação de formato roda igual (é db-free/env-free).
