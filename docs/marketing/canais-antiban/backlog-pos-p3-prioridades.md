# Backlog pós-P3 — o que ainda falta implementar/validar

Sim: a campanha Canais + Preservação já tem páginas, blog, diagnóstico, checklist, calculadora, páginas de decisão e pacote de distribuição. O que ainda falta não é “mais uma landing”; agora o trabalho restante é **validação, instrumentação real, produção dos criativos, prova comercial e otimização por dados**.

## Resumo executivo

| Prioridade | Tema | Status | Por que importa |
|---|---|---|---|
| P0 | QA em staging + correções antes de tráfego | Pendente | Evita divulgar página com erro visual, CTA quebrado ou expectativa desalinhada. |
| P1 | Medição real + CRM/funil | Parcial | Eventos e UTMs foram definidos, mas ainda precisam ser acompanhados em dashboard/CRM. |
| P2 | Execução da distribuição P3 | Pendente operacional | Posts e roteiros existem, mas ainda precisam virar criativos publicados. |
| P3 | Provas comerciais e autoridade | Pendente operacional | Aumenta confiança e reduz dependência de promessa textual. |
| P4 | SEO pós-indexação e CRO | Pendente de dados | Só deve começar depois de impressões/cliques suficientes. |
| P5 | Produto/onboarding alinhado à promessa | Pendente de validação | Evita fricção entre campanha, cadastro e experiência real no dashboard. |

## P0 — Validação obrigatória em staging antes de divulgar

**Objetivo:** garantir que a campanha pode receber tráfego sem erro técnico, rota quebrada, promessa desalinhada ou CTA indo para destino errado.

### Tarefas

1. Validar manualmente em `http://178.105.54.0:3006` as rotas principais:
   - `/bot-canais-whatsapp`
   - `/diagnostico-antiban-whatsapp`
   - `/materiais/checklist-antiban-whatsapp`
   - `/ferramentas/calculadora-risco-whatsapp`
   - `/bot-comum-vs-botinho`
   - `/faq-antiban-whatsapp`
   - `/como-funciona-botinho-canais`
   - `/protecao-antiban-botinho`
2. Conferir mobile: hero, tabelas, formulários, cards e CTAs.
3. Conferir se todo CTA P0/P1/P2 abre destino correto e preserva UTM.
4. Conferir se a copy visível não promete “anti-ban 100%”.
5. Conferir se o mock do painel não parece promessa de tela real caso ainda não exista no produto.

### Critério de pronto

- Todas as rotas acima respondem em staging.
- Não há CTA quebrado.
- O fluxo diagnóstico → cadastro e calculadora → checklist/cadastro funciona.
- A usuária aprova visual/copy na porta 3006.

## P1 — Medição real, CRM e painel de acompanhamento

**Objetivo:** transformar UTMs/eventos em aprendizado acionável.

### Tarefas

1. Criar visão de funil para:
   - `organic_page_view`
   - `organic_cta_click`
   - `diagnostic_result_viewed`
   - `diagnostic_form_submitted`
   - cliques da calculadora para checklist/cadastro.
2. Mapear campos enviados ao `/login` para CRM ou base de cadastro:
   - `diagnostic_score_band`
   - `risk_score_band`
   - `source`
   - `utm_campaign`
   - `utm_content`
   - `segmento`
3. Definir relatório semanal simples:
   - página de entrada;
   - CTA clicado;
   - destino;
   - faixa de risco;
   - cadastro concluído ou abandono.
4. Confirmar se eventos públicos persistidos aparecem no endpoint/API esperado.

### Critério de pronto

- É possível responder: “qual página trouxe lead?”, “qual CTA gerou cadastro?” e “qual faixa de risco converte melhor?”.

## P2 — Publicação dos criativos P3

**Objetivo:** tirar os ativos do papel e publicar com cadência.

### Tarefas

