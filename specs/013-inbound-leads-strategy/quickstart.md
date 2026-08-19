# Quickstart — validação da feature 013

Guia de execução e verificação. Nada aqui altera produção, `.env` ou banco de produção
(FR-035).

## Pré-requisitos

```bash
cd /home/user/wabot
git branch --show-current      # precisa ser claude/inbound-leads-strategy-yqtajg
npm ci
cd dashboard && npm ci && cd ..
```

**Não criar nem trocar de branch.** O PR final é contra `develop`, nunca `main`.

---

## Portões — rodar sempre nesta ordem

```bash
# 1) raiz — suíte inteira (FR-040)
npm test

# 2) dashboard — os seis validadores (FR-038, FR-039)
cd dashboard
npm run guard:config-page
npm run guard:seo-registry
npm run lint:seo-metadata
npm run validate:seo-consistency
npm run validate:editorial-freshness
npm run validate:schema-templates
cd ..
```

> **Ordem importa em P2:** `guard:seo-registry` compara as rotas do disco com
> `getIndexableSeoRoutes()`. Marcar a primeira rota como `indexable: false` **antes** de trocar
> a base do guard para `getAllSeoRoutes()` reprova o portão. Ajuste o guard primeiro.

---

## P1 — clique

```bash
node --test test/inbound-titulos-clique.test.js
```

**Esperado:** os 11 títulos de FR-004 com ≤ 55 caracteres no texto da página; a mensagem de
falha mostra também o título entregue (texto + `' | Espelha Grupos'`). Descrições ≤ 160.
`/bot-achadinhos-whatsapp` intocado, ainda passando em
`test/pagina-achadinhos-clique.test.js` com o teto de 60 que já tinha.

Conferência manual do que o teste não mede (o motivo aparecer no começo):

```bash
cd dashboard && node -e "
import('./lib/seo-registry.mjs').then(m=>{
  for (const r of m.SEO_ROUTES.filter(r=>r.title)) {
    console.log(String(r.title.length).padStart(3), r.title.slice(0,55) + '…', '|', r.path)
  }
})"
```

Ler as 55 primeiras posições em voz alta: se o motivo para clicar não apareceu ali, o trabalho
não está feito (edge case da spec).

**Resultado de campo:** Search Console, 30 dias depois (SC-002, SC-003, SC-004).

---

## P2 — indexação

```bash
node --test test/seo-noindex-guard.test.js
cd dashboard && npm run validate:seo-consistency && npm run guard:seo-registry && cd ..
```

Verificação de que o sinal chega ao HTML de verdade (não só ao registro):

```bash
cd dashboard && npm run build && npm start &
curl -s http://localhost:3000/<rota-marcada> | grep -i '<meta name="robots"'
# esperado: content="noindex, follow"
curl -s http://localhost:3000/sitemap.xml | grep -c '<rota-marcada>'   # esperado: 0
```

**Nenhuma página apagada (FR-010, SC-007):** a contagem de rotas públicas antes e depois tem
que ser igual ou maior.

```bash
cd dashboard && node -e "
import('./lib/seo-registry.mjs').then(m=>{
  console.log('total no registro:', m.SEO_ROUTES.length)
  console.log('indexáveis:', m.getIndexableSeoRoutes().length)
})"
```

**Registro escrito exigido por FR-012 e FR-013:**
`specs/013-inbound-leads-strategy/triagem-indexacao.md`, com a decisão por página (as duas
evidências de R9) e a conclusão sobre `/promo-vip-7dias` (já pronta em `research.md` R7).

---

## P3 — aviso de credencial

```bash
node --test test/painel-aviso-credencial.test.js test/painel-linguagem-leiga.test.js
```

Teste de ponta a ponta, manualmente, em staging:

1. Conta com WhatsApp conectado e **nenhuma** credencial de loja.
2. Deixar um envio ser recusado (linha `skip:no_valid_conversions` em `MessageLog`).
3. Abrir `/painel` e `/painel/checklist`: o aviso aparece **sem abrir o histórico** (FR-015).
4. Conferir o texto por loja:
   - Shopee → "as ofertas … **param de sair**";
   - Mercado Livre / Amazon → "**continuam saindo**, só com link mais comprido".
