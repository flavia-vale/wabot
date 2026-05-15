# Sprint orgânica IA — Semana 2026-05-14

## Ativos publicados/criados

1. Página/artigo indexável: `/blog/conferir-converter-link-afiliado-whatsapp`
   - Tema: conversão e conferência de link de afiliado antes de divulgar no WhatsApp.
   - SEO on-page: title, description, canonical, H1, resposta direta, CTA, FAQ visível, schema `Article` e `FAQPage`.
   - Mensagens obrigatórias cobertas: link monetizado/tag/código de afiliado, risco de perder comissão por link errado e ausência de promessa de integração não aprovada.

2. Página/artigo indexável: `/blog/bot-para-afiliados-whatsapp-grupos-cupons`
   - Tema: bot para afiliados, grupos de cupons, espelhamento e distribuição responsável.
   - SEO on-page: title, description, canonical, H1, resposta direta, CTA, FAQ visível, schema `Article` e `FAQPage`.
   - Mensagens obrigatórias cobertas: automação como apoio operacional, conferência humana prévia e respeito às regras de grupos/plataformas.

3. Material/checklist indexável: `/materiais/checklist-divulgacao-ofertas-grupos-whatsapp`
   - Tema: checklist público para validar oferta, link monetizado, copy, grupos e medição antes de escalar divulgação.
   - SEO on-page: title, description, canonical, H1, resposta direta, CTA, FAQ visível, schema `Article` e `FAQPage`.
   - Função no cluster: apoiar SEO/AEO e linkagem interna entre afiliados, bot para afiliados e automação em grupos.

4. Sitemap atualizado
   - Inclusão das três rotas novas em `dashboard/app/sitemap.js`.
   - `lastModified` ajustado para `2026-05-14`.

5. Checklist de indexação criado
   - Arquivo: `docs/marketing/ORGANICO_SPRINT1_INDEXACAO_CHECKLIST.md`.

## Estratégia e keywords priorizadas

### Cluster afiliados/conversão

- `como padronizar divulgacao de afiliado no whatsapp`
- `bot ofertas afiliados whatsapp`
- `bot para afiliados whatsapp`
- `converter link de afiliado whatsapp`
- `conferir link monetizado afiliado`
- `link de afiliado errado perder comissão`

### Cluster automação/espelhamento/distribuição

- `como automatizar divulgacao em grupos whatsapp`
- `como postar em varios grupos whatsapp ao mesmo tempo`
- `como escalar grupos de ofertas sem equipe`
- `espelhar grupos whatsapp`
- `grupos de cupons whatsapp`

### Cluster material/checklist

- `checklist divulgar ofertas whatsapp`
- `checklist grupos de cupons`
- `como aumentar conversao em grupos de cupons`
- `como centralizar links de oferta para grupos`

## Validações locais executadas

- Branch criada: `codex/organic-marketing-sprint-1` a partir de branch local `develop` criada no mesmo commit base disponível no ambiente, porque o repo local não possui remote `origin` configurado.
- Leitura de instruções: `AGENTS.md`, `dashboard/AGENTS.md`, documentação local do Next em `dashboard/node_modules/next/dist/docs/`.
- Leitura de insumos disponíveis: `docs/marketing/seo_backlog_50_keywords.csv`, `docs/marketing/utm_taxonomia_padrao.csv`, `dashboard/app/sitemap.js`, `dashboard/app/robots.js`.
- Observação: `.agents/product-marketing.md` e `docs/marketing/PLANO_MARKETING_ORGANICO_EXECUTAVEL_IA.md` não existem neste checkout local; a sprint foi baseada nos arquivos disponíveis e no backlog já versionado.
- Checks locais rodados ao final estão listados na resposta do PR e na resposta final.

## Validações esperadas em staging na porta 3006

- Abrir `http://178.105.54.0:3006/blog/conferir-converter-link-afiliado-whatsapp` e confirmar status 200, layout, H1, FAQ, CTA e links internos.
- Abrir `http://178.105.54.0:3006/blog/bot-para-afiliados-whatsapp-grupos-cupons` e confirmar status 200, layout, H1, FAQ, CTA e links internos.
- Abrir `http://178.105.54.0:3006/materiais/checklist-divulgacao-ofertas-grupos-whatsapp` e confirmar status 200, layout, H1, FAQ, CTA e links internos.
- Abrir `http://178.105.54.0:3006/sitemap.xml` e confirmar presença das três rotas novas.
- Conferir visual mobile e desktop.
- Conferir claims comerciais sensíveis antes de qualquer publicação externa.

