# Plano de execução — backlog da análise Pro Afiliados

Data da revisão: **28/09/2026**. Base: `ANALISE_CONCORRENTE_PROAFILIADOS_2026-09-27.md`.

## Regra de execução

Cada item abaixo foi revisto antes da implementação. Mudanças de banco serão
aditivas, configurações antigas continuarão válidas e toda alegação pública
dependerá de dado ou autorização. A coluna **proteção** registra como a função
atual não será afetada.

| ID | O que será feito | Impactos possíveis | Proteção e aceite |
|---|---|---|---|
| B02 | Centralizar a identidade jurídica e exibi-la no rodapé, em `/quem-somos` e no schema `Organization`. | Informação legal errada prejudica confiança e SEO. | Só publicar `legalName` e `taxID` depois de receber os dados oficiais; sem valor fictício ou dado de terceiro. Teste garante consistência entre os três pontos. |
| B03 | Criar bloco reutilizável com reembolso em 7 dias, cancelamento sem multa, suporte humano e ausência de anúncios. | Promessa comercial pode divergir da política ou do plano. | Texto deriva das políticas já publicadas; home e preços usam o mesmo componente. Links levam à política e ao suporte. |
| B04 | Reutilizar uma captura real e sanitizada do painel de vendas na home, preços e página de vendas. | Print pode expor cliente, valor ou ficar desatualizado. | Aceite somente com asset aprovado, sem PII e com texto alternativo; até lá, não fabricar prova visual. |
| B05 | Mostrar no hero quatro métricas agregadas, produzidas por snapshot diário: afiliadas ativas, envios em 30 dias, lojas e dias de sessão. | Consulta ao banco no acesso público aumenta carga; números pequenos ou antigos enganam. | Hero lê arquivo estático validado, mostra data de atualização e omite métricas inválidas; geração é read-only e não cria processo residente. |
| B06 | Adicionar ajuda curta e um próximo passo em cada rota principal do painel por meio de um catálogo central. | Card repetitivo ocupa espaço, sobretudo no celular. | Um único componente no layout escolhe a copy pela rota e pode ser dispensado; não altera formulários nem chamadas da tela. |
| B07 | Exibir diagnóstico global com passo atual, tempo estimado e ação resolutiva usando os estados já carregados pelo painel. | Diagnóstico incorreto pode mandar reconectar uma sessão saudável. | Reusar o estado canônico do `PainelShell`/checklist; sem polling novo e sem declarar falha quando o dado estiver ausente. |
| B09 | Criar seis guias (`shopee`, `amazon`, `mercado-livre`, `magalu`, `shein`, `aliexpress`) com cadastro, localização do identificador e cadastro no painel. | Regras das lojas mudam e conteúdo desatualiza. | Conteúdo centralizado, fonte/data visíveis e links internos; nenhuma credencial ou cookie de exemplo real. |
| B10 | Preparar checklist, texto e evidências para reivindicar Reclame Aqui e solicitar inclusão no OfertasBot. | Ação depende de conta externa, CNPJ e aprovação humana. | Código não afirma que perfis foram reivindicados; item só conclui após comprovante/URL ser registrado. |
| B11 | Adicionar ofertas pré-pagas de 3, 6 e 12 meses ao checkout Mercado Pago, mantendo recorrência como está. | Cobrança duplicada, acesso com duração errada e desconto sem decisão comercial. | Fluxo separado/idempotente, preço definido no servidor e recorrência intocada; não ativar descontos sem tabela aprovada. Testes cobrem webhook e término do acesso. |
| B12 | Criar `/ferramentas/testar-link`, aberta e com limite de uso, que usa a conversão já existente e captura e-mail com consentimento. | Abuso da conversão, gasto de API e coleta indevida de dados. | Rate limit, lojas permitidas, resposta sem segredo, consentimento explícito e nenhum acesso às credenciais de outras contas. |
| B13 | Expor dois controles simples no destino: link do grupo e texto final em toda mensagem. | Pode duplicar rodapé ou mudar mensagens já configuradas. | Traduzir para `relayFooterText` já existente; padrão desligado e migração sem alterar valores atuais. Preview mostra o resultado antes de salvar. |
| B14 | Aplicar um FAQ comercial canônico de dez perguntas e schema `FAQPage` nas páginas comerciais. | FAQ duplicado ou resposta divergente gera inconsistência. | Fonte única de perguntas; páginas podem complementar, não sobrescrever fatos centrais. Validador impede schema sem conteúdo visível. |
| B15 | Registrar a linha de base das consultas “grátis”, “Telegram”, “comissão” e “Pro Afiliados vale a pena”. | Resultado varia por IA, conta, data e localização. | Roteiro reproduzível registra motor, data, consulta e fonte; sem inventar respostas quando a medição externa não puder ser executada. |
| B19 | Completar a aba “Próximos envios” com contagem regressiva e cancelamento individual. | Relógio pode gerar renderização excessiva; cancelamento pode atingir item enviado. | Um timer compartilhado e cancelamento atômico apenas de item pendente; atualizar lista sem apagar os demais. |
| B20 | Atribuir cliques de `/r/:hash` à oferta e ao destino e expor agregados no painel. | Alto volume de escrita, privacidade e quebra de links antigos. | Redirect continua funcionando mesmo se a medição falhar; dados mínimos, hash opaco, retenção e índices. Links antigos permanecem aceitos. |
| B21 | Cruzar vendas Shopee atribuídas com clique/envio para mostrar comissão por destino. | Atribuição não é causal e parte das vendas não terá cobertura. | Mostrar cobertura e “não atribuído”; nunca distribuir comissão sem evidência. Totais continuam iguais ao relatório Shopee. |
| B22 | Permitir mensagem com imagem em intervalo, diária ou por dias da semana. | Duplicação após restart, fuso horário e crescimento de fila. | Regra persistida, próxima execução idempotente, teto de uma ocorrência pendente por agenda e cancelamento sem apagar histórico. Sem processo PM2 novo. |
| B25 | Publicar “Proteção do número: os números do mês” com idade média, percentual de quedas e preset padrão. | Métrica pode expor contas ou prometer proteção contra banimento. | Só agregados com amostra mínima, metodologia/data e aviso de que WhatsApp decide restrições; página omite número sem amostra. |
| B26 | Completar comparativos de Afilira, Divulgador Inteligente, Divulga Ninja, Gigi Prime, Busqy, PromoBot, DivulgaLinks e OfertasBot. | Preço/funcionalidade de concorrente muda; risco de afirmação injusta. | Usar fichas centralizadas, fonte e data; declarar limites e para quem cada opção serve. Sem copiar texto do concorrente. |
| B27 | Publicar cinco depoimentos autorizados com nome e foto nas três páginas. | PII, falta de consentimento e prova social falsa. | Só entra depoimento com autorização registrada e asset entregue; sem placeholder apresentado como cliente. Componente compartilhado evita versões divergentes. |
| B28 | Confirmar página pública do programa (PIX) e adicionar card contextual no painel. | Pode confundir programa do produto com programas das lojas. | Copy distingue os dois, usa percentuais do backend e não altera cálculo/pagamento existente. |
| B40 | Permitir Status do WhatsApp como destino opcional. | Formato/limite do Status difere de grupo; envio indevido é risco alto. | Feature flag desligada por padrão, capability check, envio isolado e sem fallback para contatos/grupos. Só liberar após teste de mídia e texto. |
| B42 | Mostrar “Fila travada” somente quando houver item pendente acima do limite. | Esconder recuperação quando realmente necessária. | Decisão usa contagem e idade devolvidas pela API; estado vazio, fila andando ou dado ausente não mostra ação destrutiva. |

