# CRO — Auditoria profunda do projeto WABOT

Data: 2026-05-16  
Skill aplicada: `cro` (escopo máximo: aquisição, ativação, pricing, formulários, tracking e risco operacional)  
Escopo analisado: `landing/`, `dashboard/`, `src/api/`, `src/analytics.js`, docs de marketing já existentes.

---

## 0) Protocolo STRICT de risco (pré-implementação)

### Erros fatais
- **Risco**: hoje existe instrumentação híbrida (`window.dataLayer` + persistência em `/api/public/analytics`) e parte dos eventos públicos não entra no mesmo funil dos eventos autenticados (`ANALYTICS_EVENTS`), gerando leitura parcial e decisões enviesadas.
- **Proteção recomendada**: congelar nomenclatura de eventos em um contrato único versionado antes de novos experimentos.

### Breaking changes
- **Risco**: mudança em payload de cadastro (`/api/auth/register`) impacta captura de UTM, promo, trial e dashboards de marketing.
- **Proteção recomendada**: toda alteração de campos de cadastro deve ter compatibilidade retroativa por pelo menos 1 ciclo de release em `develop`.

### Efeito cascata
- **Risco**: ajustes de copy/CTA sem alinhamento com attribution podem aumentar clique e reduzir qualidade de lead (mais cadastros, menos ativação).
- **Proteção recomendada**: avaliar sempre em 3 níveis: `CTR CTA -> signup -> first_send_success`.

### Isolamento de ambiente
- **Risco**: qualquer teste de pricing/login/analytics em produção distorce dados e pode impactar receita.
- **Proteção recomendada**: tudo passa por `develop` + staging (`3006`) e validação de smoke analítico antes de merge para `main`.

### Bloqueio
- **Bloqueio ativo recomendado**: NÃO implementar experimentos de formulário, prompt ou pricing sem plano de medição com hipótese, métrica primária, guarda-corpo e janela mínima.

---

## 1) Diagnóstico executivo (estado atual de conversão)

O projeto está **acima da média em base estrutural** (boa proposta no hero, pricing claro, instrumentação inicial, UTMs no cadastro), mas com gargalos clássicos de CRO em scale-up:

1. **Mensagem forte no topo, pouca especificidade de prova no meio** (valor percebido cai após hero).
2. **CTAs com boa presença, mas pouca segmentação por intenção** (mesma CTA para visitantes frios e quentes).
3. **Formulário de cadastro robusto, porém longo para tráfego frio** (fricção de 4 campos + senha logo no primeiro passo).
4. **Analytics parcialmente conectado** (eventos públicos e autenticados ainda não formam um funil único auditável).
5. **Ausência de rotina formal de experimentação** (há tracking, mas falta camada operacional de teste A/B contínuo).

---

## 2) Análise profunda por framework CRO

## 2.1 Value Proposition Clarity

### Pontos fortes
- Headline comunica resultado (“promoção dos outros vira vendas no seu grupo”), linguagem adequada ao ICP afiliado WhatsApp.
- Subheadline explica mecanismo (monitorar grupos -> converter links -> repostar).

### Lacunas
- Falta “prova objetiva” imediata acoplada à promessa (ex.: tempo médio até primeiro envio real, taxa de setup concluído).
- Benefícios ainda estão mais descritivos de funcionalidade do que de transformação econômica por perfil de usuário.

### Melhorias
- Inserir bloco “resultado em X dias” com faixa realista por segmento (iniciante vs operador).
- Adicionar mini-estudo com antes/depois operacional (tempo economizado + consistência de postagem).

---

## 2.2 Headline & Message Match

### Observação crítica
- O componente Hero já trabalha variação de tom (`direto`, `animado`, `amigavel`), mas na prática usa `DEFAULTS` estático sem engine de experimento.

### Oportunidade
- Isso é excelente “gancho técnico” para A/B: já existe arquitetura simples para testar tons sem refactor grande.

### Ação
- Rodar experimento controlado por `utm_campaign` e armazenar variante exibida no evento de page view.

---

## 2.3 CTA Placement, Copy, Hierarquia

### Pontos fortes
- CTA principal aparece no hero e no pricing.
- Copy de CTA é orientada à ação (“Conectar meu WhatsApp”, “Começar teste grátis”).

### Lacunas
- Falta CTA intermediária para visitante não pronto para cadastro (microconversão explícita de baixa fricção).
- `href="#login"` em alguns trechos da landing não garante caminho consistente quando rota real de autenticação é `/login`.

### Melhorias
- Criar dupla trilha: **CTA primária** (cadastro) + **CTA secundária** (checklist/guia operacional).
- Padronizar todos os destinos de CTA para URL canônica com parâmetros de origem.

---

## 2.4 Scannability e Hierarquia Visual

### Pontos fortes
- Estrutura de seções bem previsível (Hero -> How -> Features -> Social -> Pricing -> FAQ -> CTA final).
- Uso de bullets e cards facilita leitura móvel.

### Lacunas
- Falta sticky CTA em mobile para reduzir retorno ao topo.
- Seções de prova social e pricing podem ficar distantes para usuário com scroll curto (drop de atenção).

### Melhorias
- Sticky bottom CTA contextual em mobile (não intrusivo).
- Blocos de “prova rápida” entre seções longas para renovar atenção.

---

## 2.5 Trust Signals e Prova Social

### Pontos fortes
- Existe seção social dedicada.
- Login reforça benefícios em lista clara.

