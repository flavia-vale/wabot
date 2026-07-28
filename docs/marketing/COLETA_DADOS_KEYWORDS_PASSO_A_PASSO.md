# Coleta de dados reais de palavras-chave — passo a passo

Objetivo: substituir as **estimativas** do estudo de 2026-07-28 por **números reais**.
São 3 relatórios. O nº 1 é o mais valioso e o mais rápido.

Ao terminar, me mande os arquivos exportados (CSV). Eu monto a matriz final de
prioridade com número real em vez de estimativa.

---

## RELATÓRIO 1 — Google Search Console (o mais importante)

**Por que primeiro:** é dado **exato** (não é faixa nem estimativa), é **grátis**,
é sobre o **seu** site, e mostra a mina de ouro: as buscas em que você já aparece
na **posição 8–20**. Essas são as vitórias mais rápidas que existem — falta pouco
para virar página 1.

### Passos

1. Acesse https://search.google.com/search-console
2. Escolha a propriedade `espelhagrupos.com.br`
   - *Se não existir*, me avise — a propriedade precisa ser criada e verificada antes.
3. Menu lateral → **Desempenho** → **Resultados da pesquisa**
4. No topo, clique no filtro de data → **Personalizado** → **Últimos 12 meses**
   (se o site for mais novo, pegue **Todo o período**)
5. Confirme que as 4 caixas de métrica estão **ligadas** (elas ficam azuis quando ativas):
   - Total de cliques
   - Total de impressões
   - CTR médio
   - **Posição média** ← esta costuma vir desligada, **precisa ligar**
6. Logo abaixo, selecione a aba **CONSULTAS**
7. Canto superior direito → botão **Exportar** → **CSV** (ou "Baixar CSV")
8. Repita o export na aba **PÁGINAS** (mesmo período, mesmas métricas)

### O que me mandar
- `Consultas.csv`
- `Páginas.csv`

### Observação
O Search Console limita a exportação da tela a 1.000 linhas. Está ótimo para o
que preciso. Se aparecer opção de exportar para Google Sheets, prefira — vem completo.

---

## RELATÓRIO 2 — Planejador de Palavras-Chave do Google

**Por que:** traz o volume de busca de termos em que você **ainda não aparece**
(o Search Console só mostra onde você já aparece).

### Pré-requisito e uma armadilha importante

Precisa de conta no **Google Ads** (criar é grátis, **não precisa rodar anúncio**).

⚠️ **Armadilha:** contas que nunca gastaram nada mostram o volume em **faixas**
("1 mil – 10 mil") em vez do número exato. Duas saídas:

- **Opção A (grátis):** aceitar as faixas. Já resolve 80% da priorização.
- **Opção B (~R$50):** rodar uma campanha mínima por alguns dias. Destrava o
  número exato **para sempre**. Se o plano é levar SEO a sério, vale.

Comece pela A. Se as faixas ficarem largas demais para decidir, aí faça a B.

### Como criar a conta sem cair na armadilha do anúncio

1. https://ads.google.com → **Começar agora**
2. O Google vai empurrar a criação de uma campanha. **Não crie.**
   Procure o link pequeno **"Alternar para o modo especialista"** ou
   **"Criar uma conta sem uma campanha"** (fica no rodapé, em letra menor)
3. Preencha país **Brasil**, fuso **Brasília**, moeda **BRL**
4. Finalize. Não precisa cadastrar cartão para usar o Planejador.

### Parte A — "Descobrir novas palavras-chave"

1. Ícone de ferramentas (chave inglesa) no topo → **Planejamento** →
   **Planejador de palavras-chave**
2. Clique em **Descobrir novas palavras-chave**
3. **Configure antes de rodar** (isso muda tudo):
   - **Local: Brasil** (remova "Todos os locais" se vier preenchido)
   - **Idioma: Português**
   - **Redes de Pesquisa: Google** (sem "parceiros de pesquisa")
   - **Período: Últimos 12 meses**
4. Cole o **Lote 1** da lista abaixo → **Ver resultados**
5. Canto superior direito → **Fazer o download das ideias de palavras-chave** → **CSV**
6. **Repita** para os Lotes 2, 3 e 4 (o Google aceita no máximo 10 sementes por vez)

