# Contrato de UI — tela "Anti-banimento"

## Rotas do painel

| Endereço | Comportamento |
|---|---|
| `/painel/anti-banimento` | tela única; `?parte=situacao|ritmo|conta` (padrão `situacao`), `?destino=<groupId>` abre o destino no "Ritmo por grupo" |
| `/painel/preservacao` | redirect → `/painel/anti-banimento` |
| `/painel/preservacao/monitoramento` | redirect → `?parte=situacao` |
| `/painel/preservacao/destinos` | redirect → `?parte=ritmo` (preserva `?destino=` se vier) |
| `/painel/preservacao/configuracoes` | redirect → `?parte=conta` |

## Menu (`dashboard/app/painel/nav.js`)

- Remove o grupo "Preservação avançada" (3 itens).
- Adiciona no grupo "Configuração", logo após "Conexão WhatsApp":
  `{ label: 'Anti-banimento', href: '/painel/anti-banimento', pro: true }`.
- Selo com o **texto** "PRO" (não só cor).

## Gate

`canUseAdvancedPreservation({ plan, accessExpiresAt })` importado de
`src/billing/plans.js`. Sem acesso: tela **visível e bloqueada** — resumo leigo,
frase "o robô já protege seu número com o ritmo padrão", botão "Conhecer o plano
PRO" → `/painel/plano`. Campos não renderizados como editáveis.

## Partes

1. **Situação** (só leitura + liga/desliga do "vigiar se seus canais estão sendo
   escondidos"). Sem medição → "ainda sem medições", nunca verde.
2. **Ritmo por grupo**: lista com busca dos destinos; por destino, escolhas
   prontas ("Bem devagar", "Equilibrado", "Mais rápido") + os 4 campos editáveis
   em frase; etiqueta "🐢 Ritmo mais cuidadoso" quando `ritmoMaisCuidadoso`;
   botão "Voltar ao ritmo padrão" (grava `null` nos overrides). As escolhas
   prontas gravam **só** campos editáveis. Sem destino: frase + atalho para
   Espelhamento.
3. **Ajustes da conta**: seguidas por dia; variação de imagem (se aprovada como
   editável); frase de "espera mais entre canais que o padrão" quando aplicável.

## Espelhamento

Aba de proteção do painel do destino: mantém "Saúde deste destino"; atalho
"Ajustar no Anti-banimento PRO →" para `/painel/anti-banimento?parte=ritmo&destino=<id>`.

## Linguagem (teste falha se aparecer)

burst, rajada, janela de rajada, throttle, jitter, preset, cap, anti-flood,
shadowban, hash, snapshot, score, mutação, stagger, "Preservação avançada",
"Módulo de Preservação", "Preservação Pro", "Preservação por grupo" — em
`dashboard/app/painel/anti-banimento/**`, nos componentes que ela usa, no upsell e
na mensagem do gate. Nenhuma frase pode prometer que o número não será banido.
Celular: nenhuma largura fixa sem `sm:`; tabela larga só com `overflow-x-auto`.
