# TikTok Shop — pesquisa do Sprint 0

Status: **gate bloqueado por dados e validações externas** (2026-09-29).

Nenhum código de conversão deve ser ligado antes de todas as decisões abaixo
terem evidência real. Isso evita tratar vídeo como produto ou publicar link sem
atribuição de comissão.

## Evidências

### D-001 — Medição de demanda

- Comando: `node scripts/diag-tiktok-links.mjs --dias 30`.
- Fonte total: evento agregado `ops_unsupported_store_daily` para `tiktok.com`.
- Limitação comprovada no desenho atual: o evento guarda apenas domínio, dia e
  quantidade; o link removido não chega ao `MessageLog`. Portanto formato,
  cliente e 20 amostras podem ficar incompletos.
- Decisão: **pendente**. O comando precisa ser executado na VPS e H2/H3 exigem
  amostras reais fornecidas voluntariamente, sem segredos de afiliada.
- Execução de 2026-09-29 na produção: `0` para TikTok, `0` linhas na amostra.
  Esse resultado da versão inicial não mostrou cobertura da telemetria e,
  portanto, **não prova demanda zero**. A versão corrigida também informa links
  de outras lojas, dias cobertos e atividade do robô; D-001 só fecha como zero
  se outra loja comprovar que a telemetria estava funcionando no período.

### D-002 — Mecanismo de afiliação

- Evidência exigida: gerar um link com uma conta de afiliada de teste, abrir no
  celular, confirmar o mesmo produto e confirmar atribuição no relatório.
- Registrar: mecanismo (OAuth, sessão ou parâmetro), região BR, expiração,
  limites e campos que a afiliada realmente consegue copiar.
- Decisão: **pendente**. Sem prova de atribuição, o projeto para aqui.

### D-003 — Produto versus vídeo

- Evidência exigida: 10 links reais de produto e 10 de vídeo, incluindo
  `vt.tiktok.com` e `vm.tiktok.com`, com hops, destino final e tempo.
- Decisão: **pendente**. Link curto permanece ambíguo.

### D-004 — Foto, título e preço

- Evidência exigida: teste a partir da VPS em 20 produtos, registrando sucesso
  de `og:image`, JSON embutido ou API pública, sem imprimir cookies/tokens.
- Decisão: **pendente**. Navegador headless não está autorizado; ele exigiria
  estimativa de RAM, alternativa leve e aprovação explícita antes.

### D-005 — Decisões da dona do produto

- Go/no-go com base em D-001 a D-004.
- Basic ou PRO.
- Cores do card adicionadas primeiro ao design system.
- Participa ou não do alerta de credencial bloqueada.
- Decisão: **pendente**.

## Gate para o Sprint 1

O gate só fica aprovado quando D-001 a D-005 estiverem preenchidas com dados.
Até lá, `TIKTOKSHOP_ENABLED`, conversor, credencial, banco, painel e publicação
no WhatsApp não devem ser implementados por suposição.