## URLs prontas para inspeção no Google Search Console

Após aprovação em staging e disponibilização em produção:

- `http://espelhagrupos.com.br/blog/conferir-converter-link-afiliado-whatsapp`
- `http://espelhagrupos.com.br/blog/bot-para-afiliados-whatsapp-grupos-cupons`
- `http://espelhagrupos.com.br/materiais/checklist-divulgacao-ofertas-grupos-whatsapp`

## Pacote social gerado

### 3 posts de LinkedIn

#### LinkedIn 1 — Afiliados e comissão

Texto:

> Afiliado não perde comissão só por falta de tráfego. Às vezes perde por operação.
>
> Antes de divulgar uma oferta em grupos de WhatsApp, vale conferir:
> - se o link monetizado abre no celular;
> - se a tag/código de afiliado continua no destino final;
> - se cupom, preço e estoque batem com a copy;
> - se o grupo certo vai receber a oferta certa.
>
> O BOTinho entra depois dessa validação: ajuda a organizar e distribuir mensagens conferidas, sem depender de copia-e-cola.
>
> Guia novo: http://espelhagrupos.com.br/blog/conferir-converter-link-afiliado-whatsapp?utm_source=linkedin&utm_medium=social-organic&utm_campaign=organic-marketing-sprint-1&utm_content=post-link-afiliado

#### LinkedIn 2 — Grupos de cupons

Texto:

> Grupos de cupons escalam quando deixam de ser improviso.
>
> O fluxo saudável é simples:
> 1. curar oferta;
> 2. conferir link de afiliado;
> 3. padronizar copy;
> 4. escolher grupos com contexto;
> 5. automatizar a distribuição com responsabilidade.
>
> Automação não substitui revisão. Ela escala o processo que já está correto.
>
> Artigo novo: http://espelhagrupos.com.br/blog/bot-para-afiliados-whatsapp-grupos-cupons?utm_source=linkedin&utm_medium=social-organic&utm_campaign=organic-marketing-sprint-1&utm_content=post-bot-afiliados

#### LinkedIn 3 — Checklist operacional

Texto:

> Antes de ligar qualquer rotina de espelhamento no WhatsApp, responda:
>
> - A oferta está válida?
> - O link monetizado tem tag/código de afiliado?
> - A copy não promete mais do que a oferta entrega?
> - O grupo permite esse tipo de conteúdo?
> - Existe UTM ou tag para medir depois?
>
> Transformei isso em um checklist público para afiliados e admins de grupos.
>
> Material: http://espelhagrupos.com.br/materiais/checklist-divulgacao-ofertas-grupos-whatsapp?utm_source=linkedin&utm_medium=social-organic&utm_campaign=organic-marketing-sprint-1&utm_content=post-checklist

### 3 legendas de Instagram

#### Instagram 1

Perder comissão por link errado dói porque parece problema de venda, mas é problema de processo. Antes de publicar em grupos de WhatsApp, confira tag/código de afiliado, destino final, cupom e preço no celular. Guia completo no link da bio.

UTM para bio/sticker: `http://espelhagrupos.com.br/blog/conferir-converter-link-afiliado-whatsapp?utm_source=instagram&utm_medium=social-organic&utm_campaign=organic-marketing-sprint-1&utm_content=legenda-link-afiliado`

#### Instagram 2

Bot para afiliados não é licença para spam. É organização para distribuir ofertas revisadas em grupos certos, com frequência responsável e menos copia-e-cola. Veja o fluxo recomendado no artigo novo.

UTM para bio/sticker: `http://espelhagrupos.com.br/blog/bot-para-afiliados-whatsapp-grupos-cupons?utm_source=instagram&utm_medium=social-organic&utm_campaign=organic-marketing-sprint-1&utm_content=legenda-bot-afiliados`

#### Instagram 3

