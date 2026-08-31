# Research — Capacidade e previsibilidade no ADMIN

## 1. Coleta dentro da API existente

**Decision (revisada em 2026-08-31)**: iniciar uma passada best-effort no boot e depois a cada 1 hora com `setInterval(...).unref()`, trava in-process contra sobreposição e timeout global. Cada fonte tem timeout e resultado independente. A redução de cadência evita observação excessiva; o botão manual cobre investigações pontuais.

**Rationale**: é o padrão já usado por sweeps do projeto, evita um novo processo PM2 e atende à frequência/overhead do spec. A trava impede acúmulo se PM2, SQLite ou metadata demorarem.

**Alternatives considered**:
- Novo cron/PM2: rejeitado por memória e escopo operacional.
- Coletar ao abrir a tela: rejeitado por latência, falta de histórico e risco de carga induzida por usuários.
- Agente externo completo: rejeitado para o MVP; seria complexidade desnecessária para um host.

## 2. Métricas Linux sem dependência nova

**Decision**: usar `os.totalmem/freemem/loadavg/uptime/cpus`, `/proc/meminfo`, `/proc/vmstat`, `/proc/<pid>/{cmdline,status,stat}` e `fs.statfs`; calcular CPU e swap I/O por delta entre duas leituras monotônicas.

**Rationale**: são fontes locais baratas e disponíveis no Ubuntu alvo. `MemAvailable` e cache continuam distinguíveis; `pswpin/pswpout` só ganham significado como delta. `statfs` evita executar `df`.

**Alternatives considered**:
- `systeminformation`/Prometheus node-exporter: bons produtos, mas adicionam dependência/processo e não são necessários inicialmente.
- `free`, `vmstat`, `df` via shell: simples manualmente, porém parsing é frágil e contraria a preferência por APIs nativas.

## 3. PM2 e identificação de workers reais

**Decision**: chamar `pm2 jlist` somente por `execFile` com argumentos constantes e timeout; complementar com enumeração numérica de `/proc`. Um worker válido precisa ter executável Node e argumento de script normalizado exatamente igual a `<prodRoot>/src/bot-worker.js` ou `<stagingRoot>/src/bot-worker.js`; o coletor e comandos contendo apenas texto semelhante não contam.

**Rationale**: PM2 não lista filhos como apps próprios. Identificação por argumento exato resolve o falso positivo observado em `pgrep` e permite separar ambientes pelo root conhecido sem retornar cmdline bruto.

**Alternatives considered**:
- `pgrep -af`: rejeitado por contar o próprio coletor/comando.
- Inferir worker pela sessão no banco: rejeitado porque impediria detectar divergência.
- Somente `pm2 jlist`: rejeitado porque omite os workers filhos.

## 4. Capacidade segura e política versionada

**Decision**: política pura versionada (`capacity-policy-v1`). Reserva do host = `max(20% da RAM, 1536 MB, base fixa conservadora)`. Custo por sessão = `max(350 MB, p95 confiável de RSS/worker em 30 d)`. Memória de workers segura = RAM física menos reserva; swap nunca entra. Limite é `floor(memória segura / custo por sessão)` e headroom é limite menos sessões/workers atuais, usando o maior contador confiável quando divergem.

**Rationale**: mantém a referência operacional existente, usa cauda conservadora em vez de média e torna resultados históricos reproduzíveis. A base fixa é calculada sem workers e recebe p95 após histórico suficiente; antes disso a reserva mínima domina.

**Alternatives considered**:
- Limite fixo de 22: útil como baseline, mas envelhece após rescale ou mudança do processo.
- Média por worker: rejeitada porque mídia e GC produzem cauda grande.
- Contar swap: rejeitado porque mascara pressão e aumenta latência.

## 5. Forecast e confiança

**Decision**: derivar uma série diária de pico de sessões conectadas/worker válido e ajustar tendência linear robusta por janela de 7/30/90 dias, excluindo intervalos marcados por mudança de host/política. Só emitir horizonte com ≥7 dias e ≥5 pontos diários válidos, inclinação positiva e limite acima do valor atual. Faixa usa variabilidade residual; confiança (`low|medium|high`) combina cobertura e coeficiente de variação. A recomendação adota 30 d por padrão, usando 7 d apenas como aceleração sinalizada e 90 d como contexto.