1. Transformar os 8 posts de [`social-posts.md`](./social-posts.md) em criativos finais.
2. Produzir os 3 vídeos de [`roteiros-video.md`](./roteiros-video.md).
3. Agendar a cadência de 14 dias descrita em [`p3-distribuicao-autoridade.md`](./p3-distribuicao-autoridade.md).
4. Usar UTMs finais por canal:
   - `utm_source=linkedin`
   - `utm_source=instagram`
   - `utm_source=x`
   - `utm_source=tiktok`
   - `utm_medium=social`
   - `utm_campaign=canais-preservacao`
5. Criar checklist de publicação: link, thumbnail, legenda, CTA, UTM, comentário fixado quando aplicável.

### Critério de pronto

- Pelo menos 8 posts e 3 vídeos publicados/agendados com links rastreáveis.

## P3 — Provas comerciais e autoridade

**Objetivo:** aumentar confiança sem expor dados sensíveis.

### Tarefas

1. Coletar os itens planejados em [`provas-comerciais.md`](./provas-comerciais.md):
   - 3 prints fictícios/anonimizados;
   - 2 depoimentos autorizados;
   - 1 microcase anonimizado;
   - métrica agregada de diagnósticos;
   - métrica de CTR das páginas P2.
2. Criar versões “seguras” dos prints:
   - sem telefone;
   - sem JID;
   - sem QR Code;
   - sem link privado;
   - sem token/cookie;
   - sem nome de cliente sem autorização.
3. Atualizar landing/P2 com provas apenas depois de consentimento.

### Critério de pronto

- Existe pelo menos 1 prova segura publicada ou pronta para inserir na landing/P2.

## P4 — SEO pós-indexação e CRO por dados

**Objetivo:** otimizar apenas depois de dados reais.

### Tarefas

1. Executar o playbook de [`search-console-otimizacao.md`](./search-console-otimizacao.md).
2. Após 14 dias:
   - conferir cobertura;
   - exportar queries;
   - identificar páginas com impressão e baixo CTR.
3. Após 28 dias:
   - ajustar title/meta com base em query real;
   - reforçar FAQ/resposta direta onde houver posição ruim;
   - adicionar links internos para páginas com baixa impressão.
4. Rodar experimentos simples de CRO:
   - CTA hero: diagnóstico vs checklist;
   - copy do aviso honesto;
   - ordem de diagnóstico/calculadora/checklist;
   - CTA final: cadastro direto vs “calcular risco”.

### Critério de pronto

- Há uma planilha com query, impressão, CTR, posição média e ação tomada por URL.

## P5 — Alinhamento produto/onboarding com a promessa

**Objetivo:** garantir que quem chega pela campanha encontra continuidade no produto.

### Tarefas

1. Validar se o dashboard/onboarding mostra claramente:
   - canais;
   - grupos;
   - cadência;
   - variações;
   - monitoramento;
   - plano de recuperação.
2. Se ainda não existir tela real para algum item, ajustar copy da campanha para “módulo/fluxo/processo” em vez de “painel pronto”.
3. Criar uma tela ou checklist interno pós-cadastro usando:
   - `diagnostic_score_band`;
   - `risk_score_band`;
   - perfil da operação.
4. Definir próximo passo no produto para cada origem:
   - diagnóstico;
   - checklist;
   - calculadora;
   - página comparativa;
   - blog.

### Critério de pronto

- Usuário que vem da campanha sabe exatamente o que configurar primeiro no BOTinho.

## Priorização recomendada agora

1. **P0 primeiro:** validar tudo em staging na porta 3006.
2. **P1 em paralelo:** garantir que eventos/UTMs chegam onde precisam.
3. **P2 depois da aprovação visual:** publicar posts e vídeos.
4. **P3 assim que houver uso real:** coletar provas seguras.
5. **P4 só com dados:** ajustar SEO/CRO após Search Console e eventos.
6. **P5 conforme feedback:** alinhar onboarding com a promessa mais clicada.

## O que não recomendo fazer agora

- Criar novas páginas antes de validar as atuais.
- Rodar tráfego pago antes do QA em staging e da medição mínima.
- Prometer “anti-ban 100%” para aumentar CTR.
- Publicar prints reais sem borrar identificadores e sem consentimento.
- Mudar `DATABASE_URL`, portas, `.env` ou banco para esta campanha.
