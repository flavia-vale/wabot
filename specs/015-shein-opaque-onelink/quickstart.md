# Quickstart — validar oneLink opaco da SHEIN

## Pré-requisitos

- branch originada de `develop` e PR contra `develop`;
- dependências já instaladas;
- nenhuma env, migration, dependência ou processo novo;
- amostras reais ficam fora do Git; fixtures versionadas são sintéticas.

## 1. Testes focados, sem rede

```bash
node --test test/shein-shortlink-resolve.test.js test/converters-shein.test.js
```

Validar que cobrem:

- produto único oficial converte sem cookie;
- encurtador indisponível preserva o longo;
- dois IDs, zero IDs, host externo/sósia, HTTP, URL com credencial, corpo excessivo, timeout e ciclo
  nunca publicam entrada/intermediário;
- nenhum token/rastro/identidade de origem aparece na saída;
- mensagem de opaco não comprovado não acusa credencial;
- oneLink antigo, produto direto e cupom/campanha existentes continuam iguais.

## 2. Regressão do pipeline

```bash
node --test test/detector.test.js test/link-kind.test.js test/converters-shein.test.js \
  test/shein-shortlink-resolve.test.js
npm test
npm run arch:check
git diff --check
```

Os testes não podem tocar a rede. Nenhum teste de outras lojas deve exigir atualização de
expectativa, pois seus contratos não mudam.

## 3. Revisão estática de segurança

```bash
rg -n "eval\(|new Function|node:vm|playwright|puppeteer" src/converters/shein.js
rg -n "shc|link|onelink|requestId|behaviorId|utm_" test/converters-shein.test.js \
  test/shein-shortlink-resolve.test.js
```

Esperado: nenhuma execução remota; ocorrências dos parâmetros somente em guardas/fixtures/asserts de
ausência. Conferir também que nenhuma amostra/ID/cookie real da RCA entrou no diff.

## 4. Staging obrigatório

Após merge em `develop` e autodeploy, validar em `http://178.105.54.0:3006`:

1. usar conta de staging com ID SHEIN válido e cookie vazio;
2. publicar uma amostra conversível do novo formato em origem monitorada;
3. confirmar `success` no histórico e link longo oficial;
4. abrir o link e confirmar visualmente o **mesmo produto**;
5. confirmar na URL ausência de `shc`, `link`, `onelink`, `requestId`, identidade de terceiro e
   presença exclusiva do ID de staging;
6. testar fixture/amostra não comprovável: nada publicado e diagnóstico diz que o link não revelou
   o produto, sem mencionar credenciais/cookie;
7. simular indisponibilidade quando possível e conferir mensagem transitória;
8. testar um oneLink antigo, produto direto e uma oferta de cada outra loja.

Mudanças em `src/converters/` fazem o deploy reiniciar o supervisor quando `RESTART_SUPERVISOR=auto`.
Confirmar nos logs que os workers de staging nasceram após o deploy; não reiniciar produção aqui.

## 5. Gate de comissão

No celular, abrir o link longo gerado em staging e confirmar no painel de afiliada de teste que a
atribuição pertence à conta configurada. "Abriu o produto" não basta para provar comissão.

## 6. Produção

Somente após aprovação manual em staging: PR `develop` → `main`. Como o deploy pode reiniciar
`bot-supervisor` por mudança no conversor, anunciar/agendar a janela; o restart reconecta todas as
sessões. Não fazer reinício manual fora da janela.

Depois do deploy:

```bash
cd ~/wabot
git rev-parse --short HEAD
ps -eo pid,lstart,etime,cmd | grep "wabot/src/bot-worker" | grep -v staging | grep -v grep
```

Repetir uma oferta controlada, conferir o mesmo produto e acompanhar somente o PID da conta. Se a
prova falhar, o rollback funcional é manter a recusa fail-closed; nunca publicar o oneLink original.

## Resultado local da implementação (2026-09-02)

A validação automatizada cobre resolução estática com prova única, recusa de candidato ambíguo ou
inseguro, orçamento compartilhado, saída longa sem cookie, fallback do encurtador e diagnóstico
classificado. A validação manual T034–T036 permanece pendente até o merge/autodeploy em `develop`;
nenhum resultado local deve ser interpretado como validação de staging ou atribuição real.

Após as correções da auditoria de convergência, a suíte focada passou com 86 testes e a suíte
completa passou com 2.916 testes; `arch:check` não encontrou violações em 304 módulos/614
dependências e `git diff --check` passou. T034–T036 continuam explicitamente adiadas para staging.

### Diagnóstico representativo ainda obrigatório

O ambiente local não conseguiu resolver `onelink.shein.com` (`EAI_AGAIN`), portanto **não há prova
local** de que o HTML real observado exponha uma URL estática de produto. T047 permanece adiada e
US1 não deve ser considerada validada em produção. Na VPS/staging, executar sem registrar a URL:

```bash
read -rsp 'Cole o oneLink: ' SHEIN_URL; echo
node scripts/diag-shein-opaque-evidence.mjs "$SHEIN_URL"
unset SHEIN_URL
```

O script imprime somente código/classe, presença/comprimento do ID e host final; nunca URL, query,
token, ID ou corpo. Se `evidenceStatus` não for `resolved`, é necessário capturar apenas a estrutura
sanitizada da transição oficial seguinte antes de ampliar o resolvedor; `shc`/`link` não viram prova.
