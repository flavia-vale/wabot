# Benchmark com dados próprios — o que é, e o passo a passo

Status: **proposta**. Nada foi executado, nenhum dado foi lido.

---

## 1. O que é

Uma página pública com **números reais da operação do BOTinho**, agregados e
anonimizados — nunca dados de um cliente específico. Algo como:

> *"Analisamos 340 mil ofertas espelhadas em grupos de WhatsApp entre janeiro e
> junho de 2026. **23% das ofertas que chegaram já tinham sido enviadas ao mesmo
> grupo nas últimas 2 horas.** O pico de envio real é às 11h e às 20h, não às 8h
> como diz a maioria dos guias. A Shopee responde por 61% dos links, o Mercado
> Livre por 22%."*

Números ilustrativos — não sei os reais, é justamente isso que o script mediria.

## 2. Por que vale mais que qualquer outra página

O estudo mostrou que citar estatística aumenta a chance de uma página ser citada
por IA em ~40%, e que **dado original vale mais que dado agregado de terceiros**.

Mas o argumento mais forte é outro: **é a única coisa do plano que nenhum
concorrente consegue copiar.** Achadinho Pro, ProAfiliados, Shozap — todos podem
escrever "guia de afiliado Shopee" melhor que o seu. Nenhum deles pode publicar
os seus dados. É o único ativo verdadeiramente defensável do site.

E ele alimenta conteúdo que já existe: o post
`/blog/melhores-horarios-para-postar-ofertas-no-whatsapp` hoje dá conselho
genérico ("início da manhã, almoço, início da noite"). Com dado próprio, ele
passa a dizer o horário **medido**, e vira a fonte que os outros citam.

---

## 3. ⚠️ O bloqueio que vem antes de tudo

**A política de privacidade atual não cobre esse uso.** Ela diz que dados
operacionais são tratados *"para entregar as funcionalidades contratadas"* —
publicar estatística agregada não é entregar funcionalidade contratada.

Isso não é impedimento definitivo, é uma etapa: a política precisa passar a
prever **uso agregado e anonimizado para fins estatísticos e de comunicação**,
antes de qualquer publicação. É alteração de texto legal, não de código.

**Minha recomendação:** consultar quem cuida do jurídico do BOTinho antes de
executar. Eu posso preparar o rascunho da cláusula, mas não sou a pessoa que
deve aprovar redação legal que vincula você perante seus clientes.

---

## 4. O que o script mediria (baseado nas colunas que existem de verdade)

Confirmei no `prisma/schema.prisma` que estes dados já são gravados. Nada
precisa ser instrumentado.

### Da tabela `MessageLog`

| Métrica | Coluna | Por que é interessante |
|---|---|---|
| Volume de ofertas espelhadas | contagem | dá escala à afirmação |
| **% bloqueada por repetição** | `dedupHits` | **ninguém no mercado tem esse número** |
| Distribuição por hora do dia | `sentAt` | substitui conselho genérico por horário medido |
| Share por marketplace | `platform` | dado real de Shopee vs Amazon vs ML em grupos |
| Taxa de sucesso e principais erros | `status`, `errorMsg` | honestidade sobre o que falha |

O de `dedupHits` é o mais valioso: responde uma pergunta que o mercado inteiro
tem — *"quanta oferta repetida circula nos grupos?"* — e que só quem opera
espelhamento em escala consegue responder.

### Da tabela `WaConnectionEvent`

Estabilidade de sessão: quanto tempo uma conexão dura, com que frequência cai.
Alimenta o cluster de ban com dado em vez de opinião.

---

## 5. O que EU faço

| # | Ação |
|---|---|
| E1 | Escrevo `scripts/benchmark-operacao.mjs` — **somente leitura**, seguindo o padrão dos `diag-*.mjs` que já existem |
| E2 | O script imprime **só agregados**. Nenhum e-mail, nome, número, nome de grupo ou link individual sai no output |
| E3 | O script aplica um **piso de anonimato**: se o número de contas na amostra for pequeno demais, ele recusa a publicar aquele recorte e avisa |
| E4 | Você roda, revisa a saída e me manda **só os números que aprovar** |
| E5 | Transformo em página pública com metodologia, período e limitações declaradas |
| E6 | Atualizo o post de melhores horários para citar o dado medido |