## Dependências externas que não podem ser inventadas

- **B02:** razão social e CNPJ oficiais.
- **B04:** captura real, aprovada e sem dados pessoais.
- **B10:** acesso/validação nos dois serviços externos.
- **B11:** descontos e valores aprovados para 3, 6 e 12 meses.
- **B15:** acesso aos motores de IA que formarão a linha de base.
- **B27:** cinco textos, fotos e permissões de publicação.
- **B40:** validação em uma conta WhatsApp de teste antes de habilitar a flag.

Essas dependências não autorizam substituir dado real por placeholder público.
O código pode deixar a estrutura pronta, mas o item só será marcado como
concluído quando a evidência correspondente existir.

## Resultado desta execução

| Estado | Itens | Evidência/decisão |
|---|---|---|
| Implementado | B03, B06, B07, B09, B13, B19, B42 | Bloco de garantia compartilhado; orientação e diagnóstico globais; seis guias; controles do rodapé; relógio/cancelamento individual; recuperação só para fila realmente presa. |
| Instrumentado, aguardando medição externa | B15 | Conjunto B15 separado no roteiro e no medidor Gemini; falta executar com chave e repetir nas outras três superfícies. |
| Já existia e foi preservado | B20 (fundação), B28 | `/r/:hash`, `AffiliateLink` e `AffiliateClick` já medem cliques, mas ainda não substituem links enviados nem exibem oferta/destino; programa de indicação já vive em `/parceiro-influenciador` e `/painel/afiliados`. Não foi movido para `/programa-de-afiliados`, pois essa URL indexada compara programas das lojas. |
| Parcial na base, sem evidência para completar | B14, B26 | Home, preços e páginas comerciais já têm FAQ visível/schema; seis dos oito comparativos pedidos já existem. PromoBot/OfertasBot não entram sem ficha datada — e o próprio plano registra que OfertasBot é o site do PromoBot. |
| Bloqueado por dado/autorização | B02, B04, B05, B10, B11, B25, B27 | CNPJ/razão social, print real, snapshot de uso, contas externas, tabela de descontos, agregados mensais e depoimentos autorizados não existem no repositório. Nada foi inventado. |
| Não liberado sem validação funcional dedicada | B12, B21, B22, B40 | Conversão pública sem credencial pode gerar link sem comissão; atribuição Shopee por grupo ainda não tem cobertura; recorrência pode duplicar agenda; Status exige conta de teste e feature flag. Permanecem fora desta entrega para não afetar o envio funcional. |

### Observação sobre B10

O plano canônico anterior (`PLANO_MAQUINA_DE_VENDAS_IA_2026-09-18.md`) registra
que pedir inclusão no ranking foi **descartado**, pois `ofertasbot.com` pertence
ao PromoBot, concorrente. `ACOES_FLAVIA_2026-09-11.md` também proíbe abrir
Reclame Aqui sem CNPJ. A instrução mais segura e baseada em evidência foi
preservada; esta execução não afirmou que qualquer ação externa ocorreu.
