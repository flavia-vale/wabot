# Data Model — Estratégia de leads inbound (013)

**Nenhuma migration. Nenhuma coluna nova. Nenhuma tabela nova.** Todas as entidades abaixo já
existem — o trabalho é ler e apresentar o que já está gravado.

---

## 1. Entrada do registro de páginas (`SeoRoute`)

Objeto literal em `dashboard/lib/seo-registry.mjs`. Sem persistência.

| Campo | Tipo | Papel nesta feature |
|---|---|---|
| `path` | string | chave |
| `title` | string \| ausente | **P1** — passa a existir só onde a página não tem módulo de conteúdo próprio (FR-001) |
| `description` | string \| ausente | idem |
| `indexable` | boolean | **P2** — passa a governar três pontas: sitemap, IndexNow **e** `robots` do HTML (FR-008/FR-011) |
| `template` | string | critério de triagem: `'programmatic-lp'` = grade gerada por modelo (R9) |
| `schemaTypes` | string[] | exigido por `validate-schema-templates.mjs` nas rotas novas |
| `lastModified` | string | alimentado por `EDITORIAL_DATES` |

**Invariante nova (FR-011):** `indexable === false` ⇒ fora do sitemap **e** fora do IndexNow
**e** com `robots: { index:false, follow:true }` no HTML. As três derivam do mesmo campo; não
há caminho que leia uma sem as outras.

**Invariante nova (FR-001):** para um mesmo `path`, `title`/`description` existem em **um**
lugar — no registry **ou** no módulo de conteúdo, nunca nos dois.

### Derivado: título entregue

```
tituloEntregue(path) = tituloDaPagina(path) + ' | Espelha Grupos'
```

`' | Espelha Grupos'` vem de `title.template` em `dashboard/app/layout.js` (17 caracteres).
Orçamento de FR-002 = 55 sobre `tituloDaPagina`; o sufixo é medido e reportado, não somado
(justificativa em `research.md` R2).

---

## 2. Concorrente (`Competitor`)

Objeto literal em `dashboard/lib/competitors-data.js`. Já valida campos obrigatórios.

| Campo | Papel |
|---|---|
| `slug`, `name` | identidade |
| `pricingTiers[]` | **toda** citação de preço da página tem que sair daqui |
| `verifiedAt`, `source` | **FR-031** — sem os dois, o preço não pode aparecer no texto |
| `bestFor`, `notIdealFor` | matéria-prima de **FR-032** |

Achadinho Pro já está preenchido e verificado (31/07/2026). Nenhuma coleta nova é necessária.

---

## 3. Página de comparação (`ComparisonPage`)

Entrada em `dashboard/app/_comparisonContent.js`, chaveada por path.

| Campo | Obrigatório para | Observação |
|---|---|---|
| `title`, `description` | FR-002, FR-007 | fonte única do título dessa rota |
| `competitorSlugs[]` | FR-031 | liga a página aos dados verificados |
| `tldr`, `directAnswer` | citação por IA | resposta direta e extraível |
| `rows[]` | comparação | cada linha nomeia as duas ferramentas |
| **`bestFit[]`** | **FR-032** | onde o concorrente é a melhor escolha — campo obrigatório |
| `notIdealFit[]` | honestidade | inclui o que o BOTinho não cobre |
| `productPage` | par recíproco | link de volta para a comercial (padrão do PR #1420) |

**Invariante (FR-030):** `title` diz "Alternativa a X"; a página nunca se apresenta como X.

---

## 4. Linha de envio bloqueado (`MessageLog`)

Tabela existente (`prisma/schema.prisma:479`). **Somente leitura** nesta feature.

| Campo | Valor no caso que interessa |
|---|---|
| `status` | `'skipped'` |
| `errorMsg` | `'skip:no_valid_conversions'` |
| `platform` | `'shopee'` \| `'mercadolivre'` \| `'amazon'` \| `'magalu'` — **é daqui que sai o vocabulário certo por loja** |
| `sentAt` | recorta a janela de 7 dias |

Índice usado: `@@index([userId, status, sentAt])` — já existe.

---

## 5. Credencial (`Credential`)

Tabela existente. Leitura de `platform` apenas (nunca de `data`, que é cifrado).

Serve para separar os dois casos de **FR-020**:

| Tem linha para a loja? | Significado | Quem avisa |
|---|---|---|
| não | nunca cadastrou | **aviso novo** (P3) |
| sim | cadastrou; código venceu ou chave recusada | `src/credentialExpiry/` (já existe) — o novo se cala |

---

## 6. Aviso de credencial (`CredentialBlockAlert`) — objeto de transporte

Não é persistido. Montado pela rota nova, consumido pelo painel.

```
{
  stores: [
    {
      platform:   'shopee' | 'mercadolivre' | 'amazon' | 'magalu',
      storeLabel: 'Shopee' | 'Mercado Livre' | 'Amazon' | 'Magazine Luiza',
      blockedCount: number,        // envios recusados na janela
      lastBlockedAt: ISO string,
      headline:  string,           // "O que aconteceu"
      body:      string,           // por quê + consequência (INVERTIDA na Shopee)
      nextStep:  string,           // o que fazer
      href:      '/painel/ids-afiliada'
    }
  ]
}
```

**Invariantes de texto (FR-017..FR-019):**

| Regra | Consequência |
|---|---|
| `platform === 'shopee'` | `body` diz que as ofertas **param de sair** |
| `platform ∈ {mercadolivre, amazon}` | `body` diz que as ofertas **continuam saindo**, com link mais comprido |
| qualquer | `headline`/`body`/`nextStep` nunca contêm `cookie`, `SSID`, `tag`, `partner_id`, `?tag=` |
| loja com credencial cadastrada | não entra em `stores` (FR-020) |
| loja cadastrada depois | some da resposta seguinte (FR-021) |

As duas famílias de texto vivem em **constantes separadas** em
`src/credentialBlockAlert/message.js` — nunca um template único com a consequência como
variável. Fundir os dois textos é exatamente a regressão que o guard procura.
