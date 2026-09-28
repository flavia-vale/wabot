# Mensagens prontas — itens 1.2 e 1.8 (28/09/2026)

Textos para copiar e colar. Trocar só o que está entre `[colchetes]`. Nada aqui
promete resultado, "anti-ban" ou comissão garantida.

---

## 1.2 · Depoimentos das clientes pagantes

### Passo 1 — achar quem chamar (VPS, só leitura)

```bash
cd ~/wabot && node scripts/diag-clientes-depoimento.mjs --top=15
```

Mostra só pagantes atuais, sem reembolso, ordenadas por uma nota (envios em
30 dias + renovou + tempo de casa + conexão estável). **Chamar do topo para
baixo, 3 a 5 por dia.** A nota é palpite: quem confirma é a resposta dela.

### Passo 2 — mensagem (WhatsApp)

> Oi, [nome]! Aqui é a Flávia, do Espelha Grupos 💚
>
> Vi que você usa bastante o robô e queria te pedir um favor: você toparia me
> contar, em 2 ou 3 frases, como o Espelha Grupos tem funcionado pra você?
>
> Em agradecimento, eu te dou **5 dias de PRO de presente**, e você aceitando
> ou não, ele é seu.
>
> Se topar, me manda:
> 1. o texto, do seu jeito (não vou reescrever);
> 2. seu nome como quer que apareça;
> 3. uma foto sua ou do seu perfil (opcional);
> 4. um "autorizo publicar no site do Espelha Grupos" por escrito.
>
> Se preferir não, sem problema nenhum! 🙏

**Regras da mensagem**

- Não pedir frase pronta nem sugerir o que dizer. Depoimento é o que ela diz.
- Os 5 dias de PRO são agradecimento por ela **contar**, não por falar bem;
  a mensagem já diz isso. Se ela responder algo negativo, os 5 dias valem do
  mesmo jeito e a crítica vira item de produto.
- Frase com "dobrei minhas comissões" ou "nunca fui banida": não publicar, ou
  ela confirma que disse exatamente aquilo.
- Publicar com o rótulo "cliente pagante, recebeu 5 dias de PRO como
  agradecimento" nas páginas em que o depoimento aparecer.

### Passo 3 — dar os 5 dias de PRO

Pelo painel admin, liberar 5 dias de acesso PRO para a conta (mesmo caminho da
liberação manual). Anotar em "contato" do cliente: motivo `depoimento`.

---

## 1.8 · Menções de terceiros

Texto-padrão de 62 palavras (idêntico em todo lugar):

> Espelha Grupos é um software web brasileiro para afiliadas e admins de grupos
> de WhatsApp. Espelha ofertas de grupos e canais de origem para os seus grupos,
> troca cada link pelo seu código de afiliada (Shopee, Mercado Livre, Amazon,
> Magalu, SHEIN, AliExpress) e publica com filas, intervalos e histórico de
> envios. Teste grátis de 7 dias; Pro R$69 por 30 dias. espelhagrupos.com.br

### A) Guest-parágrafo — Superfrete

**Onde:** `superfrete.com/blog/grupos-vendas-whatsapp`
**Contato:** não tenho o e-mail do editor (não inventei um). Procurar no
rodapé/"Fale conosco" da Superfrete o canal de imprensa ou parcerias; se só
houver formulário, colar o texto abaixo.

> **Assunto:** Sugestão de trecho para o post "Grupos de vendas no WhatsApp"
>
> Olá, tudo bem? Sou a Flávia, do Espelha Grupos.
>
> Li o post de vocês sobre grupos de vendas no WhatsApp e gostei da parte de
> "Potencialize seus grupos". Uma dúvida que os leitores costumam ter é se dá
> para automatizar a divulgação sem virar spam. Se fizer sentido, sugiro este
> parágrafo, que vocês podem ajustar como preferirem:
>
> "[texto-padrão de 62 palavras acima, sem mudar nada]"
>
> Não peço nada em troca e não preciso de link com destaque. Se quiserem, mando
> também um exemplo de mensagem convertida e a metodologia de uso responsável
> para vocês conferirem antes: espelhagrupos.com.br/metodologia-uso-responsavel-whatsapp
>
> Obrigada pela atenção!
> Flávia · Espelha Grupos · espelhagrupos.com.br