Checklist antes de divulgar oferta em grupos:

1. preço e estoque;
2. link monetizado;
3. copy sem promessa exagerada;
4. grupo com contexto;
5. UTM ou tag de campanha.

Salve para usar antes do próximo disparo.

UTM para bio/sticker: `http://espelhagrupos.com.br/materiais/checklist-divulgacao-ofertas-grupos-whatsapp?utm_source=instagram&utm_medium=social-organic&utm_campaign=organic-marketing-sprint-1&utm_content=legenda-checklist`

### 1 thread para X/Twitter

1/7 Afiliado que divulga em WhatsApp precisa tratar link como ativo financeiro, não como detalhe operacional.

2/7 Antes de postar, abra a URL no celular e confira se o destino é o produto certo.

3/7 Depois confira se a tag, código ou parâmetro de afiliado continua presente após redirecionamentos.

4/7 Link limpo, encurtador quebrado ou cupom divergente podem significar comissão perdida e confiança menor no grupo.

5/7 Automação entra depois: distribuir mensagens já revisadas para grupos certos, com frequência responsável.

6/7 Checklist público para validar oferta, link, copy, grupos e medição antes de escalar: http://espelhagrupos.com.br/materiais/checklist-divulgacao-ofertas-grupos-whatsapp?utm_source=x&utm_medium=social-organic&utm_campaign=organic-marketing-sprint-1&utm_content=thread-checklist

7/7 Regra prática: não automatize uma oferta que você ainda não conferiu manualmente.

### 1 roteiro curto de Reels/Shorts

Título: “O erro que faz afiliado perder comissão no WhatsApp”

- 0s-3s: “Você pode estar vendendo e mesmo assim perdendo comissão.”
- 3s-8s: Mostrar tela simbólica de link. “Se o link final não tem sua tag ou código de afiliado, a venda pode não ser atribuída.”
- 8s-15s: “Antes de postar em grupos: abra no celular, confira destino, preço, cupom e parâmetro de afiliado.”
- 15s-22s: “Depois sim, use automação para distribuir a mensagem conferida nos grupos certos.”
- 22s-30s: “Checklist gratuito no link da bio.”

UTM para bio/sticker: `http://espelhagrupos.com.br/materiais/checklist-divulgacao-ofertas-grupos-whatsapp?utm_source=instagram&utm_medium=social-organic&utm_campaign=organic-marketing-sprint-1&utm_content=reels-checklist`

### 5 comentários úteis para comunidades, sem spam

1. “Um ponto que costuma passar batido: antes de escalar divulgação, vale abrir o link no celular e conferir se a tag/código de afiliado continua depois do redirecionamento. Isso evita diagnosticar como ‘baixa conversão’ algo que era link errado.”

2. “Para grupos de cupons, eu separaria processo em duas etapas: validação da oferta e só depois distribuição. Automatizar antes de conferir preço, cupom e link monetizado tende a escalar erro.”

3. “Uma rotina simples que ajuda: registrar oferta, link aprovado, grupo de destino, horário e UTM/tag interna. Mesmo em operação pequena, isso facilita entender o que funcionou.”

4. “Cuidado para não tratar bot como substituto de permissão. Se o grupo não aceita aquele tipo de oferta ou a frequência incomoda, automação só acelera o problema.”

5. “Para quem divulga afiliado no WhatsApp, o checklist mínimo é: destino correto, parâmetro de afiliado, preço/cupom, copy honesta e grupo compatível com o nicho.”

## Ações executadas automaticamente pela IA

- Criada branch `codex/organic-marketing-sprint-1` no checkout local.
- Criadas três rotas públicas indexáveis para o primeiro ciclo orgânico.
- Adicionados title, description, canonical, H1, resposta direta, CTA, FAQ visível e JSON-LD coerente com o conteúdo visível.
- Atualizado sitemap com as novas rotas públicas.
- Criado checklist de indexação em `docs/marketing/`.
- Gerado pacote de distribuição orgânica com UTMs.
- Executados checks locais aplicáveis sem tocar produção, `.env`, banco, portas, Prisma, PM2, scripts de deploy ou configurações sensíveis.

## AÇÕES HUMANAS pendentes

