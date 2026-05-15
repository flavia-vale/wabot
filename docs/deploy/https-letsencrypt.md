# HTTPS em produção (Let's Encrypt)

## Por que isso é obrigatório

Apps modernos (WhatsApp, Instagram, Facebook, Telegram, LinkedIn) usam
in-app browsers com **App Transport Security** (iOS) ou políticas
equivalentes (Android recente) que **bloqueiam conexões HTTP**.

Sintoma observado: cliente recebe link do `http://espelhagrupos.com.br`
pelo WhatsApp, toca, abre tela preta/branca. O mesmo link aberto no
Safari/Chrome direto funciona.

Solução única: servir o site em HTTPS.

## O que está sendo configurado

- Certificado gratuito da Let's Encrypt para
  `espelhagrupos.com.br` e `www.espelhagrupos.com.br`
- Renovação automática (timer systemd ou cron)
- Redirect 301 de HTTP para HTTPS no Nginx
- HSTS opcional (não habilitado por padrão — pode quebrar se precisar
  voltar para HTTP temporariamente)

## Passo a passo no VPS

```bash
# 1. SSH no servidor de produção
ssh deploy@178.105.54.0

# 2. Buscar a branch de setup
cd ~/wabot
git fetch origin
git checkout claude/setup-https

# 3. Rodar o script (precisa de sudo)
sudo bash scripts/setup_letsencrypt.sh
```

O script vai:

1. Verificar que Nginx está ativo e o DNS resolve pro IP do VPS.
2. Pedir um email pra alertas de vencimento de cert.
3. Instalar `certbot` e o plugin `python3-certbot-nginx`.
4. Emitir certificado e **editar automaticamente o vhost do Nginx**
   pra escutar 443 com SSL e redirecionar 80 → 443.
5. Configurar renovação automática 2x/dia.
6. Validar com `curl` que `https://espelhagrupos.com.br/` retorna 200.

Tempo total: ~3 minutos.

## Pós-setup (passos manuais)

### 1. Atualizar variáveis de ambiente

Em `~/wabot/.env`:

```diff
- DASHBOARD_URL=http://espelhagrupos.com.br
- API_URL=http://espelhagrupos.com.br
+ DASHBOARD_URL=https://espelhagrupos.com.br
+ API_URL=https://espelhagrupos.com.br
```

Em `~/wabot/dashboard/.env.local`: sem mudança (usa
`NEXT_PUBLIC_FORCE_SAME_ORIGIN_API=true`, então herda o protocolo do
browser automaticamente).

### 2. Atualizar `ecosystem.config.cjs`

Trocar `http://espelhagrupos.com.br` por `https://espelhagrupos.com.br`
nos campos `DASHBOARD_URL` e `API_URL` do app `api`.

Em seguida, no VPS:

```bash
pm2 restart api dashboard --update-env
pm2 save
```

### 3. Atualizar `app/layout.js`

`metadataBase` em `dashboard/app/layout.js` ainda aponta pra
`http://espelhagrupos.com.br`. Ajustar pra `https://...` para os
metadados OpenGraph e canonical apontarem certo.

### 4. Callbacks externos

Se houver webhook ou callback de Mercado Pago, Stripe, Google OAuth,
etc., atualizar a URL pra `https://...` no painel do provedor.

### 5. Validação final

```bash
# No VPS
curl -I https://espelhagrupos.com.br/
curl -I https://espelhagrupos.com.br/login
curl -I https://espelhagrupos.com.br/api/health
```

Todas devem retornar 200 (ou 405 no /health do POST). Nenhuma deve
retornar 526/502/000.

E o teste de verdade: mandar o link pelo WhatsApp pra você mesmo, tocar,
e ver se abre.

## Renovação

Certbot renova automaticamente 60 dias antes do vencimento. Pra
verificar a qualquer momento:

```bash
sudo certbot certificates
sudo systemctl list-timers | grep certbot
```

Pra forçar renovação manual (raramente necessário):

```bash
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

## Rollback

Se algo der errado e for preciso voltar pra HTTP:

```bash
sudo certbot delete --cert-name espelhagrupos.com.br
# Restaurar o vhost original do backup que o certbot guarda em
# /etc/letsencrypt/.../nginx-rollback ou
# /etc/nginx/sites-available/<arquivo>.backup-<timestamp>
sudo nginx -t && sudo systemctl reload nginx
```

Mas a expectativa é nunca precisar disso — Let's Encrypt é estável e
gratuito desde 2015.

## Custos

Zero. Let's Encrypt é grátis. O único custo possível é, no futuro, se
quiser um cert EV (com nome da empresa na barra) — não vale a pena pra
este projeto.
