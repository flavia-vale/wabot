# Auditoria Mobile - Página Inicial (/)

Data: 2026-05-09
Escopo: `dashboard/app/page.js` e componentes da landing.

## Top 3 erros de UX Mobile

1. **Overflow horizontal no hero por layout rígido em duas colunas + elementos absolutos fora da tela.**
   - `gridTemplateColumns: '1fr 0.85fr'` é aplicado sem fallback mobile no hero.
   - Cards flutuantes usam `left: -40` e `right: -50`, forçando conteúdo para fora da viewport em telas de 375–414px.
   - O mockup tem largura fixa de `300px` por card e são dois cards empilhados, pressionando o bloco inteiro dentro de um grid sem regra de colapso.

2. **Navegação desktop-only, baixa usabilidade com um polegar.**
   - Navbar mantém 3 blocos lado a lado (logo + links + CTAs) sem hamburger/drawer para mobile.
   - Links de navegação têm alvo pequeno (texto em `fontSize: 14` sem garantia de área mínima 44x44).
   - Em telas pequenas, os itens tendem a quebrar linha/desalinhar, reduzindo previsibilidade de toque.

3. **Primeira dobra visualmente entulhada e com hierarquia fraca para conversão mobile.**
   - Hero concentra título grande (`clamp(44px, 5.5vw, 76px)`), subtítulo longo, 2 CTAs, 3 trust items e mockup com notas flutuantes na mesma dobra.
   - A densidade cognitiva é alta e empurra ações críticas (ex.: login/cupom/oferta principal) para baixo ou para zonas menos acessíveis.
   - Elementos decorativos e notas sobre o mockup competem com o CTA principal.

## Risco técnico (pré-implementação)

- **Detecção de erros fatais:** sem alteração de código nesta fase; risco zero de quebra de build.
- **Breaking changes:** nenhuma mudança de contrato/API/props foi realizada.
- **Efeito cascata:** inexistente nesta fase, pois apenas auditoria documental.
- **Protocolo:** seguro prosseguir para Fase 2 somente após aprovar diagnóstico e priorização.
