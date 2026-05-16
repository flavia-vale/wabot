# Design: Filtro configurável para mensagens sem link por grupo monitorado

## Contexto
Hoje o Wabot monitora grupos e encaminha para destino apenas mensagens com link. Há demanda para permitir encaminhar também mensagens sem link (avisos, cupons em texto etc.) com controle explícito por grupo monitorado.

## Objetivo
Permitir que o usuário escolha, no cadastro/edição do grupo monitorado, se o grupo permanece em `somente com link` ou se passa a encaminhar mensagens sem link com escopo configurável.

## Requisitos funcionais
1. O comportamento padrão deve permanecer `somente com link` para grupos novos e existentes.
2. Não haverá migração automática de grupos existentes para incluir sem link.
3. A configuração deve ficar no cadastro/edição do grupo monitorado.
4. Quando `incluir sem link` estiver ativo, o usuário escolhe uma política:
   - `ALL`: tudo (texto, mídia, áudio, sticker, documentos etc.)
   - `TEXT_ONLY`: apenas mensagens textuais
   - `TEXT_IMAGE_WITH_CAPTION`: texto e imagem com legenda
5. Alterações de configuração devem valer imediatamente para as próximas mensagens, sem restart manual.

## Modelo de dados proposto
Adicionar campos no registro de grupo monitorado (ou entidade equivalente usada na regra de forwarding):

- `forwardMode` (enum):
  - `LINK_ONLY` (default)
  - `ALLOW_NO_LINK`
- `noLinkScope` (enum opcional):
  - `ALL`
  - `TEXT_ONLY`
  - `TEXT_IMAGE_WITH_CAPTION`

### Regras de consistência
- Se `forwardMode=LINK_ONLY`, `noLinkScope` pode ser `null`.
- Se `forwardMode=ALLOW_NO_LINK` e `noLinkScope` vier vazio por inconsistência, aplicar fallback seguro para `TEXT_ONLY` e registrar warning.

## Fluxo de decisão no encaminhamento
Para cada mensagem monitorada:
1. Se contém link, encaminhar (comportamento atual preservado).
2. Se não contém link:
   - `LINK_ONLY` => não encaminhar.
   - `ALLOW_NO_LINK` + `ALL` => encaminhar qualquer tipo suportado.
   - `ALLOW_NO_LINK` + `TEXT_ONLY` => encaminhar apenas mensagens de texto.
   - `ALLOW_NO_LINK` + `TEXT_IMAGE_WITH_CAPTION` => encaminhar texto + imagem com legenda.

## UX no Dashboard (grupo monitorado)
No formulário de criar/editar grupo monitorado:
- Toggle: **Incluir mensagens sem link** (desligado por padrão).
- Select condicional (apenas quando toggle ligado):
  - Tudo
  - Só texto
  - Texto + imagem com legenda
- Texto de ajuda: “Ativar pode aumentar o volume de mensagens encaminhadas.”

## API/contrato
- Endpoints de criação/edição/leitura da entidade de grupo monitorado devem aceitar/devolver `forwardMode` e `noLinkScope`.
- Deve haver validação server-side para combinações inválidas.

## Estratégia de rollout
1. Implementar e validar em `develop`.
2. Validar em staging (porta 3006) com cenários de volume.
3. Sem migração de dados de usuários para novo modo.
4. Deploy para produção apenas após validação manual em staging.

## Estratégia de testes
- Unitários para a função de decisão de encaminhamento sem link.
- Integração da API para persistência/validação dos novos campos.
- Testes de UI para estado default e renderização condicional do select.
- Smoke em staging:
  - Grupo em `LINK_ONLY` não encaminha sem link.
  - Grupo em `ALLOW_NO_LINK` + `TEXT_ONLY` encaminha só texto.
  - Grupo em `ALLOW_NO_LINK` + `TEXT_IMAGE_WITH_CAPTION` encaminha texto e imagem legendada.

## Riscos e mitigação
- **Spam por configuração indevida:** mitigado por default conservador (`LINK_ONLY`) + aviso no formulário.
- **Quebra comportamental:** mitigada por não migrar grupos existentes.
- **Inconsistência de configuração:** mitigada por validação e fallback seguro.
- **Impacto em produção:** mitigado por ciclo obrigatório via staging.
