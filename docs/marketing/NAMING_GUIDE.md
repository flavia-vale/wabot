# Naming do Projeto — Decisão Canônica (2026-05-17)

## Classificação da demanda
**[MARKETING]** com impacto em produto e marca.

## Protocolo de risco (STRICT)
1. **Erros fatais:** este documento não altera runtime, build ou tipagem.
2. **Breaking changes:** não há mudanças de API, schema, contratos ou props.
3. **Efeito cascata:** sem efeito técnico imediato; cria diretriz para reduzir inconsistência futura.
4. **Isolamento de ambiente:** nenhuma alteração em `.env`, banco ou deploy.
5. **Bloqueio:** sem risco fatal identificado; execução liberada.

---

## Diagnóstico crítico de naming atual
Hoje existem **3 nomes ativos**, com papéis misturados:

- **Wabot**: nome técnico/interno do repositório e infraestrutura.
- **BOTinho**: nome de produto/marca em páginas e materiais.
- **Espelha Grupos / espelhagrupos.com.br**: domínio e expressão SEO orientada à intenção de busca.

### Evidência quantitativa no código
Levantamento local (2026-05-17):

- `BOTinho`: **1015 ocorrências** em **103 arquivos**
- `espelha grupos` / `espelhagrupos`: **258 ocorrências** em **36 arquivos**
- `wabot`: **126 ocorrências** em **30 arquivos**

Interpretação: o projeto já converge organicamente para **BOTinho como marca principal**, enquanto `wabot` é majoritariamente técnico e `espelha grupos` funciona como ativo de descoberta SEO.

---

## Critérios de decisão (marketing)
A análise usou princípios de posicionamento e psicologia de marca:

1. **Memorabilidade**: nome curto, humano e fácil de lembrar.
2. **Distintividade**: evita ser genérico no mar de “bots”.
3. **Transferência de confiança**: funciona em produto, conteúdo e vendas.
4. **Escalabilidade de categoria**: permite expansão além de “espelhar grupos”.
5. **Sinergia SEO + Brand**: separa claramente nome de marca vs termo de busca.

---

## Decisão recomendada (canônica)

## **Marca oficial: BOTinho**

### Por quê
- Já é o naming dominante no conteúdo e na interface.
- É mais “brandável” que `Wabot` (que soa nome de código).
- Permite estratégia de marca própria sem depender de keyword exata.
- Convive bem com SEO de intenção via “espelhar grupos”, “bot de ofertas”, etc.

---

## Arquitetura de naming (como usar cada nome)

### 1) **BOTinho** → nome de marca (externo e interno de produto)
Use em:
- Site, dashboard, LPs, blog, social, vendas, onboarding, suporte.
- Mensagens de produto (“O BOTinho organiza sua operação...”).

### 2) **Espelha Grupos** → território semântico / SEO
Use em:
- Slugs, headlines SEO, cluster de conteúdo e variações de busca.
- Exemplos: “espelhar grupos WhatsApp”, “bot para espelhar grupos”.

**Regra:** tratar como **keyword/tema**, não como marca principal.

### 3) **wabot** → nome técnico (infra)
Use apenas em:
- Nome do repositório, paths de servidor, scripts, CI/CD, variáveis internas.

**Regra:** não usar em peças de marketing nem em copy de produto.

---

## Guia prático de padronização

## Linguagem de marca (do)
- “BOTinho” (respeitar capitalização: **BOT** + **inho**).
- “O BOTinho que espelha grupos.”
- “Espelha grupos com o BOTinho.”
- “espelhagrupos.com.br” como domínio principal.

## Evitar (don’t)
- Misturar “Wabot” em títulos públicos.
- Alternar “Botinho”, “BOTinho” e “botinho” sem regra.
- Usar “Espelha Grupos” como se fosse produto separado sem contexto.

---

## Plano de rollout sugerido (sem breaking)

### Fase 1 — Governança (imediata)
- Criar este documento como fonte única de naming.
- Definir checklist em PR: “naming está conforme padrão?”

### Fase 2 — Superfícies de alto impacto
- Header, title templates, meta title/description, e-mail transacional, mensagens de login.
- Materiais de vendas e docs de onboarding.

### Fase 3 — Higiene técnica progressiva
- Manter `wabot` apenas em infraestrutura.
- Revisar textos residuais quando tocar nos arquivos (abordagem oportunística, sem mutação massiva arriscada).

---

## Mini style guide

- **Produto/marca:** BOTinho
- **Domínio:** espelhagrupos.com.br
- **Categoria/keyword:** espelhar grupos no WhatsApp
- **Repositório/infra:** wabot

Modelo de frase institucional:

> “O BOTinho espelha grupos e espalha ofertas no WhatsApp com controle, cadência e consistência operacional.”

---

## Decisão final
Se o objetivo é reduzir confusão e maximizar valor de marca + performance orgânica, o melhor naming mestre é:

## ✅ **BOTinho** (marca)
com
## ✅ **Espelha Grupos** (território SEO)

E manter:
## ✅ **wabot** apenas no backend operacional.
