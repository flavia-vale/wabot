# Prompt para o implementador — aulasdematematicabh.com.br, o que AINDA falta (2026-09-18, noite)

Cole o bloco abaixo, inteiro, para quem for implementar no repositório do site
(Astro). Ele parte do que já foi verificado no ar hoje à noite e só pede o que
falta. O diagnóstico completo, com evidência, está em
`SITE_MATEMATICA_BH_DIAGNOSTICO_E_PLANO_2026-09-18.md`.

---

```text
Contexto: o site aulasdematematicabh.com.br (Astro, Cloudflare) já recebeu hoje:
rodapé "Site mantido por Flávia Vale" com Person #flavia como creator/maintainer
no schema; 301 de http→https e www→apex; /sitemap.xml redirecionando para
sitemap-index.xml; lastmod em todas as 33 URLs; Claude-SearchBot no robots.txt;
e quatro posts locais novos (Coltec, CEFET-MG, Colégio Militar, Cálculo 1
UFMG/PUC), linkados da home. NÃO refazer nada disso.

O que falta, em ordem. Cada item tem o teste de aceitação; só marque como feito
quando o teste passar.

1) MEDIÇÃO (hoje o HTML não carrega NENHUM script externo).
   - Instalar Cloudflare Web Analytics (beacon) OU GA4. Se GA4: `gtag` no
     <head> de todas as páginas, com consentimento simples (banner de 1 linha).
   - Medir o clique no WhatsApp: todo <a href="https://wa.me/..."> dispara um
     evento (GA4: `generate_lead`, parâmetros `page_path` e `cta_position`;
     Cloudflare: não tem evento — aí GA4 é obrigatório).
   - Gerar `/llms.txt` NÃO é este item (já existe). Não mexer.
   Teste: `curl -s https://aulasdematematicabh.com.br/ | grep -cE "gtag|googletagmanager|cloudflareinsights"` ≥ 1.

2) TÍTULOS E DESCRIÇÕES (26 das 30 páginas passam de 60 caracteres; as 4 novas
   têm 72-83 por causa do sufixo "| Aulas de Matemática BH").
   - Regra: <title> com no máximo 60 caracteres, consulta no começo, "BH" ou
     "online" no título; meta description com no máximo 155.
   - Retirar o sufixo "| Aulas de Matemática BH" de todo <title> que estoure 60
     com ele (nos posts, sempre).
   - Trocar os 16 títulos abaixo exatamente por estes:
     /                                                Aula particular de matemática em BH e online (UFMG)
     /aulas-particulares-matematica-bh                Aula particular de matemática em BH, na casa do aluno
     /aulas-de-matematica-online                      Aula de matemática online ao vivo: R$ 45 por 50 min
     /reforco-escolar-matematica                      Reforço escolar de matemática: fundamental e médio
     /enem-matematica                                 Matemática para o ENEM: preparação individual em BH
     /professor-particular-de-matematica              Professora particular de matemática: aula individual
     /aulas-particulares-ensino-superior              Aula particular de Cálculo, GAAL e Estatística em BH
     /aula-particular-de-calculo-1                    Aula particular de Cálculo 1: limites e derivadas
     /aula-particular-de-calculo-2                    Aula particular de Cálculo 2: integrais e séries
     /aula-particular-de-calculo-3                    Aula particular de Cálculo 3: várias variáveis
     /aula-particular-de-pre-calculo                  Aula particular de Pré-cálculo: base para o Cálculo 1
     /aula-particular-de-estatistica-e-probabilidade  Aula particular de Estatística e Probabilidade
     /aula-particular-de-geometria-analitica-e-algebra-linear  Aula particular de GAAL: Geometria Analítica e Álgebra
     /sobre                                           Taciane Andrade, professora de matemática (UFMG)
     /contato                                         Contato: agende a aula diagnóstica gratuita
     /blog                                            Blog: matemática para pais e alunos de BH
   - Nos 4 posts novos, manter o H1 e usar como <title> o próprio H1 sem
     sufixo (todos cabem em 60): "Matemática do Coltec 2027: o que cai e como
     preparar", "Matemática do CEFET-MG: o que estudar para 2027", "Colégio
     Militar de BH: 4 semanas até o exame de matemática", "Cálculo 1 na UFMG e
     na PUC Minas: 5 razões da reprovação".
   Teste: para toda URL do sitemap-0.xml,
   `curl -s <url> | grep -o "<title>[^<]*" | sed "s/<title>//" | wc -m` ≤ 61.

