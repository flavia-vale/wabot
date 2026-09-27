# Sessão de 23 a 27/09 — decisões, pendências e prompts prontos

Os dados desta rodada estão nos lugares canônicos; este arquivo só guarda o que
não cabe neles.

| Onde está o dado | O quê |
|---|---|
| `SERIE_HISTORICA_SEO.md` | Search Console 23/09, origem de cadastro, LTV, ChatGPT 23/09, Cloudflare 30 dias, códigos e endereços dos robôs, Bing |
| `ai_visibility_tracking.csv` | 10 linhas do ChatGPT de 23/09 + 1 pergunta indutora |
| `RESUMO_E_PLANO_2026-09-23.md` | 11 achados e plano de 7 dias |
| `ACOES_FLAVIA_2026-09-11.md` | prioridades vivas e fila de indexação |
| `ROTEIRO_MEDICAO_IA.md` | as 10 consultas, regras e o Gemini por script (e por que não roda grátis) |

## Decisões e fatos confirmados com a Flávia

- **Não há CNPJ.** Nada de razão social/CNPJ no site nem Reclame Aqui (exige CNPJ).
  Confiança vem de política de reembolso pública, depoimentos reais e da página
  `/espelha-grupos-e-confiavel`.
- **Reembolso:** pedido pelo WhatsApp ou e-mail oficial, feito em até **5 dias
  úteis** (prazo bom, mantido). Obrigatório somar o direito de arrependimento
  (CDC art. 49: valor integral se pedir em até 7 dias do pagamento).
  **Pendente:** regra depois dos 7 dias.
- **E-mail "o que faltou" descartado:** clientes não respondem e-mail. Estudos de
  renovação e funil usam comportamento no produto, não pesquisa por e-mail.
- **Depoimentos (5 textos recebidos em 23/09):** só publicar se forem de clientes
  reais, com permissão e sem reescrita. Três frases pedem confirmação ou ajuste:
  "dobrar minhas comissões", "total estabilidade e zero dores de cabeça" (soa como
  promessa de não banir) e "converte sem errar". Ainda não publicados.
- **Gemini por script:** pronto (`scripts/medir-citacao-ia.mjs`), mas conta nova
  não tem busca grátis. Só roda com cobrança ativa no AI Studio (decisão dela).
- **Robôs "de IA" com falha em 23/09 eram robôs de ataque disfarçados**
  procurando `/.env*`, `/server-status`, `/api/v1/config` na porta 8080. Conferido:
  tudo 404, nada exposto.

## Regra na Cloudflare contra robôs de ataque (opcional, 5 min)

Security → WAF → Custom rules → Create rule → "Edit expression":

```
(http.request.uri.path contains "/.env") or (http.request.uri.path eq "/server-status") or (cf.edge.server_port ne 443 and cf.edge.server_port ne 80)
```

Action: **Block**. Depois conferir que `https://espelhagrupos.com.br/` abre.

## Como fazer a rodada de IA à mão

As 10 perguntas do `ROTEIRO_MEDICAO_IA.md`, texto idêntico, em **aba anônima**
(sem login), uma por vez, sem continuar a conversa. Gemini em gemini.google.com,
Perplexity em perplexity.ai, AI Overviews na busca normal do google.com.br (se
não aparecer o resumo, anotar "não apareceu"). Copiar a resposta inteira com as
fontes. Pergunta extra é marcada como indutora e não entra no placar.

---

## Prompt A — páginas de confiança e de ofertas automáticas (enviado a outra sessão em 23/09)

