# Homologação QA — conversão SHEIN e AliExpress

**Data:** 2026-09-10  
**Escopo informado:** “duas novas lojas para converter: SHEIN e ALIEXPRESS”  
**Parecer atualizado:** **APROVADO COM RESSALVAS PARA STAGING; PRODUÇÃO BLOQUEADA ATÉ O GATE REAL**

## Resumo executivo

A entrega ainda não pode ser promovida para produção. A implementação da SHEIN está
presente e sua bateria automatizada específica teve **209 de 210 casos
aprovados**. A única falha desse recorte ocorreu antes de exercitar a regra da
migration porque o SQLite deste ambiente retornou `disk I/O error`; por isso,
ela é uma limitação do ambiente de QA, não uma aprovação nem uma falha funcional
confirmada.

**Atualização:** os bloqueios de implementação encontrados abaixo foram
corrigidos no ciclo seguinte. AliExpress passou a integrar detector, conversor,
credenciais, defaults, seletores, card, migration e diagnóstico, com contrato em
`specs/016-aliexpress-store-support/spec.md`. O bloqueio remanescente é o gate
externo: confirmar com credenciais reais, no staging, que a API aceita a
assinatura e credita o clique à conta correta.

Para a SHEIN, os testes locais cobrem detecção, domínio sósia, conversão,
remoção de identidade de terceiro, timeout, links opacos, credencial, link
curto, cupom, imagem e card. A homologação final continua pendente porque os
gates manuais do próprio produto — grupo real no staging, card no celular e
confirmação do clique/comissão no painel da afiliada — exigem ambiente e contas
reais não fornecidos nesta execução.

## 1. Análise crítica dos requisitos

### 1.1 Bloqueios e ambiguidades

1. **Não existe especificação da AliExpress.** Falta definir domínios oficiais
   e encurtadores aceitos, formato de credencial, API/gerador usado, regra de
   atribuição, parâmetros que devem ser removidos, comportamento de
   cupom/campanha, expiração da credencial, limites e mensagens de erro.
2. **“Converter” não define o critério financeiro de aceite.** É obrigatório
   dizer como provar que a comissão foi atribuída à cliente, e não apenas que o
   link abriu ou ficou visualmente correto.
3. **Não há política explícita para falha da AliExpress.** Deve ser decidido e
   testado se uma falha bloqueia a oferta. A recomendação de QA é falhar fechado:
   jamais publicar o link de terceiro.
4. **Não há amostras homologáveis da AliExpress.** São necessários, no mínimo,
   links reais de produto direto, short link, produto de outro afiliado,
   cupom/campanha, link expirado, link internacional e domínio sósia.
5. **Critérios não funcionais estão ausentes para ambas as lojas.** Definir
   timeout total, número máximo de redirects, tamanho máximo de resposta,
   política de retry/cache, taxa mínima de sucesso e orçamento de latência.
6. **Concorrência não está especificada.** Deve haver contrato para dois saves
   simultâneos de credencial e várias mensagens do mesmo produto processadas ao
   mesmo tempo, sem credencial cruzada entre clientes nem publicação duplicada.
7. **O spec da SHEIN ainda declara status `Draft`.** Antes da promoção, o
   documento precisa representar o aceite real e registrar quem aprovou os
   testes de comissão em staging.

### 1.2 Regressões que precisam fazer parte do gate

- As lojas existentes devem continuar sendo detectadas e convertidas sem
  alteração de URL, card, imagem, deduplicação ou mensagens de erro.
- As allowlists de API, worker e tela devem derivar de uma fonte comum ou ter
  um teste contratual que falhe quando uma loja existir em apenas algumas
  superfícies.
- Credenciais de uma conta nunca podem ser usadas na conversão de outra, mesmo
  com saves e conversões concorrentes.
- Links não suportados, malformados, com `javascript:`, credenciais embutidas no
  URL ou redirects para domínio externo devem falhar sem SSRF e sem publicar o
  original.
