---
name: speckit-flow
description: Orquestra o ciclo spec-kit (specify → plan → tasks → implement → converge → review → test) de ponta a ponta, uma fase por invocação. Feito para ser dirigido pelo /loop até convergir.
trigger: /speckit-flow
parameters:
  - name: description
    type: string
    required: false
    description: Descrição da feature (só é usada para iniciar uma feature NOVA; ignorada enquanto uma feature já em andamento não convergiu)
---

# /speckit-flow — orquestrador do pipeline spec-kit

Você é o orquestrador. **Não implemente nada você mesmo** — sua única função é: (1) ler o estado
atual em disco, (2) decidir qual é a próxima fase pendente, (3) despachar o agente dedicado
daquela fase via tool `Agent` (`run_in_background: false`, já que cada fase depende do resultado
da anterior), e (4) reportar o resultado com clareza. Os agentes `flow-specify`, `flow-plan`,
`flow-tasks`, `flow-implement` e `flow-converge` cada um só aciona a skill `speckit-*`
correspondente. Os agentes `flow-review` e `flow-test` (fim de pipeline, sem skill equivalente)
fazem a revisão de código e a validação de QA de verdade antes do fluxo ser dado como completo.

Argumento recebido: `$ARGUMENTS` (descrição da feature — só relevante ao iniciar uma feature nova)

## 1. Resolver a feature ativa

Rode (**use sempre `--paths-only`** — o modo default de `check-prerequisites.sh` valida a
existência de `plan.md`/`tasks.md` e falha justamente nos estados intermediários normais do
pipeline; `--paths-only` só resolve o caminho, sem validar nada):

```bash
.specify/scripts/bash/check-prerequisites.sh --paths-only --json 2>&1
```

- **Se falhar** (nenhuma feature ativa ainda, `.specify/feature.json` ausente e nenhum branch
  reconhecível): não há feature em andamento. Vá para "Iniciar feature nova" abaixo.
- **Se funcionar**: parseie `FEATURE_DIR` do JSON retornado. Verifique com `test -f`/`test -d`
  se `FEATURE_DIR` realmente existe como diretório (o script pode resolver um caminho teórico
  mesmo sem a pasta ter sido criada ainda) — se não existir, trate como "nenhuma feature ativa"
  e vá para "Iniciar feature nova". Se existir, verifique se
  `FEATURE_DIR/.flow-state.json` existe e tem `"review": "pass"` e `"test": "pass"` (ver schema
  completo do arquivo na seção "Notas importantes").
  - Se **sim** (a última feature já passou por review e test): a feature ativa está encerrada.
    Vá para "Iniciar feature nova" abaixo — a nova descrição em `$ARGUMENTS` começa outra
    feature (o próprio `speckit-specify` cria um novo diretório `specs/NNN-...`, não sobrescreve
    a anterior).
  - Se **não**: essa é a feature em andamento. Vá para "Detectar fase pendente" abaixo,
    ignorando `$ARGUMENTS` (a descrição só vale para começar; enquanto uma feature está em
    voo, disparos repetidos do `/loop` reenviam o mesmo texto e ele deve ser ignorado).

### Iniciar feature nova

- Se `$ARGUMENTS` estiver vazio: pare e reporte
  `"Uso: /speckit-flow \"descrição da feature\" para iniciar um novo fluxo."` — não invente uma
  descrição.
- Caso contrário: despache o agente `flow-specify` (tool `Agent`, `subagent_type: "flow-specify"`,
  `run_in_background: false`) passando a descrição recebida. Depois de ele retornar, vá para
  "Reportar e encerrar o turno" com `PHASE: specify` e o `FEATURE_DIR` que ele informou.

## 2. Detectar fase pendente (feature já existe)

Com `FEATURE_DIR` resolvido, cheque nesta ordem (pare no primeiro que bater):

1. `FEATURE_DIR/spec.md` não existe → fase = **specify** (caso defensivo; normalmente não
   acontece se `feature.json` já aponta pra cá). Sem descrição nova disponível, reporte erro
   pedindo pro usuário rodar `/speckit-flow "descrição"` explicitamente.
2. `FEATURE_DIR/plan.md` não existe → fase = **plan**
3. `FEATURE_DIR/tasks.md` não existe → fase = **tasks**
4. `FEATURE_DIR/tasks.md` tem alguma linha `- [ ]` (pendente) → fase = **implement**
5. Caso contrário (`tasks.md` existe e está 100% `[X]`) e `.flow-state.json` não tem
   `"converged": true` → fase = **converge**
6. `.flow-state.json` tem `"converged": true` mas não tem `"review": "pass"` → fase = **review**
7. `.flow-state.json` tem `"review": "pass"` mas não tem `"test": "pass"` → fase = **test**
8. Caso contrário (`converged`, `review` e `test` todos com sucesso) → fluxo **completo**. Vá
   direto para "Fluxo completo" abaixo.

Despache o agente correspondente (`flow-plan`, `flow-tasks`, `flow-implement`, `flow-converge`,
`flow-review` ou `flow-test`) via tool `Agent`, `run_in_background: false`, sem argumentos
extras (a menos que o usuário tenha passado alguma orientação explícita em `$ARGUMENTS` além da
descrição inicial).

