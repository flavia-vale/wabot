# Contrato: motivo canônico `skip:ml_vitrine_missing`

Novo motivo de `MessageLog.errorMsg` para o outcome `missing_vitrine`.

## Prefixo canônico
- **errorMsg**: `skip:ml_vitrine_missing`
- **status do log**: `skipped`
- **destGroup**: `conversion`
- **categoria** (`errorTaxonomy.js` → `categorizeErrorMsg`): `config_block`
  (já coberto pelo catch-all `skip:`; adicionar branch explícito para documentar).
- **`isBenignSkip`**: `true` → painel pinta cinza "Ignorado" (não vermelho).

## Produção do motivo (backend)
1. `src/converters/mercadolivre.js` → `convertMlCouponWithoutProduct`: no
   outcome `missing_vitrine`, lançar erro sinalizado:
   - `err.mlFailureType` preservado (propaga por `convert()`).
   - `err.conversionLogErrorMsg = 'skip:ml_vitrine_missing'`
   - `err.conversionLogStatus = 'skipped'`
2. `src/bot-worker.js` → `catch` de conversão (~L2698): se
   `err.conversionLogErrorMsg` presente, gravar `MessageLog` com esse `errorMsg`
   e `status`, em vez de `error:conversion:${err.message}`. Demais erros:
   inalterados.

## Tradução humana (UI) — DOIS renderizadores, ambos obrigatórios
Texto deve: (a) dizer que a oferta foi **ignorada** porque falta cadastrar a
vitrine própria; (b) indicar o caminho **IDs de afiliada → Mercado Livre**;
(c) **NÃO** mencionar renovar/atualizar SSID (FR-005).

- `dashboard/lib/painel/logsCopy.js` (`explainErrorMsg`): novo branch
  `if (errorMsg.startsWith('skip:ml_vitrine_missing'))` retornando, p.ex.:
  > "Esse link era uma vitrine/perfil de outra loja. A oferta foi ignorada
  > porque você ainda não cadastrou o link da SUA vitrine. Cadastre em IDs de
  > afiliada → Mercado Livre para que esses casos saiam com o seu link
  > automaticamente."
- `dashboard/lib/mobileLogs.js`: branch equivalente (texto pode ser mais curto,
  mesmo sentido; caminho "Conta → Credenciais → Mercado Livre" conforme o padrão
  já usado nesse arquivo). **Não esquecer este arquivo** — senão o mobile exibe
  a string crua.

## Não-regressão
- O caso `use_vitrine` continua gravando `warning:ml_vitrine_fallback_used`
  (status `info`) — intocado (feature 004).
- Nenhum outro `error:conversion:*` muda de prefixo/status.

## Requisitos rastreados
- FR-003 (motivo específico), FR-004 (texto + caminho), FR-005 (sem SSID),
  FR-007 (novo prefixo + taxonomia + tradutor sincronizados).
