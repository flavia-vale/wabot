# Tasks: oneLink opaco da SHEIN com fallback longo seguro

**Input**: documentos em `/specs/015-shein-opaque-onelink/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`,
`contracts/opaque-resolution.md`, `contracts/conversion-diagnostics.md`, `quickstart.md`

**Tests**: obrigatórios e escritos antes da implementação. Todos os testes automatizados usam
`fetchImpl` injetado, fixtures sintéticas e zero rede. Nenhum token, cookie ou ID coletado em
produção pode entrar no repositório.

**Organization**: tarefas agrupadas pelas três user stories. O escopo fica restrito ao conversor
SHEIN e ao diagnóstico já persistido pelo worker; não há migration, dependência, processo, fila,
dashboard ou alteração nos demais conversores.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável por tocar arquivo/caso independente e não depender de task incompleta
- **[Story]**: US1 (P1 — converter com prova), US2 (P1 — falhar fechado), US3 (P2 — diagnosticar)
- Cada task identifica o arquivo e o resultado verificável esperado

## Path Conventions

Backend Node em `src/`; testes `node:test` em `test/`; nenhum diretório de código novo.

---

## Phase 1: Setup e baseline

**Purpose**: congelar o comportamento funcional antes de ampliar a resolução.

- [X] T001 Executar `node --test test/shein-shortlink-resolve.test.js test/converters-shein.test.js`
      e registrar o baseline local: produto direto, oneLink antigo, campanha/cupom, ausência de
      cookie e fallback longo já devem passar antes de qualquer edição.
- [X] T002 Auditar `src/converters/shein.js` e documentar junto às novas funções os limites já
      existentes que serão compartilhados (8 s totais, 6 hops, corpo de 512 KiB e cookie jar
      efêmero), sem criar segundo orçamento, dependência ou acesso a `creds.cookie` na descoberta.

**Checkpoint**: baseline verde e limites existentes identificados; nenhuma semântica mudou.

---

## Phase 2: Foundational — contrato puro de prova (bloqueante)

**Purpose**: definir por testes a fronteira exata entre candidato remoto e produto comprovado.

**⚠️ CRITICAL**: US1/US2/US3 não podem implementar efeitos antes desta fase ficar verde.

### Tests first

- [X] T003 [P] Adicionar testes inicialmente falhos em `test/shein-shortlink-resolve.test.js`
      para o predicado exato do endpoint opaco: aceitar somente HTTPS,
      `api-shein.shein.com` e `/h5/sharejump/appjump`; recusar HTTP, credenciais embutidas, host
      sósia/sufixado, subdomínio diferente e caminho parecido.
- [X] T004 [P] Adicionar testes inicialmente falhos em `test/shein-shortlink-resolve.test.js`
      para extração estática de candidatos absolutos/relativos em HTML ou dados estáticos, sempre
      sem executar JavaScript; rejeitar esquema não HTTPS, host externo/sósia, URL com credenciais e
      candidato sem `goods_id` verificável.
- [X] T005 [P] Adicionar testes inicialmente falhos em `test/shein-shortlink-resolve.test.js`
      para consolidação da prova: mesmo ID repetido em múltiplas fontes resulta em um produto;
      zero IDs, dois IDs distintos ou URL canônica com ID divergente resultam em `unproven`.

### Implementation

- [X] T006 Implementar em `src/converters/shein.js` o predicado puro do endpoint
      `https://api-shein.shein.com/h5/sharejump/appjump`, com comparação ancorada de protocolo,
      hostname e pathname e rejeição explícita de `username`/`password`, satisfazendo T003.
- [X] T007 Implementar em `src/converters/shein.js` helpers puros e limitados para coletar
      candidatos estáticos, normalizá-los contra a base oficial e aceitar apenas URLs HTTPS sem
      credenciais em hosts SHEIN permitidos que exponham `goods_id` pela própria URL, sem `eval`,
      VM, browser/headless ou interpretação de `shc`/`link`, satisfazendo T004.
- [X] T008 Implementar em `src/converters/shein.js` a consolidação `ProductEvidence`: deduplicar
      pelo ID, exigir exatamente um `goodsId`, selecionar URL canônica que exponha esse mesmo ID e
      devolver estado explícito `resolved`/`unproven`, satisfazendo T005.
- [X] T009 Rodar `node --test test/shein-shortlink-resolve.test.js` e confirmar que o contrato puro
      fica verde sem requisições reais nem valores da RCA nos fixtures.

