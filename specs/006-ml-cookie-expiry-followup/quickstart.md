# Quickstart — Validação

Guia de validação da feature 006 (vetores #1, #3, #4). Detalhes de comportamento nos `contracts/` e `data-model.md`.

## Pré-requisitos

- Node do repo instalado (`npm ci` na raiz).
- Nenhuma env obrigatória para os testes (db-free/env-free). `CREDENTIAL_ENCRYPTION_KEY` **não** é necessária nos testes (D-3 vira no-op).

## Testes automatizados (SC-007)

```bash
# Módulo de cookie extraído (helpers puros; deleção ignorada; patch null quando nada muda)
node --test test/mercadolivre-cookie-rotation.test.js

# Scrape: fetchHtml expõe Set-Cookie; ramo ML persiste rotação; double-check reaproveita token;
# falha de persistência emite sinal sem quebrar o fluxo
node --test test/product-info-scraper.test.js

# Regressão do eixo de afiliado após a extração (comportamento idêntico)
node --test test/mercadolivre-session.test.js

# Sinal operacional roteia para ops_ml_patch_persist_failed
node --test test/observability-operational-signals.test.js
```

Esperado: todos passam sem rede/DB real.

## Cenários de aceitação cobertos

| Cenário | Onde é provado |
|---|---|
| #1 rotação de cookie persistida e reutilizada (SC-001) | `product-info-scraper.test.js`: `fetch` stub devolve `Set-Cookie` com `ssid` novo → `__onCredentialPatch('mercadolivre', {ssid: novo, ...})` |
| #1 sem `Set-Cookie` → sem escrita (FR-006) | idem: resposta sem `Set-Cookie` → `__onCredentialPatch` não chamado |
| #1 deleção não apaga `ssid` válido (SC-002) | `mercadolivre-cookie-rotation.test.js` + scraper: `ssid=;`/`Max-Age=0` ignorado |
| #1 ambos consumidores (FR-005) | contrato: `offerEngine`/`mirrorTemplate` já entregam `__onCredentialPatch`; scraper persiste no caminho comum |
| #3 concorrência reaproveita token (SC-003) | `product-info-scraper.test.js`: `readFreshCredential` devolve credencial já renovada → refresh do ML **não** chamado |
| #3 single-caller renova normal (FR-009) | idem: fresca ainda expirada → refresh ocorre |
| #4 falha de persistência visível (SC-004/SC-005) | `product-info-scraper.test.js`: `__onCredentialPatch` lança → scrape retorna normal + sinal registrado (spy) |

## Validação em staging (SC-006 — vida útil real)

SC-006 só é conclusivo com credencial ML real em staging/prod:

1. Merge em `develop` → autodeploy staging (`http://178.105.54.0:3006`).
2. Cadastrar credencial ML válida; criar ofertas de produtos ML pelo painel "Criar oferta" (exercita o scrape web de alta frequência).
3. Observar em `AnalyticsEvent`/`/metrics` que **não** há `ops_ml_patch_persist_failed` recorrente (persistência saudável) e que a sessão ML sobrevive além do baseline pós-005 sem recadastro.
4. Só depois de validado: PR `develop → main`.

> Nota: esta feature não altera portas, processos PM2, schema nem consumo relevante de RAM. Sem passo de migration.