### Parte B — "Ver o volume de pesquisa" (a lista fechada)

1. Volte ao Planejador → **Ver volume de pesquisa e previsões**
2. Cole a **LISTA COMPLETA** (última seção deste documento) de uma vez
3. Mesmas configurações: Brasil / Português / Google / 12 meses
4. Aba **Palavras-chave históricas** (não a de "Previsão")
5. **Download** → **CSV**

### O que me mandar
- Os 4 CSVs da Parte A
- O CSV da Parte B

---

## RELATÓRIO 3 — Google Trends (2 minutos, resolve uma dúvida específica)

**Por que:** o Planejador trata "bot" e "robô" como coisas separadas e não diz
qual está **crescendo**. O Trends responde isso e é grátis, sem login.

1. Acesse https://trends.google.com.br
2. Configure: **Brasil** · **Últimos 12 meses** · **Pesquisa na Web**
3. Faça **3 comparações** (o Trends compara até 5 termos por vez).
   Em cada uma, use o botão **Comparar** para adicionar os termos:

   **Comparação 1 — como o mercado chama a ferramenta**
   `bot whatsapp` · `robô whatsapp` · `automação whatsapp` · `bot de ofertas`

   **Comparação 2 — como o mercado chama o produto**
   `achadinhos` · `grupo de ofertas` · `promoções whatsapp` · `cupom de desconto`

   **Comparação 3 — marketplaces**
   `afiliado shopee` · `afiliado amazon` · `afiliado mercado livre` · `afiliado magalu`

4. Em cada comparação, clique no ícone de **download** (seta para baixo, canto
   superior direito do gráfico) → salva CSV

### O que me mandar
- Os 3 CSVs (ou só prints do gráfico — para o Trends, print resolve)

---

## SEMENTES PARA A PARTE A (copiar e colar, 10 por vez)

### Lote 1 — núcleo bot / robô
```
bot para grupos de ofertas whatsapp
robô para grupos de ofertas whatsapp
bot para afiliados whatsapp
robô para afiliados whatsapp
bot achadinhos whatsapp
automação whatsapp afiliados
automatizar grupos de ofertas
postar ofertas automaticamente whatsapp
bot de ofertas
divulgar ofertas whatsapp automático
```

### Lote 2 — marketplaces e links
```
bot shopee whatsapp
afiliado shopee whatsapp
bot amazon afiliados whatsapp
bot mercado livre afiliados
divulgar ofertas magalu whatsapp
converter link de afiliado
link de afiliado shopee automático
gerar link de afiliado automaticamente
afiliado aliexpress whatsapp
programa de afiliados divulgar whatsapp
```

### Lote 3 — topo de funil e dor
```
como criar grupo de ofertas no whatsapp
como encher grupo de achadinhos
quanto ganha com grupo de ofertas
grupo de achadinhos whatsapp
ganhar dinheiro como afiliado whatsapp
evitar banimento whatsapp
quantas mensagens whatsapp sem tomar ban
whatsapp banido divulgação
gerenciar vários grupos whatsapp
disparo em massa whatsapp grupos
```

### Lote 4 — comercial e concorrentes
```
melhor bot para afiliados
melhores ferramentas para afiliados
bot afiliados grátis
quanto custa bot whatsapp
achadinho pro
proafiliados
shozap
fluxopromo
bot whatsapp telegram afiliados
software para grupos de ofertas
```

---

## LISTA COMPLETA PARA A PARTE B (colar tudo de uma vez)