**Checkpoint**: apenas uma prova única, oficial e inspecionável pode seguir ao construtor.

---

## Phase 3: User Story 1 — Publicar produto comprovado sem cookie (Priority: P1) 🎯 MVP

**Goal**: um oneLink opaco que fornece evidência estática inequívoca gera o link longo do mesmo
produto com apenas a identidade da cliente; cookie permanece estética opcional.

**Independent Test**: mockar `onelink → sharejump/appjump → evidência oficial de um produto`, usar
`creds={tag}` sem cookie e conferir saída longa, mesmo `goods_id`, identidade da cliente e ausência
de tokens/rastros.

### Tests first

- [X] T010 [P] [US1] Adicionar teste inicialmente falho em
      `test/shein-shortlink-resolve.test.js` para uma cadeia opaca resolvida por evidência estática
      única, verificando a ordem/quantidade de `fetchImpl`, compartilhamento do cookie jar efêmero e
      consumo do mesmo contador de hops/deadline da resolução comum.
- [X] T011 [P] [US1] Adicionar testes inicialmente falhos em `test/converters-shein.test.js` para
      conversão do novo formato com somente `tag`: saída `m.shein.com`, `linkKind:'product'`, mesmo
      `goods_id`, `koc_id`/`url_from` da cliente e ausência case-insensitive de `shc`, `link`,
      `onelink`, `requestId`, `behaviorId`, `utm_*`, fragmento e afiliado originador.
- [X] T012 [P] [US1] Adicionar teste inicialmente falho em `test/converters-shein.test.js` em que
      existe cookie mas o encurtador falha/recusa: a mesma conversão comprovada deve retornar o link
      longo seguro, sem transformar cookie em pré-requisito.

### Implementation

- [X] T013 [US1] Estender `resolveSheinShortLink` em `src/converters/shein.js` para inspecionar
      passivamente o endpoint opaco, usando `fetchImpl`, deadline, hop limit, cookie jar e leitor de
      corpo limitado já existentes; encaminhar somente `ProductEvidence.status==='resolved'` e
      nunca executar conteúdo remoto ou usar cookie da credencial.
- [X] T014 [US1] Integrar a evidência comprovada ao fluxo atual de `convert` em
      `src/converters/shein.js`: reutilizar `stripSheinAffiliateTracking` e o único construtor longo
      existente, aplicar identidade da cliente e conferir novamente que o ID final é igual ao ID da
      evidência antes de permitir o encurtamento opcional.
- [X] T015 [US1] Rodar `node --test test/shein-shortlink-resolve.test.js
      test/converters-shein.test.js` e confirmar os cenários T010–T012, inclusive que o caminho sem
      cookie não chama o encurtador autenticado.

**Checkpoint**: US1 converte somente produto comprovado e publica longo sem cookie.

---

## Phase 4: User Story 2 — Falhar fechado sem prova (Priority: P1)

**Goal**: nenhuma entrada, intermediário ou reescrita parcial é publicada quando produto/host não
é comprovável ou os limites operacionais impedem concluir a prova.

**Independent Test**: submeter zero produtos, IDs ambíguos, host malicioso e limites excedidos e
confirmar que todos terminam sem URL publicada.

### Tests first

- [X] T016 [P] [US2] Adicionar testes inicialmente falhos em
      `test/shein-shortlink-resolve.test.js` para zero candidato, mesmo endpoint ainda opaco,
      candidatos somente externos/HTTP/com credenciais e dois `goods_id` distintos; todos devem
      resultar em produto não comprovado, sem retornar candidato parcial.
- [X] T017 [P] [US2] Adicionar testes inicialmente falhos em
      `test/shein-shortlink-resolve.test.js` para corpo acima de 512 KiB, ciclo, mais de 6 hops,
      deadline total e erro/interrupção de rede; nenhum caso pode ganhar orçamento extra nem
      publicar entrada/intermediário.
- [X] T018 [P] [US2] Adicionar testes inicialmente falhos em `test/converters-shein.test.js` para
      candidato sósia, ID final divergente e identidade/token sobrevivente após construção; `convert`
      deve falhar fechado em todos, nunca retornar o oneLink original.

### Implementation

- [X] T019 [US2] Completar o caminho opaco em `src/converters/shein.js` para classificar prova
      ausente/ambígua/insegura como falha fechada e rede/timeout/leitura interrompida como transitória,
      preservando o teto total de corpo, hops e tempo e sem fallback para qualquer URL remota.
