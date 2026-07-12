/**
 * Barreira de import (Etapa 0 — rede de segurança contra regressão e acoplamento).
 *
 * Ver AGENTS.md e specs/002-regression-safety-net/ para o racional completo.
 * Este arquivo é config estática, versionada — não é código de runtime.
 *
 * Executar: npm run arch:check
 *   = depcruise src dashboard/lib --config .dependency-cruiser.cjs
 */
module.exports = {
  forbidden: [
    {
      name: 'no-src-to-dashboard',
      severity: 'error',
      comment:
        'src/**/*.js (runtime) não deve importar dashboard/lib/**. Ver AGENTS.md ' +
        '(fronteiras de arquitetura) e specs/002-regression-safety-net/. As 2 exceções ' +
        'abaixo são dívida de baseline conhecida, documentada em ' +
        'docs/architecture/coupling-ledger.md, e serão removidas na Etapa 1 — não ' +
        'adicionar novas exceções a esta allowlist sem registrar entrada equivalente no ' +
        'livro-razão.',
      from: {
        path: '^src/',
        pathNot: [
          '^src/offerAutomation/dispatcher\\.js$',
          '^src/core/mirrorTemplate\\.js$',
        ],
      },
      to: {
        path: '^dashboard/',
      },
    },
    {
      name: 'routes-must-use-manager',
      severity: 'error',
      comment:
        'src/api/routes/** não deve importar src/core/sessionCore.js diretamente — ' +
        'sempre passar por src/manager.js (fachada que escolhe inline vs remote). ' +
        'Ver AGENTS.md, seção "Arquivos do supervisor".',
      from: {
        path: '^src/api/routes/',
      },
      to: {
        path: 'src/core/sessionCore\\.js$',
      },
    },
    {
      name: 'domain-no-infra',
      severity: 'error',
      comment:
        'Regra dormente: src/domain/ ainda não existe hoje (Etapa 0). Quando essa ' +
        'camada de domínio for criada, ela não deve depender diretamente de infra ' +
        '(Prisma, Baileys, Redis) — mantém a lógica de negócio testável e desacoplada. ' +
        'Não dispara enquanto src/domain/ não existir.',
      from: {
        path: '^src/domain/',
      },
      to: {
        path: '^(@prisma/client|(@whiskeysockets/)?baileys|ioredis)$',
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: false,
  },
};