```
Repo flavia-vale/wabot, site público espelhagrupos.com.br (dashboard Next.js).
Antes de tudo leia AGENTS.md, docs/rca/seo-marketing.md e
docs/design-system/design-system-v2.html. Crie branch a partir de develop e abra
PR contra develop (nunca main, nunca push direto em develop), seguindo
.github/PULL_REQUEST_TEMPLATE.md.

OBJETIVO: fazer o ChatGPT nos indicar em "bot para afiliados no WhatsApp". Em
23/09 ele nos deixou de fora porque (a) lê a consulta como "robô que busca oferta
sozinho" e (b) quer evidência além do marketing — premiou um concorrente por ter
política de reembolso pública. Registro em docs/marketing/ai_visibility_tracking.csv
(linhas de 2026-09-23). NÃO temos CNPJ: não inventar razão social nem CNPJ.

ENTREGA 1 — página pública de política de reembolso
- Rota nova (confira o nome contra dashboard/lib/seo-registry.mjs).
- Pedido pelo WhatsApp ou e-mail oficial: use as constantes SUPPORT_* de
  dashboard/lib/marketing-content.js, nunca escreva o contato à mão.
- Reembolso feito em até 5 dias úteis depois do pedido.
- Direito de arrependimento: valor integral se pedir em até 7 dias depois do
  pagamento (CDC art. 49).
- Depois de 7 dias: <<PREENCHER>>
- Não prometer prazo do banco/cartão para o estorno aparecer.
- Linkar a partir do rodapé, /precos, /termos e /espelha-grupos-e-confiavel;
  registrar no seo-registry, sitemap, dashboard/public/llms.txt e pricing.md.

ENTREGA 2 — página das ofertas automáticas da Shopee
- Título e H1 pela palavra que o cliente busca (ex.: "bot que busca ofertas da
  Shopee sozinho no WhatsApp"); termo interno explicado dentro da página.
- Descrever SÓ o que o recurso faz de verdade — confira no código
  (src/offerAutomation/, dashboard/lib/offerAutomationSearch.js,
  dashboard/lib/planFeatures.js): só Shopee, só no Pro, palavra-chave e filtros,
  fila e cadência. Deixar claro que Mercado Livre e Amazon não têm busca
  automática.
- Mostrar que o Espelha Grupos faz os dois: espelha ofertas de outros grupos E
  busca oferta sozinho.
- Atualizar /bot-afiliados-whatsapp e /melhores-bots-para-afiliados-whatsapp
  para citar os dois modos.

ENTREGA 3 — comparativos /alternativas/<slug> para Easyfy, LucreShop, AfiliAI,
Achify e Afiliados Turbo
- Mesmo padrão das /alternativas/* existentes + ficha em
  dashboard/lib/competitors-data.js.
- Preço, plano ou limite de concorrente SÓ com fonte oficial (a página do próprio
  concorrente, via WebFetch) e data da coleta. O que não confirmar, não publica —
  tabela de IA ou de outro concorrente não é fonte.
- Comparação factual; nunca se passar pelo concorrente.

ENTREGA 4 — primeira frase de /quem-somos, da home e de dashboard/public/llms.txt
deve definir a marca: "Espelha Grupos é um robô para afiliadas que [espelha
ofertas de outros grupos e busca ofertas da Shopee sozinho], trocando o link pelo
seu código de afiliada." Motivo: em 3 rodadas o ChatGPT leu "espelha grupos" como
expressão genérica.

REGRAS DE TODAS AS PÁGINAS NOVAS
- No mínimo 3 páginas já indexadas e COM impressão apontando para cada página
  nova (test/marketing-paginas-orfas.test.js). /conteudos e sitemap não contam.
  Preferir /bot-achadinhos-whatsapp, /alternativas/achadinhos-bot,
  /shopee-afiliados-whatsapp e /melhores-bots-para-afiliados-whatsapp.
- Nunca prometer "não bane". Nunca escrever "BOTinho" sozinho (sempre "BOTinho,
  o robô do Espelha Grupos"). Linhas congeladas de SEO continuam congeladas.
- Antes de concluir: npm test, lint (no-undef inclusive dashboard),
  npm ci --prefix dashboard e build do dashboard.
- No fim, me entregue a lista de URLs para pedir indexação no Google e no Bing
  (as novas E as editadas).
```

## Prompt B — varredura de segurança

