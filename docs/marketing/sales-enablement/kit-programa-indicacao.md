# Kit do programa de indicação — BOTinho

O programa já existe em produção (`dashboard/app/painel/afiliados/`,
`dashboard/app/admin/afiliados/`) — este kit só organiza como oferecê-lo a
um cliente satisfeito. Não é preciso construir nada novo para usar isto.

## Como funciona hoje (confirmado no código)

1. O cliente candidata-se ao programa dentro do painel (`ApplyForm`) — não
   é automático para toda conta, precisa de aprovação.
2. Depois de aprovado, o painel mostra o link pessoal no formato
   `https://espelhagrupos.com.br/cadastro?aff=<código>` com botão de copiar.
3. Comissão padrão do sistema (configurável por afiliado no admin, então
   **confirme o valor atual em `/painel/afiliados` antes de prometer um
   número**): **30% na primeira compra confirmada** do indicado, e **30%
   recorrente** nos pagamentos seguintes elegíveis, se a recorrência
   estiver ativa.
4. O repasse só é liberado após o período de segurança contra
   estorno/reembolso (padrão do sistema: 30 dias após o pagamento do
   cliente indicado) — avisar isso para não gerar expectativa de saque
   imediato.
5. Pagamento via PIX, com a chave PIX do próprio afiliado cadastrada e
   criptografada no sistema (mesma criptografia usada nas credenciais de
   afiliado de loja).

## Por que este é o canal de aquisição mais barato disponível

O público do BOTinho — pessoas que já divulgam ofertas de afiliado — já
entende e confia em programa de comissão por natureza do próprio trabalho.
Não é preciso explicar o conceito, só apresentar a oportunidade.

## Texto pronto para oferecer a um cliente satisfeito

> "Já que o BOTinho tá ajudando na sua rotina: sabia que dá pra ganhar
> comissão indicando outras pessoas que divulgam ofertas? Você recebe uma
> % sobre a assinatura de quem você indicar. É só se candidatar dentro do
> painel, em 'Programa de Afiliados' — te aprovamos e você já tem seu link
> pra compartilhar."

## Onde usar o link de indicação

- Comunidades/grupos de afiliados dos quais o próprio cliente já participa
  (o alcance dela é mais confiável do que outreach frio nosso).
- Bio de Instagram/TikTok, se ela já cria conteúdo sobre afiliação.
- Resposta a "onde você automatiza suas ofertas?" — cenário orgânico, não
  precisa de post dedicado.

## O que não fazer

- Não prometer o percentual de comissão como fixo/contratual numa
  conversa — ele é configurável por afiliado no admin e pode mudar.
  Sempre dizer "hoje é X%, confirme no seu painel".
- Não pressionar cliente insatisfeito a indicar — programa de indicação
  funciona com quem já está satisfeito, forçar desgasta a relação.