- Timeout/indisponibilidade da loja não pode prender o worker nem atrasar a fila
  indefinidamente.

## 2. Matriz de execução

| Área | SHEIN | AliExpress | Resultado |
|---|---:|---:|---|
| Detecção de produto/short link | Automatizado | Automatizado | **Aprovado local** |
| Domínio sósia e redirect externo | Automatizado | Automatizado | **Aprovado local** |
| Cadastro e validação de credencial | Automatizado | Automatizado | **Aprovado local** |
| Conversão com identidade da cliente | Automatizado com mocks | Automatizado com mocks | **Pendente gate real** |
| Remoção de identidade/rastros de terceiro | Automatizado | Automatizado | **Aprovado local** |
| Link opaco, timeout e falha de rede | Automatizado | Automatizado | **Aprovado local** |
| Cupom/campanha e classificação | Automatizado | Automatizado | **Pendente gate real** |
| Card, título e imagem | Automatizado estruturalmente | Automatizado estruturalmente | **Pendente visual real** |
| Autorização básica de rota | Exercitada pela suíte de rota | Usa a mesma rota autenticada | **Aprovado estrutural** |
| Concorrência/save duplo | Sem evidência específica | Proteção de duplo clique adicionada | **Pendente carga real** |
| Build do dashboard | Não concluiu: `EIO` no `fsync` | Não concluiu | **Inconclusivo (ambiente)** |
| E2E em staging/celular/comissão | Sem credenciais/ambiente | Sem implementação | **Pendente/Bloqueado** |

## 3. Relatório profissional de bugs

### BUG-001 — AliExpress anunciada no escopo, mas não existe no pipeline — **CORRIGIDO**

**Severidade original:** **Bloqueante**

**Estado:** corrigido; aguardando validação externa no staging

**Passos para reproduzir:**

1. Abrir **IDs de afiliada** e procurar uma configuração AliExpress.
2. Tentar salvar credencial com `PUT /api/credentials/aliexpress`.
3. Enviar uma mensagem contendo um link oficial da AliExpress a um grupo
   monitorado.
4. Procurar AliExpress entre as plataformas permitidas do grupo.

**Esperado:** a loja aparece no painel, aceita e protege sua credencial, detecta
o link, troca a atribuição pelo identificador da cliente e permite habilitar ou
desabilitar a loja no grupo.

**Obtido:**

- a lista visual de credenciais termina em SHEIN;
- a API rejeita a plataforma porque ela não pertence a `PLATFORMS`;
- o detector não possui pattern de AliExpress;
- o registro de conversores não possui função AliExpress;
- defaults e allowlist dos grupos também terminam em SHEIN.

**Evidências:** `dashboard/lib/painel/affiliatePlatforms.js`,
`src/credentialHealth.js`, `src/detector.js`, `src/converters/index.js`,
`src/api/routes/config.js`, `src/api/routes/groups.js`, `prisma/schema.prisma` e
a busca estática `rg -n "aliexpress" . --glob '!uploads/**' --glob
'!node_modules/**' --glob '!*lock*'`. As poucas ocorrências encontradas são
rótulo de log, linter, documentação ou fixture genérica; não formam uma
integração.

### BUG-002 — Migration da SHEIN cria CSV malformado quando `platforms` está vazio — **CORRIGIDO**

**Severidade original:** **Baixa**

**Estado:** corrigido na migration original para instalações novas e normalizado
pela migration da AliExpress para instalações já migradas

**Passos para reproduzir:**

1. Criar uma linha legada de `BotConfig` com `platforms=''`.
2. Aplicar
   `prisma/migrations/20260817120000_botconfig_platforms_add_shein/migration.sql`.
3. Consultar `platforms`.

**Esperado:** `shein`.

**Obtido:** `,shein`, com um item vazio antes da loja. O próprio teste atual
consolida esse resultado como esperado, em vez de rejeitá-lo.

