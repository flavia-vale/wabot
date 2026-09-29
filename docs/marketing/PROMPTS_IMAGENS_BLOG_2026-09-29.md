# Imagens de capa dos posts — prompts para gerar em outra IA (29/09/2026)

Regra: **todo post do blog tem imagem de capa**. Hoje faltam 7 (os 6 posts novos
e `amazon-shopee-ou-mercado-livre-para-afiliados-whatsapp`). Enquanto a imagem
não existe, o post entra na lista `AGUARDANDO_IMAGEM` de
`test/blog-posts-obrigatorios.test.js`; a lista só encolhe.

## Estilo (igual às capas que já existem)

Ver `dashboard/public/blog/hero/22-protecao-camadas.png` como referência:

> Arte quadrada 1080×1080, fundo verde-menta claro (#DDF6EF) com grade
> quadriculada bem sutil. Título grande em fonte sans-serif pesada (estilo
> Figtree/Inter Black), texto quase preto (#1F2D2A) com UMA palavra em verde
> (#3E9C7A). Etiqueta pequena em letras maiúsculas espaçadas acima do título.
> Mascote "Bit" (robô branco de cabeça redonda, rosto preto com olhos verdes
> sorridentes e bochechas rosa, coração verde no peito, antena) no canto
> superior direito. Cartões brancos arredondados com sombra suave embaixo, com
> o conteúdo do tema. Rodapé: logo "espelhagrupos." à esquerda e
> "@espelhagrupos" à direita. Sem fotos reais de pessoas. Sem logotipos de
> terceiros (Shopee, WhatsApp, etc.). Sem promessas de ganho.

## Os prompts (as linhas 32 e 35 já foram feitas) (colar depois do bloco de estilo)

| Arquivo (salvar em `dashboard/public/blog/hero/`) | Etiqueta | Título (palavra verde em **negrito**) | Cartões |
|---|---|---|---|
| `32-conectado-nao-envia.png` | SUPORTE | Painel verde e **nada** saindo? | 1 A origem postou? · 2 Motivo na tela Envios · 3 Intervalo e limites · 4 Refazer conexão · 5 Chamar o suporte |
| `33-oferta-sem-foto.png` | CARD E FOTO | Oferta sem **foto**: por quê? | 1 Loja não devolveu imagem · 2 Foto pequena demais · 3 Link mudou · 4 O que o robô faz nesses casos |
| `34-numero-banido.png` | SE ACONTECER | Número banido: o que **fazer** | 1 Não criar outro na pressa · 2 Pedir revisão no app · 3 Guardar os grupos · 4 Rever o ritmo antes de voltar |
| `35-aquecer-numero.png` | NÚMERO NOVO | Como **aquecer** um número | 1 Começar devagar · 2 Conversas reais · 3 Aumentar aos poucos · 4 Sem promessa mágica |
| `36-link-sem-comissao.png` | CONFERIR | Link sem **comissão**? Confira | 1 Etiqueta cadastrada · 2 Link convertido · 3 Cookie/atribuição · 4 Regras da loja |
| `37-conta-suspensa.png` | REGRAS | Shopee **suspendeu** sua conta? | 1 Ler o motivo · 2 Termos do programa · 3 Pedir revisão · 4 Não improvisar com outra conta |
| `38-qual-loja.png` | ESCOLHA | Shopee, Amazon ou **Mercado Livre**? | 3 cartões lado a lado, um por loja, sem logos: "comissão", "cadastro", "público" (só palavras, sem números) |

Os títulos e cartões vêm do conteúdo de cada post (`dashboard/app/blog/_preservationBlogPosts.js`);
conferir o texto do cartão contra o post antes de gerar.

## Depois de gerar as imagens

1. Salvar em `dashboard/public/blog/hero/` com o nome da tabela (PNG 1080×1080, até ~400 KB).
2. Me mandar os arquivos (ou o caminho). Eu adiciono `heroImage` de cada post
   (`path`, `alt` descritivo, `width: 1080`, `height: 1080`) e tiro o slug da
   lista `AGUARDANDO_IMAGEM` do teste.
3. O `alt` descreve a imagem em uma frase, sem promessa de resultado.