5. Cadastrar a credencial → recarregar → o aviso some (FR-021).
6. Conta com tudo em ordem → nenhum aviso (US3, cenário 6).
7. Conta com credencial **cadastrada e vencida** → aparece o aviso antigo de código vencido, e
   **não** o novo (FR-020).

Checagem direta da rota:

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3004/api/logs/credential-block | jq
```

**Resultado de campo:** SC-008 (60% → ≥80% de quem conecta e cadastra), 60 dias.

---

## E-mails de escuta — caminho de uso (FR-022)

**Isto não é um portão de teste** — não há comando a rodar aqui, e nenhuma linha de código muda
com esta seção. É o "como usar na prática" que faltava documentar depois de T026/T041 terem
confirmado o que o requisito PROÍBE (os oito e-mails do grupo `contato` em `src/email/registry.js`
— o grupo "Contato e escuta" de AGENTS.md — são **sempre `trigger: 'manual'`**, nunca disparo
automático). O uso mais direto é falar com quem parou **na etapa da credencial**: conectou o
WhatsApp, mas nunca cadastrou etiqueta de afiliada de nenhuma loja — e por isso o robô se recusa a
publicar (protege a comissão dela, não repassa para o afiliado do grupo de origem).

**Por que sempre manual, e por que isso não é negociável:** pergunta disparada por e-mail na hora
errada queima o canal — diferente de um aviso de conta vencendo (código de acesso, chave da
Shopee), que É automático porque descreve um fato atual, não um convite a conversar. O motor de
e-mails (`src/email/dispatcher.js`) tecnicamente permitiria automatizar qualquer template; a trava
é de produto/relacionamento, não técnica — por isso fica registrada aqui, para não ser removida
"para economizar tempo" sem entender o motivo.

### Passo 1 — identificar o público (read-only)

```bash
cd ~/wabot && node scripts/diag-funil-ativacao.mjs --listar
# janela maior, se a de 90 dias (default) trouxer pouca gente:
cd ~/wabot && node scripts/diag-funil-ativacao.mjs --dias 180 --listar
```

O script não escreve nada. A saída relevante são duas seções:

- **"ONDE PARARAM OS QUE NÃO PAGARAM"** — quantas pessoas pararam em cada etapa (conta, quanto
  vale conversar com aquele grupo).
- **"EXEMPLOS POR ETAPA (até 5 de cada)"** — até 5 e-mails/nomes de exemplo por etapa, só quando
  chamado com `--listar`. É essa lista que você leva para a aba E-mails do admin.

Para "quem parou na etapa da credencial" especificamente, a etapa a procurar na saída é
**`pareou, mas não cadastrou credencial`** (conectou o WhatsApp, `Credential` continua vazia).

### Passo 2 — escolher o e-mail certo para a etapa

| Etapa (rótulo exato do script) | E-mail (`slug`) | Por quê |
|---|---|---|
| `pareou, mas não cadastrou credencial` | `contato_duvida_credenciais` | Fala direto do que travou (etiqueta de afiliada da loja) e já tranquiliza: a oferta continua saindo com link mais comprido enquanto não cadastra — o mesmo vocabulário leigo da tela do painel. |
| `tentou enviar e NENHUM envio saiu` | `contato_duvida_credenciais` | O próprio script aponta essa como a causa mais comum: sem credencial o robô recusa publicar, e por fora "parece não funcionar". Confirmar antes com `errorMsg` no `MessageLog` (o script já sugere o SELECT). |
| `nunca tentou parear o WhatsApp` | `contato_travou_na_configuracao` | Pergunta sem presumir a causa: pareamento, grupos ou credenciais — cobre as três sem forçar hipótese. |
| `tem credencial, sem grupo de ORIGEM` / `tem origem, sem grupo de DESTINO` | `contato_travou_na_configuracao` | Mesmo e-mail — "travou em algum passo" cobre a etapa de configurar grupos de origem/destino. |
| `configurou tudo, nunca enviou` | `contato_travou_na_configuracao` (recente) ou `contato_como_esta_indo` (já faz tempo) | Recente = ainda faz sentido perguntar onde travou; antigo = check-in mais aberto, sem presumir. |
| `ENVIOU DE VERDADE e não foi para o checkout` | `contato_primeira_semana` (recente) ou `contato_convite_conversa` (grupo mais valioso, por avaliação do próprio script) | Viu o robô funcionar e mesmo assim não comprou — o motivo dela vale mais que pesquisa de mercado; conversa por chamada entende melhor que e-mail sozinho. |
| `foi ao checkout e não pagou` | `contato_convite_conversa` | Chegou mais perto de todo mundo sem fechar — conversa direta capta o motivo melhor que qualquer template. |
| Conta que já usou e o robô ficou quieto (não é bem uma etapa do funil de ativação — é sinal de churn) | `contato_parou_de_usar` | Pergunta se foi pausa deliberada ("tudo bem, é só ignorar") ou algo quebrou. |
| Cancelou/decidiu não continuar depois de conhecer o robô | `contato_o_que_faltou` | Pede o motivo de não continuar, mesmo que "duro de ouvir". |
| Qualquer etapa, quando o objetivo é um dado rápido e amplo | `contato_pesquisa_rapida` | Uma pergunta só, baixa fricção — serve para lote maior sem pedir muita atenção de cada pessoa. |
| Nenhuma das etapas específicas se aplica claramente | `contato_como_esta_indo` | Abertura genérica, sem hipótese de onde travou. |

### Passo 3 — disparar pela aba E-mails do admin

`dashboard/app/admin/emails/page.js` é o único lugar de onde estes e-mails saem, e sempre por
clique humano — não existe rota nem cron que os dispare sozinhos.

1. Com a lista de e-mails da etapa escolhida em mãos (passo 1), abrir a aba **E-mails** do painel
   admin e escolher, na lista de templates, o `slug` correspondente (tabela acima) — os oito do
   grupo "Contato e escuta" aparecem marcados com o chip **Manual**.
2. Usar a busca de clientes da própria tela (por nome ou e-mail) para localizar e marcar, um a um,
   os clientes que o script listou — o envio manual sempre vai só para quem foi selecionado ali
   (`filters.userIds`), nunca para "todos que batem um filtro amplo" por engano.
3. Revisar o texto antes de enviar (as variáveis `{{saudacao}}`/`{{marca}}` são preenchidas pelo
   próprio motor — não editar à mão) e confirmar o envio.
4. `dedupDays` de cada e-mail (varia entre 21 e 90 dias por template, ver `registry.js`) impede
   reenviar o MESMO e-mail para a MESMA pessoa dentro da janela — mas isso não impede mandar um
   e-mail *diferente* do grupo `contato` na mesma semana, então use bom senso: uma pergunta por
   vez, não uma sequência de oito.

**Não regredir:** os oito continuam `trigger: 'manual'` em `src/email/registry.js` (T026/T041 já
guardam isso por teste); esta seção é só o "como usar", não abre um caminho de automação novo. Não
criar cron, `setInterval` nem gatilho de evento para nenhum destes oito sem decisão explícita
nova — seria romper de propósito a regra que motivou o grupo existir.

---

## P4, P5, P6 — conteúdo

```bash
node --test test/marketing-limites-que-nao-se-cruzam.test.js
cd dashboard && npm run validate:editorial-freshness && npm run validate:schema-templates && cd ..
```

**Esperado (FR-029..FR-034, SC-013):**
- zero promessa de não-banimento em qualquer texto publicado;
- todo preço de concorrente rastreável a um `slug` de `dashboard/lib/competitors-data.js` com
  `verifiedAt` e `source`;
- toda página de comparação com o bloco `bestFit` (onde o concorrente é a melhor escolha);
- nenhuma rota nova de cidade, de nicho novo, de Magalu como frente, nem de "automação
  whatsapp"/"disparo em massa";
- nenhuma página antiga das linhas congeladas apagada.

**Portão de publicação (FR-014):** P5 e P6 só entram depois de P2 concluído e verificado. A
próxima página de comparação da fila só sai depois que a de Achadinho Pro entrar no índice
(SC-011, ≤ 14 dias) — regra registrada no checklist de FR-026.

---

## Antes de abrir o PR

```bash
npm test && (cd dashboard && npm run guard:config-page && npm run validate:seo-p0 \
  && npm run validate:seo-consistency && npm run validate:seo-p2 \
  && npm run validate:schema-templates)
git status                     # nenhum .env, nenhum .db
git branch --show-current      # ainda claude/inbound-leads-strategy-yqtajg
```

PR **contra `develop`**. Depois do merge, validar em staging (`http://178.105.54.0:3006`) antes
de qualquer PR para `main`.