### Lacunas
- Falta prova numérica consistente perto de CTA crítica.
- Pricing comunica diferença Basic vs Pro quase só por “anúncios”, com risco de percepção de valor limitado.

### Melhorias
- Prova próxima ao botão: “X operações ativas / Y envios processados (janela temporal)”.
- Reenquadrar valor do Pro por impacto operacional (tempo, clareza, foco), não apenas “sem anúncios”.

---

## 2.6 Objection Handling

### Cobertura atual
- FAQ ajuda, mas objeções de risco/implementação ainda podem aparecer tarde.

### Objeções prioritárias a tratar acima da dobra
1. “Vou precisar ficar monitorando o bot?”
2. “Se eu errar a configuração, perco o grupo?”
3. “Quanto tempo até ficar útil de verdade?”
4. “Consigo testar sem cartão e sem travar?”

### Melhorias
- Inserir bloco “Sem risco operacional” com checklist curto de segurança e rollback.

---

## 2.7 Fricção no Formulário (login/cadastro)

### Pontos fortes
- Validação client-side clara e mensagens boas.
- Coleta de telefone já alinhada com suporte proativo.

### Lacunas
- Cadastro único em uma etapa pode reduzir taxa de conclusão em tráfego frio.
- Não há progressão visual de esforço (usuário não sabe “quanto falta”).

### Melhorias
- Testar fluxo de 2 etapas:
  - Etapa 1: nome + WhatsApp + objetivo.
  - Etapa 2: email + senha.
- Mostrar barra de progresso simples (“Passo 1 de 2”).

---

## 2.8 Mensuração e Experimentação

### Situação
- Frontend já tenta persistir eventos públicos.
- Backend possui whitelist de eventos e sanitização, porém com listas distintas para público/autenticado.

### Risco
- Fragmentação semântica entre eventos pode gerar “falso ganho” em CTR e perda real em receita.

### Melhorias
- Unificar taxonomia de eventos em um único contrato (`docs/marketing/event-taxonomy-v1.md`).
- Criar painel com 5 métricas canônicas:
  1. LP view
  2. CTA click
  3. signup submit
  4. signup success
  5. first_send_success

---

## 3) Quick Wins (implementar agora)

1. Padronizar todas as URLs de CTA com parâmetros de origem/campanha.
2. Inserir prova curta imediatamente acima de CTA de cadastro.
3. Adicionar CTA secundária de baixa fricção (checklist/roteiro de setup).
4. Criar checklist de copy por seção para reduzir jargão e reforçar benefícios concretos.
5. Definir baseline semanal de funil (view->click->signup->ativação).

---

## 4) High-Impact Changes (prioridade alta)

1. **Motor mínimo de A/B no Hero** usando `tone` já existente + persistência da variante.
2. **Refatoração do cadastro em 2 passos** com medição de abandono por etapa.
3. **Framework de experimentos** (hipótese, métrica, duração, critério de parada, rollout).
4. **Reenquadramento do pricing** com valor percebido por plano e ancoragem de escolha recomendada.
5. **Dashboard de conversão único** unindo público + autenticado em coorte temporal.

---

## 5) Test ideas (hipóteses para A/B)

1. Hero outcome-first vs mechanism-first.
2. CTA “Começar teste grátis” vs “Validar meu primeiro envio em 4 minutos”.
3. Signup 1 etapa vs 2 etapas.
4. Prova social no topo vs após seção de recursos.
5. Pricing com ancoragem visual no plano recomendado vs layout neutro.

---

## 6) Copy alternatives

## Headline
1. “Transforme grupos de promoções em vendas no seu WhatsApp — sem copiar manualmente.”
2. “Monitore ofertas, converta links e publique no seu grupo em segundos.”
3. “Seu grupo vende mais quando o envio certo acontece na hora certa.”

## CTA primária
1. “Começar teste guiado agora”
2. “Validar meu primeiro envio grátis”
3. “Conectar WhatsApp e testar”

## CTA secundária
1. “Receber checklist de setup”
2. “Ver roteiro de 4 minutos”
3. “Entender antes de criar conta”

---

## 7) Plano de execução em ondas (sem risco de produção)

### Onda 1 — Instrumentação e baseline (staging)
- Congelar taxonomia de eventos.
- Revisar payloads de CTA e signup attribution.
- Publicar painel inicial de funil.

### Onda 2 — Quick wins de copy/CTA
- Ajustes em hero, prova curta, CTA secundária.
- QA em mobile e desktop.

### Onda 3 — Experimentos estruturados
- A/B Hero tone.
- A/B signup 1 vs 2 passos.
- A/B pricing framing.

### Onda 4 — Escala e governança
- Cadência quinzenal de experimentos.
- Retro mensal com decisão de manter, iterar ou reverter.

---

## 8) Critérios de sucesso (90 dias)

- +20% em `signup_success / organic_page_view`.
- +15% em `first_send_success / signup_success`.
- -20% em abandono no cadastro.
- Tempo até primeiro valor percebido < 1 dia para novos cadastros ativos.

---

## 9) Conclusão

O WABOT já está em um estágio avançado de maturidade para aquisição orgânica, mas a próxima alavanca de crescimento está em **operações de CRO orientadas por hipótese e medição unificada**. O maior ganho virá menos de “novos blocos visuais” e mais de: mensagem certa por intenção, redução inteligente de fricção e disciplina de experimentação com validação em staging.
