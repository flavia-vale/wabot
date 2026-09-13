# Revisão crítica — Instagram Stories (2026-09-11)

Esta revisão não considera a integração pronta para produção. Ela separa as
falhas corrigidas no código dos bloqueadores que exigem infraestrutura,
validação real com a Meta ou decisão de produto.

## Falhas críticas corrigidas

1. **Estado mentiroso após falha:** validações que falhavam antes do `try`
   deixavam a publicação como `queued`. Agora o job é reivindicado primeiro e
   toda falha fica registrada na publicação e na tentativa.
2. **Job preso após reinício:** uma queda depois de criar o container deixava a
   linha em `processing`/`container_processing`, estados que o retry não
   reivindicava. Eles agora são retomáveis e o container existente é
   reaproveitado.
3. **DLQ sem estado terminal:** quando o BullMQ esgotava as tentativas, o banco
   continuava em `retry_scheduled`. O callback de falha final agora persiste
   `failed` sem sobrescrever estados terminais ou de reconciliação.
4. **Retry manual inoperante:** o `jobId` é o ID da publicação; adicionar de
   novo um job ainda existente não o reativava. O retry remove o job antigo e
   recria o job, além de descartar IDs de provider de uma tentativa encerrada.
5. **Idempotência entre clientes:** a chave era global, aceitava entrada do
   cliente e podia colidir com outra conta. Ela agora é derivada de
   `userId + SHA-256(chave)` e o repositório rejeita colisão de tenant/destino.
6. **Gate tarde demais:** clientes fora do plano reservado conseguiam criar
   registros e baixar/renderizar imagem antes da recusa. O entitlement agora é
   validado antes de qualquer preparação.
7. **Agendamento com arquivo vencido:** o arquivo durava sete dias mesmo para
   agendamentos posteriores. O TTL cobre a data agendada mais dois dias, e a
   API limita novos agendamentos a 30 dias.
8. **Espelhamento atrasava o WhatsApp:** buscar imagem de marketplace acontecia
   no processo do bot antes do fan-out principal. Essa etapa foi movida para o
   consumidor assíncrono da API.
9. **Outbox eternamente em processamento:** ingressos abandonados por uma
   queda agora têm lease (`claimedAt`) e são recuperados depois de dez minutos.
10. **Perda silenciosa entre canais:** automação não marca o item como
    concluído quando o WhatsApp elegível está offline; na fila manual o
    Instagram é disparado antes do WhatsApp, permitindo retry independente e
    idempotente.
11. **Callback para página inexistente:** o OAuth agora retorna para
    `/painel/configuracoes`.
12. **LGPD incompleta:** exportação e anonimização agora incluem os registros
    Instagram; o token cifrado nunca é exportado e dependências são apagadas na
    ordem exigida pelas FKs.
13. **Queda transitória desativava a conta:** timeout, HTTP 429 ou erro 5xx na
    renovação marcava a conexão para reconectar e desligava seus destinos. Erro
    transitório agora preserva a conexão; somente falha permanente exige novo
    login.
14. **Premium caía no paywall Pro:** o espelho de entitlement do dashboard só
    reconhecia `pro` e trial, portanto o novo plano superior perderia acesso a
    filas e automações. Premium agora herda explicitamente a experiência Pro.
15. **Fila Instagram-only enviava para todos os grupos:** `targetJids=[]` tinha
    significado legado de “todos os grupos”, então a fila sem WhatsApp podia
    disparar para todos inadvertidamente. `whatsappEnabled` agora distingue o
    fallback legado da escolha explícita por somente Instagram.

## Bloqueadores antes de staging/produção

### P0 — impedem homologação real

- **HTTPS público:** o staging canônico usa um IP em HTTP, enquanto a Meta
  precisa buscar a imagem por URL HTTPS pública. É necessário domínio/certificado
  e `STORY_ASSET_PUBLIC_BASE_URL` HTTPS antes do teste real.
- **Validação real da Meta pendente:** app, permissões, revisão, conta
  Business/Creator e publicação real ainda não foram validados. Testes com
  mocks não comprovam aceite de permissões, payload, quota nem comportamento de
  processamento da versão Graph escolhida.
- **Link do produto:** a implementação gera uma imagem, mas não cria sticker
  de link clicável. Produto precisa definir uma alternativa honesta (link na
  bio, mensagem direta, landing/QR quando permitido) e ajustar a CTA; não se
  deve prometer clique no Story sem confirmação na API real.
- **Interface de destinos (corrigido):** criação manual/agendada, filas,
  automações e espelhamento agora expõem as contas conectadas. O backend
  continua sendo a autoridade do plano e da propriedade do destino.

### P1 — risco operacional/escala

- **Disco local:** assets só funcionam em uma instância com disco persistente.
  Escala horizontal, container efêmero ou API/worker em hosts diferentes exige
  object storage compartilhado (S3 compatível) e lifecycle policy.
- **Worker dentro da API:** deploy/restart interrompe polling de containers. O
  job agora pode ser recuperado, mas volume relevante pede processo PM2 próprio.
- **Polling bloqueante:** cada job pode ocupar um slot por minutos; concorrência
  2 limita vazão. Evoluir para jobs diferidos por estado em vez de `sleep`.
- **SSRF residual:** há bloqueio de IP privado e validação de redirects, porém
  a resolução DNS e a conexão não são fixadas juntas; DNS rebinding ainda é um
  risco residual. Produção deve usar download por egress proxy/allowlist ou
  conexão com endereço validado.
- **Múltiplas contas:** no login Facebook, mais de uma conta elegível hoje vira
  erro; falta uma tela de seleção.
- **Renovação via Facebook Login:** o sweep tenta a troca de token novamente,
  mas isso não elimina reautenticação quando a Meta não concede nova validade;
  o painel precisa avisar e conduzir a reconexão antes do vencimento.
- **Observabilidade parcial:** o painel agora agrega fila, publicação,
  reconciliação e falhas/stalls do espelhamento. Alertas externos, idade da DLQ,
  quota da Meta e aviso proativo de token perto de vencer ainda faltam.
- **Atualização de destinos (corrigido):** a configuração escalar e os vínculos
  Instagram da fila agora mudam na mesma transação, inclusive na reativação.

## Critérios mínimos de saída

1. Infra HTTPS e storage acessível pela Meta em staging.
2. POC real: conectar, criar container, aguardar `FINISHED`, publicar e conferir
   visualmente na conta de teste.
3. Decisão documentada e UX honesta para o link/CTA.
4. ~~Seletores Instagram nas quatro superfícies~~ — implementado; validar a UX
   responsiva em staging com uma conta Premium conectada.
5. Testes E2E com Redis + Prisma e ensaio de reinício entre container e publish.
6. Métricas/alertas e runbook de DLQ/reconciliação.
7. Homologação no staging antes de qualquer promoção para `main`.
