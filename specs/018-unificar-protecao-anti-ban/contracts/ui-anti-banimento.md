# Contrato de UI — tela "Anti-banimento"

## Rotas do painel

| Endereço | Comportamento |
|---|---|
| `/painel/anti-banimento` | tela única; `?parte=situacao|ritmo|conta` (padrão `situacao`), `?destino=<groupId>` abre o destino no "Ritmo por grupo" |
| `/painel/preservacao` | redirect → `/painel/anti-banimento` |
| `/painel/preservacao/monitoramento` | redirect → `?parte=situacao` |
| `/painel/preservacao/destinos` | redirect → `?parte=ritmo` (preserva `?destino=`) |
| `/painel/preservacao/configuracoes` | redirect → `?parte=conta` |

## Menu (`dashboard/app/painel/nav.js`)

- Remove o grupo "Preservação avançada" (3 itens).
- Adiciona no grupo "Configuração", logo após "Conexão WhatsApp":
  `{ label: 'Anti-banimento', href: '/painel/anti-banimento', pro: true }`.
- Selo com o **texto** "PRO" (não só cor).

## Gate

`canUseAdvancedPreservation({ plan, accessExpiresAt })` importado de
`src/billing/plans.js`. Sem acesso: tela **visível e bloqueada** — resumo leigo,
frase "o robô continua protegendo seu número (com o ritmo padrão, ou com os
ajustes que você já tinha deixado)", botão "Conhecer o plano PRO" →
`/painel/plano`. Campos não renderizados como editáveis.

## Partes

1. **Situação** (só leitura + liga/desliga "vigiar se seus canais estão sendo
   escondidos"). Sem medição → "ainda sem medições", nunca verde.
2. **Ritmo por grupo**: lista com busca dos destinos; por destino, escolhas
   prontas ("Bem devagar", "Equilibrado", "Mais rápido" — o antigo "Leve"
   redescrito sem prometer 10/hora) + os 4 campos editáveis em frase (intervalo
   mínimo, limite diário, horário, descarte por idade recolhido); etiqueta
   "🐢 Ritmo mais cuidadoso" quando `ritmoMaisCuidadoso`; botão "Voltar ao ritmo
   padrão" (grava `null`). Salvar grava só campos editáveis **+ `throttleEnabled:
   true`**. Destino com `recomecouDoPadrao` não tem etiqueta nem aviso técnico
   (mostra os valores efetivos do padrão nos campos editáveis). Sem destino:
   frase + atalho para Espelhamento.
3. **Ajustes da conta** (todos editáveis, nenhum fixo):
   - **"Intervalo entre destinos"** — "Esperar X segundos entre enviar para um
     grupo ou canal e enviar para o próximo". Dica: "Vale para grupos e canais.
     É diferente do tempo entre uma oferta e outra no mesmo grupo. Com muitos
     grupos, a oferta leva mais tempo para chegar ao último." Campo em segundos,
     0 a 600; 0 = sem espera extra. Fora da faixa: frase com a faixa, nada gravado.
   - Seguir no máximo X canais por dia.
   - Variação de imagem — "Mudar levemente a foto em cada envio para os canais"
     (mesmo comportamento e padrão de hoje).

## Espelhamento

Aba de proteção do painel do destino: mantém "Saúde deste destino"; atalho
"Ajustar no Anti-banimento PRO →" para `/painel/anti-banimento?parte=ritmo&destino=<id>`.

## Linguagem (teste falha se aparecer)

burst, rajada, janela de rajada, throttle, jitter, preset, cap, anti-flood,
shadowban, hash, snapshot, score, mutação, stagger, **"atraso entre canais"**,
"Preservação avançada", "Módulo de Preservação", "Preservação Pro",
"Preservação por grupo", "Preservação por destino" — em
`dashboard/app/painel/anti-banimento/**`, nos componentes que ela usa, no upsell,
na mensagem do gate e nos motivos de adiamento que chegam ao painel
(`deferReasonMessage`, `logsCopy.js`). Nenhuma frase pode prometer que o número
não será banido. Celular: nenhuma largura fixa sem `sm:`; tabela larga só com
`overflow-x-auto`.