- [ ] Revisar e aprovar o PR contra `develop`.
- [ ] Validar as páginas novas em `http://178.105.54.0:3006`.
- [ ] Conferir visual, copy, CTAs e claims comerciais.
- [ ] Inspecionar cada URL nova no Google Search Console.
- [ ] Solicitar indexação das URLs aprovadas no Google Search Console.
- [ ] Publicar/agendar posts sociais aprovados.
- [ ] Aprovar ou corrigir claims comerciais sensíveis.
- [ ] Só considerar produção depois de staging aprovado.

---

## Continuação da sprint — 2026-05-14 (turno 2)

### O que já existia antes

- Estrutura de sprint orgânica já iniciada com cluster afiliados/conversão e cluster de automação/espelhamento/distribuição.
- Três ativos indexáveis já publicados no ciclo anterior e checklist de indexação existente.

### O que foi continuado

- Continuidade do cluster de afiliados/conversão com novo ativo pendente do backlog (`bot ofertas afiliados whatsapp`).
- Manutenção explícita do plano de automação/espelhamento/distribuição no conteúdo da LP (sem substituir por afiliados).

### O que foi criado agora

1. Nova LP indexável: `/bot-ofertas-afiliados-whatsapp`
   - Keyword principal: `bot ofertas afiliados whatsapp`.
   - Inclui title, description, canonical, H1 (via template), FAQ visível (via template) e schemas já aplicados no template (`FAQPage`, `HowTo`, `Product`).
   - Conteúdo inclui: conferência/conversão de link monetizado, tag/código de afiliado, risco de perda de comissão por link errado e sem promessa de integração não aprovada.

2. Sitemap atualizado
   - Rota nova adicionada em `dashboard/app/sitemap.js`.

### URLs/rotas novas

- `http://espelhagrupos.com.br/bot-ofertas-afiliados-whatsapp`

### Keywords trabalhadas

- `bot ofertas afiliados whatsapp`
- `como estruturar funil de afiliados em grupos` (apoio semântico)
- `como automatizar divulgacao em grupos whatsapp` (apoio semântico)

### Links internos adicionados

- Navegação global/template da própria LP (herdada de `LpTemplate`) para rotas centrais e CTA de captura.

### Checklist de indexação (incremental)

- [ ] Validar `http://178.105.54.0:3006/bot-ofertas-afiliados-whatsapp` em staging.
- [ ] Confirmar presença da rota em `http://178.105.54.0:3006/sitemap.xml`.
- [ ] Inspecionar URL em Search Console após aprovação e ida para produção.

### Pacote social gerado (incremental)

- Gancho LinkedIn: “Link de afiliado certo + rotina certa = comissão protegida em escala.”
- URL sugerida com UTM:
  `http://espelhagrupos.com.br/bot-ofertas-afiliados-whatsapp?utm_source=linkedin&utm_medium=social-organic&utm_campaign=organic-marketing-sprint-1&utm_content=post-bot-ofertas-afiliados`

### Validações locais

- Atualização de arquivos markdown e rotas Next sem tocar `.env`, banco, portas, Prisma, PM2 ou deploy.
- Verificação de sintaxe básica por lint local focado nos arquivos alterados.

### Validações esperadas em staging 3006

- Abrir `http://178.105.54.0:3006/bot-ofertas-afiliados-whatsapp` e validar conteúdo/CTA/FAQ.
- Confirmar sitemap com a nova rota.

### Ações executadas automaticamente pela IA

- Criação de nova rota pública da LP de afiliados.
- Inclusão de configuração SEO/conteúdo no `LP_CONFIG`.
- Atualização do sitemap e documentação de sprint.

### AÇÕES HUMANAS pendentes

- [ ] Revisar e aprovar o PR contra `develop`.
- [ ] Validar as páginas novas em `http://178.105.54.0:3006`.
- [ ] Conferir visual, copy, CTAs e claims comerciais.
- [ ] Inspecionar cada URL nova no Google Search Console.
- [ ] Solicitar indexação das URLs aprovadas no Google Search Console.
- [ ] Publicar/agendar posts sociais aprovados.
- [ ] Aprovar ou corrigir claims comerciais sensíveis.
- [ ] Só considerar produção depois de staging aprovado.
