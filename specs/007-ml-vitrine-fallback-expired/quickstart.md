# Quickstart — Validação da feature 007 (vitrine fallback em SSID vencido)

Guia de validação. Não contém implementação — só como provar que os cenários
da spec funcionam ponta a ponta.

## Pré-requisitos
- Repo na branch `007-ml-vitrine-fallback-expired`.
- Node instalado (mesma versão do projeto). Testes usam `node:test`.
- `COUPON_LINK_CONVERT=true` no ambiente de teste (o caminho de cupom/vitrine
  vive atrás desse flag — ver `test/ml-vitrine-fallback.test.js`).

## 1. Testes automatizados (obrigatório — cobre SC-004)

```bash
# Função pura da decisão (tabela-verdade do contrato)
node --test test/ml-vitrine-policy.test.js

# Contrato de integração da vitrine (004 + novos casos expired)
node --test test/ml-vitrine-fallback.test.js

# Taxonomia do novo motivo
node --test test/error-taxonomy.test.js   # se existir; senão cobrir no de vitrine
```

Cenários que DEVEM passar (SC-004):
- **(a)** vitrine direta + `expired` + com vitrine → `convert()` retorna
  `{ url: <vitrine cadastrada>, warning: 'ml_vitrine_fallback_used' }`.
- **(b)** vitrine direta + `expired` + sem vitrine → lança erro sinalizado que
  vira `errorMsg='skip:ml_vitrine_missing'`, status `skipped`.
- **(c)** produto não-vitrine + `expired` → comportamento atual preservado
  (erro de renovar SSID / fallback partner_id; sem `use_vitrine`).
- Regressão 004: `unsupported_url` + com vitrine → `use_vitrine` (inalterado).

## 2. Tradução no painel (FR-004/FR-005)

```bash
node --test test/logs-copy.test.js   # se existir
```
Ou inspeção manual: `explainErrorMsg('skip:ml_vitrine_missing')` (em
`dashboard/lib/painel/logsCopy.js`) **e** o equivalente em
`dashboard/lib/mobileLogs.js` devem:
- citar "cadastrar a vitrine" e o caminho IDs de afiliada → Mercado Livre;
- **não** conter "SSID" / "renove" / "cookie".

## 3. Validação manual em staging (obrigatório antes de prod)

> Só um clique real no celular confirma que a vitrine credita comissão
> (ressalva canônica do AGENTS.md para links ML). Não ligar em prod sem isto.

1. Merge em `develop` → autodeploy staging (`http://178.105.54.0:3006`).
2. Numa conta de teste: cadastrar a vitrine própria em Painel → IDs de afiliada
   → Mercado Livre; **expirar/invalidar o SSID** (deixar cookie inválido).
3. Encaminhar, de um grupo monitorado, um link de vitrine direta de OUTRA loja
   (`https://www.mercadolivre.com.br/social/<outra-loja>/lists`).
4. **Esperado (US1)**: a oferta espelhada sai com o link da SUA vitrine; no
   painel de Envios aparece o aviso "usou a sua vitrine" (status "aviso").
5. Remover a vitrine própria; repetir o passo 3.
6. **Esperado (US2)**: a oferta é ignorada; o painel mostra "Ignorado" com o
   texto pedindo para cadastrar a vitrine — **sem** mencionar renovar SSID.
7. Encaminhar um link de PRODUTO comum com SSID vencido.
8. **Esperado (US3/SC-003)**: comportamento atual — mensagem de renovar SSID /
   oferta sai com partner_id; nenhuma menção a vitrine.

## Referências
- Decisão pura: `contracts/decide-vitrine-fallback.md`
- Motivo canônico + tradução: `contracts/errormsg-vitrine-missing.md`
- Tabela-verdade e invariantes: `data-model.md`
