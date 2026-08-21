# Falar com quem parou na etiqueta da loja

Medido em 2026-08: **22 pessoas** — 32% de quem não pagou — conectaram o
WhatsApp e nunca cadastraram etiqueta de afiliada de loja nenhuma.

## Por que esse grupo é diferente de todos os outros

Sem etiqueta cadastrada, o robô **se recusa a publicar** — `skip:no_valid_conversions`
em `src/bot-worker.js`. A recusa é de propósito: publicar sem a etiqueta dela
faria a comissão daquela venda ir para o afiliado do grupo de origem.

Do lado de fora isso parece outra coisa. Essa pessoa fez a parte difícil
(parear o WhatsApp), achou que tinha terminado, e nenhuma oferta saiu. **Para
ela, o produto não funciona.** Ela não tem como saber que o robô está
segurando a publicação para protegê-la.

É por isso que o texto não pode ser "falta um passinho" nem "suas ofertas
continuam saindo". Os dois soam falsos para quem não viu nada acontecer.

O enquadramento que funciona: **"não é defeito, é o robô te protegendo"**.
Ele transforma "quebrado" em "protegendo você", e o próximo passo fica óbvio.

## Achar quem são

```bash
cd ~/wabot && node scripts/diag-sem-etiqueta.mjs
cd ~/wabot && node scripts/diag-sem-etiqueta.mjs --so-com-telefone
cd ~/wabot && node scripts/diag-sem-etiqueta.mjs --csv > /tmp/sem-etiqueta.csv
```

Read-only. A saída tem **dado pessoal de cliente** — não colar em chat
público, issue ou print.

## Por e-mail

Aba E-mails do painel admin → **"Seu robô está pronto, falta só a etiqueta da
loja"** (`contato_sem_etiqueta_nada_sai`).

⚠️ **Não usar** o e-mail "Precisa de ajuda com as etiquetas de afiliada?"
(`contato_duvida_credenciais`) neste grupo. Ele diz *"suas ofertas continuam
saindo e a comissão continua sendo sua: o link só sai mais comprido"* — o que
é verdade para quem TEM etiqueta e ela venceu, e mentira para quem nunca
cadastrou. Há guarda em `test/email-contato-escuta.test.js`.

Envio é **manual**, por regra do grupo "Contato e escuta". Nada aqui dispara
sozinho.

## Por WhatsApp

Mais direto que o e-mail e com resposta muito mais provável, porque essa
pessoa já usa WhatsApp o dia inteiro. Mande em duas mensagens — uma parede de
texto num balão só não é lida.

**Mensagem 1**

> Oi, {NOME}! Aqui é a {SEU NOME}, do Espelha Grupos 🙂
>
> Vi que você chegou a conectar o WhatsApp no robô — essa é a parte mais chata
> de todas, e você já passou por ela.
>
> Só que ainda falta cadastrar a sua etiqueta de afiliada de pelo menos uma
> loja. E enquanto ela não estiver lá, o robô **não publica nenhuma oferta**.

**Mensagem 2**

> E isso é de propósito, não é defeito: sem a sua etiqueta, a comissão da venda
> iria para outra pessoa. O robô prefere não enviar a te fazer trabalhar de
> graça.
>
> Uma loja só já resolve e leva uns 5 minutos. Tem uma vídeo-aula e eu já te
> mando o link no minuto certo — qual loja você usa?

**Mensagem 3 — só o link da loja que ela responder**

Mandar os sete links de uma vez vira lista e ninguém abre. Pergunte a loja e
mande **um** link, já posicionado no segundo:

| Trecho | Link direto |
|---|---|
| Shopee — pedir o acesso de afiliada (0:15) | https://youtu.be/6F2AUM88FKk?t=15 |
| Shopee — copiar a chave (1:43) | https://youtu.be/6F2AUM88FKk?t=103 |
| Instalar o programinha (3:15) — antes de Amazon e ML | https://youtu.be/6F2AUM88FKk?t=195 |
| Amazon — código de acesso (4:10) | https://youtu.be/6F2AUM88FKk?t=250 |
| Mercado Livre — código de acesso (6:11) | https://youtu.be/6F2AUM88FKk?t=371 |
| Mercado Livre — link da vitrine (8:20) | https://youtu.be/6F2AUM88FKk?t=500 |
| Magalu — etiqueta de afiliada (9:22) | https://youtu.be/6F2AUM88FKk?t=562 |

> Perfeito! Esse aqui já abre no minuto da {LOJA}: {LINK}
>
> Me chama se travar em qualquer tela que eu vejo com você.

Os mesmos carimbos saem de `VIDEO_ETIQUETAS_CAPITULOS` em
`src/email/layout.js` — se o vídeo for regravado, muda lá e o e-mail se
ajusta sozinho. Esta tabela é cópia para consulta rápida; o teste
`test/email-contato-escuta.test.js` garante que o e-mail não divirja da fonte.

### Se a pessoa sumiu faz tempo (mais de 60 dias)

Mais curto, e sem cobrar:

> Oi, {NOME}! Aqui é a {SEU NOME}, do Espelha Grupos.
>
> Passando só para fechar uma ponta: seu robô parou num ponto em que ele não
> chega a publicar nada — falta a etiqueta de afiliada de alguma loja, e sem
> ela ele segura as ofertas para a comissão não ir para outra pessoa.
>
> Se ainda fizer sentido para você, são 5 minutos: https://youtu.be/6F2AUM88FKk
>
> E se não fizer mais, me conta o que te fez desistir? Ajuda demais aqui.

## Regras que valem nos dois canais

- **Não prometer resultado** e não dizer "última chance".
- **Não culpar** ("você não terminou", "você esqueceu"). Ela não sabia.
- **Uma pergunta no fim**, sempre. Sem pergunta, não abre conversa.
- **Vocabulário**: "etiqueta de afiliada", "código de acesso". Nunca "tag",
  "cookie", "SSID", "partner_id".
- **Shopee e SHEIN são o caso extremo**: nessas duas, sem a etiqueta nada é
  convertido e nada sai. No Mercado Livre e na Amazon, com etiqueta cadastrada
  porém vencida, o plano B continua publicando com link mais comprido — não
  confundir os dois casos.

## Depois

Rode `scripts/diag-funil-ativacao.mjs` de novo em 2 semanas. O número que
importa é quantas das 22 saíram desse estado — não quantas responderam.
