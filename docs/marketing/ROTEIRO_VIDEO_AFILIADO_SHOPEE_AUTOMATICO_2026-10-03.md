# Roteiro — vídeo "Afiliado Shopee no automático" (Frente 5, 03/10/2026)

Frente 5 de `ANALISE_SEO_GEO_AS_IS_TO_BE_2026-10-02.md` (G8). O canal tem 0
vídeo nesse tema. A Visão geral de IA do Google cita YouTube em 3 das 5
respostas medidas, e os vídeos mais vistos do assunto têm de 92 a 202 mil
visualizações com título em CAIXA ALTA + "no automático" + "grátis".

**O site já está pronto para receber o vídeo.** Quando ele subir, me passe o
link. Eu preencho `id` e `publicadoEm` em `VIDEO_AFILIADO_SHOPEE_AUTOMATICO`
(`src/tutorialVideo.js`), e o player e o schema `VideoObject` aparecem sozinhos
em `/bot-afiliados-whatsapp` e `/quem-somos`.

## Regras (as mesmas do site)

- Nada de "não bane", "anti-ban garantido" ou "renda garantida". Dizer:
  "nenhum programa garante que o número não será bloqueado".
- Nada de Telegram: o produto publica só no WhatsApp.
- Preço só o nosso: 7 dias grátis sem cartão, Basic R$ 39 e Pro R$ 69 a cada
  30 dias. Não citar preço de concorrente.
- Nome: só "Espelha Grupos".
- Mostrar o painel com conta de teste (sem chave real e sem número de cliente
  na tela).

## Título (YouTube)

AFILIADO SHOPEE: como postar ofertas no automático nos grupos de WhatsApp (7 dias grátis)

## Miniatura (texto curto, 3–4 palavras)

"SHOPEE NO AUTOMÁTICO" + print do grupo recebendo a oferta com o link.

## Descrição (colar no YouTube)

```
Como postar ofertas da Shopee no automático nos seus grupos de WhatsApp, com o seu link de afiliada, sem copiar e colar. Passo a passo no painel do Espelha Grupos: conectar o WhatsApp, cadastrar a chave de afiliada da Shopee, escolher os grupos e ver a oferta sair sozinha.

Teste 7 dias grátis, sem cartão: https://espelhagrupos.com.br/bot-afiliados-whatsapp

Capítulos
00:00 O que é postar ofertas no automático
01:00 O que você precisa antes (conta de afiliada Shopee)
02:00 Conectar o WhatsApp pelo QR Code
03:30 Cadastrar a chave da Shopee (App ID e chave secreta)
05:00 Espelhar: escolher grupos de origem e destino
07:00 Garimpo automático da Shopee por tema e desconto (Pro)
08:30 Intervalo entre envios e horário de descanso (Pro)
09:30 Quanto custa e o que nenhum programa garante

Saiba mais
- Bot para afiliados no WhatsApp: https://espelhagrupos.com.br/bot-afiliados-whatsapp
- O que é o Espelha Grupos: https://espelhagrupos.com.br/quem-somos
- Garimpo de ofertas da Shopee no automático: https://espelhagrupos.com.br/bot-que-busca-ofertas-shopee-whatsapp
- Os 6 critérios para escolher um bot de afiliados: https://espelhagrupos.com.br/melhores-bots-para-afiliados-whatsapp
```

Os minutos dos capítulos são estimativa do roteiro: ajustar à edição final
antes de publicar. O YouTube só cria capítulos se o primeiro for 00:00.

## Roteiro (8–12 min)

**00:00 — Abertura (o que é).**
"Se você é afiliada Shopee e ainda copia e cola oferta por oferta em cada
grupo, este vídeo é para você. Vou mostrar como as ofertas saem no automático
nos seus grupos de WhatsApp, já com o seu link de afiliada. A ferramenta é o
Espelha Grupos, e dá para testar 7 dias grátis sem cartão."

**01:00 — Antes de começar.**
- Conta de afiliada Shopee aprovada.
- Um número de WhatsApp. Recomendamos um número dedicado à divulgação.
- Os seus grupos (ou canais) de destino, com você como admin.

**02:00 — Conectar o WhatsApp (tela "Conexão WhatsApp").**
Ler o QR Code como no WhatsApp Web (ou usar o código de pareamento). Mostrar
que depois disso o robô roda no servidor, sem precisar deixar o celular
ligado.

**03:30 — Chave da Shopee (tela "Minhas credenciais").**
Colar o App ID e a chave secreta da API de afiliados da Shopee. Explicar em
uma frase: é com ela que o link sai com o SEU código. Se a troca do link
falhar, a oferta não é publicada: o link de outra pessoa nunca vai para o seu
grupo.

**05:00 — Espelhar (tela "Espelhamento").**
Escolher um grupo de ofertas que você já acompanha como origem e os seus
grupos como destino. Mostrar uma oferta chegando na origem e saindo no
destino com o link trocado, no seu modelo de mensagem. Mostrar o histórico em
"Envios".

**07:00 — Garimpo automático (tela "Ofertas automáticas", plano Pro).**
Criar uma oferta automática por tema (ex.: "cozinha") e desconto mínimo. O
robô procura na Shopee sozinho e publica, sem precisar de grupo de origem.
Dizer que a busca automática hoje é só da Shopee.

**08:30 — Ritmo (plano Pro).**
Intervalo entre envios, horário de descanso e limite por dia. Frase
obrigatória: "Isso deixa a postagem mais natural, mas nenhum programa garante
que o número não será bloqueado. Use grupos seus e conteúdo que o seu público
quer receber."

**09:30 — Preço e fechamento.**
"São 7 dias grátis com tudo do Pro, sem cartão. Depois, Basic R$ 39 ou Pro
R$ 69 a cada 30 dias, sem fidelidade. O link está na descrição."

## Depois de publicar

1. Me passar o link do vídeo e a data de publicação (está no próprio vídeo).
2. Eu preencho a constante. A PR vai para `develop` → staging → `main`.
3. Pedir indexação de `/bot-afiliados-whatsapp` e `/quem-somos` (vira linha
   🔝 em `ACOES_FLAVIA` nessa PR).
4. Na medição mensal (Frente 6), anotar se a Visão geral de IA passou a
   embutir o vídeo nas perguntas "melhor bot Shopee" e "o que é o Espelha
   Grupos".
