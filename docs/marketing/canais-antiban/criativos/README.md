# Criativos finais — campanha Canais + Preservação (P2)

Os 8 posts de [`../social-posts.md`](../social-posts.md) transformados em peças prontas para publicar: copy final por rede (dentro do limite de caracteres), hashtags, texto alternativo, links com UTM e capa 1080×1080 em SVG.

**Publicar é passo da dona do produto** (ver "Checklist de publicação" abaixo). Nada aqui foi publicado.

## O que mudou em relação ao rascunho de `social-posts.md`

- **Marca única:** "Espelha Grupos" em todas as peças (o rascunho ainda usava o nome antigo).
- **Endereços novos:** posts 4, 7 e 8 apontam direto para `/bot-comum-vs-espelha-grupos`, `/como-funciona-espelha-grupos-canais` e `/protecao-antiban-espelha-grupos` (os antigos só redirecionam).
- **Só o que o produto faz** (regra de `docs/rca/seo-marketing.md`, 24/09/2026): saíram "pausa preventiva", "rastreio de cliques", "conta observadora + painel de saúde" e "monitoramento de sinais". Entrou o que existe: status de cada canal pelas falhas de envio e pausa automática de **1 hora** do canal que recusa envios 3 vezes seguidas (plano Pro).
- **Sem promessa:** nenhuma peça diz "100%", "não bane" ou "anti-ban garantido"; quando o assunto é banimento, a peça diz que ninguém pode prometer isso.
- **UTM pelo padrão `utm_taxonomia_padrao.csv`:** `utm_medium=social-organic` (o rascunho usava `social`), `utm_campaign=canais-preservacao`, `utm_content` = id do post (`post01-grupo-cair` …). As linhas foram registradas no CSV.

## Índice

| # | Post | Destino | Formato | Capa |
|---|---|---|---|---|
| 1 | [Se seu grupo cair hoje](./post01-grupo-cair.md) | `/diagnostico-antiban-whatsapp` | LinkedIn texto + Instagram carrossel (5 slides) + X | [`post01-grupo-cair.svg`](./post01-grupo-cair.svg) |
| 2 | [“Anti-ban” honesto](./post02-antiban-honesto.md) | `/faq-antiban-whatsapp` | X thread (3 posts) + LinkedIn curto + Instagram card único | [`post02-antiban-honesto.svg`](./post02-antiban-honesto.svg) |
| 3 | [Checklist de preservação](./post03-checklist.md) | `/materiais/checklist-antiban-whatsapp` | Instagram carrossel (8 slides) + LinkedIn carrossel (PDF) + X | [`post03-checklist.svg`](./post03-checklist.svg) |
| 4 | [Bot comum vs Espelha Grupos](./post04-bot-comum-vs-espelha.md) | `/bot-comum-vs-espelha-grupos` | LinkedIn comparação + Instagram card comparativo + X | [`post04-bot-comum-vs-espelha.svg`](./post04-bot-comum-vs-espelha.svg) |
| 5 | [Sinais de shadowban](./post05-shadowban.md) | `/blog/shadowban-whatsapp-canais` | X thread (3 posts) + LinkedIn lista + Instagram card | [`post05-shadowban.svg`](./post05-shadowban.svg) |
| 6 | [Calculadora de risco](./post06-calculadora.md) | `/ferramentas/calculadora-risco-whatsapp` | LinkedIn + Instagram card + X | [`post06-calculadora.svg`](./post06-calculadora.svg) |
| 7 | [Grupos e canais juntos](./post07-grupos-canais.md) | `/como-funciona-espelha-grupos-canais` | LinkedIn texto + Instagram carrossel (4 slides) + X | [`post07-grupos-canais.svg`](./post07-grupos-canais.svg) |
| 8 | [Preservação em camadas](./post08-camadas.md) | `/protecao-antiban-espelha-grupos` | Instagram carrossel (7 slides) + LinkedIn carrossel (PDF) + X | [`post08-camadas.svg`](./post08-camadas.svg) |

## Padrão de link

```txt
https://espelhagrupos.com.br<destino>?utm_source={linkedin|instagram|x}&utm_medium=social-organic&utm_campaign=canais-preservacao&utm_content=<id-do-post>
```

A UTM chega no funil do admin (`/admin/marketing-growth` → "Campanha Canais + Preservação") como **link de origem** (`entry_utm_*`), e o relatório semanal sai de `node scripts/diag-funil-antiban.mjs` na VPS.

## Limites respeitados (conferidos na geração de cada peça)

| Rede | Limite | Observação |
|---|---|---|
| LinkedIn | 3.000 caracteres | 3 hashtags no fim |
| Instagram | 2.200 caracteres, até 30 hashtags | 4–5 hashtags; link não é clicável na legenda → link da bio ou figurinha de link no Stories |
| X | 280 caracteres | todo link conta 23; posts 2 e 5 são fio de 3 |
| Texto alternativo | ≤ 250 caracteres | mesmo texto nas três redes |

## Molde visual (Design System v2 — `docs/design-system/design-system-v2.html`)

Formato 1080×1080 (carrossel: todos os slides no mesmo tamanho). Fonte **Figtree** (800 nos títulos, 600 no apoio).

| Elemento | Token | Medida |
|---|---|---|
| Fundo | `--bg` com círculos `--accent-3` (canto superior direito) e `--bg-soft` (inferior esquerdo) | sangria total |
| Cartão | `--surface`, borda `--line` | margem 72px, raio 48px |
| Selo (eyebrow) | fundo `--bg-soft`, ponto e texto `--accent-strong` | 28px, caixa alta, espaçamento 3px |
| Título | `--ink` | 84px, 2 linhas no máximo |
| Apoio | `--ink-soft` | 44px, 2 linhas no máximo |
| Botão | fundo `--accent-strong`, texto `--surface` | altura 100px, raio 50px, 38px |
| Rodapé | linha `--line`; marca "Espelha Grupos" `--ink` com ponto `--accent`; domínio `--ink-soft` | 32px / 24px |

Slides internos do carrossel: mesmo cartão, sem botão, um item por slide (título 84px + apoio 44px). Último slide repete o botão com "link na bio". Nada de print real de painel ou de cliente — se usar tela, escrever "Ilustração · dados de exemplo" no próprio slide.

Os SVGs usam as cores dos tokens como classes nomeadas (`.accent-strong`, `.ink`…). Para exportar PNG: abrir no navegador ou no Canva/Figma (instalar Figtree para o texto ficar igual ao do site).

## Checklist de publicação (passo da dona do produto)

Para cada post:

- [ ] Exportar a capa (`.svg` → PNG 1080×1080) e montar os slides internos pelo molde acima.
- [ ] Colar a copy da rede **exatamente** como está no arquivo do post.
- [ ] Link: LinkedIn e X — no próprio texto (já está lá); Instagram — trocar o link da bio pelo link do Instagram do post (ou usar a figurinha de link no Stories).
- [ ] Colar o texto alternativo na imagem (LinkedIn: "Texto alternativo"; Instagram: "Configurações avançadas → Acessibilidade"; X: "+ALT").
- [ ] Conferir que o link abre a página certa (clicar uma vez depois de publicado).
- [ ] Comentário fixado quando aplicável (LinkedIn: repetir o link no 1º comentário se o alcance cair com link no texto).
- [ ] Anotar data/hora e rede na cadência de 14 dias de [`../p3-distribuicao-autoridade.md`](../p3-distribuicao-autoridade.md).
- [ ] Uma semana depois: rodar `node scripts/diag-funil-antiban.mjs` na VPS (ou abrir o admin) e ver visitas/cadastros por `utm_content`.
