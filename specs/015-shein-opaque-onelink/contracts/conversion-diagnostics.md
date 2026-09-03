# Contract — diagnóstico da conversão SHEIN

## Fronteira de responsabilidade

1. `validateCredentialData` roda primeiro. Se o `tag` estiver ausente/inválido, o diagnóstico
   existente de credencial é usado e o conversor não roda.
2. O conversor classifica apenas falhas posteriores à validação.
3. O worker traduz códigos conhecidos e persiste via `recordConversionIssue`.
4. Nenhuma classificação inclui cookie, `tag`, `shc`, `link` ou URL intermediária.

## Mapeamento mínimo

| Código | Mensagem leiga esperada | Não pode dizer |
|---|---|---|
| `shein_opaque_product_unproven` | "Este link de compartilhamento da SHEIN não permitiu identificar o produto." | "credencial inválida", "cadastre cookie" |
| `shein_resolution_transient` | "Não foi possível consultar esse link da SHEIN agora. Tente novamente mais tarde." | "seu ID está errado" |
| `shein_conversion_unknown` | "Não foi possível converter este link da SHEIN." | acusação sem evidência |

O texto exato pode seguir o tom atual do produto, mas precisa manter esse sentido e linguagem leiga.

## Compatibilidade

- falta real de `tag` conserva `describeMissingCredentials`;
- sucesso conserva `{ url, linkKind, warning }`;
- falha de encurtamento não gera diagnóstico: retorna o link longo;
- outras lojas não recebem códigos nem mensagens SHEIN;
- `MessageLog`/taxonomia existentes continuam válidos, sem migration.

## Observabilidade segura

O log pode conter `platform: 'shein'`, código e classe. Não pode adicionar o conteúdo de tokens,
cookie ou credencial. Fixtures e asserts usam valores sintéticos.
