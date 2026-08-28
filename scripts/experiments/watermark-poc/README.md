# POC isolada: marca d'agua por destino

Esta prova e **offline**: nao importa codigo de `src/`, nao acessa banco/Redis,
nao inicia PM2 e nao envia nada ao WhatsApp. Ela recebe uma imagem e um JSON
local, produz um JPEG principal e uma miniatura para cada JID e grava metricas.

## Renderizar duas marcas

```bash
mkdir -p scripts/experiments/watermark-poc/output
node --max-old-space-size=256 scripts/experiments/watermark-poc/render.mjs \
  --input /caminho/oferta.jpg \
  --config scripts/experiments/watermark-poc/config.example.json \
  --output scripts/experiments/watermark-poc/output/render
```

Os arquivos usam identificadores ordinais (`destination-001`, `destination-002`).
`report.json` nao grava JID, hash do JID nem texto da marca. O diretorio
`output/` e ignorado pelo Git.

## Benchmark conservador na VPS

Comece com dois destinos e concorrencia nativa 1 (fixada pelo script):

```bash
node --max-old-space-size=256 \
  scripts/experiments/watermark-poc/benchmark.mjs \
  --destinations 2 \
  --iterations 3 \
  --output scripts/experiments/watermark-poc/output/benchmark-2.json
```

Se RAM disponivel permanecer acima de 1,5 GiB, `swap out` nao persistir e o
processo ficar abaixo de 500 MiB RSS, repetir com 10 e depois 25 destinos.

Este comando so existe depois que o PR da POC for mergeado em `develop` e o
autodeploy terminar. Branch, `git push` e PR sao operacoes do ambiente de
desenvolvimento; **nao execute `gh`, `git push` ou troca de branch na VPS**.

## Limites desta prova

- Nao valida envio, card preview ou relay do WhatsApp.
- Nao altera `Group`, painel ou API.
- Nao promete cobertura de video/GIF/documento.
- Imagem com menor eixo abaixo de 160 px sai normal, com `image_too_small` no
  relatorio, pois nao ha espaco seguro para uma marca legivel.
- Uma integracao futura deve ser `fail-open`: falha da marca devolve a imagem
  normal e nunca bloqueia uma oferta.