```
bot para grupos de ofertas whatsapp
robô para grupos de ofertas whatsapp
bot para grupos de achadinhos
robô para grupos de achadinhos
bot achadinhos whatsapp
robô achadinhos whatsapp
bot para achadinhos
automação para grupos de ofertas
automação para grupos de achadinhos
automação para afiliados
automação whatsapp afiliados
robô para afiliados
robô para afiliados whatsapp
bot para afiliados
bot para afiliados whatsapp
bot afiliados whatsapp grátis
bot para afiliados grátis
robô de vendas whatsapp
bot de ofertas whatsapp
bot de promoções whatsapp
bot de cupons whatsapp
automatizar grupo de whatsapp
automatizar grupos de ofertas
automatizar divulgação whatsapp
como automatizar grupo de ofertas no whatsapp
postar ofertas automaticamente no whatsapp
enviar ofertas automaticamente whatsapp
divulgar ofertas whatsapp automático
publicar promoções automaticamente
programa para postar em vários grupos do whatsapp
enviar mensagem para vários grupos whatsapp
gerenciar vários grupos de whatsapp
ferramenta para grupos de whatsapp
software para grupos de ofertas
plataforma para afiliados whatsapp
bot shopee whatsapp
bot shopee afiliados
automação shopee whatsapp
afiliado shopee whatsapp
como ser afiliado shopee
divulgar shopee no whatsapp
bot amazon whatsapp
afiliado amazon whatsapp
divulgar amazon no whatsapp
bot mercado livre whatsapp
afiliado mercado livre whatsapp
divulgar mercado livre whatsapp
bot magalu whatsapp
afiliado magalu divulgar
bot aliexpress whatsapp
afiliado aliexpress whatsapp
converter link de afiliado
converter link de afiliado automaticamente
gerar link de afiliado automaticamente
trocar link de afiliado automático
link de afiliado não está dando comissão
como saber se o link de afiliado está funcionando
encurtador de link de afiliado
como criar grupo de ofertas no whatsapp
como criar grupo de achadinhos
como montar grupo de ofertas
como encher grupo de achadinhos
como divulgar grupo de ofertas
como conseguir membros para grupo de whatsapp
grupo de achadinhos whatsapp
grupo de ofertas whatsapp entrar
grupo vip de ofertas whatsapp
canal de ofertas whatsapp
canal de achadinhos whatsapp
grupo ou canal whatsapp ofertas
quanto ganha com grupo de ofertas
quanto ganha um afiliado shopee
ganhar dinheiro com grupo de whatsapp
ganhar dinheiro como afiliado whatsapp
como ganhar dinheiro com achadinhos
vender no automático whatsapp
evitar banimento whatsapp
como não tomar ban no whatsapp
quantas mensagens posso enviar no whatsapp
limite de mensagens whatsapp
whatsapp banido o que fazer
whatsapp bloqueado divulgação
chip para bot whatsapp
número virtual para whatsapp bot
anti ban whatsapp
antiban whatsapp bot
bot whatsapp seguro
melhor bot para afiliados
melhor bot para grupos de ofertas
melhores ferramentas para afiliados
melhores bots para whatsapp
comparativo bot afiliados
alternativa ao proafiliados
alternativa ao achadinho pro
quanto custa bot para whatsapp
preço bot whatsapp afiliados
bot whatsapp mensalidade
teste grátis bot whatsapp
achadinho pro
proafiliados
shozap
fluxopromo
afilira
ia divulgadora
bot whatsapp e telegram
whatsapp ou telegram para grupo de ofertas
bot telegram afiliados
espelhar grupos whatsapp
espelhar grupo de whatsapp
copiar ofertas de outro grupo
repostar ofertas whatsapp
monitorar grupos de whatsapp
melhores horários para postar ofertas
agendar mensagem whatsapp grupo
disparo em massa whatsapp
botinho whatsapp
botinho bot
espelha grupos
```

---

## Sobre a marca (decidido: BOTinho)

Registro do que já foi apurado, para não repetir a pesquisa depois:

- `botinho.com.br` → **indisponível**. Registrado desde 18/01/2007 por
  *Indústria de Calçados Botinho Ltda* (CNPJ 07.833.689/0001-84), ativo,
  renovação até 01/2027. Empresa em operação — improvável de vender barato.
- Consequência: existe uma **marca homônima** no Brasil. Não impede o uso
  (setores completamente distintos), mas significa que a busca por "botinho"
  puro devolve calçado. O nome sempre precisará de qualificador
  ("BOTinho WhatsApp", "BOTinho afiliados").
- Os dois exports acima incluem `botinho whatsapp`, `botinho bot` e
  `espelha grupos` de propósito: vão medir se a marca já tem busca própria
  e qual das duas identidades o mercado usa hoje.

**Decisão de domínio fica pendente até os dados chegarem.** Não faz sentido
escolher entre migrar de domínio, comprar variação (`.app`, `.com`, `use...`)
ou manter `espelhagrupos.com.br` antes de saber quanta autoridade e quanto
tráfego de marca já existem. O Relatório 1 responde isso.