- [X] T020 [US2] Reforçar em `src/converters/shein.js` a rede final de segurança antes do retorno:
      host HTTPS oficial sem credenciais, mesmo `goods_id`, identidade exclusiva da cliente e zero
      tokens/rastros de origem; qualquer violação deve impedir a publicação.
- [X] T021 [US2] Rodar os testes focados e confirmar que T016–T018 passam e que nenhuma fixture
      adversarial produz propriedade `url` publicável.

**Checkpoint**: US2 falha fechado para toda ausência de prova, ambiguidade, host inseguro ou limite.

---

## Phase 5: User Story 3 — Diagnóstico verdadeiro (Priority: P2)

**Goal**: após uma credencial válida, explicar formato não comprovável, indisponibilidade ou falha
desconhecida sem culpar ID/cookie e sem vazar segredo/token.

**Independent Test**: processar cada classe de falha com `tag` válido e confirmar o texto/código
persistido; depois usar `tag` ausente e confirmar que apenas esse caso mantém a mensagem de cadastro.

### Tests first

- [X] T022 [P] [US3] Adicionar testes inicialmente falhos em `test/converters-shein.test.js` para
      erros classificados sem dados sensíveis: `shein_opaque_product_unproven`,
      `shein_resolution_transient` e `shein_conversion_unknown`; sucesso mantém
      `{url, linkKind, warning}` e falha do encurtador continua retornando longo sem diagnóstico.
- [X] T023 [P] [US3] Adicionar testes de pipeline inicialmente falhos no arquivo de teste existente
      mais próximo do bloco de conversão de `src/bot-worker.js` (ou criar
      `test/bot-worker-conversion-diagnostics.test.js` se não houver seam): mapear os três códigos
      para mensagens leigas, garantir que opaco não comprovado não menciona credencial/cookie e que
      apenas `validateCredentialData(...).configured===false` usa `describeMissingCredentials`.
- [X] T024 [P] [US3] Adicionar asserts em `test/converters-shein.test.js` e no teste do worker para
      garantir que erro/log/diagnóstico não contém valor sintético de `tag`, cookie, `shc`, `link`
      ou URL intermediária, preservando a sanitização atual do `originalUrl`.

### Implementation

- [X] T025 [US3] Introduzir em `src/converters/shein.js` a menor representação de erro classificado
      compatível com o pipeline, sem URL/token/credencial no payload, distinguindo produto não
      comprovado, falha transitória e desconhecida sem alterar o contrato de sucesso.
- [X] T026 [US3] Atualizar somente o ramo de SHEIN após validação em `src/bot-worker.js` para
      traduzir os códigos conhecidos e persistir via `recordConversionIssue`; manter intacto o ramo
      anterior de credencial inválida e o diagnóstico/conversão de todas as outras plataformas.
- [X] T027 [US3] Rodar os testes T022–T024 e confirmar mensagens: “link de compartilhamento não
      permitiu identificar o produto”, “não foi possível consultar agora” e falha genérica sem
      acusar credencial.

**Checkpoint**: US3 informa a causa correta sem vazar dados e sem regredir falta real de ID.

---

## Phase 6: Regressão, segurança e qualidade

**Purpose**: provar compatibilidade e as restrições transversais antes de staging.

- [X] T028 [P] Ampliar/confirmar em `test/converters-shein.test.js` a regressão de produto direto,
      oneLink antigo resolvível, campanha/cupom, limpeza case-insensitive, ausência de cookie,
      encurtamento com cookie e fallback longo; nenhuma expectativa funcional anterior muda.
- [X] T029 [P] Rodar `node --test test/detector.test.js test/link-kind.test.js
      test/converters-shein.test.js test/shein-shortlink-resolve.test.js` e os testes do diagnóstico
      do worker para confirmar detecção/link kind/pipeline.
- [X] T030 Rodar `npm test`, `npm run arch:check` e `git diff --check`, corrigindo apenas regressões
      causadas pela feature; confirmar que Shopee, Amazon, Mercado Livre e Magazine Luiza continuam
      verdes.
- [X] T031 [P] Executar `rg -n "eval\\(|new Function|node:vm|playwright|puppeteer"
      src/converters/shein.js` e revisar o diff para confirmar zero execução remota, dependência,
      migration, processo, fila, env ou ID/cookie/token real versionado.
