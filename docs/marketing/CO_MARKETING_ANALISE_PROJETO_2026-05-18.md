# Co-marketing — análise completa de parcerias para BOTinho/WABOT

Data: 2026-05-18
Owner sugerido: Growth/Parcerias
Skill aplicada: `co-marketing`
Escopo: BOTinho/WABOT — bot para afiliados e operadores de grupos/canais de ofertas no WhatsApp.

---

## Análise de risco (STRICT)

- **Erros fatais:** risco técnico nulo; este entregável é documental e não altera runtime, build, dependências, banco, API ou componentes.
- **Breaking changes:** inexistentes; não há mudança em contratos, schemas, rotas, props, portas ou integrações.
- **Efeito cascata:** baixo; a única influência é estratégica/comercial. A execução das campanhas deve respeitar a taxonomia de eventos e UTMs já documentada em `docs/marketing/event-taxonomy-v1.md` e `docs/marketing/utm_taxonomia_padrao.csv`.
- **Isolamento de ambiente:** nenhuma ação externa foi disparada; qualquer landing page, cupom, tracking ou automação derivada deste plano deve sair por `develop` e ser validada em staging (`http://178.105.54.0:3006`) antes de produção.
- **Bloqueio:** não disparar outreach em massa, webhook, automação WhatsApp/e-mail, campanha paga ou alteração de checkout sem aprovação manual, revisão de opt-in/LGPD, UTMs e plano de mensuração. Parcerias com concorrentes diretos devem ser tratadas como benchmark, não como co-marketing operacional.

---

## 1. Diagnóstico executivo

O BOTinho tem uma tese forte para co-marketing porque atua em um ponto operacional específico: reduzir cópia-e-cola, padronizar divulgação e espelhar ofertas em grupos/canais de WhatsApp para afiliados. Isso cria parceiros naturais em quatro frentes:

1. **Curadores/admins de grupos de ofertas** — têm audiência e dor operacional imediata.
2. **Educadores/comunidades de afiliados** — precisam de ferramentas e estudos práticos para seus alunos/membros.
3. **Plataformas adjacentes de e-commerce/checkout/afiliados** — têm base interessada em vender por social commerce, mas não necessariamente resolvem operação de grupos.
4. **Ferramentas complementares de WhatsApp, CRM, analytics e criativos** — compartilham o mesmo ICP, sem disputar exatamente o mesmo orçamento.

A recomendação é executar co-marketing em ondas: primeiro parcerias leves com leads já mapeados em CRM, depois campanhas de conteúdo e workshops com educadores, e só então buscar integrações/marketplaces com plataformas maiores.

---

## 2. Contexto de mercado e sinais externos

### 2.1 Por que WhatsApp e grupos/canais são eixo de parceria