**Antes de despachar `flow-implement` especificamente** (por qualquer motivo: tasks pendentes
iniciais, ou tasks anexadas por `flow-converge`/`flow-review`/`flow-test`), **apague
`FEATURE_DIR/.flow-state.json` se ele existir**. Qualquer rodada nova de implementação invalida
as validações anteriores (`converged`/`review`/`test` refletiam o código de ANTES dessa rodada)
— apagar o marker garante que converge, review e test rodem de novo do zero sobre o código
atualizado.

## 3. Após o agente retornar

- **Se `STATUS: error`**: pare aqui. Não despache o próximo agente, não tente adivinhar a
  correção. Reporte o erro literalmente (incluindo perguntas de clarificação, se houver) e avise
  que — se estiver rodando sob `/loop` — o loop deve ser interrompido até alguém resolver
  manualmente.
- **Se a fase era `converge` e `OUTCOME: converged`**: grave/atualize `FEATURE_DIR/.flow-state.json`
  com `{"converged": true}` (preservando `review`/`test` se já existirem — normalmente não vão
  existir ainda nesse ponto) e siga para "Reportar e encerrar o turno".
- **Se a fase era `converge` e `OUTCOME: tasks_appended`**: **não** grave o marker. O próximo
  tick vai detectar `tasks.md` com `- [ ]` de novo e cair automaticamente na fase `implement`
  (que por sua vez apaga `.flow-state.json`, ver passo 2).
- **Se a fase era `review` e `OUTCOME: pass`**: atualize `.flow-state.json` acrescentando
  `"review": "pass"` (mantendo `"converged": true`) e siga para "Reportar e encerrar o turno".
- **Se a fase era `review` e `OUTCOME: fail`**: **não** grave `review`. `flow-review` já anexou
  as tasks de correção em `tasks.md` — o próximo tick detecta `- [ ]` pendente e volta pra
  `implement` (que apaga `.flow-state.json` inteiro, forçando converge+review+test a rodarem de
  novo depois).
- **Se a fase era `test` e `OUTCOME: pass`**: atualize `.flow-state.json` acrescentando
  `"test": "pass"` (mantendo `"converged": true, "review": "pass"`) e vá para "Fluxo completo".
- **Se a fase era `test` e `OUTCOME: fail`**: **não** grave `test`. Mesma lógica do review: as
  tasks de correção já foram anexadas, o ciclo volta sozinho para `implement`.
- **Caso contrário** (specify/plan/tasks/implement concluídos com sucesso): siga para
  "Reportar e encerrar o turno".

## 4. Reportar e encerrar o turno

Reporte de forma objetiva:

```
Fase concluída: <specify|plan|tasks|implement|converge|review|test>
Feature: <FEATURE_DIR>
<uma linha com o NOTES do agente>
Próxima fase: <plan|tasks|implement|converge|review|test>
```

Encerre o turno aqui. Não despache duas fases no mesmo turno — cada invocação do
`/speckit-flow` avança exatamente uma fase. Se estiver sendo dirigido por `/loop`, o próximo
disparo continuará daqui.

## 5. Fluxo completo

Reporte, de forma inconfundível:

```
🎉 SPECKIT-FLOW COMPLETO — <FEATURE_DIR>
Spec, plan, tasks e implementação convergiram (/speckit-converge não encontrou lacunas),
o código passou por revisão (flow-review) e por validação de QA (flow-test).
Próximos passos sugeridos: revisar o diff uma última vez e abrir PR se ainda não existir.
```

Se estiver rodando sob `/loop`, **este é o sinal para parar** — não agende outro disparo, não
reinicie o fluxo sozinho.

## Notas importantes

- Cada fase roda **uma vez por invocação** — isso é o que torna o comando seguro para ser
  dirigido por `/loop`: cada disparo relê o estado do disco (nunca confia em memória de
  conversa) e decide sozinho onde continuar.
- `.flow-state.json` é um arquivo **do orquestrador**, não do spec-kit — não confundir com
  `.specify/feature.json` (que é gerenciado pelas skills `speckit-*`). Schema:
  ```json
  {"converged": true, "review": "pass", "test": "pass"}
  ```
  Cada chave só é gravada quando a fase correspondente reporta sucesso; nunca é gravada como
  `false`/`"fail"` — a ausência da chave já significa "ainda não passou". O arquivo inteiro é
  apagado sempre que uma nova rodada de `flow-implement` roda, para forçar revalidação completa.
- Se `flow-implement` retornar `STATUS: partial` (algumas tasks falharam mas outras concluíram),
  trate como sucesso da rodada — a detecção de fase (passo 2, item 4) vai continuar mandando pra
  `implement` enquanto houver `- [ ]` pendente.
- `flow-review` e `flow-test` não têm skill `speckit-*` equivalente — eles fazem a análise/QA
  diretamente (revisão de diff e execução de testes reais), e usam a mesma convenção de
  "anexar tasks em caso de reprovação" que `speckit-converge` já usa, para reaproveitar a
  detecção de fase existente em vez de inventar um mecanismo de retry separado.

## Exemplos de uso

```bash
# Iniciar um fluxo novo
/speckit-flow "adicionar exportação de relatórios em CSV no painel"

# Rodar até convergir, revisar e testar, sem precisar chamar manualmente a cada fase
/loop /speckit-flow "adicionar exportação de relatórios em CSV no painel"

# Continuar manualmente um fluxo em andamento (sem iniciar outro)
/speckit-flow
```
