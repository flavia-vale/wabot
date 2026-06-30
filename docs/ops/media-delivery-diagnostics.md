# Diagnóstico de mídia cinza no WhatsApp

Quando a imagem enviada aparece como bloco cinza com ícone de download e tamanho
(`62 kB`, por exemplo), investigue primeiro se o problema está no **download da
mídia pelo cliente/infra do WhatsApp** ou no **payload enviado pela Baileys**.

## Suspeitos mais prováveis neste projeto

1. **Bloqueio/limitação do CDN de origem da imagem**: Amazon/Shopee/ML podem
   responder diferente para User-Agent, ASN, país ou volume. Procure `403`,
   `429`, redirects para páginas anti-bot e HTML servido como imagem.
2. **Headers incompatíveis para download parcial**: confirme `Content-Type:
   image/*` e suporte a `Range` (`Accept-Ranges: bytes` ou resposta `206` para
   `Range: bytes=0-65535`).
3. **TTFB alto/timeouts na origem**: o app pode exibir placeholder se a origem
   demora demais para iniciar o stream.
4. **Falha de normalização local**: o worker baixa a imagem, reencoda como JPEG
   e envia Buffer para o WhatsApp; se `normalizeImageForWhatsApp` falha, o código
   degrada para texto com preview e deve registrar warning.
5. **Configuração do destinatário**: se os probes e logs estão saudáveis, valide
   se o WhatsApp do destinatário não desativou download automático de mídia por
   rede móvel/Wi-Fi.

## Probe de URL de mídia

Rode a partir do clone que tem Node 18+. O primeiro argumento pode ser a URL
direta da imagem **ou** um link de produto/short link de marketplace; quando for
produto, o script tenta resolver a `imageUrl` pelo mesmo scraper usado pela app e
só então executa os probes HTTP.

```bash
node scripts/diagnose-media-delivery.mjs "https://exemplo.com/imagem.jpg" "https://pagina-do-produto-ou-referer/"
node scripts/diagnose-media-delivery.mjs "https://s.shopee.com.br/8fQOrj52cW"
```


> Não copie os placeholders literalmente. Substitua `https://exemplo.com/imagem.jpg`
> pela URL real da imagem ou por um link real de produto. Linhas como
> `"status": 403` no JSON são exemplos de leitura do relatório, não comandos
> para digitar no shell.

O script mede:

- DNS A/AAAA e latência de resolução.
- `HEAD`, `GET` com `Range` e `GET` completo.
- TTFB aproximado (`firstChunkMs`) e tempo total.
- `Content-Type`, `Cache-Control`, `Accept-Ranges`, tamanho e magic bytes.
- Respostas com User-Agents básicos de WhatsApp/Meta para flagrar WAF/CDN.

Sinais de falha:

- `status` 403/429 em qualquer probe de User-Agent Meta/WhatsApp.
- `Content-Type` ausente ou diferente de `image/*`.
- `range.status` diferente de `206` e sem `Accept-Ranges: bytes`.
- `full.magicMime: "unknown"`.
- `firstChunkMs` acima de 3000 ms de forma recorrente.
- `Cache-Control: no-store`, `no-cache` ou `max-age=0` em imagens de oferta.

## Logs da API/worker

No VPS, colete uma janela curta em volta do horário da mensagem com problema:

```bash
pm2 logs api --lines 300 --nostream | grep -E "broadcast image|normalizeImageForWhatsApp|sendMessage timeout|timeout:send|Falha ao resolver imagem"
pm2 logs bot-supervisor --lines 300 --nostream | grep -E "broadcast image|normalizeImageForWhatsApp|sendMessage timeout|timeout:send|Falha ao resolver imagem"
pm2 logs api-staging --lines 300 --nostream | grep -E "broadcast image|normalizeImageForWhatsApp|sendMessage timeout|timeout:send|Falha ao resolver imagem"
pm2 logs bot-supervisor-staging --lines 300 --nostream | grep -E "broadcast image|normalizeImageForWhatsApp|sendMessage timeout|timeout:send|Falha ao resolver imagem"
```

Busque principalmente por:

- `broadcast image: falha ao baixar imagem — enviando texto com preview`
- `broadcast image: normalizeImageForWhatsApp falhou — enviando texto com preview`
- `normalizeImageForWhatsApp falhou — enviando sem imagem`
- `sendMessage timeout; tentando próximo fallback se houver`
- `timeout:send:` no `MessageLog.errorMsg`

Esses warnings indicam que a imagem **não chegou saudável ao upload da Baileys**.
Se a mensagem foi registrada como sucesso e sem warnings, a investigação passa a
ser a origem/CDN ou o cliente destinatário.

## Nginx/proxy/CDN

Se a imagem for servida por domínio nosso, confira:

```bash
sudo nginx -T | sed -n '/server_name .*espelhagrupos/,+120p'
sudo tail -n 500 /var/log/nginx/access.log
sudo tail -n 500 /var/log/nginx/error.log
```

Procure respostas `403`, `404`, `416`, `429`, `499`, `502`, `504`, ausência de
`Content-Type image/*`, redirects inesperados, WAF/geo-blocking e regras que
bloqueiem User-Agent contendo `WhatsApp`, `facebookexternalhit` ou IPs fora do
Brasil. Para mídia estática nossa, prefira:

```nginx
location /media/ {
  try_files $uri =404;
  types { image/jpeg jpg jpeg; image/png png; image/webp webp; }
  add_header Cache-Control "public, max-age=86400, immutable" always;
  add_header Accept-Ranges bytes always;
}
```

## PCAP opcional

Se houver suspeita de rede no servidor de mídia próprio, capture apenas tráfego
HTTP(S) do host de mídia durante um reenvio controlado:

```bash
sudo tcpdump -i any -nn -s 0 -w /tmp/wabot-media.pcap 'host <IP_DO_SERVIDOR_DE_MIDIA> and (tcp port 80 or tcp port 443)'
```

Interrompa após reproduzir o problema e analise retransmissões, resets, TLS
handshake falhando e TTFB alto no Wireshark/tshark.
