# One-pager — BOTinho

> Formato de uso: copiar o texto abaixo (ou adaptar as 2-3 linhas de cada
> bloco) para uma mensagem de WhatsApp/DM após o primeiro contato com um
> admin de grupo/canal de ofertas. Não é para virar PDF engessado — é
> referência de conteúdo e ordem.

---

## O problema

Quem divulga ofertas em grupo/canal de WhatsApp hoje perde tempo copiando e
colando link de afiliado manualmente, arrisca esquecer de trocar o código
de afiliado, e não tem visibilidade de quantas mensagens realmente saíram
ou falharam.

## O que o BOTinho faz

Monitora os grupos/canais de origem que você indicar, detecta links de
Shopee, Mercado Livre, Amazon e Magalu, converte para o seu código de
afiliado e publica no seu grupo/canal de destino — com revisão humana e
histórico de logs, não em piloto automático cego.

## Três diferenciais que não são "feature comum de bot"

1. **Sessão que não cai a cada atualização do sistema.** O ciclo de vida da
   conexão com o WhatsApp roda separado da aplicação — atualizar o sistema
   não derruba sua operação em andamento. (Detalhe técnico:
   `/confiabilidade-sessao-whatsapp`)
2. **Credenciais criptografadas, não em texto puro.** Suas contas de
   afiliado e sua chave PIX ficam cifradas em repouso (AES-256-GCM).
   (Detalhe técnico: `/seguranca-credenciais-afiliado`)
3. **Sem promessa de ganho.** O BOTinho não promete comissão, faturamento
   ou aprovação de marketplace — organiza a execução, a responsabilidade
   pela oferta continua sendo de quem revisa antes de publicar. É chato de
   ler num pitch, mas é a diferença entre uma ferramenta séria e uma que
   promete o que não controla.

## Prova real (preencher só quando existir)

> Não copiar depoimento nem número daqui enquanto o card abaixo estiver
> vazio — usar case real assim que `case-studies-template.md` tiver pelo
> menos 1 entrada preenchida.

- [ ] Nome / nicho:
- [ ] Resultado (com número real, ex.: "de X para Y grupos monitorados"):
- [ ] Frase da pessoa:

## CTA

"Quer testar 7 dias grátis com tudo do plano Pro liberado, sem cartão? Te
mando o link." → `https://espelhagrupos.com.br/login?mode=register`

Se a pessoa já é cliente satisfeita, oferecer o programa de indicação
(ver `kit-programa-indicacao.md`) em vez de só pedir indicação de graça.