- O Painel TIC 2026 aponta WhatsApp como canal de uso diário massivo no Brasil: 91% dos usuários de Internet de 16+ acessam diariamente, somando “praticamente o tempo todo”, “várias vezes ao dia” e “pelo menos uma vez por dia”. Fonte: [CETIC.br/NIC.br — Painel TIC Integridade da Informação 2026](https://www.cetic.br/media/docs/publicacoes/2/pt-br/20260408150919/painel_tic_integridade_informacao_2026_livro_pt.pdf).
- No mesmo relatório, grupos/canais de **negociações ou promoções** aparecem como categoria relevante em aplicativos de mensagem: 27% no WhatsApp e 19% no Telegram entre usuários semanais desses apps. Fonte: [CETIC.br/NIC.br — gráfico de tipos de grupo/canais](https://www.cetic.br/media/docs/publicacoes/2/pt-br/20260408150919/painel_tic_integridade_informacao_2026_livro_pt.pdf).
- A landing pública do BOTinho posiciona o produto como “bot para afiliados no WhatsApp”, com foco em transformar promoções de terceiros em vendas no próprio grupo. Fonte: [espelhagrupos.com.br](https://espelhagrupos.com.br/).

### 2.2 Sinais de ecossistema e cuidado competitivo

Há várias ferramentas concorrentes ou parcialmente sobrepostas posicionadas em “automação de afiliados para WhatsApp/Telegram” (ex.: Shozap, ProAfiliados, IA Divulgadora, Afilimais, LucreShop, DivulgaKaloferta, FluxoPromo, Auto Afiliados). Esses players validam a demanda, mas **não devem ser prioridade de co-marketing**, pois disputam a mesma intenção e podem capturar leads de alto valor.

Use esses players para:

- benchmark de promessas, pricing e objeções;
- páginas comparativas/alternativas;
- pesquisa de lacunas de posicionamento;
- inteligência de keywords.

Não usar como parceiros de campanhas conjuntas sem acordo comercial explícito e proteção de lead sharing.

---

## 3. ICP de co-marketing

### ICP primário — Admin/curador de ofertas

- Opera grupos/canais no WhatsApp, Telegram ou Instagram.
- Publica links de Shopee, Amazon, Mercado Livre, Magalu, AliExpress, infoprodutos ou nichos locais.
- Sofre com repetição manual, falta de padrão, risco de perder cupom relâmpago e inconsistência de postagem.
- Valor do BOTinho: produtividade, consistência, timing e previsibilidade operacional.

### ICP secundário — Educador/comunidade de afiliados

- Ensina afiliados iniciantes/intermediários a vender com grupos, social commerce e conteúdo de ofertas.
- Precisa de cases, aulas práticas, ferramentas com teste guiado e material de apoio.
- Valor do BOTinho: demonstração concreta de “operação enxuta” para alunos.

### ICP terciário — Plataforma adjacente

- Atende lojistas, afiliados, produtores, criadores, agências ou social sellers.
- Pode ter programa de parceiros, marketplace de apps, blog, newsletter ou webinars.
- Valor do BOTinho: conteúdo e caso de uso sobre WhatsApp/grupos sem exigir que a plataforma resolva essa camada internamente.

---

## 4. Mapa de parceiros por categoria

| Categoria | Exemplos de alvos | Fit | Risco | Melhor campanha inicial |
|---|---:|---:|---:|---|
| Admins de grupos de ofertas | Leads do lote `dia8_cold_outreach_parceiros` | Muito alto | Baixo/médio por opt-in | Piloto guiado + case conjunto |
| Curadores nichados | Beleza, pet, autopeças, supermercado, moda, eletrônicos | Alto | Baixo | Série “Como escalar grupo de [nicho]” |
| Educadores de afiliados | Cursos, mentorias, comunidades, creators de YouTube/Instagram/TikTok | Alto | Médio por reputação | Workshop/aula prática com cupom exclusivo |
| Plataformas de e-commerce | Nuvemshop, Yampi e ecossistemas similares | Médio/alto | Médio por ciclo longo | Conteúdo “WhatsApp como canal de recompra/ofertas” |
| Plataformas de checkout/infoproduto | Kiwify, Hotmart, Eduzz, Monetizze, Kirvano, Braip | Médio | Médio por ICP amplo | Guia para afiliados divulgarem sem operação manual |
| Ferramentas oficiais de WhatsApp/CRM | Blip, Zenvia, CRMs e atendimento | Médio | Alto se mensagem confundir API oficial vs automação de grupos | Conteúdo educativo de segurança/boas práticas |
| Ferramentas de criativos/landing/links | Encurtadores, criadores de criativos, Linktree/Beacons-like, analytics | Médio | Baixo | Bundle de checklist + template + teste BOTinho |
| Concorrentes diretos | Shozap, ProAfiliados, IA Divulgadora, Afilimais etc. | Baixo para parceria | Alto | Apenas benchmark/comparativos |

---

## 5. Scoring de fit de parceiros

Critérios da skill `co-marketing`, adaptados ao BOTinho:

| Critério | Peso | Como pontuar 1–5 |
|---|---:|---|
| Audience fit | 25% | O público opera ou quer operar grupos/canais de ofertas? |
| Audience size | 15% | Há base relevante em WhatsApp, Telegram, Instagram, newsletter ou comunidade? |
| Brand alignment | 15% | O parceiro evita spam, pirâmide, promessa irreal e práticas anti-plataforma? |
| Engagement quality | 15% | Há comentários, compartilhamentos, frequência e resposta real? |
| Reciprocity potential | 15% | BOTinho entrega valor claro ao parceiro: conteúdo, comissão, case, ferramenta? |
| Ease of execution | 15% | O parceiro tem canal de contato claro, histórico de collab ou baixa burocracia? |

### Fórmula simples

`score_final = audience_fit*0,25 + audience_size*0,15 + brand_alignment*0,15 + engagement_quality*0,15 + reciprocity*0,15 + ease*0,15`

Multiplicar por 20 para converter para escala 0–100.

### Interpretação

- **85–100:** prioridade A; abordar com proposta específica e piloto de 7 dias.
- **70–84:** prioridade B; nutrir com conteúdo, aula ou diagnóstico gratuito.
- **55–69:** prioridade C; manter em lista, usar apenas se houver nicho estratégico.
- **<55:** não priorizar.

---

## 6. Análise dos ativos internos do BOTinho para co-marketing

### Ativos existentes

1. **CRM de parceiros já iniciado:** o lote de cold outreach lista 100 leads, com 37 segmento A, 53 segmento B e 10 segmento C.
2. **Templates de outreach prontos:** sequência inicial já existe para abordagem manual/CRM.
3. **Landing e SEO programático:** há páginas por dor, cidade, nicho, comparativos, materiais e ferramentas.
4. **Ferramentas gratuitas:** calculadoras e checklists podem virar “moeda” para parceiros.
5. **Conteúdo anti-ban/segurança:** diferencial importante para reduzir objeção de risco.
6. **Taxonomia de eventos:** base para medir funil de parcerias com UTM e eventos.

### Lacunas a resolver antes de escalar

- Falta uma **landing canônica de parceria**: `/parcerias` ou `/parceiros` com proposta, termos básicos, formulário e exemplos.
- Falta um **partner kit** com logo, copy curta, prints, bullets, FAQ e instrução de UTM.
- Falta uma **oferta de reciprocidade clara**: comissão, cupom, extensão de trial, diagnóstico, aula exclusiva ou caso publicado.
- Falta um **score padronizado** incorporado ao pipeline além do lote inicial.
- Falta uma **política de lead sharing** pronta para campanhas com webinars/e-books.

---

## 7. Priorização de parceiros

### Onda 1 — parceiros de execução rápida (0–14 dias)

Priorizar os 12 seeds públicos verificados e os segmentos A do lote de outreach:

- administradores com WhatsApp + Telegram;
- curadores Shopee/Amazon/Mercado Livre;
- páginas Linktree com grupos ativos;
- comunidades que já vendem por links de afiliado;
- perfis com promessa de “ofertas, achadinhos, cupons, promoções”.

**Objetivo:** obter 3–5 pilotos guiados e 1–2 depoimentos/cases.

**Oferta:** “piloto assistido de 7 dias para reduzir copia-e-cola e publicar com padrão em poucos grupos primeiro”.

### Onda 2 — creators e educadores (15–45 dias)

Buscar creators que ensinam:

- afiliado Shopee/Amazon/Mercado Livre;
- renda extra com grupos;
- achadinhos no Instagram/TikTok;
- automação simples para afiliados;
- criação de comunidade no WhatsApp/Telegram.

**Objetivo:** webinars, aulas práticas e bundles.

**Oferta:** cupom exclusivo + aula “operação de ofertas em grupos sem equipe”.

### Onda 3 — plataformas adjacentes (45–90 dias)

Buscar plataformas com programas de parceiros, app stores ou conteúdo para lojistas/afiliados.

- Nuvemshop tem programa de parceiros/associados e pauta de venda via WhatsApp. Fontes: [parceiros Nuvemshop](https://www.nuvemshop.com.br/parceiros) e [canal WhatsApp Nuvemshop](https://www.nuvemshop.com.br/canais/whatsapp).
- Yampi divulga programa de afiliados e parceiros tech com menção a co-marketing em seu ecossistema. Fontes: [afiliados Yampi](https://www.yampi.com.br/afiliados) e [parceiros tech Yampi](https://www.yampi.com.br/parceiros-tech).
- Zenvia e Blip são referências em WhatsApp oficial/atendimento; podem ser parceiros de educação sobre boas práticas, mas exigem cuidado para não confundir automação de grupos com API oficial. Fontes: [Zenvia WhatsApp](https://zenvia.com/whatsapp/) e [Blip WhatsApp](https://www.blip.ai/whatsapp/).

**Objetivo:** guest posts, webinars, listagens de app/integração futura ou co-branded guide.

---

## 8. Campanhas recomendadas por tipo

### 8.1 Content partnerships

| Campanha | Parceiro ideal | Esforço | Métrica principal | Observação |
|---|---|---:|---|---|
| Post coautorado “Como operar grupo de ofertas sem virar refém do copia-e-cola” | Educador/creator | Baixo | Visitas qualificadas + signup | Bom para SEO e autoridade |
| Guia “Checklist de operação WhatsApp para afiliados” | Comunidade de afiliados | Médio | Downloads + MQL | Pode reaproveitar materiais existentes |
| Estudo “Quanto tempo um admin perde copiando oferta manualmente?” | Admins/cases | Médio | Leads + PR/social proof | Usar dados reais só com consentimento |
| Newsletter swap “3 erros que travam grupos de ofertas” | Creator/newsletter | Baixo | Cliques com UTM | Cada um mantém sua base |

### 8.2 Webinars e eventos

| Campanha | Parceiro ideal | Esforço | Métrica principal | Formato |
|---|---|---:|---|---|
| Workshop “Grupo de ofertas em 7 dias” | Educador afiliado | Médio | Trial starts | Aula prática + Q&A |
| Painel “WhatsApp, Telegram ou canal: onde postar ofertas?” | Multi-parceiro | Médio | Leads totais | Bom para atrair comunidades |
| Clínica ao vivo de operação | Admins selecionados | Alto | Ativação | Diagnóstico de rotina e configuração |

### 8.3 Product/integration marketing

| Campanha | Parceiro ideal | Esforço | Métrica principal | Formato |
|---|---|---:|---|---|
| Case “antes/depois” | Admin A validado | Médio | Conversão trial→ativo | Depoimento + números operacionais |
| Better together page | Plataforma adjacente | Baixo/médio | Signup parceiro | Página com UTM e FAQ |
| Cupom de parceiro | Creator/comunidade | Baixo | Trial + receita | Exige regras claras de attribution |
| Bundle checklist + teste guiado | Educador/comunidade | Médio | MQL→trial | Boa primeira oferta |

### 8.4 Community/social

| Campanha | Parceiro ideal | Esforço | Métrica principal | Formato |
|---|---|---:|---|---|
| Live/AMA “pergunte sobre operação de grupos” | Comunidade | Baixo | Inscritos + perguntas | Gera insight de objeções |
| Giveaway de diagnóstico operacional | Creator | Baixo | Leads qualificados | Evitar atrair curiosos sem grupo |
| Takeover de stories com bastidores | Admin parceiro | Baixo | Cliques + DMs | Mostrar rotina real |

---

## 9. Ideias de campanhas específicas

### Campanha 1 — “Piloto 7 dias: menos copia-e-cola, mais consistência”

- **Parceiro:** admin/curador de grupo segmento A.
- **Promessa:** testar BOTinho em poucos grupos sem mexer na operação inteira.
- **Ativos:** checklist, call de setup, cupom, UTM único.
- **Entregável conjunto:** mini-case com rotina antes/depois.
- **Métrica primária:** `trial_started` por parceiro.
- **Guarda-corpo:** `first_connection_success` e `first_send_success`.

### Campanha 2 — “Aula aberta: como montar esteira de ofertas no WhatsApp”

- **Parceiro:** educador de afiliados.
- **Promessa:** ensinar rotina prática, não “ganhar dinheiro fácil”.
- **Ativos:** slides, demo, cupom, replay por 7 dias.
- **Métrica primária:** leads inscritos.
- **Guarda-corpo:** taxa de ativação do trial.

### Campanha 3 — “Benchmark de operação de grupos de ofertas”

- **Parceiro:** 3–5 admins que topem responder survey anônimo.
- **Promessa:** relatório com tempo gasto, número de grupos, canais, gargalos, medo de ban, ferramentas usadas.
- **Ativos:** landing gated + relatório PDF + posts sociais.
- **Métrica primária:** downloads qualificados.
- **Guarda-corpo:** qualidade de MQL e respostas completas.

### Campanha 4 — “Kit nichado: beleza/pet/autopeças/supermercado”

- **Parceiro:** curador vertical.
- **Promessa:** mostrar como operar ofertas de um nicho com calendário, copy e regras.
- **Ativos:** template de calendário + lista de boas práticas + trial.
- **Métrica primária:** conversão por nicho.
- **Guarda-corpo:** churn inicial por desalinhamento de expectativa.

### Campanha 5 — “Boas práticas anti-ban para afiliados”

- **Parceiro:** ferramenta oficial de WhatsApp/CRM ou comunidade séria.
- **Promessa:** educação de segurança e responsabilidade operacional.
- **Ativos:** checklist anti-ban, FAQ, webinar.
- **Métrica primária:** leads qualificados.
- **Guarda-corpo:** não prometer invulnerabilidade a bloqueio.

---

## 10. Proposta de valor combinada por parceiro

### Com admin de grupo

> “Você traz a operação real e a audiência; o BOTinho traz automação guiada, padronização e suporte para transformar isso em case.”

### Com educador

> “Você ensina a estratégia; o BOTinho demonstra a rotina operacional que o aluno consegue testar sem montar gambiarra.”

### Com plataforma adjacente

> “Vocês têm lojistas/afiliados que querem vender em canais sociais; o BOTinho cobre a camada de operação de grupos e ofertas no WhatsApp.”

### Com ferramenta de WhatsApp/CRM

> “Vocês educam empresas sobre maturidade de atendimento/vendas; o BOTinho contribui com a visão de operação responsável para comunidades e ofertas.”

---

## 11. Assets necessários antes da primeira onda

### Obrigatórios

- Landing simples de parceiros com:
  - para quem é;
  - tipos de parceria;
  - benefícios;
  - formulário;
  - FAQ de segurança;
  - política de UTM/cupom;
  - aviso de que piloto começa em staging/validação controlada quando houver implementação.
- Partner kit em PDF/Markdown:
  - descrição curta do BOTinho;
  - bullets de benefício;
  - prints aprovados;
  - CTA padrão;
  - logo;
  - termos de uso de marca;
  - instrução de divulgação.
- Planilha de pipeline com scoring da seção 5.
- Cupom/UTM por parceiro.
- Termo simples para lead sharing.

### Desejáveis

- Página “cases” com template padronizado.
- Checklist em PDF para download.
- Roteiro de webinar de 45 minutos.
- Email/DM follow-up pós-evento.
- Dashboard mensal de co-marketing.

---

## 12. Lead ownership e acordo simples

### Regras recomendadas

1. **Newsletter swap:** cada parceiro mantém seus leads; medir apenas cliques/UTMs.
2. **Webinar co-branded:** leads inscritos podem ser compartilhados se houver consentimento explícito no formulário.
3. **Case conjunto:** dados só entram com autorização e podem ser anonimizados.
4. **Cupom de parceiro:** attribution pelo cupom + UTM; evitar disputa com último clique sem regra.
5. **Creator/educador:** definir previamente se remuneração será comissão, fee fixo, permuta ou híbrido.

### Campos mínimos do acordo

- campanha e objetivo;
- responsabilidades de cada lado;
- calendário;
- ativos a criar;
- compromissos de divulgação;
- uso de marca;
- custos/receita/comissão;
- política de leads e LGPD;
- métricas pós-campanha;
- critérios para nova rodada.

---

## 13. Mensuração

### UTMs padrão

Seguir a estrutura já usada em `utm_taxonomia_padrao.csv`:

- `utm_source=parceiro-{slug}`
- `utm_medium=affiliate` ou `co-marketing`
- `utm_campaign=launch-botinho-2026q2` ou `comarketing-{tema}-{yyyymm}`
- `utm_content={formato}-{variante}`

### Eventos recomendados

- `partner_landing_view`
- `partner_cta_click`
- `partner_form_submit`
- `webinar_registration`
- `webinar_attended`
- `partner_trial_started`
- `partner_first_connection_success`
- `partner_first_send_success`
- `partner_paid_conversion`

### Métricas quantitativas

- leads por parceiro;
- taxa de MQL;
- trial starts;
- primeira conexão WhatsApp com sucesso;
- primeiro envio/espelhamento com sucesso;
- conversão para pago;
- receita por parceiro;
- CAC por campanha;
- tempo até ativação;
- churn D7/D30 por origem.

### Métricas qualitativas

- facilidade de colaboração;
- velocidade de aprovação;
- qualidade das perguntas recebidas;
- aderência do público;
- risco reputacional;
- potencial de repetir campanha.

---

## 14. Sequência de outreach recomendada

### Mensagem inicial — admin de grupo

Assunto/gancho: `Ideia de piloto BOTinho + {nome do grupo}`

> Oi, {nome}! Vi que vocês já curam ofertas em {canal/nicho}.
> Tenho uma ideia simples de parceria: um piloto guiado de 7 dias para testar o BOTinho em poucos grupos, reduzindo copia-e-cola e padronizando as postagens sem mexer na operação inteira.
> Se fizer sentido, eu te mostro em 15 minutos e, se funcionar, transformamos em um case com benefício exclusivo para sua audiência.

### Mensagem inicial — educador/creator

> Oi, {nome}! Acompanho seu conteúdo para afiliados e pensei em uma aula prática para sua comunidade: “como montar uma rotina de ofertas no WhatsApp sem virar refém do copia-e-cola”.
> O BOTinho entra como ferramenta demonstrável, com cupom exclusivo e checklist para seus alunos. Topa avaliarmos um workshop gratuito ou uma live?

### Mensagem inicial — plataforma adjacente

> Olá, {nome/time}! O BOTinho ajuda afiliados e operadores de grupos a transformar links/ofertas em postagens padronizadas no WhatsApp.
> Vejo uma interseção com a audiência de vocês em social commerce e vendas por canais conversacionais. Tenho 2 ideias leves de co-marketing: guest post educativo ou webinar prático sobre operação de ofertas em grupos. Podemos explorar?

### Follow-up 1 — prova/valor

> Passando para deixar uma ideia mais concreta: podemos começar sem integração técnica, só com uma campanha educativa + UTM exclusivo + piloto assistido para quem já opera grupos. Assim medimos interesse antes de qualquer esforço maior.

### Follow-up 2 — fechamento suave

> Se agora não for prioridade, tudo bem. Posso te mandar o checklist de operação de grupos de ofertas para você avaliar internamente e retomo quando fizer sentido?

---

## 15. Backlog de execução

### Semana 1

- Revisar os 37 parceiros segmento A do lote atual.
- Enriquecer contato dos 10 melhores.
- Criar partner kit v0.
- Definir oferta: piloto 7 dias + cupom + case.
- Preparar UTM/cupom por parceiro.

### Semana 2

- Enviar 10 abordagens manuais altamente personalizadas.
- Agendar 3 calls.
- Rodar 1 piloto controlado.
- Documentar objeções.

### Semanas 3–4

- Publicar primeiro mini-case ou case anônimo.
- Rodar 1 live/workshop com creator pequeno/médio.
- Testar newsletter swap ou post coautorado.
- Ajustar scoring com dados reais.

### Dias 45–90

- Criar página de parceiros.
- Padronizar termo de lead sharing.
- Abrir conversas com plataformas adjacentes.
- Produzir relatório/benchmark com dados agregados.
- Criar rotina mensal de dashboard de parcerias.

---

## 16. Checklist operacional

### Identificação de parceiros

- [ ] Listar ferramentas e comunidades usadas pelos clientes atuais.
- [ ] Cruzar com lote `dia8_cold_outreach_parceiros`.
- [ ] Aplicar score 0–100.
- [ ] Validar risco reputacional e concorrência.
- [ ] Checar canal público e contato.

### Planejamento da campanha

- [ ] Definir formato: piloto, webinar, conteúdo, case, bundle ou social.
- [ ] Definir oferta e reciprocidade.
- [ ] Criar UTM e cupom.
- [ ] Definir lead ownership.
- [ ] Definir métrica primária e guarda-corpos.

### Execução

- [ ] Criar assets compartilhados.
- [ ] Aprovar copy e uso de marca.
- [ ] Coordenar calendário de promoção.
- [ ] Rodar campanha primeiro com baixo volume.
- [ ] Monitorar eventos e feedback.

### Pós-campanha

- [ ] Compartilhar métricas com parceiro.
- [ ] Registrar aprendizados.
- [ ] Classificar parceiro para repetir, pausar ou encerrar.
- [ ] Criar case se houver resultado e consentimento.
- [ ] Atualizar CRM e backlog.

---

## 17. Guardrails de marca, segurança e compliance

- Evitar promessas como “sem risco de ban”, “renda garantida”, “ganhe dinheiro automático” ou “comissão garantida”.
- Usar linguagem de operação responsável: teste gradual, grupos autorizados, consistência, organização e monitoramento.
- Não usar listas raspadas para disparo em massa sem opt-in e base legal adequada.
- Não compartilhar dados de leads sem consentimento claro.
- Não usar marcas de marketplaces sugerindo parceria oficial sem autorização.
- Validar políticas dos programas de afiliados antes de orientar qualquer canal de divulgação.
- Diferenciar BOTinho de ferramentas oficiais de atendimento WhatsApp/API: o posicionamento deve ser sobre operação de grupos/canais de ofertas, sem alegar ser parceiro oficial Meta.

---

## 18. Recomendação final

A prioridade do BOTinho deve ser **co-marketing de proximidade com operadores reais**, não grandes integrações no primeiro momento. O caminho mais rápido para receita e prova é:

1. ativar 10 parceiros segmento A já mapeados;
2. fechar 3 pilotos guiados;
3. transformar 1 resultado em case;
4. usar o case para abrir creators/comunidades;
5. só depois buscar plataformas maiores com prova concreta.

Essa sequência reduz risco, evita ciclos longos de parceria, gera prova social e alimenta SEO/CRO com evidências reais do ICP.

---

## 19. Implementação do Pacote 1 (2026-05-19)

Assets criados para execução da primeira onda:

- `docs/marketing/co-marketing/partner-kit.md`
- `docs/marketing/co-marketing/pipeline_parceiros_template.csv`
- `docs/marketing/co-marketing/utm_cupons_parceiros_template.csv`
- `docs/marketing/co-marketing/lead-sharing-termo-simples.md`

Observação: esta entrega permanece documental (sem mudanças em runtime, APIs, schema, portas ou banco).


---

## 20. Implementação dos Pacotes 2, 3 e 4 (2026-05-19)

Pacote 2 (assets desejáveis) implementado com:

- `docs/marketing/co-marketing/case-template.md`
- `docs/marketing/co-marketing/checklist-operacao-grupos-ofertas.md`
- `docs/marketing/co-marketing/webinar-45min-roteiro.md`
- `docs/marketing/co-marketing/follow-up-pos-evento.md`
- `docs/marketing/co-marketing/dashboard-mensal-template.md`

Pacote 3 (landing de parcerias) implementado com:

- `docs/marketing/co-marketing/landing-parcerias-copy.md`
- `dashboard/app/parcerias/page.js`

Pacote 4 (fechamento operacional) aplicado com:

- atualização do plano com assets executados e padronização de handoff para Growth/Parcerias.

Observação: continua obrigatório validar a página `/parcerias` em staging (`3006`) antes de uso em produção.


---

## 21. Pós-entrega implementado (2026-05-19)

Itens implementados do manual pós-entrega:

- Landing `/parcerias` com rastreio orgânico e CTA rastreável.
- Formulário de qualificação de parceria com consentimento explícito e envio de evento público (`partner_form_submit`).
- Handoff operacional documentado para Growth/Parcerias com RACI, SLA e checklist.
- Distribuição interna inicial da rota `/parcerias` no hub de conteúdos.

Pendências que continuam manuais/operacionais:

- validação em staging (`3006`) e aprovação visual final;
- revisão jurídica final do termo de lead sharing;
- operação de CRM e cadência de outreach no time.


- `docs/marketing/co-marketing/social-tiktok-instagram.md` (formatos prontos para TikTok e Instagram).
