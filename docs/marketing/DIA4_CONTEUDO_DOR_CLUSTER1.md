# Dia 4 — Conteúdo de dor (Cluster 1) — wabot

Data: 2026-05-11
Owner: Growth/SEO

## Análise de risco (STRICT)
- **Erros fatais:** baixo risco; escopo concentrado em páginas públicas estáticas, componentes de marketing e arquivo de material baixável.
- **Breaking changes:** inexistentes; sem alteração de APIs, schema de banco, contratos de autenticação ou props existentes.
- **Efeito cascata:** baixo; novas rotas ficam isoladas em `/blog/*` e `/materiais/*`, sem alterar fluxos críticos do dashboard autenticado.
- **Isolamento de ambiente:** nenhuma execução em produção; validação prevista para staging na porta 3006 antes de deploy.
- **Bloqueio:** não aplicável ao escopo atual.

---

## Objetivo
Capturar tráfego informacional de alta intenção para o cluster de dor “operação manual em grupos” e converter visitantes em leads de lista VIP/trial guiado.

## Entregáveis publicados
1. Artigo pilar: `/blog/como-escalar-grupos-sem-operacao-manual`
2. Artigo pilar: `/blog/checklist-padronizar-divulgacao-whatsapp`
3. Isca digital online: `/materiais/checklist-operacao-whatsapp`
4. Download da isca em PDF: `/materiais/checklist-operacao-whatsapp.pdf`
5. Versão editável em Markdown: `/materiais/checklist-operacao-whatsapp.md`

## Formulários e CRM
Os formulários das páginas usam `method="get"` para `/login` com os seguintes campos de roteamento:
- `mode=register`
- `source=<origem_da_pagina>`
- `utm_campaign=dia4_conteudo_dor_cluster1`
- `email=<email_do_lead>`
- `segmento=<perfil_operacional>`

Mapeamento operacional no CRM:
- **Lead:** visitante envia e-mail no formulário do material/artigo.
- **MQL:** lead informa perfil de operação no campo `segmento`.
- **Trial:** lead conclui cadastro em `/login?mode=register`.
- **Ativado:** usuário conecta WhatsApp e realiza primeiro espelhamento.

> Observação: a persistência nativa de lead em banco/CRM externo deve ser acoplada em etapa posterior para evitar alteração de schema neste Dia 4.

## SEO on-page aplicado
- Metadata por página com canonical.
- JSON-LD `Article` nos dois artigos pilar.
- CTA contextual em todos os conteúdos.
- Links internos para home, lista VIP/cadastro e material baixável.
- Inclusão das rotas no sitemap da aplicação.

## Checklist de validação em staging
- [ ] Abrir `/blog/como-escalar-grupos-sem-operacao-manual` na porta 3006.
- [ ] Abrir `/blog/checklist-padronizar-divulgacao-whatsapp` na porta 3006.
- [ ] Abrir `/materiais/checklist-operacao-whatsapp` na porta 3006.
- [ ] Baixar `/materiais/checklist-operacao-whatsapp.pdf`.
- [ ] Conferir versão editável `/materiais/checklist-operacao-whatsapp.md`.
- [ ] Enviar formulário e confirmar redirecionamento para `/login?mode=register` com query de origem.
- [ ] Validar sitemap com as novas URLs.