**Impacto:** dado inconsistente e risco de comportamentos diferentes entre
consumidores que filtram itens vazios e consumidores que não filtram. Não
bloqueia sozinho a SHEIN, mas deve ser corrigido e coberto para dados legados.

**Evidências:** concatenação incondicional na migration e expectativa
`,shein` em `test/migrations-botconfig-platforms-shein.test.js`.

### BUG-003 — Gate automatizado obrigatório não é executável neste ambiente

**Severidade:** **Alta para homologação; infraestrutura, não defeito funcional confirmado**

**Passos para reproduzir:**

1. Rodar `npm test`.
2. Rodar isoladamente
   `node --test test/migrations-botconfig-platforms-shein.test.js`.
3. Rodar `cd dashboard && npm run build`.

**Esperado:** banco temporário criado, testes executados e build concluído.

**Obtido:** Prisma/SQLite falham com `disk I/O error`; o Next.js falha com
`EIO: i/o error, fsync`. Há espaço e inodes livres, portanto o resultado aponta
para a camada de filesystem/sincronização do ambiente atual.

**Evidências:** saídas dos três comandos na execução de QA; `df -h /tmp
/workspace` mostrou 29 GiB livres e `df -i /tmp /workspace` mostrou 3% de
inodes usados.

## 4. Cenários mínimos para reexecução

### Happy path

- Salvar cada tipo de credencial válido, reabrir a tela e apagar duas vezes.
- Converter produto direto e short link de outro afiliado; confirmar mesmo
  produto e identidade da cliente.
- Espelhar em grupo real e validar card, imagem, título, registro e comissão.
- Converter cupom/campanha e validar a classificação visual correta.

### Negativos e segurança

- Texto vazio, espaços, Unicode invisível, URL truncada, payload enorme e
  formato de credencial de outra loja.
- Domínio sósia, subdomínio malicioso, URL com usuário/senha, protocolo não
  HTTP(S), redirect externo, loop de redirects e HTML/JSON acima do limite.
- SQL/HTML/script no campo de credencial e no URL, verificando que nada volta
  sem escape em log ou tela.
- Usuário sem JWT, JWT de outra conta e tentativa de ler/apagar credencial de
  terceiro.

### Borda, concorrência e desempenho

- Timeout em cada hop, conexão resetada, 429, 5xx e resposta 200 inválida.
- Duplo clique em **Salvar** e **Apagar**, troca de tela durante a requisição e
  retry após resposta perdida.
- Duas sessões salvando credenciais diferentes na mesma conta; múltiplas
  contas convertendo simultaneamente; rajada do mesmo link para validar dedup.
- Medir p50/p95/p99 e confirmar que o timeout da loja não excede o orçamento do
  processamento da mensagem.

### UX e acessibilidade

- Mensagens em português leigo, foco levado ao erro, `aria-invalid`, navegação
  apenas por teclado, leitor de tela, contraste e estado de loading.
- Viewports de 320, 375, 768 e 1440 px; nomes/URLs longos sem overflow.
- Feedback inequívoco de sucesso/falha e botão protegido contra cliques duplos.

## 5. Critérios para desbloquear

1. ~~Especificar e implementar AliExpress em todas as superfícies, com testes de
   contrato que impeçam cadastro parcial de uma nova loja.~~ **Concluído.**
2. ~~Corrigir o CSV vazio da migration da SHEIN e sua expectativa automatizada.~~
   **Concluído.**
3. Reexecutar `npm test`, `npm run arch:check` e o build do dashboard em um
   ambiente com filesystem saudável.
4. Executar a matriz manual em staging para as duas lojas, inclusive celular,
   grupo real, falha de rede e concorrência.
5. Confirmar atribuição/comissão no painel real de cada programa de afiliados.
6. Somente após todos os itens verdes, mudar o parecer para **Aprovado** e
   seguir o fluxo `develop` → staging → validação → `main`.