- [X] T032 [P] Auditar `src/converters/shein.js` e `src/bot-worker.js` para confirmar que logs/erros
      novos carregam apenas plataforma e código/classe, que `creds.cookie` continua restrito a
      `shortenSheinLink` e que nenhuma URL original/intermediária virou fallback.
- [X] T033 Atualizar `specs/015-shein-opaque-onelink/quickstart.md` somente se comandos/arquivos
      realmente mudarem durante a implementação; registrar resultados locais e limitações sem
      alegar validação de staging ainda não executada.

---

## Phase 7: Staging obrigatório e promoção

**Purpose**: validar produto e comissão reais antes de qualquer promoção a produção.

- [~] T034 **DEFERRED — exige merge/autodeploy e conta real de staging.** Validar após merge do PR em `develop` e autodeploy em
      `http://178.105.54.0:3006`, com conta de staging, ID SHEIN válido e cookie vazio: amostra
      conversível do novo formato deve gerar `success`, link longo oficial, mesmo produto no celular,
      somente identidade da conta staging e ausência de `shc`, `link`, `onelink`, `requestId` e
      afiliado originador; confirmar também atribuição no painel de afiliada de teste.
- [~] T035 **DEFERRED — exige ambiente staging implantado e teste operacional controlado.** Validar em staging uma amostra não comprovável e uma indisponibilidade controlada:
      nenhuma URL deve ser publicada e o painel deve mostrar respectivamente motivo de produto não
      identificado e mensagem transitória, sem mencionar credencial inválida ou cookie.
- [~] T036 **DEFERRED — exige autodeploy em staging e credenciais/sessões reais das lojas.** Validar em staging um oneLink antigo, produto direto e uma oferta de Shopee, Amazon,
      Mercado Livre e Magazine Luiza; conferir nos logs que workers nasceram após o deploy e que o
      staging permaneceu no modo canônico `inline` fora de janela de cutover.
- [~] T037 **DEFERRED — bloqueada até aprovação manual de T034–T036 e janela anunciada.** Preparar a promoção `develop → main` somente após T034–T036 aprovadas: anunciar/agendar
      a janela porque `src/converters/` aciona reinício automático do supervisor, não reiniciar
      produção manualmente fora da janela e manter rollback fail-closed (nunca publicar oneLink
      original).

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup → Foundational, que bloqueia todas as stories.
- US1 e US2 dependem da prova pura; seus testes podem ser preparados em paralelo, mas US2 valida a
  mesma extensão de resolução implementada por US1.
- US3 depende da classificação produzida pelo conversor após US1/US2.
- Regressão depende de todas as stories implementadas.
- Staging depende de PR contra `develop`, autodeploy e todas as verificações locais verdes; produção
  depende de aprovação manual em staging.

### User Story Dependency Graph

```text
Setup → Foundation ─┬→ US1 (produto provado) ─┐
                    └→ US2 (fail-closed) ─────┼→ US3 (diagnóstico) → Regressão → Staging
```

### TDD obrigatório dentro de cada story

1. adicionar os testes listados e confirmar que falham pelo motivo esperado;
2. implementar a menor mudança para deixá-los verdes;
3. rodar o teste independente da story;
4. só então avançar à próxima story/fase.

### Parallel Opportunities

- T003, T004 e T005 podem ser escritos em paralelo.
- T010, T011 e T012 podem ser escritos em paralelo após Foundation.
- T016, T017 e T018 podem ser escritos em paralelo após Foundation.
- T022, T023 e T024 podem ser escritos em paralelo após o contrato de erros ser definido.
- T028/T031/T032 podem ser revisados em paralelo antes da suíte completa T030.

## Implementation Strategy

1. **MVP seguro**: Foundation + US1 + US2; conversão só existe quando há prova única.
2. **Diagnóstico**: US3 melhora a causa exibida sem afrouxar a recusa.
3. **Compatibilidade**: suíte focada, completa, arquitetura e auditoria estática.
4. **Operação**: staging obrigatório prova produto e comissão; promoção posterior segue o fluxo
   canônico e janela anunciada para possível restart de sessões.

---

## Phase 8: Correções da auditoria de convergência

**Purpose**: fechar lacunas entre os itens marcados como concluídos e os contratos verificáveis.

- [X] T038 [US2] Alterar `readBodyLimited`/o caminho opaco em `src/converters/shein.js` para
      distinguir corpo concluído de corpo truncado: uma resposta que exceda 512 KiB deve terminar
      em `shein_resolution_transient` e jamais aceitar evidência encontrada no prefixo truncado,
      conforme FR-006, o contrato de resposta excessiva e T017. Manter, por compatibilidade, o
      comportamento antigo somente para interstícios não opacos se isso for deliberado e coberto.