3) POSICIONAMENTO DA HOME (hoje o H1 diz "Matemática que finalmente faz
   sentido — pro 6º ano até o 3º do médio" e o telefone é DDD 32 em 9 lugares).
   - H1 da home: "Aula particular de matemática em BH — presencial ou online,
     com professora da UFMG". Primeiro parágrafo diz BH e presencial na casa
     do aluno; o online vira o segundo parágrafo; bloco próprio "Universitário?
     Cálculo, GAAL e Estatística" linkando /aulas-particulares-ensino-superior.
   - Telefone: DECISÃO DA DONA, escolher uma das duas e aplicar em TODAS as
     páginas, no schema e no llms.txt:
     (a) trocar para um número (31) — o WhatsApp Business migra o histórico; ou
     (b) manter o (32) com a frase ao lado, sempre: "WhatsApp (32) — atendo
         Belo Horizonte presencialmente e todo o Brasil online".
     O mesmo número precisa estar na ficha do Google.
   Teste: `curl -s https://aulasdematematicabh.com.br/ | grep -o "<h1[^>]*>[^<]*"`
   contém "Belo Horizonte" ou "BH"; e (b) → `grep -c "atendo Belo Horizonte"` ≥ 1.

4) SCHEMA DOS 4 POSTS NOVOS: cada um tem FAQ em texto mas sem FAQPage no
   JSON-LD. Emitir `FAQPage` com as perguntas/respostas do próprio post
   (mesmo padrão que as páginas de serviço já usam). E em cada BlogPosting,
   `author` → Person Taciane (#taciane), `publisher` → #business.
   Teste: `curl -s <url do post> | grep -c FAQPage` = 1 nos quatro.

5) "ATUALIZADO EM" nas 8 páginas de serviço (hoje só os posts têm data):
   data visível no fim da página + `dateModified` no WebPage do schema, lida
   do frontmatter. Não inventar data: usar a do último commit que tocou a
   página.
   Teste: `curl -s https://aulasdematematicabh.com.br/enem-matematica | grep -c dateModified` ≥ 1.

6) sameAs COMPLETO na Person #taciane e no LocalBusiness: acrescentar o
   Instagram e o Facebook SÓ depois que a dona confirmar que
   `instagram.com/tacianeandrade8` e a página "Aulas de Matemática | Belo
   Horizonte MG" são dela. Se a página do Facebook NÃO for dela, avisar: é
   colisão de nome e a marca precisa virar "Taciane Andrade — Matemática BH"
   em título, ficha e redes.

7) POSTS QUE FALTAM (mesmo esqueleto dos 4 publicados: resposta direta em 3
   linhas → o que a prova/escola cobra → aula diagnóstica → plano por semanas
   → o que os pais fazem → FAQ; 1.000-1.500 palavras; CTA do WhatsApp com
   mensagem pré-preenchida própria; 3 links internos; FAQPage no schema):
   - "Recuperação de matemática em BH: o que fazer em novembro" — publicar
     ATÉ 10/10 (sazonal). Não copiar o post nacional de recuperação que já
     existe: este fala do calendário das escolas de BH.
   - "Aula particular de matemática em BH: preço por região (2026)" — usar
     só os preços que já estão no site (online R$ 45; presencial a partir de
     R$ 50 com deslocamento incluso); por região = quanto o deslocamento muda.
   - "Reforço de matemática para alunos do [Colégio X] em BH" — UMA página
     por escola onde JÁ existe aluno, nunca por escola imaginada. A dona
     informa a lista.
   Cada post novo entra linkado de 3 páginas existentes (home, a página de
   serviço do tema e o post relacionado) e é pedido no Search Console.

8) O que NÃO fazer: comprar avaliação; `aggregateRating`/`review` com os
   depoimentos do próprio site (o Google trata como self-serving e ignora);
   página por bairro sem atender o bairro; mais posts nacionais genéricos;
   prometer "aprovação garantida" em qualquer texto.

Fora do código (a dona faz, não o implementador): Search Console + Bing
Webmaster Tools (enviar sitemap-index.xml, inspecionar as 4 URLs novas e a
home); ficha do Google (categoria "Professor(a) particular", área = BH + 6
cidades, telefone igual ao do site, horário seg-sex 8-21 / sáb 9-14, serviços
com "a partir de", 5+ fotos, Perguntas e respostas com as 6 do FAQ, 1 post por
semana); pedir 10 avaliações no Google em 30 dias com o link direto da ficha
(mensagem pronta na seção 4.5 do diagnóstico); Superprof: mesma bio, responder
em menos de 2 horas, pedir avaliação a cada aluno concluído.
```
