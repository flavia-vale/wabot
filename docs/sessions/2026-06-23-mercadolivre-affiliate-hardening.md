# Mercado Livre — hardening de sessão afiliada (2026-06-23)

## Objetivo

Reduzir invalidação por uso da sessão de afiliado do Mercado Livre evitando três padrões perigosos:

1. descartar cookies rotacionados (`Set-Cookie`),
2. repetir chamadas autenticadas depois de falhas terminais (`403`/`429`),
3. deixar mais de um processo usar o mesmo `ssid` físico ao mesmo tempo.

## Proteções implementadas

- O converter lê `Set-Cookie` do `createLink`, mescla no cookie jar e persiste `cookie`, `ssid`, `csrf` e `id` na credencial criptografada.
- Respostas `401`, `403` e `429` são classificadas separadamente; `403`/`429` não viram falso alarme de SSID expirado.
- `403`/`429` ativam cooldown por credencial para evitar martelar o endpoint.
- Chamadas ao endpoint autenticado do ML (`createLink` real e probe de sessão do painel) passam por lock local por sessão física (`ssid`). Esse lock usa diretório em `tmpdir()` por padrão, então sincroniza processos PM2 do mesmo host, incluindo prod/staging quando compartilham o mesmo VPS.
- Se o lock não for obtido a tempo, a oferta cai para `partner_id` longo com warning `ml_affiliate_busy`, em vez de disputar a sessão.

## Envs operacionais

| Env | Default | Uso |
| --- | --- | --- |
| `ML_AFFILIATE_LOCK_DIR` | `os.tmpdir()` | Diretório dos locks `wabot-ml-affiliate-*.lock`. Use um caminho compartilhado se os consumidores estiverem em containers/hosts diferentes. |
| `ML_AFFILIATE_LOCK_TIMEOUT_MS` | `12000` | Tempo máximo esperando outro processo terminar uma chamada autenticada ML. Ao exceder, usa fallback longo. |
| `ML_AFFILIATE_LOCK_POLL_MS` | `150` | Intervalo de polling enquanto aguarda lock. |
| `ML_AFFILIATE_LOCK_STALE_MS` | `30000` | Locks mais velhos que isso são considerados órfãos e removidos. |
| `ML_AFFILIATE_FORBIDDEN_COOLDOWN_MS` | `900000` | Cooldown após `403`. |
| `ML_AFFILIATE_RATE_LIMIT_COOLDOWN_MS` | `300000` | Cooldown após `429`. |
| `ML_CREATE_LINK_MAX_CANDIDATES` | `1` | Teto de candidatos canônicos enviados ao `createLink`. |

## Checklist de prevenção

- Não reutilizar o mesmo `ssid` de Mercado Livre entre ambientes; o lock evita concorrência no mesmo host, mas não substitui credenciais separadas por ambiente.
- Se prod/staging estiverem em hosts diferentes e inevitavelmente compartilharem `ssid`, configurar `ML_AFFILIATE_LOCK_DIR` para um volume compartilhado ou, preferencialmente, separar o `ssid`.
- Monitorar warnings `ml_affiliate_forbidden`, `ml_affiliate_rate_limited` e `ml_affiliate_busy` nos logs de envio; crescimento de `ml_affiliate_busy` indica consumidores concorrentes demais.
- Em incidentes, preferir reduzir volume/candidatos/cooldowns antes de renovar repetidamente o SSID.