```
Repo flavia-vale/wabot. Leia AGENTS.md e docs/rca/deploy-e-infra.md antes de tudo.
Stack: dashboard Next.js + API Fastify + SQLite + Redis + PM2 num VPS Hetzner atrás
da Cloudflare. Produção espelhagrupos.com.br; staging http://178.105.54.0:3006.

POR QUE: em 23/09 o Cloudflare mostrou robôs se passando por Claude-User e
Perplexity-User procurando /.env.production (18), /server-status (21),
/api/v1/config na porta 8080 (6), /css../.env, /public/env.js, /.env.save.
Conferido de fora: todos devolvem 404, sem segredo. Quero saber se existe
alguma outra porta aberta.

MÉTODO (cite na resposta onde cada achado se encaixa): OWASP Top 10 (2021) e
OWASP ASVS 4.0.3 nível 2 como checklist da aplicação; CIS Benchmark do Ubuntu
para o servidor.

O QUE VARRER
1. Segredos: gitleaks (ou trufflehog) no HISTÓRICO INTEIRO do git, não só no
   estado atual; conferir dashboard/public/ e o que o build expõe (source maps
   públicos, variáveis NEXT_PUBLIC_ com segredo).
2. Dependências: npm audit na raiz e em dashboard/, separando o que é alcançável
   em produção do que é só de desenvolvimento.
3. Aplicação: autorização das rotas /api/admin/* (acesso a dado de outra conta),
   rate limit de login/cadastro/esqueci senha, assinatura do webhook do Mercado
   Pago, mensagens de erro com stack trace, /health vazando informação,
   cabeçalhos de segurança (HSTS, CSP, X-Frame-Options, X-Content-Type-Options),
   cookies/JWT, proteção contra SSRF nos lugares que buscam URL de terceiros.
4. Borda e servidor: a origem responde direto pelo IP sem passar pela Cloudflare
   (portas 3000, 3001, 3004, 3006, 8080, 6379)? Staging público por IP e sem HTTPS
   é aceitável? Porta 8080: o que responde nela?
5. VPS: me peça SÓ os comandos necessários, um por pergunta, com a saída já
   filtrada, dizendo o que cada saída decide. Ex.: `ss -ltnp` (quem escuta em
   0.0.0.0), `sudo ufw status`, `grep -E "^(PasswordAuthentication|PermitRootLogin)" /etc/ssh/sshd_config`,
   `redis-cli CONFIG GET bind`.

REGRAS
- Só leitura e testes NÃO intrusivos: nada de força bruta, DoS, fuzzing em produção
  nem exploração. Não mexer em .env nem no banco.
- Todo achado com EVIDÊNCIA (arquivo:linha, saída de comando ou resposta HTTP).
  Hipótese é dita como hipótese.
- Nenhum processo novo no servidor sem avisar a estimativa de memória (regra de
  memória do AGENTS.md).
- Correções de código: branch a partir de develop, PR contra develop.
  Correções de servidor/Cloudflare: passo a passo para eu executar.

ENTREGA: relatório em tabela (achado | gravidade crítica/alta/média/baixa |
evidência | correção | quem faz), com os críticos primeiro, em linguagem simples.
```

## Prompt C — estudo da renovação

⚠️ **Corrigido em 27/09:** o problema descrito no prompt ("só 17% renovaram")
era leitura errada — a média incluía quem ainda não tinha chegado à data de
renovar. Na coorte de agosto, 7 de 7 renovaram. Se este prompt já rodou em
outra sessão, avisar lá; se não rodou, esperar a turma de setembro renovar
(primeira quinzena de outubro) antes de rodar.

```
Repo flavia-vale/wabot. Leia AGENTS.md, docs/rca/cobranca.md, docs/rca/admin.md,
docs/rca/emails.md e a seção "4b. LTV e retenção" de
docs/marketing/SERIE_HISTORICA_SEO.md antes de tudo.

PROBLEMA (dados de 23/09, scripts/diag-ltv-retencao.mjs): 30 clientes pagaram
até hoje, R$ 1.613,10 no total, média R$ 53,77 por cliente (mediana R$ 39),
1,13 mês pago em média. Só 17% renovaram: Pro 29% (de 14), Basic 6% (de 16).
Turma de setembro (18 pagantes) ainda é nova demais para medir. Os cadastros
crescem (205 em 30 dias), então cada cliente que não renova vaza.

CONTEXTO QUE PODE EXPLICAR (verificar, não assumir):
- Até 01/09 todo pagamento era avulso de 30 dias e precisava ser refeito à mão;
  a cobrança automática só foi ligada em 01/09. Parte do "não renovou" pode ser
  esquecimento/atrito, não desistência.
- Clientes não respondem e-mail: não basear o estudo em pesquisa por e-mail.
- Já existem: jornada de e-mails de plano vencido, /admin/funil,
  /admin/clientes/[id], scripts/contato-ativo-semanal.mjs,
  scripts/diag-funil-ativacao.mjs.

MÉTODO (boas práticas de mercado — cite-as no relatório):
1. Curva de retenção por turma do primeiro pagamento (cohort analysis).
2. Separar cancelamento voluntário de involuntário (cartão recusado,
   pagamento avulso não refeito) — metodologia ProfitWell/Paddle Retain e Recurly.
3. Achar o "momento aha": o comportamento nos primeiros dias que mais separa
   quem renova de quem não renova (ex.: nº de ofertas publicadas, grupos
   conectados, lojas cadastradas, dias com WhatsApp conectado) — abordagem
   Amplitude/Reforge de métrica de ativação.
4. Nota de saúde da cliente (customer health score, Gainsight) com sinais de uso
   que já existem no banco (MessageLog success, WaConnectionEvent, credenciais).
5. Coleta do motivo DENTRO do produto, no momento de cancelar ou vencer (uma
   pergunta de clique único), em vez de e-mail.

REGRAS
- Amostra pequena (30): dizer o intervalo de incerteza, nunca vender correlação
  como causa. Toda conclusão com DADO; hipótese dita como hipótese.
- Dados da VPS: me peça o MÍNIMO — prefira os scripts diag-* read-only, um
  comando por pergunta, saída filtrada. Se faltar script, escreva um read-only,
  com teste, em PR contra develop.
- Nunca mostrar telefone/e-mail de cliente em texto público ou PR.
- Nenhum processo novo; nenhuma mudança de cobrança sem me perguntar.

ENTREGA: (1) diagnóstico com números — quanto do não-renovar é voluntário ×
involuntário e qual comportamento prevê renovação; (2) até 5 intervenções em
ordem de impacto/esforço, cada uma com a métrica que prova se funcionou;
(3) o que implementar primeiro, perguntando antes se é agora ou backlog.
```

