## Contexto
O produto possui as telas essenciais, mas o usuário iniciante ainda precisa descobrir sozinho a ordem correta para chegar ao primeiro link convertido: conectar WhatsApp, configurar credenciais, cadastrar grupos e validar logs.

## Objetivo
Criar um onboarding guiado que leve o usuário ao primeiro resultado sem depender de suporte humano.

## Escopo
- Criar card/checklist de “Primeiros passos” na página inicial do dashboard.
- Mostrar status de cada etapa:
  - WhatsApp conectado;
  - pelo menos uma credencial cadastrada;
  - pelo menos um grupo monitorado;
  - pelo menos um grupo de postagem;
  - primeiro envio/log de sucesso.
- Adicionar CTA direto para a tela correspondente em cada etapa incompleta.
- Exibir alerta quando o usuário tentar usar funcionalidades sem setup mínimo.
- Adicionar microcopy explicando a ordem recomendada de configuração.
- Se necessário, criar endpoint agregado de readiness do usuário para evitar excesso de chamadas no frontend.

## Critérios de aceite
- [ ] Usuário novo vê uma sequência clara de configuração ao entrar no dashboard.
- [ ] Cada etapa mostra status concluído/pendente.
- [ ] Cada etapa pendente tem CTA para resolver.
- [ ] Usuário entende como fazer primeiro teste operacional.
- [ ] Checklist não bloqueia usuários avançados que já sabem operar.
- [ ] O estado do checklist reflete dados reais do backend.

## Fora de escopo
- Tutorial em vídeo.
- Tour interativo complexo com biblioteca externa.
- Automação de criação de credenciais nas plataformas de afiliado.

## Testes sugeridos
- Criar usuário novo e validar todos os passos pendentes.
- Conectar WhatsApp e validar mudança de status.
- Salvar credencial e validar mudança de status.
- Adicionar grupos monitor/post e validar mudança de status.
- Gerar primeiro log de sucesso e validar checklist completo.
- Rodar lint/build do dashboard.

## Prioridade
P0 — Blocker de lançamento assistido; essencial para reduzir churn.

## Labels sugeridas
`mvp`, `launch-readiness`, `onboarding`, `ux`, `p0`
