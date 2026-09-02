# Implementation Plan: Conversão segura de oneLinks opacos da SHEIN

**Branch**: `015-shein-opaque-onelink` | **Date**: 2026-09-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-shein-opaque-onelink/spec.md`

## Summary

Ampliar o resolvedor SHEIN existente para tratar especificamente o intermediário oficial
`api-shein.shein.com/h5/sharejump/appjump`, sem tornar seus tokens opacos em prova. O novo passo
fará somente leitura passiva e limitada de redirects e conteúdo oficial, coletará candidatos de
URL de produto sem executar JavaScript e só aceitará o resultado quando houver **um único**
`goods_id` verificável em host SHEIN permitido. A partir dessa prova, o conversor construirá o link
longo pelo caminho já protegido: remove todo rastro/identidade da origem, aplica o `tag` da cliente
e só então tenta o encurtamento opcional. Sem cookie, ou se o encurtador falhar, sai o link longo.

Falhas ganham classificação interna específica (`opaque_product_unproven`, `transient` e
`unknown`) para o worker registrar uma explicação honesta; credencial ausente continua sendo
decidida exclusivamente pela validação já existente. Nenhum link original/intermediário será usado
como fallback e a guarda atual contra comissão de terceiro permanece fail-closed.

## Technical Context

**Language/Version**: JavaScript ESM em Node.js 22 em produção (compatível com o runtime Node atual do projeto)  
**Primary Dependencies**: APIs nativas `fetch`, `URL`, `AbortSignal`, `TextDecoder`; nenhuma dependência nova  
**Storage**: SQLite/Prisma existentes apenas para `MessageLog`; nenhuma tabela, coluna ou migration  
**Testing**: `node:test`, fixtures sintéticas, `fetchImpl` injetado, sem rede  
**Target Platform**: VPS Linux com bot-workers Node gerenciados pelo `bot-supervisor`/PM2  
**Project Type**: aplicação Node monorepo; mudança restrita ao conversor e ao pipeline de diagnóstico do worker  
**Performance Goals**: todo o caminho de resolução SHEIN permanece dentro do orçamento total de 8 s e no máximo 6 hops; nenhuma espera nova fora desse orçamento  
**Constraints**: corpo limitado a 512 KiB por hop; nenhuma execução de JavaScript remoto; HTTPS e host SHEIN ancorado; prova de um único produto; nenhuma dependência/processo/cache persistente novo; nunca registrar cookie ou valores de `shc`/`link`  
**Scale/Scope**: um resolvedor/conversor existente, um ponto de diagnóstico no worker e duas suítes SHEIN; nenhuma mudança nas outras quatro lojas

## Constitution Check

*GATE inicial e pós-design: PASS.*

`.specify/memory/constitution.md` permanece um template sem princípios preenchidos. Aplicam-se as
regras canônicas de `AGENTS.md` e as invariantes do spec:

| Gate aplicado | Resultado |
|---|---|
| Branch/PR contra `develop`, staging antes de `main` | PASS — quickstart separa testes locais, staging e produção |
| Comissão/identidade nunca presumidas | PASS — token opaco não é evidência; exige produto único e reconstrói a saída limpa |
| Falha fechada | PASS — nunca publica entrada, `sharejump/appjump`, intermediário ou candidato ambíguo |
| Orçamento de memória | PASS — sem processo, dependência ou cache novo; leitura efêmera já limitada a 512 KiB/hop |
| Não executar conteúdo remoto | PASS — somente redirects e extração estática de URLs/IDs em resposta limitada |
| Privacidade de logs | PASS — códigos de falha e mensagem leiga; tokens/cookies/IDs reais não entram em fixtures nem novos logs |
| Compatibilidade | PASS — caminho novo só ativa no host/path exatos; links diretos, oneLinks antigos e outras lojas mantêm o fluxo atual |
| Código novo carregado pelos bots | PASS — `src/converters/` aciona restart automático do supervisor no deploy; validação de staging é obrigatória e produção deve ser agendada |

A rechecagem pós-design mantém PASS: o modelo não adiciona persistência, o contrato limita a nova
resolução ao endpoint exato e o diagnóstico tipado reaproveita `recordConversionIssue`/`MessageLog`.

## Project Structure

### Documentation (this feature)

```text
specs/015-shein-opaque-onelink/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── opaque-resolution.md
│   └── conversion-diagnostics.md
└── tasks.md                    # criado posteriormente por /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── converters/
│   └── shein.js               # endpoint opaco, extração/prova e erro classificado
└── bot-worker.js               # mensagem leiga/código persistido por motivo classificado

test/
├── shein-shortlink-resolve.test.js  # hops, conteúdo limitado, candidatos e prova única
└── converters-shein.test.js         # saída limpa/mesmo produto/fail-closed/diagnóstico
```

**Structure Decision**: estender o módulo SHEIN existente, que já concentra resolução, limpeza,
guarda de host/identidade e encurtamento. Não criar serviço paralelo nem alterar `detector.js`,
credenciais, schema, dashboard ou os conversores irmãos. O worker só traduz a classificação segura
para o formato de diagnóstico que ele já grava.

## Design e ordem de implementação

1. Introduzir predicado exato para `https://api-shein.shein.com/h5/sharejump/appjump` e estruturas
   puras de extração/validação de candidatos.
2. Estender a resolução, usando o mesmo deadline, hop limit, cookie jar efêmero e teto de corpo,
   para inspecionar passivamente esse intermediário e aceitar apenas uma evidência inequívoca.
3. Separar `produto comprovado` de `URL candidata`; somente a prova entra no construtor atual do
   link longo. Manter `hasOpaqueShareToken` como recusa para qualquer opaco não resolvido.
4. Classificar falhas esperadas sem incluir URL/token no payload e fazer o worker persistir o texto
   leigo apropriado. A validação de credencial continua antes do converter.
5. Cobrir primeiro os casos adversariais e de regressão; executar testes SHEIN e suíte completa.
6. Validar em staging com cookie vazio, conferindo mesmo produto, identidade da cliente e ausência
   de tokens; só então promover conforme o fluxo canônico.

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Um token ou candidato leva a produto diferente | token nunca é decodificado como prova; exigir um único `goods_id` em evidência oficial e conferir igualdade na saída |
| HTML contém várias URLs/IDs | conjunto com mais de um `goods_id` é ambíguo e falha fechado |
| Redirect sai da SHEIN ou usa domínio sósia | HTTPS, sem credenciais na URL e `isSheinHost` ancorado em cada candidato/hop aceito |
| Novo parser executa/avalia conteúdo remoto | proibidos `eval`, VM, browser/headless e execução de script; apenas parsing estático limitado |
| Identidade de terceiro sobrevive | reaproveitar strip case-insensitive, limpeza de fragmento e rede final de segurança antes de publicar |
| Exceção classificada quebra outro consumidor | usar o padrão de erro já aceito pelo pipeline; rotas/offerEngine já capturam falhas, e testes de integração protegem os contratos |
| Mensagem ainda acusa credencial | worker usa código específico somente após `validateCredentialData(...).configured === true`; falta de ID preserva o ramo anterior |
| Deploy reinicia sessões sem janela | validar em staging; mudança em `src/converters/` é detectada pelo deploy e reinício de produção deve ser comunicado/agendado |

## Complexity Tracking

Nenhuma violação de gate. A classificação de falha é necessária para cumprir FR-018–FR-021 sem
alterar banco/UI; o resolvedor específico é a menor extensão que preserva as guardas existentes.