## Prompt D — estudo do funil comercial

```
Repo flavia-vale/wabot. Leia AGENTS.md, docs/rca/admin.md (seção do funil),
docs/rca/seo-marketing.md e as seções 4 e 4b de
docs/marketing/SERIE_HISTORICA_SEO.md antes de tudo.

PROBLEMA (dados de 23/09, últimos 30 dias): 205 cadastros → 18 pagantes (8,8%).
54 cadastros (26%) vieram do ChatGPT; o Google traz a maior parte das visitas.
Teste grátis: 7 dias do Pro, sem cartão. Depois Basic R$39 ou Pro R$69 a cada
30 dias. Muita gente entra e pouca compra — quero saber ONDE e POR QUÊ.

O QUE JÁ EXISTE (usar antes de criar): /admin/funil com 7 etapas (criou conta →
conectou WhatsApp → cadastrou loja → escolheu grupos → teve oferta publicada →
começou pagamento → pagou) e 9 motivos de parada; scripts/diag-funil-ativacao.mjs,
scripts/diag-origem-cadastros.mjs, scripts/diag-paginas-seo.mjs (funil por página).

MÉTODO (boas práticas de mercado — cite-as no relatório):
1. AARRR / Pirate Metrics (Dave McClure): medir cada passagem e atacar só a
   maior perda.
2. Product-Led Growth (Wes Bush) — tempo até o primeiro valor: quanto tempo leva
   do cadastro à primeira oferta publicada, e quantos nunca chegam lá no trial.
3. Onboarding "bowling alley" (Wes Bush): um caminho mínimo até o valor, com os
   obstáculos da primeira sessão (QR, código de acesso da loja, escolha de grupos).
4. Funil por origem e por página de entrada: ChatGPT × Google × direto, e qual
   página traz quem PAGA, não só quem se cadastra.
5. Benchmark de conversão de teste grátis sem cartão: só usar número com fonte e
   data (ex.: ChartMogul, OpenView); se não achar fonte confiável, não comparar.

REGRAS
- A etapa com maior perda absoluta primeiro; dado antes de opinião; hipótese dita
  como hipótese. Amostra pequena: dizer a incerteza.
- Clientes não respondem e-mail: não basear em pesquisa por e-mail.
- Dados da VPS: me peça o MÍNIMO, um comando por pergunta, saída filtrada,
  preferindo os scripts diag-* read-only.
- Nunca mostrar telefone/e-mail de cliente em texto público ou PR. Linguagem leiga
  em qualquer tela (regra do AGENTS.md). Nada de promessa de "não bane".
- Mudanças: branch a partir de develop, PR contra develop; nenhum processo novo.

ENTREGA: (1) o funil em números com a maior perda destacada e a divisão por
origem; (2) os 3 principais motivos de parada com a quantidade de pessoas em
cada; (3) até 5 intervenções em ordem de impacto/esforço, cada uma com a métrica
de sucesso; (4) perguntar se implemento agora ou deixo como tarefa pendente.
```