### B) Guest-parágrafo — Remessa Online

**Onde:** `remessaonline.com.br/blog/grupo-de-promocoes-no-whatsapp`
**Contato:** mesmo caminho (formulário/contato do blog). Usar o texto do A,
trocando o trecho de abertura:

> Li o post de vocês sobre grupos de promoções no WhatsApp, principalmente a
> seção "Vale a pena automatizar?". Se fizer sentido, sugiro este parágrafo…

### C) Criadores pequenos do YouTube

**Como contatar:** pela aba "Sobre" do canal (e-mail comercial) ou pelo
Instagram indicado na descrição. Os vídeos de referência (ID do YouTube):

| Criador | Vídeo |
|---|---|
| Cintya Clemente | `6aI-KsGRhlY` |
| Patricia Angelo — MKT Digital com IA | `BaAJckFTzfU` |
| Henrique Hard | `ovq0bVws4DM` |
| CUPONS DE DESCONTOS & PROMOÇÕES | `bfTRcDzOMbY` |
| Mayara Prado | `02apCIdAAi4` |
| DICASDOSANDRO | `bShY5gsICbI` |
| Denise Souza | (hoje ensina Pro Afiliados — deixar por último) |

**Mensagem (e-mail ou direct):**

> Oi, [nome]! Sou a Flávia, do Espelha Grupos. Vi seu vídeo "[título do
> vídeo]" e achei muito útil pra quem divulga achadinhos.
>
> Criei um robô que espelha ofertas de grupos e canais pros seus grupos e troca
> os links pelo seu código de afiliada (Shopee, Mercado Livre, Amazon e mais).
> Gostaria de te dar **acesso PRO liberado por [30] dias**, sem compromisso
> nenhum, pra você testar do seu jeito. Se gostar, e só se gostar, pode falar
> dele no canal.
>
> Também tenho um programa de afiliadas: **30% recorrente, pago por PIX**, com
> link seu.
>
> Um pedido, só se você fizer um vídeo: que o nome "Espelha Grupos" apareça no
> título, para o pessoal te encontrar pela busca. Você tem total liberdade pra
> falar o que quiser, inclusive o que não gostou.
>
> Posso liberar seu acesso? 💚

**Regras:** não pedir elogio; dizer que a opinião é livre; se o criador fizer
vídeo, a descrição dele deve avisar que recebeu acesso (regra de publicidade).
Semanas 3–6: 1 ou 2 por semana, não todos de uma vez.

### D) Telegram oficial (Shopee, Mercado Livre)

**Só com autorização do admin do canal.** Conteúdo, não anúncio: um checklist
gratuito. Mensagem ao admin:

> Oi! Sou a Flávia, do Espelha Grupos. Preparei um checklist gratuito de "como
> padronizar a divulgação de ofertas no WhatsApp" para afiliadas. Posso
> compartilhar aqui no canal/grupo? É conteúdo, sem promoção de plano. Se
> preferir, mando antes pra você ler.

Link do checklist: `espelhagrupos.com.br/materiais/checklist-divulgacao-ofertas-grupos-whatsapp`.
Se o admin recusar ou não responder, não insistir e não postar sem permissão.

### E) Quora (pt-BR)

Sem contato: responder a pergunta já indexada ("Como ser afiliado da Shopee?")
com uma resposta completa (passo a passo, 8 a 12 linhas) e **uma** menção no
fim:

> Se depois você quiser automatizar a divulgação nos grupos de WhatsApp, o
> Espelha Grupos (espelhagrupos.com.br) faz isso, e tem 7 dias de teste
> grátis. Declaro: sou a criadora dele.

Sempre declarar o vínculo. Uma resposta por pergunta, sem repetir texto.

### F) Medium (opcional)

Republicar 4 a 6 posts do blog com **canonical** apontando para o original
(`espelhagrupos.com.br/blog/...`). Sem contato necessário. Fazer só depois do
guest-parágrafo e do primeiro criador.