- [X] T039 [US2] Adicionar em `test/shein-shortlink-resolve.test.js` testes executáveis do caminho
      opaco para: corpo >512 KiB contendo candidato antes do teto, ciclo de redirects, esgotamento
      dos 6 hops e deadline/AbortSignal. Usar `returnDetails:true` e exigir falha fechada com código
      transitório nos limites operacionais, sem `evidence.status==='resolved'` nem URL publicável.
- [X] T040 [US2] Implementar detecção de ciclo e classificação explícita de esgotamento de
      hops/deadline em `resolveSheinShortLink`; antes de qualquer fetch adicional, recusar transição
      para host não oficial, URL HTTP ou com credenciais. Adicionar testes provando que o
      `fetchImpl` nunca é chamado com o destino inseguro e que nenhuma entrada/intermediária vira
      prova ou fallback.
- [X] T041 [US2] Completar os casos adversariais prometidos por T016/T018 em
      `test/shein-shortlink-resolve.test.js` e `test/converters-shein.test.js`: dois `goods_id`
      distintos no HTML opaco, candidatos apenas HTTP/externo/sósia/com userinfo, candidato final
      com ID divergente e tentativa de sobrevivência case-insensitive de `shc`, `link`,
      `onelink`, `requestId`, `behaviorId` e `utm_*`; em todos, `convert` não pode devolver `url`.
- [X] T042 [US3] Substituir o teste textual de `test/bot-worker-conversion-diagnostics.test.js`
      por um seam executável (helper puro extraído ou pipeline injetável) que prove o comportamento
      real: os três códigos SHEIN são traduzidos e persistidos via `recordConversionIssue`, falta de
      `tag` continua usando exclusivamente `describeMissingCredentials`, falha de encurtamento não
      grava diagnóstico, e erro de outra plataforma não recebe mensagem/código SHEIN.
- [X] T043 [US3] Adicionar asserts executáveis de sanitização no seam do worker: razão,
      `errorMsg` e campos novos de log/persistência não podem conter os valores sintéticos de
      `tag`, cookie, `shc`, `link` ou URL intermediária. Confirmar separadamente que a política
      preexistente de sanitização de `originalUrl` permanece intacta.
- [X] T044 Rodar novamente a suíte focada, `npm test`, `npm run arch:check` e
      `git diff --check`; atualizar os checkboxes T030/T033 e o quickstart somente com resultados
      realmente observados depois das correções, sem marcar staging T034–T036 como concluído.

---

## Phase 9: Remediações da revisão independente

**Purpose**: corrigir lacunas bloqueantes encontradas na revisão de segurança e diagnóstico.

- [X] T045 [US2] Tornar o limite de 512 KiB real também no fallback de `readBodyLimited` em que a
      resposta não oferece `body.getReader()`: o uso atual de `res.text()` materializa o corpo
      inteiro antes de truncá-lo e viola FR-006 sob um `fetchImpl`/runtime sem Web Stream. Preferir
      rejeitar/falhar fechado nesse caminho ou usar uma primitiva realmente limitada; adicionar
      teste que prove que conteúdo arbitrariamente grande não é aceito como evidência nem tratado
      como corpo completo.
- [X] T046 [US3] Classificar todas as saídas do endpoint opaco, inclusive resposta HTTP de erro,
      `content-type` não HTML, `Location` malformado e risk/captcha, sem cair no retorno `null`
      genérico que ainda grava “Confira se as credenciais estão válidas”. Definir explicitamente
      quais são transitórias e quais são `shein_opaque_product_unproven`, lançar o erro tipado em
      `convert` e cobrir o diagnóstico persistido pelo seam/worker para cada ramo.
- [~] T047 [US1] **DEFERRED — o ambiente local não resolve `onelink.shein.com` (`EAI_AGAIN`); executar o diagnóstico sanitizado na VPS/staging antes de considerar US1 validada.** Validar a capacidade da estratégia de evidência estática contra uma captura
      sanitizada representativa do `sharejump/appjump` observado (sem token/ID real). Se o HTML
      real não expuser URL oficial com `goods_id`/`-p-ID`, não considerar US1 concluída: documentar
      a transição oficial adicional necessária e implementar/testar essa transição dentro dos
      mesmos limites, sem executar JS ou interpretar `shc`/`link` como prova.
