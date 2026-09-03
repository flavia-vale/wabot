# Cloudflare — tráfego e carga no servidor (baseline 2026-09-03)

Cinco relatórios do overview da Cloudflare, janela de 4/08 a 2/09 (30 dias).
CSVs crus em `docs/marketing/dados/cloudflare-2026-09-03/`.

**São úteis, mas não para a pergunta que o Search Console responde.** Eles não
dizem quem achou o site no Google — dizem **quanto o site está sendo pedido e
quanto disso o nosso servidor precisa atender**. Isso responde a uma pergunta
que nenhuma outra fonte respondia: se o crescimento do marketing está pesando na
mesma máquina que roda os robôs das clientes.

---

## O achado principal

**As requisições cresceram 5x. Os visitantes cresceram 1,27x.**

| | 4/08 | 2/09 | fator |
|---|---:|---:|---:|
| Visitantes únicos | 405 | 514 | **1,27x** |
| Requisições | 6.549 | 33.050 | **5,05x** |
| Requisições por visitante | 16,2 | 64,3 | **3,97x** |
| Requisições que chegaram ao NOSSO servidor | 3.473 | 21.731 | **6,26x** |

Trinta dias somados: **7.996 visitantes, 359.067 requisições, das quais 255.383
foram atendidas pelo nosso servidor** (cache médio ponderado de **28,9%**).

Quatro vezes mais páginas pedidas por visitante, com o número de visitantes
quase parado, é a assinatura de **rastreamento** — robô de buscador e de IA
varrendo o site — e não de mais gente chegando. Faz sentido no calendário: é
exatamente o mês do IndexNow em todo deploy, do desbloqueio do robots.txt e das
indexações pedidas à mão. O trabalho de SEO está sendo consumido.

⚠️ **Isto é inferência, não medição.** O overview não separa robô de pessoa.
Para confirmar, o relatório que falta é **Security → Bots** (ou Traffic →
"Requests by bot class"). Pedir junto na próxima coleta.

Dois dias extremos que reforçam a leitura: **30/08 com 108 requisições por
visitante** e 29/08 com 95. Nenhum dos dois teve pico de visitante.

---

## O que isso muda na conversa sobre capacidade

Em 02/09 a resposta sobre Google Ads apontou um bloqueio: o servidor em 20/20
robôs, 5,31 GB de RSS, 1,6 GB já em swap. **Estes números mostram uma segunda
pressão, independente, na MESMA máquina**: a carga de web no origin cresceu
**6,26x** em um mês.

E ela tem conserto barato, que a de RAM não tem.

### O cache está em 28,9% — e o motivo é conhecido

Não há `Cache-Control` configurado para as páginas do site
(`dashboard/next.config.mjs` define só cabeçalhos de segurança). **A Cloudflare
não guarda HTML por padrão** — sem regra explícita ela cacheia arquivo estático
(`/_next/static/*`, imagem, fonte) e manda *toda* página ao servidor.

Ou seja: 71% das requisições de um site que é quase todo conteúdo fixo estão
sendo geradas de novo, uma a uma, na mesma VPS que hospeda os robôs.

**Ordem de grandeza do que se ganha:** subir o cache de 29% para 80% levaria as
~255.000 requisições/mês no origin para ~72.000. É capacidade de graça, sem
trocar de servidor.

⚠️ **Não é só "ligar o cache" — e o risco é sério.** Guardar HTML sem separar o
que é público do que é privado serviria **o painel de uma cliente para outra
pessoa**. Qualquer regra de cache precisa, obrigatoriamente:

- valer **só** para as rotas públicas de marketing (home, blog, alternativas,
  landing pages);
- **nunca** tocar `/api/*`, `/painel/*`, `/admin/*`, `/login` nem nada que
  dependa de sessão;
- respeitar o `Vary` de cookie de autenticação.

Enquanto isso não for desenhado e validado em staging, o número fica como
diagnóstico, não como ação.

---

## O que estes dados NÃO dizem (não confundir as fontes)

- **"Visitante único" da Cloudflare não é "clique" do Search Console.** Foram
  7.996 visitantes em 30 dias contra 177 cliques no Search Console no
  levantamento de 01/09 — as duas medidas estão em escalas completamente
  diferentes porque contam coisas diferentes. A Cloudflare conta robô,
  monitoramento, visita direta, retorno e tráfego de IA; o Search Console conta
  só quem clicou num resultado do Google. **Nunca comparar um com o outro**, pela
  mesma razão que não se mistura o painel-resumo com a aba "Países".
- **Não dizem de onde a visita veio.** Quem responde isso é o
  `scripts/diag-origem-cadastros.mjs` (evento `referral_visit`), que separa
  IA / busca / social.
- **Não dizem o que a pessoa fez na página.** Quem responde é o
  `scripts/diag-paginas-seo.mjs`.
- **Não medem conversão.** Nenhuma dessas cinco séries sabe o que é um cadastro.

O valor delas é **carga e cobertura de rastreamento**, e é um valor que nenhuma
das outras fontes entrega.

---

## Como ler nas próximas rodadas

Três derivadas, nesta ordem de importância. Nenhuma delas vem pronta no painel
da Cloudflare — todas saem de dividir uma série pela outra.

| Derivada | Conta | O que significa |
|---|---|---|
| **Requisições ao origin** | `requisições × (1 − cache%)` | A carga real na VPS. É o número que conversa com a política de memória. |
| **Requisições por visitante** | `requisições ÷ visitantes` | Sobe sem os visitantes subirem = rastreamento. Sobem juntos = gente navegando mais. Cair de repente com o site no ar = robô parou de vir (investigar robots.txt e Cloudflare). |
| **KB por requisição** | `dados servidos ÷ requisições` | Estável em ~3-5 KB. Uma subida súbita indica página nova pesada ou mídia sem otimização. |

Baseline para comparar: **29% de cache, 64 requisições por visitante, 21,7 mil
requisições/dia no origin, ~3,9 KB por requisição.**
