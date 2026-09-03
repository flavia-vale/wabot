# Phase 1 — Data Model: resolução opaca SHEIN

Nenhuma entidade persistente nova e nenhuma migration. Os modelos abaixo existem apenas durante o
processamento de uma URL; o único registro durável continua sendo `MessageLog`.

## 1. Destino opaco reconhecido

```text
OpaqueSheinEndpoint
  protocol = https:
  hostname = api-shein.shein.com
  pathname = /h5/sharejump/appjump
```

Todos os três campos precisam casar exatamente (hostname sem correspondência parcial). Query params
não tornam o endpoint confiável e seus valores nunca são persistidos como evidência.

## 2. Candidato de produto

| Campo | Tipo | Regra |
|---|---|---|
| `url` | URL absoluta | HTTPS, sem usuário/senha, host oficial permitido |
| `goodsId` | string numérica | extraído por `extractSheinGoodsId` da própria URL |
| `source` | enum interno | `location`, `html_redirect`, `static_url` ou `static_data` |

Um candidato inválido é descartado; ele nunca é publicado diretamente.

## 3. Evidência de produto

```text
ProductEvidence
  goodsId: string
  canonicalUrl: string
  sources: string[]
```

Validação:

1. todos os candidatos aceitos pertencem à SHEIN e usam HTTPS;
2. o conjunto de `goodsId` distintos precisa ter tamanho exatamente 1;
3. `canonicalUrl` precisa conter esse mesmo ID;
4. zero IDs = `unproven`; dois ou mais = `ambiguous` (também fail-closed).

## 4. Resultado da resolução

```text
Resolved       { status: 'resolved', evidence }
Unproven       { status: 'unproven', reason: 'missing' | 'ambiguous' | 'unsafe' }
TransientError { status: 'transient' }
```

O resultado nunca contém cookie, valor de token opaco ou credencial. A URL canônica só segue para o
construtor quando `status === 'resolved'`.

## 5. Link longo convertido

Invariantes:

- host oficial SHEIN e HTTPS;
- mesmo `goodsId` da evidência;
- `koc_id=<tag da cliente>`;
- `url_from=affiliate_koc_<tag da cliente>`;
- ausência de `shc`, `link`, `onelink`, `requestId`, `behaviorId`, `utm_*`, fragmento e identidade
  de terceiro;
- cookie não participa da construção.

Somente depois dessas invariantes o encurtamento opcional pode substituir a apresentação final.

## 6. Diagnóstico persistido

Reusa `MessageLog`:

| Situação | `status` | prefixo/código de `errorMsg` | Texto para a cliente |
|---|---|---|---|
| credencial inválida | `error` | `error:conversion:*` existente | falta cadastrar ID |
| produto não comprovado | `error` ou `skipped` conforme convenção atual | código SHEIN estável | link de compartilhamento não permitiu identificar o produto |
| indisponibilidade | `error` | código SHEIN transitório | não foi possível consultar a SHEIN agora |
| desconhecida | `error` | conversão genérica sem culpar credencial | não foi possível converter este link |

Nenhum campo novo; `originalUrl` segue a política existente e os novos logs estruturados não devem
adicionar valores de token/cookie.

## 7. Transições

```text
oneLink -> resolução comum -> produto direto ----------------------┐
                                                                  v
oneLink -> sharejump/appjump -> evidência passiva -> produto único -> limpeza -> identidade cliente -> longo
                                      |                                   |
                                      +-> sem/ambíguo/inseguro -> recusa  +-> cookie opcional -> curto
                                      +-> rede/timeout -> transitório
```
