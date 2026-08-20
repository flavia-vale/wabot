# Phase 1 — Data Model: SHEIN

Nenhuma tabela nova. Nenhuma coluna nova. Uma única migration, DML.

---

## 1. Credencial SHEIN da cliente

Armazenada na tabela `Credential` já existente:

| Campo | Valor |
|---|---|
| `platform` | `'shein'` (string livre — sem migration) |
| `data` | JSON cifrado AES-256-GCM (`src/credentialCrypto.js`), formato `v1:<iv>:<tag>:<ct>` |
| conteúdo de `data` | `{ "tag": "<identificador numérico da afiliada>" }` |

**Campos obrigatórios**: `REQUIRED_FIELDS.shein = ['tag']` — um só.

**Entrada aceita pela cliente** (normalizada no save):

| O que ela cola | Resultado |
|---|---|
| link de afiliada da SHEIN (oneLink ou destino já expandido) | identificador extraído e guardado |
| só o número | aceito como está |
| link de compartilhamento do app (`shc`/`link`, `url_from=GM7…`) | **recusado** com explicação de onde pegar o link certo |
| texto que não é link nem número | **recusado** com mensagem dizendo o que era esperado |

**Validade**: permanente. Fora de `PLATFORMS_WITH_SESSION_CHECK` e de `EXPIRY_ALERT_PLATFORMS`
(FR-008) — nunca exibe status de sessão nem aviso de vencimento.

**Apagar**: `DELETE /credentials/shein` — a rota já é genérica e idempotente (200 +
`deleted: false` quando não havia nada). Nada a implementar além de a plataforma constar em
`PLATFORMS`.

---

## 2. Estados da credencial (reusa `getPlatformStatus`)

```
pending  ──salvar link/número válido──▶  configured
   ▲                                          │
   └──────────── apagar meus dados ───────────┘

(salvar link errado → permanece no estado atual + mensagem de erro; nada é gravado)
```

`incomplete` não ocorre para SHEIN: há um campo só, então preenchido = `configured`.

---

## 3. Formatos de link de SHEIN

### 3.1 oneLink (encurtado) — **entrada típica do grupo monitorado**

```
https://onelink.shein.com/<n>/<code>
```

Não redireciona por HTTP no 1º hop: serve HTML com o destino num `<input id="url" value="...">`
escondido. Também é a página que carrega o `og:image` do produto.

### 3.2 Destino conversível (após resolução)

```
https://m.shein.com/br/ark/default
  ?onelink=<x>&requestId=<x>
  &scene=1&test=5051&ad_type=KOC&campaign=goods&campaign_id=20
  &koc_id=<ID_AFILIADA>&goods_id=<ID_PRODUTO>
  &url_from=affiliate_koc_<ID_AFILIADA>
```

Classificação de cada parâmetro — **esta tabela é a regra do conversor**:

| Parâmetro | Classe | O que fazemos |
|---|---|---|
| `koc_id` | identidade da afiliada | **substituir** pela da cliente |
| `url_from` | identidade derivada (literal `affiliate_koc_` + `koc_id`) | **recalcular** a partir do `koc_id` da cliente |
| `aff_id`, `src_identifier` | identidade (variantes) | **remover** (nunca copiar de terceiro) |
| `onelink`, `requestId`, `behaviorId` | rastro da sessão de quem gerou | **remover** (FR-013) |
| `utm_*` | tracking de terceiro | **remover** |
| `goods_id` | produto | **preservar** — vem do link de origem |
| `scene=1`, `test=5051`, `ad_type=KOC`, `campaign=goods`, `campaign_id=20` | constantes do programa | **preservar/garantir** — vivem no código, não no cadastro |
| caminho (`/br/ark/default`) e demais params | destino | **preservar** |

### 3.3 Página de produto direta

```
https://br.shein.com/<slug>-p-<goodsId>.html
https://br.shein.com/<slug>-p-<goodsId>-cat-<catId>.html
```

Conversível: o `goodsId` sai do caminho.

### 3.4 Compartilhamento do app — **NÃO conversível**

```
https://api-shein.shein.com/h5/sharejump/appjump?shc=<token>&link=<token>&url_from=GM7<koc_id>
```

Sem `goods_id`; produto trancado em token opaco; prefixo `GM7` em vez de `affiliate_koc_`.
Conversão **retorna `null`** (FR-014).

### 3.5 Cupom / campanha / vitrine

Qualquer URL de domínio SHEIN sem identificador de produto. Converte igual (só a identidade é
aplicada), com `linkKind: 'coupon'`.

---

## 4. Link publicado (saída)

Invariantes verificáveis (FR-012/013/015):

- contém `koc_id` e `url_from` **da cliente**, e nenhum outro identificador de afiliada;
- **não** contém `onelink`, `requestId`, `behaviorId`, `utm_*`;
- aponta ao mesmo produto do link de origem (mesmo `goods_id`);
- se qualquer passo falhar → **nada é publicado** (nunca o original, nem em pedaço).

---

## 5. Foto do produto

| Origem | `og:image` da página do oneLink (`img.ltwebstatic.com`) |
|---|---|
| Transformação | remover o sufixo de miniatura (`_thumbnail_405x552`) do endereço |
| Resultado medido | 1340x1785 (acima de `IMAGE_HIRES_MIN_DIMENSION_PX = 800`) |
| Se faltar | oferta sai sem foto, sem erro para a cliente (FR-019) |

---

## 6. Catálogo da loja (constantes de apresentação)

| Registry | Valor |
|---|---|
| `PLATFORM_LABELS` (credencial, mirrorTemplate) | `SHEIN` |
| `STORE_PREVIEW_TITLES` (título do card) | `SHEIN` |
| `BRAND_STYLES` (banner de cupom) | `{ store: 'SHEIN', bg: '#000000', fg: '#FFFFFF', accent: '#FFFFFF' }` |
| CSV default de `BotConfig.platforms` | `shopee,amazon,mercadolivre,magazineluiza,shein` |

"SHEIN" tem 5 caracteres → cai no ramo de fonte grande do `storeBrandCard`, sem risco de corte.

---

## 7. Migration (única)

`prisma/migrations/<ts>_botconfig_platforms_add_shein/migration.sql`, DML idempotente, sem
`ALTER TABLE`:

```sql
UPDATE "BotConfig"
   SET "platforms" = "platforms" || ',shein'
 WHERE ',' || COALESCE("platforms", '') || ',' NOT LIKE '%,shein,%';
```

Acompanhada da mudança de `@default` em `prisma/schema.prisma:294` (defesa em profundidade para
linhas novas). Não exige parar API/supervisor (pegadinha #8 não se aplica a DML).
