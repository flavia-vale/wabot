# Contrato — Credencial SHEIN (backend + painel)

Reusa integralmente a infraestrutura de credenciais. Nenhuma rota nova, nenhuma migration de schema.

---

## Backend — `src/credentialHealth.js`

### `PLATFORM_LABELS` (linha 3)

```js
shein: 'SHEIN',
```

Isso já habilita, de graça: `PLATFORMS` (usada por `PUT`/`DELETE /credentials/:platform`),
o painel de saúde, e as mensagens de save.

### `REQUIRED_FIELDS` (linha 51)

```js
shein: ['tag'],
```

Um campo só (FR-004).

### `sanitizeCredentialBody` (linha 200) — normalização

Chokepoint por onde **toda** escrita de credencial passa. Ramo novo:

```
entrada: body.tag (string, o que a cliente colou)
```

| Entrada | Saída |
|---|---|
| só dígitos | os dígitos |
| link de SHEIN com `koc_id=<n>` | `<n>` |
| link de SHEIN com `url_from=affiliate_koc_<n>` | `<n>` |
| oneLink `onelink.shein.com/...` | mantido como veio (a extração acontece na validação, ver abaixo) |
| link com `url_from=GM7<n>` ou com `shc`/`link` | mantido como veio → **reprovado** na validação |
| outra coisa | mantido como veio → reprovado na validação |

Nota: a normalização é **offline** (só parsing de URL) — `sanitizeCredentialBody` é síncrono e não
pode fazer rede. Um oneLink que ainda não expõe `koc_id` na URL é tratado na validação como formato
não reconhecido, com a mensagem que ensina a colar o link do Gerador de Link (que já traz os
parâmetros) ou o número.

### `getFormatWarnings` (linha 66) — ramo `shein`

Regras (avisos e recusas, ambos em linguagem leiga):

| Situação | Comportamento |
|---|---|
| valor final não é numérico | recusa: diz que era esperado o link de afiliada ou o número |
| a entrada trazia `GM7` / `shc` / `link` | recusa **específica**: aquele link vem do botão de compartilhar do aplicativo; explica onde pegar o link certo (Gerador de Link do painel de afiliada) |
| número muito curto | aviso leve de conferência (não bloqueia) |

**SC-008**: a mensagem do caso "link errado" precisa levar ao link certo sozinha — sem abrir suporte.

### O que **NÃO** alterar (FR-008)

- `src/credentialSaveCheck.js:25` — `PLATFORMS_WITH_SESSION_CHECK` fica sem `shein`.
- `src/credentialExpiry/policy.js:19` — `EXPIRY_ALERT_PLATFORMS` fica sem `shein`.

Consequência automática: nenhum status de sessão, nenhum e-mail de "código de acesso vencido",
nenhum banner de vencimento para a SHEIN.

---

## Backend — rotas (nada a implementar)

| Rota | Situação |
|---|---|
| `PUT /credentials/shein` | funciona assim que `shein` entra em `PLATFORM_LABELS` (a rota valida contra `PLATFORMS`) |
| `DELETE /credentials/shein` | idem; já é idempotente (200 + `deleted:false`) — FR-009 |
| cifragem em repouso | já aplicada a todo `Credential.data` — FR-010 |

---

## Painel — `dashboard/lib/painel/affiliatePlatforms.js`

Entrada nova, no mesmo formato declarativo do Magalu (linhas 75-86):

```js
{
  id: 'shein',
  label: 'SHEIN',
  instructions: '<onde pegar o link, em português simples>',
  actionLinks: [{ label: 'Abrir a página da loja', href: '<página do programa de afiliadas>' }],
  fields: [{ key: 'tag', label: '<rótulo leigo>', hint: '<exemplo leigo>' }],
}
```

### Regras de linguagem (FR-007 / SC-006) — `test/painel-linguagem-leiga.test.js` reprova jargão

**Proibido em qualquer rótulo, dica, instrução, aviso ou erro:** `koc_id`, `url_from`, `goods_id`,
`aff_id`, `oneLink`, `affiliate_koc`, `GM7`, `token`, `parâmetro`, `query string`, `captcha`.

**Vocabulário a usar**: "seu link de afiliada da SHEIN", "seu número de afiliada", "o link que você
gera no painel de afiliada", "o link do botão de compartilhar do aplicativo não serve".

O status exibido reusa `getPlatformStatus`: com um campo, preenchido = "Pronta para usar",
vazio = "Ainda não cadastrada". "Falta preencher" não ocorre.

---

## Painel — demais catálogos de loja

Ver `contracts/registries.md` (checklist completo com arquivo:linha). Sem eles, a loja funciona no
espelhamento mas o painel diz "link não suportado".

---

## Testes

- `test/painel-linguagem-leiga.test.js` — jargão da SHEIN não aparece na tela.
- `test/painel-ids-afiliada-privacy.test.js` — a entrada `shein` não reintroduz "modo sem cookie" nem
  campos de sessão.
- teste de validação/normalização (junto de `test/credential-*`): número puro aceito; link de
  afiliada extrai o número; link de compartilhamento recusado com a mensagem que ensina; texto
  aleatório recusado.
