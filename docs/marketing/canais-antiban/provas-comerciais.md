# Provas comerciais — Canais + Preservação Avançada

Este documento define quais provas podem ser coletadas para aumentar confiança sem expor dados sensíveis de clientes, grupos, canais, chips ou links de afiliado.

## Regras de segurança

- Nunca publicar número de telefone, JID, link privado de grupo/canal, token, cookie, QR Code, dados de login ou nome de cliente sem autorização explícita.
- Prints devem borrar nomes de grupos, avatares, telefones, links e qualquer identificador sensível.
- Métricas devem ser agregadas ou anonimizadas quando não houver consentimento nominal.
- Depoimento só entra em página pública com autorização escrita.

## Inventário de provas permitidas

| Tipo | Exemplo | Onde usar | Status |
|---|---|---|---|
| Print conceitual | Painel com canais “saudável/atenção/risco” usando dados fictícios | Landing e posts sociais | Já existe como mock visual na landing |
| Microcase anonimizado | “Operação com 12 canais reduziu rajadas ao configurar intervalos” | Páginas P2 e social | Coletar |
| Métrica agregada | “X diagnósticos preenchidos; Y% com risco alto” | Social e Search Console report | Coletar depois de staging |
| Depoimento curto | Frase de afiliado com autorização | Landing e comparativo | Coletar |
| Antes/depois operacional | Antes: mensagens idênticas; depois: variações e cadência | Vídeo/carrossel | Criar com dados fictícios ou consentidos |
| Checklist preenchido | Exemplo de checklist sem dados reais | Lead magnet e social | Criar |

## Template de consentimento para depoimento

```txt
Autorizo o uso do meu depoimento abaixo pela equipe do BOTinho em páginas, posts, vídeos e materiais comerciais da campanha Canais + Preservação Avançada.

Depoimento aprovado:
"[texto exato]"

Nome exibido:
[Nome ou iniciais]

Empresa/perfil exibido:
[opcional]

Autorizo exibir print/métrica associada?
[ ] Sim, com dados borrados
[ ] Não, apenas o texto

Data:
Responsável:
```

## Perguntas para coletar microcases

1. Quantos grupos e canais a operação usava antes?
2. Qual era a maior dor: chip, queda de entrega, mensagens repetidas, falta de cadência ou recuperação?
3. Qual camada foi aplicada primeiro?
4. O que mudou operacionalmente depois?
5. Existe métrica que pode ser compartilhada de forma agregada?
6. O cliente autoriza citação nominal ou prefere anonimização?

## Banco de provas planejado

| Prova | Responsável | Prazo | Observação |
|---|---|---|---|
| 3 prints fictícios de painel/diagnóstico | Marketing + produto | Antes da divulgação forte | Usar dados ilustrativos. |
| 2 depoimentos autorizados | Sucesso do cliente | Após validação em staging | Não publicar sem consentimento. |
| 1 microcase anonimizado | Marketing | Após primeiros leads P0/P1 | Pode virar post social. |
| Métrica de diagnósticos por faixa | Growth/analytics | 14 dias após deploy | Usar apenas agregados. |
| Métrica de CTR das páginas P2 | SEO | 28 dias após indexação | Usar Search Console. |