**Rationale**: evita falsa precisão e mantém cálculo compreensível. Uma regressão sofisticada ou ML não tem dados/benefício suficiente.

**Alternatives considered**:
- Extrapolar dois pontos: instável.
- Data única sem faixa: falsa precisão.
- ARIMA/serviço externo: complexidade excessiva para dezenas de sessões e 90 dias.

## 6. Persistência e retenção no SQLite

**Decision**: uma linha por snapshot com métricas escalares e um JSON sanitizado de componentes/fontes; rollups horários/diários em tabela separada; eventos e alertas em tabelas próprias. Gerar rollup antes de apagar raw >90 d. Manter horário UTC e guardar `policyVersion` e capacidade contratada aplicada.

**Rationale**: 2.160 snapshots horários em 90 dias são pequenos. JSON evita uma explosão de linhas por processo, mas os valores consultados/grafados permanecem em colunas indexáveis. Alertas precisam de lifecycle próprio; `AnalyticsEvent` não modela recuperação/última observação com clareza.

**Alternatives considered**:
- Somente `AnalyticsEvent`: inadequado para séries densas e lifecycle mutável.
- Uma tabela por componente/processo: normalização maior sem benefício para gráficos agregados do MVP.
- TSDB externa: fora do escopo.

## 7. Integração Hetzner

**Decision**: cliente server-side usando `fetch`, `HCLOUD_READ_TOKEN`, `HCLOUD_PROJECT_ID` e `HCLOUD_SERVER_ID`; endpoints apenas GET, allowlist explícita, timeout curto, cache persistido por pelo menos 6 h e fallback ao último valor válido. Baseline manual conhecido cobre ausência do token.

**Rationale**: o token nunca chega ao navegador e a visão local não depende da rede. Inventário/custo/quota informa `source=provider|manual|baseline` e `checkedAt`.

**Alternatives considered**:
- Chamar Hetzner no browser: rejeitado por vazamento do token.
- Consultar a cada polling: rejeitado por latência/rate limit.
- Token read-write: proibido e desnecessário.

## 8. Alertas e anti-spam

**Decision**: avaliar após cada snapshot; abrir alerta somente após duas medições consecutivas (10 min no default), atualizar `lastObservedAt`, notificar no máximo uma vez/24 h por `host+type`, exceto piora de severidade, e registrar recuperação após duas medições normais. Alertas permanecem informativos.

**Rationale**: cumpre detecção em 10 minutos e reduz ruído de picos. Ciclo persistido sobrevive a restart da API.

**Alternatives considered**:
- Alertar em todo snapshot: spam.
- Apenas evento imutável: dificulta saber condição ativa e recuperação.
- Ação automática: proibida pelo spec e arriscada para sessões WhatsApp.

## 9. Superfície do dashboard

**Decision**: rota própria `/admin/capacidade`, acessível apenas quando `admin.permissions` contém `tech:read`. O primeiro fetch ocorre no mount dessa rota; current atualiza a cada 30 s enquanto `document.visibilityState === 'visible'`; histórico/forecast são buscados separadamente e por período. Sem biblioteca de gráficos nova no MVP: SVG/HTML acessível e tabela alternativa.

**Rationale**: route-level code splitting entrega lazy-load real e não amplia o `Promise.all` da página admin. Acessibilidade e ausência de dependência reduzem custo.

**Alternatives considered**:
- Painel embutido na página admin atual: faria eager load e aumentaria um arquivo já grande.
- Biblioteca pesada de charts: não necessária para quatro séries simples.

## 10. Controle de staging

**Decision**: exibir todos os componentes de staging, mas delegar qualquer ação ao endpoint `staging-power` já existente, com `tech:write`, MFA, confirmação e auditoria. Sugestão aparece apenas sem workers de staging e com dados recentes; nunca executa automaticamente.

**Rationale**: preserva guardas existentes e deixa explícito o estado parcialmente ligado, inclusive supervisor fora da allowlist padrão do botão.

**Alternatives considered**:
- Novo endpoint de stop: duplicaria lógica e riscos.
- Auto-stop por ociosidade: proibido.
