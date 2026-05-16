# Implementação AI SEO P2 — BOTinho — 2026-05-15

## Resultado entregue

Este documento registra a implementação do backlog P2 da auditoria `docs/marketing/AI_SEO_AUDIT_2026-05-15.md`.

| Item P2 | Status | Entrega |
|---|---:|---|
| Criar comparativos e alternativas equilibrados | Feito | Novas rotas `/alternativas/bot-para-whatsapp-afiliados`, `/botinho-vs-planilha-manual`, `/botinho-vs-ferramentas-genericas-automacao` e `/melhores-bots-para-afiliados-whatsapp`. |
| Construir presença em diretórios, comunidades e parcerias | Feito como playbook | CSV `docs/marketing/ai_seo_presence_targets.csv` com alvos, ângulo, prova exigida e status inicial para execução manual sem spam. |
| Publicar estudos de caso reais com consentimento | Bloqueado para claims reais; infraestrutura entregue | Nova rota `/estudos-de-caso` explica a política: nenhum número público sem consentimento, contexto, metodologia e evidência verificável. |
| Criar glossário e páginas de definição | Feito | Nova rota `/glossario` com termos parseáveis e schema `DefinedTermSet`. |
| Atualizar LPs programáticas com exemplos únicos por nicho/cidade | Feito | `_lpShared.js` agora gera bloco “Exemplo único de rotina” por cidade, nicho ou dor operacional, com passos específicos e sem promessa de ganho. |

## Rotas/arquivos públicos impactados

- `/alternativas/bot-para-whatsapp-afiliados`
- `/botinho-vs-planilha-manual`
- `/botinho-vs-ferramentas-genericas-automacao`
- `/melhores-bots-para-afiliados-whatsapp`
- `/glossario`
- `/estudos-de-caso`
- LPs programáticas via bloco “Exemplo único de rotina”
- `/conteudos`, `/sitemap.xml` e `/llms.txt`

## Decisão de risco sobre estudos de caso

O P2 pede estudos de caso reais. Como não há dados consentidos no repositório, a implementação não inventa clientes, comissões, porcentagens ou depoimentos. A página pública cria a política de publicação e o checklist de evidência; os cases reais devem ser adicionados somente depois de validação manual e aprovação em staging.

## Como validar em staging

Após merge em `develop`, validar na porta `3006`:

1. Abrir cada rota nova e conferir renderização, FAQ, tabelas e links internos.
2. Abrir uma LP de cidade e uma de nicho para conferir o bloco “Exemplo único de rotina”.
3. Abrir `http://178.105.54.0:3006/conteudos` e verificar as seções “Comparativos e alternativas” e “Autoridade e definições”.
4. Abrir `http://178.105.54.0:3006/sitemap.xml` e verificar se as novas rotas aparecem.
5. Revisar `docs/marketing/ai_seo_presence_targets.csv` antes de qualquer outreach externo.
