# Contract — resolução de `sharejump/appjump`

## Ativação

O caminho especial só ativa para URL absoluta com:

```text
protocol = https:
hostname = api-shein.shein.com
pathname = /h5/sharejump/appjump
```

Subdomínio, sufixo, credencial embutida, HTTP, caminho parecido ou host sósia não satisfazem o
contrato.

## Entrada

- URL intermediária retornada pelo resolvedor comum;
- `fetchImpl` injetável;
- deadline e contador de hops compartilhados com `resolveSheinShortLink`;
- cookie jar efêmero criado pela resolução (não `creds.cookie`).

## Operações permitidas

- seguir `Location` manualmente;
- ler até 512 KiB de corpo por hop;
- extrair URLs/IDs de marcação ou dados estáticos sem executar código;
- resolver URL relativa contra o host oficial atual;
- deduplicar candidatos pelo identificador de produto.

## Operações proibidas

- tratar `shc`/`link` como ID ou destino;
- executar/evaluar JavaScript, abrir browser/headless ou VM;
- consultar endpoint autenticado com cookie da cliente;
- aceitar host por substring;
- publicar entrada/intermediário/candidato antes da prova;
- ampliar timeout/hops além do orçamento total.

## Pós-condições de sucesso

1. existe exatamente um `goodsId` distinto;
2. a URL canônica é HTTPS, sem usuário/senha e em host SHEIN permitido;
3. a URL canônica expõe o mesmo `goodsId`;
4. o construtor final remove todos os tokens/rastros e aplica apenas a identidade da cliente;
5. a conferência final repete a igualdade do produto.

## Pós-condições de falha

- zero candidatos, candidatos inseguros ou IDs ambíguos: `shein_opaque_product_unproven`;
- timeout/rede/leitura abortada antes da prova: `shein_resolution_transient`;
- condição inesperada: `shein_conversion_unknown`;
- em todos os casos, nenhuma URL é publicada.

## Casos obrigatórios de contrato

- um candidato oficial e único converte sem cookie;
- o mesmo ID repetido em múltiplos locais continua único;
- IDs distintos falham fechado;
- candidato externo/sósia/HTTP/com credenciais falha fechado;
- resposta grande, ciclo, deadline e hop limit falham fechado;
- destino ainda opaco sem produto falha fechado;
- oneLink antigo e produto direto não entram no caminho especial.