**Não vou rodar nada em produção.** Quem roda é você, no VPS, e vê o resultado
antes de qualquer coisa virar página.

---

## 6. O que VOCÊ faz — passo a passo

### Passo 1 — Decidir se quer (5 min)

Antes do resto, três perguntas:

1. **Você quer publicar números da sua operação?** Isso mostra escala para o
   mercado — inclusive para concorrente. Se o volume for pequeno hoje, pode ser
   melhor esperar.
2. **Está confortável em atualizar a política de privacidade** para prever uso
   agregado e anonimizado?
3. **Quer consultar alguém do jurídico** antes? Eu recomendo.

Se a resposta a qualquer uma for "não" ou "ainda não", **para aqui** — e sem
problema. O item continua no backlog e a Onda 3 já entregou valor sem ele.

### Passo 2 — Ajustar a política de privacidade

Só depois do "sim" do Passo 1. Eu preparo o rascunho da cláusula, você (ou o
jurídico) revisa e aprova, e ela entra pelo fluxo normal de PR.

**Não pule este passo.** Publicar antes de ajustar é o tipo de coisa que gera
problema com cliente e com a LGPD.

### Passo 3 — Rodar o script (5 min, quando eu tiver escrito)

No VPS, dentro do diretório de produção:

```bash
cd ~/wabot && node scripts/benchmark-operacao.mjs --desde 2026-01-01 --ate 2026-06-30
```

É **somente leitura** — não escreve, não altera, não apaga nada. Vai imprimir
uma tabela de agregados no terminal.

⚠️ Se o painel estiver em horário de pico, rode fora dele. É consulta pesada em
SQLite e o `AGENTS.md` já documenta que leitura concorrente pode gerar
`SQLITE_BUSY`.

### Passo 4 — Revisar a saída

Leia linha por linha e se pergunte, para cada número:

- **Isso identifica alguém?** Se der para adivinhar de qual cliente veio, corta.
- **Isso me expõe demais?** Volume total revela sua escala. Pode publicar
  percentuais sem publicar o número absoluto.
- **Isso é verdade e eu defendo publicamente?** Se alguém questionar, você
  precisa conseguir explicar de onde veio.

Me mande **só os números aprovados**. Se preferir mandar percentuais sem os
absolutos, funciona — percentual é o que interessa para citação.

### Passo 5 — Eu monto a página

Com metodologia declarada: período, o que foi contado, o que ficou de fora, e
as limitações. Sem isso não é benchmark, é propaganda com número.

### Passo 6 — Atualizar quando fizer sentido

Benchmark envelhece. O ideal é revisar a cada 6 meses ou 1 ano, com a data
sempre visível. Melhor um dado de 6 meses atrás e datado do que um dado sem data.

---

## 7. Os riscos, honestamente

| Risco | Peso | Mitigação |
|---|---|---|
| **Privacidade / LGPD** | 🔴 Alto | Passo 2 é obrigatório. Só agregado, com piso de anonimato |
| **Expor sua escala ao concorrente** | 🟠 Médio | Publicar percentual sem número absoluto |
| **Amostra pequena demais** | 🟠 Médio | O script recusa recorte com poucas contas |
| **Dado envelhecer e virar mentira** | 🟡 Baixo | Data visível + revisão semestral |
| **Alguém questionar o número** | 🟡 Baixo | Metodologia declarada na própria página |

---

## 8. Se você preferir não fazer

Totalmente legítimo, e não trava nada. As alternativas mais baratas, em ordem:

1. **Benchmark de mercado, não da sua base** — compilar dados públicos de
   Shopee, Amazon e ML numa página só. Menos defensável, mas zero risco de
   privacidade. Parte disso já está no hub `/programa-de-afiliados`.
2. **Um único número, o mais forte** — em vez da página inteira, publicar só a
   estatística de oferta repetida dentro do post que já existe. Escopo mínimo,
   mesma força de citação.
3. **Adiar** — o item fica no backlog e a gente revisita quando a base crescer.
   Com mais contas, o piso de anonimato deixa de ser problema.

**Minha recomendação:** se você topar o Passo 1 e o Passo 2, vale muito. Se o
Passo 2 travar por qualquer motivo, vá pela alternativa 1 — é a que mais se
aproxima do resultado sem tocar em dado de cliente.
