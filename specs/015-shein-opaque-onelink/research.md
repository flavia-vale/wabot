# Phase 0 — Research: oneLink opaco da SHEIN

## Fonte de verdade

RCA observado em produção em 2026-09-02, implementação atual em
`src/converters/shein.js`, pipeline em `src/bot-worker.js` e testes existentes. Nenhum cookie,
token opaco ou ID real será copiado para os artefatos/fixtures.

O RCA confirmou:

1. a conta afetada tinha `tag` numérico válido, SHEIN habilitada e cookie ausente;
2. a mesma conta já publicou links longos `m.shein.com` sem cookie;
3. o novo oneLink foi detectado e resolveu para
   `api-shein.shein.com/h5/sharejump/appjump`;
4. remover `shc` da entrada não mudou a natureza da resposta: a SHEIN recolocou `shc`/`link`;
5. o intermediário não expôs `goods_id`, então a guarda atual recusou corretamente;
6. a mensagem genérica culpou credenciais válidas.

Nenhum item de arquitetura ficou como `NEEDS CLARIFICATION`. A convertibilidade de uma amostra
continua condicionada à existência de evidência estática verificável; sem ela, recusar é sucesso do
contrato, não uma falha da implementação.

---

## D-001 — Token opaco nunca é prova de produto

**Decisão**: não decodificar, não reescrever e não inferir `goods_id` de `shc`/`link`.

**Rationale**: os valores podem carregar produto e identidade de origem num contrato não público.
Removê-los ou interpretá-los por hipótese não prova o destino nem a comissão.

**Alternativas rejeitadas**: publicar o oneLink original; remover `shc`; copiar `link`; tentar
base64/heurísticas. Todas podem preservar comissão alheia ou abrir produto diferente.

## D-002 — Resolver apenas por evidência passiva oficial

**Decisão**: reconhecer host/path exatos e continuar a cadeia por redirects HTTP ou URLs/IDs
presentes estaticamente na resposta oficial limitada. Não executar JavaScript remoto.

**Rationale**: mantém o modelo do resolvedor atual (`input#url`, `Location`, meta/canonical) e
permite testar sem rede. Uma URL embutida é apenas candidata até passar protocolo, host e prova.

**Alternativas rejeitadas**: Playwright/headless browser (memória/dependência e execução remota),
endpoint autenticado/cookie da cliente (tornaria cookie obrigatório), serviço externo.

## D-003 — Prova é um único produto, não uma URL qualquer

**Decisão**: reunir candidatos válidos e aceitar somente quando o conjunto de IDs contém exatamente
um `goods_id`. A URL canônica escolhida precisa ser HTTPS, sem usuário/senha, em host permitido e
ela própria expor o mesmo ID por caminho `-p-<id>.html` ou query `goods_id`.

**Rationale**: HTML/JSON pode repetir o mesmo produto em variantes; repetição do mesmo ID não é
ambiguidade. Dois IDs distintos são ambíguos e devem falhar fechado.

## D-004 — O orçamento existente é total

**Decisão**: o passo opaco compartilha os 8 s e 6 hops de `resolveSheinShortLink`; não recebe um
timeout adicional. Corpo continua limitado a 512 KiB por hop e o cookie jar é efêmero por chamada.

**Rationale**: o pipeline inteiro tem teto de 25 s. Somar outro orçamento poderia estourar a
mensagem completa e bloquear links irmãos.

## D-005 — A construção segura existente continua sendo a única saída

**Decisão**: uma resolução comprovada volta ao fluxo atual de `stripSheinAffiliateTracking`,
aplicação de `koc_id`/`url_from`, rede final contra identidade de terceiro e conferência do ID.

**Rationale**: duplicar um construtor específico aumentaria o risco de a nova saída esquecer uma
guarda já corrigida por incidentes anteriores.

## D-006 — Cookie continua estritamente opcional

**Decisão**: nenhuma chamada de descoberta usa `creds.cookie`. `shortenSheinLink` só é chamado após
existir link longo seguro; falha ou ausência devolve o longo.

**Rationale**: comportamento já comprovado em produção e requisito explícito. O cookie melhora a
estética, não autoriza a conversão.

## D-007 — Falha classificada no limite do conversor

**Decisão**: o conversor sinaliza falhas esperadas com código não sensível; o worker traduz o código
para texto leigo e `errorMsg` persistido. Usar o mecanismo de erro classificado já tratado pelo
worker, sem incluir URL/token no objeto de erro.

Classes mínimas:

| Código interno | Quando |
|---|---|
| `shein_opaque_product_unproven` | endpoint reconhecido, mas nenhum produto único foi provado |
| `shein_resolution_transient` | rede, timeout ou leitura interrompida impede conclusão |
| `shein_conversion_unknown` | falha interna não classificada |

Credencial ausente não nasce aqui: `validateCredentialData` continua sendo a fonte exclusiva.

## D-008 — O diagnóstico usa o armazenamento existente

**Decisão**: continuar gravando `MessageLog` por `recordConversionIssue`, com códigos estáveis e
mensagem leiga. Nenhuma migration ou UI nova.

**Rationale**: o painel já apresenta `errorMsg`; corrigir a origem é suficiente e preserva custos.

## D-009 — Fixtures sintéticas e zero rede

**Decisão**: modelar HTML/JSON/redirects com tokens `synthetic-*` e IDs fictícios. Todo teste injeta
`fetchImpl` e verifica quantidade/ordem de chamadas.

**Rationale**: evita vazar dados da RCA, torna o teste determinístico e não provoca captcha/429.

## D-010 — Sem mudança nas demais lojas

**Decisão**: não alterar detector/registry nem contratos de Amazon, Shopee, ML ou Magalu.

**Rationale**: o link já é detectado corretamente; o defeito está depois da detecção e antes da
construção do link SHEIN.
