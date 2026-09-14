# Runbook — fila de revisão de ofertas automáticas

## Princípio

O modo atual (`direct`) não depende da fila e continua sendo o padrão. O modo
`review` nunca volta para `direct` por falha ou desligamento de flag.

## Ativação em staging

1. Fazer deploy em `develop` com ambas as flags ausentes/desligadas.
2. Executar `node scripts/diag-offer-review.mjs`; confirmar `readOnly: true`,
   `featureEnabled: false` e `deliveryEnabled: false`.
3. Confirmar que uma automação direta de teste continua enviando.
4. Adicionar ao `.env` de staging:

   ```env
   OFFER_AUTOMATION_REVIEW_ENABLED=true
   OFFER_AUTOMATION_REVIEW_DELIVERY_ENABLED=false
   OFFER_AUTOMATION_REVIEW_USER_IDS=<id-da-conta-de-teste>
   ```

5. Recriar `api-staging` pelo procedimento canônico de env do repositório.
6. Ativar revisão numa automação controlada, buscar, remover e aprovar.
7. Confirmar no grupo e nos logs que nenhum item foi enviado.
8. Só depois, ligar `OFFER_AUTOMATION_REVIEW_DELIVERY_ENABLED=true`, recriar a
   API e aguardar a cadência configurada.
9. Confirmar texto, foto e destinos contra o snapshot mostrado na tela.

## Critérios para abortar

- qualquer oferta sem aprovação;
- automação direta atrasada, duplicada ou com copy/destino diferente;
- dois envios do mesmo item após retry;
- crescimento contínuo de memória ou duração do tick;
- item de outra conta visível ou mutável;
- `lastSentAt` mudando durante descoberta/aprovação.

## Rollback

1. Definir `OFFER_AUTOMATION_REVIEW_DELIVERY_ENABLED=false` e recriar a API.
2. Confirmar que itens permanecem `approved`, sem novos `sending`.
3. Definir `OFFER_AUTOMATION_REVIEW_ENABLED=false` e recriar a API.
4. Rodar o diagnóstico; ambas as flags devem aparecer `false`.
5. Fazer smoke de uma automação `direct`.

Não alterar `publicationMode` em massa, não apagar itens e não reiniciar o
supervisor para este rollback. As linhas ficam inertes e preservadas para
análise ou retomada.

## Diagnóstico

```bash
cd ~/wabot-staging && node scripts/diag-offer-review.mjs
cd ~/wabot && node scripts/diag-offer-review.mjs
```

O script é somente leitura e omite IDs, palavras-chave, textos, links,
credenciais e destinos. Ele mostra apenas ordinais, flags, datas e contagens por
estado.
