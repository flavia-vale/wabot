import '../app/landing.css'
import Link from 'next/link'
import { Hero } from '@/components/landing/Hero'
import { How } from '@/components/landing/How'
import { Features } from '@/components/landing/Features'
import { Social } from '@/components/landing/Social'
import { Pricing } from '@/components/landing/Pricing'
import { FAQ } from '@/components/landing/FAQ'
import Footer, { FinalCTA } from '@/components/landing/Footer'
import { IntroCard } from '@/components/landing/IntroCard'
import { getSiteUrl } from '@/lib/site-url'
import { BRAND_NAME, BRAND_SHORT_NAME, DEFAULT_LANDING_PLANS, PRODUCT_DEFINITION } from '@/lib/marketing-content'
import { getHubSeoRoute, getProgrammaticSeoRoute, getRelatedProgrammaticSeoRoutes, buildSeoRobots } from '@/lib/seo-registry.mjs'
import { OrganicPageTracker } from '@/components/marketing/OrganicPageTracker'
import { buildOgImageUrl } from '@/lib/seo-og'
import { getProofAssetsForCluster } from '@/lib/proof-assets'

export const LP_CONFIG = {
  'espelhar-grupos-whatsapp-sao-paulo': { title: 'Espelhar grupos e canais WhatsApp em São Paulo | BOTinho', description: 'Automatize sua rotina de ofertas em grupos e canais de São Paulo com o BOTinho e reduza trabalho manual.', uniqueHeadline: 'Operação em São Paulo: volume alto, rotina estável.', uniqueBody: 'Em SP, a disputa por atenção é maior e os grupos e canais giram rápido. O BOTinho ajuda você a manter constância sem perder tempo no copia-e-cola.', uniqueBullets: ['Padronize campanhas em múltiplos bairros e públicos.', 'Evite atrasos nas postagens de ofertas relâmpago.', 'Mantenha frequência diária mesmo em horários de pico.'], faq: [{ q: 'Quanto tempo para ativar em São Paulo?', a: 'Normalmente no mesmo dia: conexão por QR Code, escolha dos grupos e/ou canais e regras básicas.' }, { q: 'Posso separar grupos e/ou canais por bairro?', a: 'Sim. Você pode organizar fontes e destinos por região e tipo de público.' }], howTo: ['Conecte seu WhatsApp de operação e valide os grupos e/ou canais de origem.', 'Defina os grupos e/ou canais de destino e o intervalo ideal para o público paulista.', 'Ative regras por horário para manter consistência nos picos de tráfego.'] },
  'espelhar-grupos-whatsapp-rio-de-janeiro': { title: 'Espelhar grupos e canais WhatsApp no Rio de Janeiro | BOTinho', description: 'Ganhe escala de publicação em grupos e canais do Rio de Janeiro com operação previsível usando o BOTinho.', uniqueHeadline: 'No Rio, consistência vence improviso.', uniqueBody: 'Para campanhas no RJ, o diferencial está na repetição com timing certo. O BOTinho automatiza esse fluxo e reduz falhas de execução.', uniqueBullets: ['Mantenha cadência de ofertas por turno.', 'Distribua campanhas para grupos e/ou canais com perfis diferentes.', 'Reduza falhas manuais em dias de alto movimento.'], faq: [{ q: 'Funciona para operação no Rio inteiro?', a: 'Sim. Você pode segmentar grupos e/ou canais por cidade, zona e perfil de oferta.' }, { q: 'Preciso equipe para operar?', a: 'Não necessariamente. Muitas operações começam com uma pessoa e o bot ativo 24/7.' }], howTo: ['Mapeie grupos e/ou canais de origem com melhor volume no RJ.', 'Configure destinos por categoria de campanha.', 'Ative alertas e acompanhe logs para ajustar performance semanal.'] },
  'espelhar-grupos-whatsapp-belo-horizonte': { title: 'Espelhar grupos e canais WhatsApp em Belo Horizonte | BOTinho', description: 'Padronize e acelere campanhas em grupos e canais de Belo Horizonte com espelhamento automatizado.', uniqueHeadline: 'BH com processo enxuto e previsível.', uniqueBody: 'Em Belo Horizonte, operações menores podem ganhar escala quando padronizam fluxo, mensagem e frequência com automação.', uniqueBullets: ['Fluxo previsível para campanhas diárias.', 'Menos retrabalho na publicação de ofertas.', 'Mais controle sobre quais grupos e/ou canais recebem cada tema.'], faq: [{ q: 'O bot ajuda a padronizar copy?', a: 'Sim. A operação fica consistente e evita variação manual em cada postagem.' }, { q: 'Consigo começar com poucos grupos e/ou canais?', a: 'Sim. Você pode iniciar com 2 ou 3 grupos e expandir gradualmente.' }], howTo: ['Escolha grupos e/ou canais de origem com melhor taxa de cliques.', 'Defina mensagens-padrão para campanhas recorrentes.', 'Escalone para novos grupos e/ou canais após uma semana de dados.'] },
  'espelhar-grupos-whatsapp-curitiba': { title: 'Espelhar grupos e canais WhatsApp em Curitiba | BOTinho', description: 'Reduza esforço operacional e aumente consistência de postagens em grupos e canais de Curitiba.', uniqueHeadline: 'Curitiba: menos operação manual, mais previsibilidade.', uniqueBody: 'Se sua rotina depende de copiar e colar links, a automação reduz ruído e mantém a régua de qualidade das campanhas.', uniqueBullets: ['Automatize campanhas sem perder controle.', 'Mantenha padrão de postagem por nicho.', 'Use histórico de logs para otimizar horários.'], faq: [{ q: 'Dá para operar múltiplos nichos em Curitiba?', a: 'Sim. Separe grupos e/ou canais por nicho e crie rotinas dedicadas para cada um.' }, { q: 'Como evitar spam?', a: 'Com intervalos e regras por grupo/canal de destino para reduzir repetição.' }], howTo: ['Conecte os grupos e/ou canais principais da sua operação em Curitiba.', 'Ajuste filtros por palavras-chave e horários.', 'Revise relatórios semanais para evoluir campanhas.'] },
  'espelhar-grupos-whatsapp-porto-alegre': { title: 'Espelhar grupos e canais WhatsApp em Porto Alegre | BOTinho', description: 'Automatize a distribuição de ofertas em Porto Alegre e mantenha uma rotina estável de divulgação.', uniqueHeadline: 'Porto Alegre com rotina de ofertas sem gargalo.', uniqueBody: 'O BOTinho transforma uma operação dependente de esforço manual em um fluxo contínuo com registro e controle.', uniqueBullets: ['Distribuição rápida para grupos e/ou canais de destino.', 'Menor risco de esquecer ofertas importantes.', 'Mais tempo para analisar resultados e criativos.'], faq: [{ q: 'Existe suporte no onboarding?', a: 'Sim. O início pode ser guiado para reduzir tempo de configuração.' }, { q: 'Funciona para operação diária?', a: 'Sim. A proposta é justamente manter constância com menor esforço humano.' }], howTo: ['Defina as fontes de ofertas mais confiáveis.', 'Crie destinos por segmento e prioridade.', 'Ative o espelhamento e ajuste regras com base nos logs.'] },

  'espelhar-grupos-whatsapp-recife': { title: 'Espelhar grupos e canais WhatsApp em Recife | BOTinho', description: 'Automatize campanhas em grupos e canais de Recife com uma rotina previsível de espelhamento.', uniqueHeadline: 'Recife: operação regional com cadência diária.', uniqueBody: 'Em Recife, campanhas de ofertas precisam acompanhar horários de maior atenção sem depender de cópia manual. O BOTinho mantém o fluxo ativo e organizado.', uniqueBullets: ['Distribua ofertas para grupos e/ou canais por região e interesse.', 'Reduza atrasos em campanhas de alta concorrência.', 'Acompanhe logs para ajustar horários com mais resposta.'], faq: [{ q: 'Como ativar uma operação em Recife?', a: 'Conecte o WhatsApp, selecione grupos e/ou canais de origem e destino e valide as primeiras regras no onboarding.' }, { q: 'Posso separar campanhas por público?', a: 'Sim. Você pode organizar destinos por bairro, categoria ou perfil de compra.' }], howTo: ['Mapeie os grupos e/ou canais de Recife com maior volume de oportunidades.', 'Defina destinos por região, categoria e prioridade.', 'Ative a rotina e revise os primeiros logs de publicação.'] },
  'espelhar-grupos-whatsapp-salvador': { title: 'Espelhar grupos e canais WhatsApp em Salvador | BOTinho', description: 'Ganhe consistência na divulgação em grupos e canais de Salvador com automação para WhatsApp.', uniqueHeadline: 'Salvador com campanhas constantes e menos retrabalho.', uniqueBody: 'Operações locais em Salvador podem escalar quando deixam de depender de postagens manuais e passam a seguir uma rotina de distribuição controlada.', uniqueBullets: ['Mantenha frequência mesmo em horários de pico.', 'Padronize mensagens para diferentes grupos locais.', 'Escalone campanhas sem contratar equipe adicional.'], faq: [{ q: 'Funciona para grupos de ofertas em Salvador?', a: 'Sim. O fluxo foi pensado para monitorar fontes, espelhar mensagens e manter consistência em grupos e canais de destino.' }, { q: 'Como reduzir risco de repetição excessiva?', a: 'Use intervalos, filtros e segmentação por grupo para controlar a cadência.' }], howTo: ['Escolha fontes confiáveis de ofertas para Salvador.', 'Separe grupos e/ou canais de destino por perfil de audiência.', 'Configure intervalos e monitore a consistência da operação.'] },
  'espelhar-grupos-whatsapp-fortaleza': { title: 'Espelhar grupos e canais WhatsApp em Fortaleza | BOTinho', description: 'Automatize a publicação em grupos e canais de Fortaleza e reduza falhas de rotina com o BOTinho.', uniqueHeadline: 'Fortaleza: distribuição ágil sem operação pesada.', uniqueBody: 'Quando a rotina cresce, o gargalo aparece no copia-e-cola. O BOTinho ajuda operações em Fortaleza a publicar com velocidade e controle.', uniqueBullets: ['Acelere ofertas relâmpago para grupos e canais prioritários.', 'Organize destinos por nicho, região ou ticket.', 'Mantenha histórico de envios para decisões semanais.'], faq: [{ q: 'Dá para começar com poucos grupos e/ou canais?', a: 'Sim. A recomendação é iniciar enxuto, validar o fluxo e ampliar com base nos dados.' }, { q: 'Preciso ficar online para postar?', a: 'Depois de configurado, o bot mantém a rotina conforme as regras definidas.' }], howTo: ['Conecte o número usado na operação de Fortaleza.', 'Defina origem, destino e regras de intervalo.', 'Acompanhe os envios iniciais e ajuste os grupos e canais prioritários.'] },
  'espelhar-grupos-whatsapp-brasilia': { title: 'Espelhar grupos e canais WhatsApp em Brasília | BOTinho', description: 'Padronize campanhas em grupos e canais de Brasília com espelhamento automatizado para WhatsApp.', uniqueHeadline: 'Brasília: previsibilidade para múltiplos públicos.', uniqueBody: 'Com audiências distribuídas por regiões administrativas, a automação ajuda a manter mensagem, frequência e controle sem aumentar a operação manual.', uniqueBullets: ['Crie rotinas por região administrativa ou nicho.', 'Evite falhas em campanhas recorrentes.', 'Ganhe clareza com logs de publicação e ajustes por grupo/canal.'], faq: [{ q: 'Posso organizar grupos e/ou canais por região administrativa?', a: 'Sim. Você pode separar grupos e/ou canais de destino e ajustar a cadência por conjunto.' }, { q: 'O onboarding ajuda na primeira configuração?', a: 'Sim. O trial guiado foi desenhado para acelerar o primeiro espelhamento.' }], howTo: ['Liste fontes e destinos relevantes para Brasília.', 'Configure regras por grupo/canal e prioridade de campanha.', 'Valide o primeiro espelhamento e acompanhe a rotina diária.'] },
  'espelhar-grupos-whatsapp-goiania': { title: 'Espelhar grupos e canais WhatsApp em Goiânia | BOTinho', description: 'Escale a divulgação em grupos e canais de Goiânia com automação e menos trabalho manual.', uniqueHeadline: 'Goiânia: campanha local com execução consistente.', uniqueBody: 'O BOTinho ajuda operações em Goiânia a manter presença diária em grupos e canais sem depender de uma sequência manual de postagens.', uniqueBullets: ['Distribua ofertas por categoria e perfil de público.', 'Reduza esquecimentos em campanhas de maior giro.', 'Use o histórico para refinar horários e destinos.'], faq: [{ q: 'Funciona para afiliados em Goiânia?', a: 'Sim. Você pode organizar ofertas e espelhar mensagens para grupos e/ou canais de destino com regras de operação.' }, { q: 'Como controlar a frequência?', a: 'Defina intervalos e revise logs para ajustar a cadência ideal.' }], howTo: ['Mapeie os grupos e canais com maior aderência em Goiânia.', 'Crie rotinas por tipo de oferta e grupo/canal de destino.', 'Ative a automação e ajuste a frequência após os primeiros dados.'] },
  'espelhar-grupos-whatsapp-campinas': { title: 'Espelhar grupos e canais WhatsApp em Campinas | BOTinho', description: 'Automatize ofertas em grupos e canais de Campinas e mantenha uma operação previsível com o BOTinho.', uniqueHeadline: 'Campinas: escala regional com processo simples.', uniqueBody: 'Para operações que atendem Campinas e região, o BOTinho reduz retrabalho e mantém campanhas rodando com padrão de mensagem e frequência.', uniqueBullets: ['Organize grupos e/ou canais por Campinas e cidades próximas.', 'Mantenha rotina estável para ofertas recorrentes.', 'Ganhe tempo para analisar criativos e resultados.'], faq: [{ q: 'Posso incluir cidades próximas de Campinas?', a: 'Sim. A estrutura de grupos permite separar destinos por cidade ou região atendida.' }, { q: 'Quanto tempo leva para testar?', a: 'O objetivo do trial guiado é colocar o primeiro espelhamento no ar rapidamente após o setup.' }], howTo: ['Separe grupos e/ou canais de origem e destino da região de Campinas.', 'Defina regras de postagem por campanha.', 'Monitore os primeiros envios e expanda para novos grupos e/ou canais.'] },
  'espelhar-grupos-whatsapp-manaus': { title: 'Espelhar grupos e canais WhatsApp em Manaus | BOTinho', description: 'Reduza trabalho manual em grupos e canais de Manaus com espelhamento automatizado de campanhas.', uniqueHeadline: 'Manaus: rotina de divulgação sem depender do improviso.', uniqueBody: 'Em operações com muitos grupos, a consistência pesa mais que esforço pontual. O BOTinho cria uma rotina de espelhamento para manter campanhas ativas.', uniqueBullets: ['Publique com cadência em grupos e canais prioritários.', 'Organize mensagens por categoria e audiência.', 'Evite perder ofertas por falha ou atraso operacional.'], faq: [{ q: 'O BOTinho ajuda em campanhas diárias?', a: 'Sim. A automação mantém a rotina conforme as regras configuradas.' }, { q: 'Consigo revisar o que foi enviado?', a: 'Sim. Os logs ajudam a acompanhar envios e ajustar a operação.' }], howTo: ['Identifique fontes com bom volume para Manaus.', 'Configure grupos e/ou canais de destino por prioridade.', 'Ative o espelhamento e revise os registros de envio.'] },
  'espelhar-grupos-whatsapp-belem': { title: 'Espelhar grupos e canais WhatsApp em Belém | BOTinho', description: 'Organize e escale divulgação em grupos e canais de Belém com automação de WhatsApp.', uniqueHeadline: 'Belém: consistência para campanhas locais de ofertas.', uniqueBody: 'A operação local ganha previsibilidade quando fontes, destinos e frequência deixam de depender de tarefa manual repetitiva.', uniqueBullets: ['Padronize campanhas para diferentes grupos locais.', 'Aumente velocidade em ofertas com validade curta.', 'Acompanhe resultados iniciais por rotina e categoria.'], faq: [{ q: 'Dá para segmentar grupos em Belém?', a: 'Sim. Você pode criar conjuntos de destino por interesse, região ou categoria de campanha.' }, { q: 'Como saber se a rotina está funcionando?', a: 'Acompanhe logs de envio e indicadores de resposta para ajustar horários e mensagens.' }], howTo: ['Defina os grupos e/ou canais de origem mais confiáveis.', 'Agrupe destinos por perfil de audiência em Belém.', 'Configure a cadência e otimize após os primeiros envios.'] },
  'espelhar-grupos-whatsapp-florianopolis': { title: 'Espelhar grupos e canais WhatsApp em Florianópolis | BOTinho', description: 'Mantenha campanhas em grupos e canais de Florianópolis com rotina automatizada e controle operacional.', uniqueHeadline: 'Florianópolis: operação enxuta para públicos segmentados.', uniqueBody: 'Com grupos segmentados por região e interesse, a automação ajuda a entregar mensagens certas com menos esforço manual.', uniqueBullets: ['Separe campanhas por ilha, continente ou nicho.', 'Controle intervalos para preservar qualidade da audiência.', 'Use dados de envio para refinar a rotina semanal.'], faq: [{ q: 'Funciona para operação regional em Florianópolis?', a: 'Sim. É possível organizar grupos e/ou canais por região, nicho e prioridade de campanha.' }, { q: 'O trial inclui orientação de setup?', a: 'Sim. A proposta do trial guiado é acelerar a ativação inicial.' }], howTo: ['Mapeie grupos e/ou canais por região e tipo de oferta.', 'Defina regras de cadência para cada conjunto.', 'Ative o fluxo e revise os resultados da primeira semana.'] },
  'espelhar-grupos-whatsapp-vitoria': { title: 'Espelhar grupos e canais WhatsApp em Vitória | BOTinho', description: 'Automatize a distribuição em grupos e canais de Vitória e ganhe consistência nas campanhas.', uniqueHeadline: 'Vitória: divulgação local com controle e repetição.', uniqueBody: 'O BOTinho transforma a rotina de postar manualmente em grupos e canais de Vitória em um processo controlado, rastreável e mais previsível.', uniqueBullets: ['Mantenha presença diária sem sobrecarga manual.', 'Organize destinos por perfil de oferta e audiência.', 'Reduza falhas em campanhas recorrentes ou sazonais.'], faq: [{ q: 'Como começar em Vitória?', a: 'Conecte o número de operação, selecione grupos e configure a primeira regra de espelhamento.' }, { q: 'Posso ajustar grupos depois?', a: 'Sim. A operação pode começar simples e evoluir com novos destinos e filtros.' }], howTo: ['Selecione fontes e destinos da operação em Vitória.', 'Configure mensagens, intervalos e prioridade de grupos.', 'Valide o primeiro espelhamento e acompanhe os logs.'] },
  'bot-ofertas-supermercado-whatsapp': { title: 'Bot de ofertas para supermercado no WhatsApp | BOTinho', description: 'Organize e acelere campanhas de supermercado em grupos e canais com automação inteligente.', uniqueHeadline: 'Supermercado: calendário de ofertas com ritmo diário.', uniqueBody: 'Campanhas de supermercado exigem frequência e velocidade. O BOTinho ajuda a publicar com consistência e menos retrabalho.', uniqueBullets: ['Destaque ofertas sazonais sem atraso.', 'Padronize mensagens por categoria de produto.', 'Mantenha fluxo contínuo nos dias de maior demanda.'], faq: [{ q: 'Como organizar o calendário semanal?', a: 'Com rotinas por dia e categoria, mantendo previsibilidade para o público.' }, { q: 'Consigo separar ofertas por perfil?', a: 'Sim. Você pode dividir destinos por interesse e ticket médio.' }], howTo: ['Defina categorias principais (hortifruti, limpeza, mercearia).', 'Organize grupos e/ou canais de destino por perfil de compra.', 'Automatize disparos e monitore clique por categoria.'] },
  'bot-ofertas-farmacia-whatsapp': { title: 'Bot de ofertas para farmácia no WhatsApp | BOTinho', description: 'Padronize publicação de ofertas de farmácia no WhatsApp com o BOTinho.', uniqueHeadline: 'Farmácia: campanhas recorrentes com precisão.', uniqueBody: 'No nicho farma, repetição inteligente gera confiança. O BOTinho facilita distribuição constante e organizada.', uniqueBullets: ['Campanhas por linha de cuidado e bem-estar.', 'Mais consistência em promoções recorrentes.', 'Menos falhas operacionais em horários críticos.'], faq: [{ q: 'Dá para priorizar categorias de alta saída?', a: 'Sim. Você pode ajustar prioridades por linha e período.' }, { q: 'O bot ajuda em campanhas mensais?', a: 'Sim. A automação reduz esforço para manter calendário ativo.' }], howTo: ['Separe ofertas por categoria farmacêutica.', 'Configure públicos por faixa de interesse.', 'Ajuste frequência para evitar repetição excessiva.'] },
  'bot-ofertas-eletronicos-whatsapp': { title: 'Bot de ofertas para eletrônicos no WhatsApp | BOTinho', description: 'Mantenha constância e velocidade na divulgação de eletrônicos com automação para grupos.', uniqueHeadline: 'Eletrônicos: timing é margem.', uniqueBody: 'Para eletrônicos, atraso custa conversão. O BOTinho acelera distribuição e ajuda você a aproveitar janelas curtas de preço.', uniqueBullets: ['Publicação rápida para promoções-relâmpago.', 'Rotina estável em lançamentos e datas promocionais.', 'Melhor controle de campanhas por ticket e categoria.'], faq: [{ q: 'Como evitar perder oferta relâmpago?', a: 'Com automação ativa e grupos e/ou canais de destino prontos por categoria.' }, { q: 'Posso segmentar por faixa de preço?', a: 'Sim. Você pode separar mensagens por perfil de público.' }], howTo: ['Priorize fontes com maior volume de eletrônicos.', 'Separe destinos por ticket (entrada, intermediário, premium).', 'Monitore horários de maior conversão e ajuste regras.'] },
  'bot-ofertas-moda-whatsapp': { title: 'Bot de ofertas para moda no WhatsApp | BOTinho', description: 'Aumente previsibilidade das campanhas de moda com uma rotina automatizada.', uniqueHeadline: 'Moda: consistência que vira hábito de compra.', uniqueBody: 'No nicho moda, recorrência e curadoria fazem diferença. O BOTinho organiza a distribuição para manter engajamento contínuo.', uniqueBullets: ['Campanhas por coleção e sazonalidade.', 'Mensagens consistentes para fortalecer marca.', 'Mais escala sem aumentar operação manual.'], faq: [{ q: 'Como manter frequência sem cansar o público?', a: 'Com regras de intervalo e segmentação por interesse.' }, { q: 'Posso separar campanhas por estilo?', a: 'Sim. Você pode criar rotinas por subnicho e persona.' }], howTo: ['Estruture grupos e/ou canais por estilo e público-alvo.', 'Defina janelas de postagem por campanha.', 'Refine mensagens com base no desempenho semanal.'] },
  'bot-ofertas-infoprodutos-whatsapp': { title: 'Bot de ofertas para infoprodutos no WhatsApp | BOTinho', description: 'Escale ofertas de infoprodutos em grupos e canais com copy orientada a conversão, conferência de link monetizado e distribuição consistente.', uniqueHeadline: 'Infoprodutos: conversão previsível com processo claro.', uniqueBody: 'Em infoprodutos, resultado depende de promessa alinhada, prova, timing e link correto. O BOTinho ajuda a padronizar copy, validar tag/código de afiliado e manter frequência de divulgação sem caos operacional.', uniqueBullets: ['Resposta direta: valide oferta, promessa e link monetizado antes de distribuir.', 'Copywriting com foco em dor, transformação e CTA objetivo.', 'Automação com cadência controlada para preservar qualidade e contexto dos grupos e/ou canais.'], faq: [{ q: 'Como reduzir perda de comissão em campanhas de infoprodutos?', a: 'Revise no celular se o link final mantém tag/código de afiliado após redirecionamentos e se o destino corresponde à oferta prometida.' }, { q: 'Essa página promete integração oficial com plataformas de infoproduto?', a: 'Não. O foco é processo operacional de divulgação e conferência, sem promessa de integração não aprovada.' }], howTo: ['Selecione ofertas com promessa clara, prova e prazo comercial válidos.', 'Confirme o link monetizado com tag/código de afiliado ativo e destino correto.', 'Publique com copy curta e segmentada por grupo, e use logs para otimizar a próxima rotina.'] },
  'bot-ofertas-cursos-whatsapp': { title: 'Bot de ofertas para cursos no WhatsApp | BOTinho', description: 'Escale campanhas de cursos em grupos e canais de WhatsApp com copy persuasiva, conferência de link monetizado e distribuição previsível.', uniqueHeadline: 'Cursos: mais matrículas com rotina, não com improviso.', uniqueBody: 'No nicho de cursos, a conversão depende de clareza de benefício, urgência real e link correto. O BOTinho ajuda a padronizar copy, validar tag de afiliado e distribuir para grupos e/ou canais compatíveis com cadência controlada.', uniqueBullets: ['Resposta direta: confira oferta e link de afiliado antes de escalar.', 'Copywriting de conversão: dor, transformação, prova e CTA objetivo.', 'Distribuição em grupos e canais segmentados para aumentar relevância e reduzir ruído.'], faq: [{ q: 'Como evitar perder comissão em campanhas de cursos?', a: 'Antes de divulgar, valide no celular se o link final mantém tag/código de afiliado e aponta para a página correta do curso.' }, { q: 'A página promete integração oficial com plataformas de curso?', a: 'Não. O foco é no processo de operação e divulgação: curadoria, conferência e distribuição, sem prometer integração não aprovada.' }], howTo: ['Escolha ofertas de cursos com proposta clara, preço e prazo de inscrição válidos.', 'Confira o link monetizado, incluindo redirecionamento e tag/código de afiliado ativo.', 'Distribua com copy curta e CTA específico por grupo, depois revise logs para otimizar a próxima campanha.'] },
  'bot-ofertas-autopecas-whatsapp': { title: 'Bot de ofertas para autopeças no WhatsApp | BOTinho', description: 'Acelere campanhas de autopeças em grupos e canais de WhatsApp com copy padronizada, conferência de link e distribuição previsível.', uniqueHeadline: 'Autopeças: menos improviso, mais giro de oferta.', uniqueBody: 'No nicho de autopeças, oportunidade tem janela curta e margem sensível. Com um processo claro, você revisa link monetizado, padroniza a copy e distribui para os grupos e canais certos sem depender de operação manual repetitiva.', uniqueBullets: ['Resposta direta: valide oferta + link monetizado antes de escalar.', 'Copywriting orientado a conversão: benefício, condição, prazo e CTA objetivo.', 'Distribuição com cadência controlada para reduzir ruído e preservar qualidade do grupo.'], faq: [{ q: 'Como evitar perder comissão por link errado em autopeças?', a: 'Antes de publicar, abra o link no celular e confirme se tag/código de afiliado permanece após redirecionamentos e se o destino final está correto.' }, { q: 'Esse fluxo promete integração oficial com marketplaces de autopeças?', a: 'Não. A proposta é operacional: curadoria, conferência de link e distribuição. Sem prometer integração não aprovada.' }], howTo: ['Escolha ofertas com preço, disponibilidade e prazo de validade conferidos.', 'Revise o link monetizado e confirme que a comissão está atribuível (tag/código ativo).', 'Publique com copy curta e clara, depois distribua por grupos segmentados e acompanhe os logs.'] },
  'bot-ofertas-turismo-whatsapp': { title: 'Bot de ofertas para turismo no WhatsApp | BOTinho', description: 'Organize campanhas de turismo em grupos e canais de WhatsApp com rotina de curadoria, conferência de link e distribuição consistente.', uniqueHeadline: 'Turismo: timing promocional com operação previsível.', uniqueBody: 'Ofertas de turismo mudam rápido por data, disponibilidade e condição comercial. O BOTinho ajuda a padronizar revisão de link monetizado e distribuir mensagens com cadência para reduzir erro operacional.', uniqueBullets: ['Rotina para ofertas sazonais e janelas promocionais curtas.', 'Conferência de link monetizado/tag de afiliado antes da distribuição.', 'Automação com controle de frequência para evitar sobrecarga nos grupos e/ou canais.'], faq: [{ q: 'Posso automatizar sem revisar condições da oferta?', a: 'Não. A prática recomendada é validar preço, regras, disponibilidade e link de afiliado antes de ativar a distribuição.' }, { q: 'Esse fluxo promete integração direta com plataformas de turismo?', a: 'Não. O conteúdo aborda processo operacional de divulgação e conferência, sem prometer integração não aprovada.' }], howTo: ['Selecione ofertas de turismo com condições e prazo válidos.', 'Valide no celular se o link final preserva tag/código de afiliado e destino correto.', 'Distribua para grupos e/ou canais compatíveis e acompanhe logs para ajustes de cadência e qualidade.'] },
  'bot-ofertas-pet-shop-whatsapp': { title: 'Bot de ofertas para pet shop no WhatsApp | BOTinho', description: 'Escale ofertas de pet shop em grupos e canais do WhatsApp com rotina padronizada de curadoria, conferência de link e distribuição.', uniqueHeadline: 'Pet shop: constância de ofertas sem caos operacional.', uniqueBody: 'No nicho pet, a recorrência de compra favorece operações consistentes. O BOTinho ajuda a validar oferta, manter padrão de copy e distribuir com cadência responsável em grupos e canais segmentados.', uniqueBullets: ['Rotina de ofertas por categoria (ração, higiene, acessórios).', 'Conferência prévia de link monetizado/tag de afiliado para reduzir perda de comissão.', 'Distribuição com frequência controlada para preservar qualidade dos grupos e/ou canais.'], faq: [{ q: 'O bot substitui validação de oferta e link?', a: 'Não. A recomendação é validar oferta, estoque, cupom e link monetizado antes de automatizar a distribuição.' }, { q: 'Posso usar para afiliados de pet shop sem integração específica?', a: 'Sim. O fluxo foca no processo operacional (curadoria, conferência e distribuição), sem prometer integração não aprovada com plataformas externas.' }], howTo: ['Selecione ofertas pet com preço, estoque e prazo válidos.', 'Confira se o link final mantém tag/código de afiliado e destino correto no celular.', 'Distribua para grupos e/ou canais compatíveis e monitore logs para ajustar cadência e desempenho.'] },
  'bot-ofertas-afiliados-whatsapp': { title: 'Não perca comissão de afiliado | BOTinho', description: 'Escalone divulgação de links monetizados em grupos e canais com processo claro de conferência e distribuição.', uniqueHeadline: 'Afiliados: escala com proteção de comissão.', uniqueBody: 'No nicho de afiliados, um link errado pode custar comissão. O BOTinho apoia a rotina de conferência, padronização de copy e distribuição em grupos e canais com consistência operacional.', uniqueBullets: ['Conferência de tag/código de afiliado antes de divulgar.', 'Padronização de mensagens para reduzir erros de operação.', 'Distribuição em grupos e canais com intervalo e rastreio para evitar retrabalho.'], faq: [{ q: 'O bot garante comissão do afiliado?', a: 'Não. A comissão depende das regras da plataforma e da configuração correta do link monetizado. O bot ajuda a organizar o processo de conferência e distribuição.' }, { q: 'Posso usar em diferentes programas de afiliado?', a: 'Sim. A página foca no processo operacional de validar link, copy e grupos, sem prometer integração específica não aprovada.' }], howTo: ['Valide destino final e tag/código do link de afiliado no celular.', 'Padronize a copy da oferta com preço, prazo e CTA claro.', 'Distribua para grupos e/ou canais compatíveis e revise logs para corrigir falhas rapidamente.'] },

  'bot-ofertas-beleza-whatsapp': { title: 'Bot de ofertas para beleza no WhatsApp | BOTinho', description: 'Acelere campanhas de beleza no WhatsApp com processos de distribuição em escala.', uniqueHeadline: 'Beleza: operação contínua para campanhas de alta recorrência.', uniqueBody: 'Produtos de beleza pedem constância e timing promocional. O BOTinho automatiza a rotina para manter presença e conversão.', uniqueBullets: ['Rotina de divulgação para skincare, make e haircare.', 'Padronização de mensagens para aumentar confiança.', 'Escala com menos esforço no dia a dia.'], faq: [{ q: 'Como começar rápido no nicho beleza?', a: 'Comece com poucos grupos e/ou canais, valide resposta e amplie com dados.' }, { q: 'Como medir ROI inicial?', a: 'Acompanhe cliques, comissão e frequência por categoria.' }], howTo: ['Crie trilhas por categoria de beleza.', 'Ative distribuição para grupos e/ou canais com maior engajamento.', 'Ajuste ofertas por sazonalidade e campanhas temáticas.'] },

  'automatizar-divulgacao-em-grupos-whatsapp': { lpType: 'pain', title: 'Automatizar divulgação em grupos e canais WhatsApp | BOTinho', description: 'Resolva o gargalo de divulgar manualmente em grupos e canais do WhatsApp com uma rotina automatizada e controlada.', uniqueHeadline: 'Diagnóstico: divulgação manual trava escala.', uniqueBody: 'Quando cada campanha depende de copiar, colar e conferir grupo por grupo, a operação perde velocidade. O BOTinho transforma a divulgação em um fluxo repetível com origem, destino e cadência definidos.', uniqueBullets: ['Menos tempo gasto em tarefas repetitivas.', 'Mais previsibilidade na publicação de ofertas.', 'Métrica esperada: redução do tempo operacional por campanha.'], faq: [{ q: 'Como automatizar divulgação em grupos e canais sem perder controle?', a: 'Mapeie fontes e destinos, defina regras de intervalo e acompanhe logs para ajustar a operação.' }, { q: 'Preciso mudar minha rotina inteira?', a: 'Não. Comece com uma campanha recorrente, valide o fluxo e expanda gradualmente.' }], howTo: ['Diagnostique quais grupos e/ou canais consomem mais tempo manual.', 'Configure origem, destino e intervalo de publicação no BOTinho.', 'Acompanhe logs e ajuste a cadência conforme resposta do público.'] },
  'escalar-grupos-ofertas-sem-equipe': { lpType: 'pain', title: 'Escalar grupos e canais de ofertas sem equipe | BOTinho', description: 'Escale grupos e canais de ofertas no WhatsApp sem contratar equipe adicional para tarefas repetitivas.', uniqueHeadline: 'Diagnóstico: crescimento sem processo vira gargalo.', uniqueBody: 'Mais grupos e canais não precisam significar mais pessoas copiando links. Com o BOTinho, a operação ganha processo para multiplicar distribuição mantendo controle de cadência.', uniqueBullets: ['Aumente cobertura sem ampliar equipe manual.', 'Padronize o fluxo de postagem entre grupos e canais.', 'Métrica esperada: mais grupos/canais ativos por operador.'], faq: [{ q: 'Dá para escalar com uma pessoa só?', a: 'Sim. A automação permite começar com operação enxuta e ampliar grupos e/ou canais por etapas.' }, { q: 'Como evitar bagunça ao crescer?', a: 'Separe grupos e/ou canais por prioridade, nicho e frequência antes de ativar novas rotinas.' }], howTo: ['Liste os grupos e canais que já performam melhor.', 'Crie conjuntos de destino por prioridade operacional.', 'Ative novas rotinas aos poucos e acompanhe produtividade por operador.'] },
  'postar-em-varios-grupos-whatsapp-ao-mesmo-tempo': { lpType: 'pain', title: 'Postar em vários grupos e/ou canais WhatsApp ao mesmo tempo | BOTinho', description: 'Organize postagens em vários grupos e/ou canais do WhatsApp com automação, intervalos e rastreio de envios.', uniqueHeadline: 'Diagnóstico: postar em massa sem regra gera risco e falha.', uniqueBody: 'O objetivo não é disparar sem controle, e sim publicar com sequência, intervalo e registro. O BOTinho ajuda a transformar múltiplos grupos e/ou canais em uma rotina rastreável.', uniqueBullets: ['Controle intervalos entre envios para reduzir repetição.', 'Evite esquecer grupos importantes.', 'Métrica esperada: aumento da cobertura com menos falhas.'], faq: [{ q: 'O bot envia tudo de uma vez?', a: 'A operação pode usar intervalos e regras para manter uma cadência mais segura e organizada.' }, { q: 'Consigo ver onde já foi postado?', a: 'Sim. Os logs ajudam a acompanhar envios e detectar falhas de rotina.' }], howTo: ['Agrupe os destinos por prioridade e tipo de público.', 'Defina intervalo e ordem de publicação.', 'Revise logs para confirmar cobertura e ajustar exceções.'] },
  'padronizar-divulgacao-afiliado-whatsapp': { lpType: 'pain', title: 'Padronizar divulgação de afiliado no WhatsApp | BOTinho', description: 'Padronize a divulgação de links de afiliado no WhatsApp com mensagens consistentes e fluxo operacional.', uniqueHeadline: 'Diagnóstico: cada postagem diferente reduz controle.', uniqueBody: 'Afiliados ganham escala quando têm padrão de mensagem, horário e destino. O BOTinho ajuda a manter a mesma régua operacional sem depender de edição manual em cada grupo/canal.', uniqueBullets: ['Copy mais consistente por campanha.', 'Menos variação manual entre grupos e canais.', 'Métrica esperada: melhora na leitura de CTR por categoria.'], faq: [{ q: 'Como padronizar sem parecer robótico?', a: 'Use modelos base, segmentação por grupo/canal e ajustes por categoria de oferta.' }, { q: 'Serve para várias redes de afiliado?', a: 'Sim. O foco da LP é o processo de divulgação, independentemente da origem da oferta.' }], howTo: ['Defina modelos de mensagem por tipo de oferta.', 'Separe destinos por público e categoria.', 'Use logs para comparar desempenho entre padrões de divulgação.'] },
  'aumentar-conversao-em-grupos-de-cupons': { lpType: 'pain', title: 'Aumentar conversão em grupos e canais de cupons | BOTinho', description: 'Aumente a conversão em grupos e canais de cupons com consistência de postagem, timing e organização operacional.', uniqueHeadline: 'Diagnóstico: conversão cai quando timing falha.', uniqueBody: 'Cupom bom precisa chegar na hora certa e para o grupo/canal certo. O BOTinho reduz atraso operacional e ajuda a manter frequência para capturar oportunidades de compra.', uniqueBullets: ['Mais velocidade em cupons com validade curta.', 'Segmentação por interesse ou ticket.', 'Métrica esperada: melhora de clique por oferta publicada.'], faq: [{ q: 'Automação melhora conversão sozinha?', a: 'Ela melhora consistência e timing; a conversão também depende da oferta, copy e público.' }, { q: 'Como medir evolução?', a: 'Compare cliques, horários e categorias antes e depois da rotina automatizada.' }], howTo: ['Identifique categorias de cupom com maior resposta.', 'Configure grupos e/ou canais de destino por interesse.', 'Ajuste horários e cadência com base nos logs de envio.'] },
  'consistencia-postagens-em-grupos': { lpType: 'pain', title: 'Consistência de postagens em grupos e canais | BOTinho', description: 'Mantenha consistência de postagens em grupos e canais do WhatsApp sem depender de lembretes manuais.', uniqueHeadline: 'Diagnóstico: consistência quebra quando depende de memória.', uniqueBody: 'A operação perde força quando publica muito em um dia e some no outro. O BOTinho ajuda a criar uma cadência previsível para manter presença sem sobrecarga.', uniqueBullets: ['Rotina de publicação mais estável.', 'Menos campanhas esquecidas em horários importantes.', 'Métrica esperada: aumento de dias com postagem ativa.'], faq: [{ q: 'Como manter consistência sem virar spam?', a: 'Defina intervalos, limite por grupo/canal e priorize campanhas realmente relevantes.' }, { q: 'Dá para ajustar por dia da semana?', a: 'Sim. A operação pode evoluir conforme horários e dias de melhor resposta.' }], howTo: ['Mapeie dias e horários críticos da operação.', 'Crie uma cadência inicial por grupo/canal de destino.', 'Revise a frequência semanal e ajuste o volume de postagens.'] },
  'reduzir-tempo-operacional-em-grupos-whatsapp': { lpType: 'pain', title: 'Reduzir tempo operacional em grupos e canais WhatsApp | BOTinho', description: 'Reduza o tempo operacional gasto com grupos e canais do WhatsApp automatizando tarefas repetitivas de divulgação.', uniqueHeadline: 'Diagnóstico: tempo operacional invisível consome margem.', uniqueBody: 'Minutos repetidos em cada grupo/canal viram horas por semana. O BOTinho centraliza o fluxo de espelhamento para que a equipe foque em oferta, copy e análise.', uniqueBullets: ['Menos copia-e-cola entre grupos e canais.', 'Mais tempo para curadoria e estratégia.', 'Métrica esperada: horas economizadas por semana.'], faq: [{ q: 'Como calcular o tempo economizado?', a: 'Compare o tempo médio por campanha manual com o tempo de revisão após automatizar o fluxo.' }, { q: 'Preciso parar de revisar as mensagens?', a: 'Não. A automação reduz execução repetitiva, mas a revisão estratégica continua importante.' }], howTo: ['Meça quanto tempo uma campanha manual consome.', 'Automatize primeiro a rotina mais repetitiva.', 'Compare horas economizadas e reinvista em otimização de ofertas.'] },
  'organizar-calendario-de-ofertas-no-whatsapp': { lpType: 'pain', title: 'Organizar calendário de ofertas no WhatsApp | BOTinho', description: 'Organize calendário de ofertas no WhatsApp com rotina, segmentação e acompanhamento de campanhas.', uniqueHeadline: 'Diagnóstico: calendário sem execução vira intenção.', uniqueBody: 'Ter datas promocionais mapeadas não basta se a publicação falha. O BOTinho ajuda a transformar calendário em distribuição consistente para grupos e canais prioritários.', uniqueBullets: ['Campanhas recorrentes por categoria e data.', 'Menos improviso em sazonalidades importantes.', 'Métrica esperada: maior cumprimento do calendário planejado.'], faq: [{ q: 'Como organizar o calendário de ofertas?', a: 'Separe datas, categorias, grupos/canais e cadência de postagem antes de ativar a rotina.' }, { q: 'Funciona para campanhas sazonais?', a: 'Sim. Datas promocionais podem ter regras e destinos específicos.' }], howTo: ['Liste datas e categorias prioritárias do mês.', 'Defina grupos/canais e mensagens por campanha.', 'Acompanhe execução e ajuste o calendário com base nos resultados.'] },
  'melhorar-alcance-em-grupos-de-promocoes': { lpType: 'pain', title: 'Melhorar alcance em grupos e canais de promoções | BOTinho', description: 'Melhore o alcance em grupos e canais de promoções com distribuição consistente, segmentada e rastreável.', uniqueHeadline: 'Diagnóstico: alcance falha quando a oferta não chega em todos os destinos.', uniqueBody: 'Alcance em grupos e canais depende de cobertura, horário e relevância. O BOTinho ajuda a reduzir falhas de distribuição e manter presença nos destinos certos.', uniqueBullets: ['Mais cobertura nos grupos e/ou canais prioritários.', 'Segmentação para reduzir mensagens irrelevantes.', 'Métrica esperada: aumento de grupos/canais cobertos por campanha.'], faq: [{ q: 'Mais alcance significa postar mais?', a: 'Não necessariamente. O foco é cobrir melhor os grupos e canais certos com cadência controlada.' }, { q: 'Como evitar queda de qualidade?', a: 'Use filtros, segmentação e revisão de desempenho por grupo/canal.' }], howTo: ['Identifique grupos e/ou canais com maior potencial de alcance.', 'Organize destinos por prioridade e perfil.', 'Acompanhe cobertura por campanha e refine a segmentação.'] },
  'rastrear-resultados-de-divulgacao-em-grupos': { lpType: 'pain', title: 'Rastrear resultados de divulgação em grupos e canais | BOTinho', description: 'Rastreie resultados da divulgação em grupos e canais com logs, consistência de campanha e leitura operacional.', uniqueHeadline: 'Diagnóstico: sem rastreio, otimização vira chute.', uniqueBody: 'Quando a equipe não sabe o que foi enviado, onde e quando, fica difícil melhorar. O BOTinho registra a execução para apoiar análise de rotina e performance.', uniqueBullets: ['Logs para conferir envios por campanha.', 'Base para comparar horários e categorias.', 'Métrica esperada: mais clareza sobre campanhas ativas.'], faq: [{ q: 'Quais resultados devo acompanhar primeiro?', a: 'Comece por envio concluído, grupo/canal de destino, horário, cliques e comissão quando disponível.' }, { q: 'O rastreio substitui análise manual?', a: 'Não. Ele organiza a base para que a análise manual seja mais rápida e confiável.' }], howTo: ['Defina quais eventos importam para sua rotina.', 'Use logs para validar envio e cobertura.', 'Compare resultados por campanha e ajuste prioridades.'] },
}

const LP_TYPE_THEME = {
  city: {
    badge: 'Operação por cidade',
    tone: 'direto',
    eyebrow: 'Modo Cidade',
    panelBg: 'color-mix(in oklab, var(--accent) 18%, var(--surface))',
    panelBorder: 'color-mix(in oklab, var(--accent-strong) 35%, var(--line))',
    heroBg: 'linear-gradient(180deg, color-mix(in oklab, var(--accent-3) 42%, white), transparent)',
  },
  niche: {
    badge: 'Operação por nicho',
    tone: 'animado',
    eyebrow: 'Modo Nicho',
    panelBg: 'color-mix(in oklab, var(--accent-3) 50%, var(--surface))',
    panelBorder: 'color-mix(in oklab, var(--accent-2) 30%, var(--line))',
    heroBg: 'linear-gradient(180deg, color-mix(in oklab, var(--accent) 24%, white), transparent)',
  },
  pain: {
    badge: 'Operação por dor',
    tone: 'direto',
    eyebrow: 'Modo Diagnóstico',
    panelBg: 'color-mix(in oklab, var(--accent-2) 18%, var(--surface))',
    panelBorder: 'color-mix(in oklab, var(--accent-strong) 28%, var(--line))',
    heroBg: 'linear-gradient(180deg, color-mix(in oklab, var(--accent-2) 18%, white), transparent)',
  },
  default: {
    badge: 'Operação programática',
    tone: 'amigavel',
    eyebrow: 'Experimente grátis!',
    panelBg: 'var(--surface)',
    panelBorder: 'var(--line)',
    heroBg: 'transparent',
  },
}

function getLpType(slug, cfg) {
  if (cfg?.lpType) return cfg.lpType
  return getProgrammaticSeoRoute(slug)?.type ?? 'default'
}

function getHeroCopy(cfg, lpType) {
  if (lpType === 'city') {
    return {
      headline: <><span>Escala local com execução</span><br /><span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>consistente todo dia.</span></>,
      sub: `${cfg.description} Fluxo pensado para operação regional com menor retrabalho.`,
    }
  }
  if (lpType === 'niche') {
    return {
      headline: <><span>Seu nicho com campanhas</span><br /><span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>mais rápidas e previsíveis.</span></>,
      sub: `${cfg.description} Estruture rotinas por categoria e publique com frequência sem sobrecarga manual.`,
    }
  }
  if (lpType === 'pain') {
    return {
      headline: <><span>Resolva gargalos da operação</span><br /><span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>com automação de grupos.</span></>,
      sub: `${cfg.description} Diagnóstico prático, rotina com o ${BRAND_SHORT_NAME} e métricas para evoluir sem depender de esforço manual.`,
    }
  }
  return {
    headline: null,
    sub: null,
  }
}


function humanizeSlugPart(value) {
  return String(value || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getRoutineExample(slug, cfg, lpType) {
  if (lpType === 'city') {
    const city = humanizeSlugPart(slug.replace('espelhar-grupos-whatsapp-', ''))
    return {
      title: `Exemplo de rotina em ${city}`,
      body: `Uma curadoria regional pode separar grupos e/ou canais de origem por categoria e grupos e/ou canais de destino por bairro, cidade ou perfil de compra em ${city}. Antes de espelhar, a pessoa operadora revisa preço, cupom, link monetizado e regra do grupo; depois acompanha logs para corrigir falhas sem prometer alcance ou comissão.`,
      steps: ['Separar destinos regionais por contexto.', 'Revisar oferta e link no celular.', 'Publicar com intervalo e conferir logs.'],
    }
  }

  if (lpType === 'niche') {
    const niche = humanizeSlugPart(slug.replace('bot-ofertas-', '').replace('-whatsapp', ''))
    return {
      title: `Exemplo de rotina para ${niche}`,
      body: `Uma operação de ${niche.toLowerCase()} pode priorizar ofertas por margem, estoque e urgência real. O BOTinho entra depois da curadoria: organiza origem, destino, filtros e cadência para que a mensagem certa chegue aos grupos e canais adequados com revisão humana.`,
      steps: ['Escolher categorias de maior aderência.', 'Conferir link, cupom e regras da plataforma.', 'Ajustar frequência conforme resposta dos grupos e/ou canais.'],
    }
  }

  return {
    title: 'Exemplo de rotina operacional',
    body: `${cfg.uniqueHeadline.replace(/\.$/, '')}. Na prática, a equipe define o problema prioritário, revisa a campanha, escolhe grupos autorizados e usa logs para aprender antes de ampliar volume. O foco é processo consistente, não promessa de resultado garantido.`,
    steps: ['Mapear gargalo antes de automatizar.', 'Aplicar checklist de oferta, link e destino.', 'Escalar aos poucos com base nos logs.'],
  }
}

export function getLpMetadata(slug) {
  const cfg = LP_CONFIG[slug]
  if (!cfg) return {}

  const siteUrl = getSiteUrl()
  const canonicalUrl = `${siteUrl}/${slug}`
  const seoRoute = getProgrammaticSeoRoute(slug)

  const ogImage = buildOgImageUrl({ slug, cluster: seoRoute?.cluster ?? 'programmatic', template: seoRoute?.template ?? 'programmatic-lp' })
  // P2 (specs/013-inbound-leads-strategy): undefined quando a rota é
  // indexável — nunca emitir `index: true` explícito (buildSeoRobots).
  const robots = buildSeoRobots(`/${slug}`)

  return {
    title: cfg.title,
    description: cfg.description,
    alternates: { canonical: canonicalUrl },
    ...(robots ? { robots } : {}),
    openGraph: {
      title: cfg.title,
      description: cfg.description,
      url: canonicalUrl,
      siteName: BRAND_NAME,
      locale: 'pt_BR',
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: cfg.title }],
    },
    twitter: {
      card: 'summary',
      title: cfg.title,
      description: cfg.description,
      images: [ogImage],
    },
  }
}

export function LpTemplate({ slug }) {
  const cfg = LP_CONFIG[slug]
  const seoRoute = getProgrammaticSeoRoute(slug)
  const lpType = getLpType(slug, cfg)
  const hubRoute = getHubSeoRoute(seoRoute?.parentPath ?? seoRoute?.cluster)
  const relatedRoutes = getRelatedProgrammaticSeoRoutes(seoRoute, 3)
  const theme = LP_TYPE_THEME[lpType] ?? LP_TYPE_THEME.default
  const heroCopy = getHeroCopy(cfg, lpType)
  const routineExample = getRoutineExample(slug, cfg, lpType)
  const faqJsonLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: cfg.faq.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })) }
  const howToJsonLd = { '@context': 'https://schema.org', '@type': 'HowTo', name: `Como configurar ${cfg.title.replace(' | BOTinho', '')}`, step: cfg.howTo.map((text, index) => ({ '@type': 'HowToStep', name: `Passo ${index + 1}`, text })) }
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: BRAND_NAME,
    alternateName: ['Espelha Grupos'],
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: `${cfg.description} ${PRODUCT_DEFINITION}`,
    url: `${getSiteUrl()}/${slug}`,
    mainEntityOfPage: `${getSiteUrl()}/${slug}`,
    image: [`${getSiteUrl()}/botinho-logo.svg`],
    brand: { '@type': 'Brand', name: BRAND_SHORT_NAME },
    offers: DEFAULT_LANDING_PLANS.map((plan) => ({
      '@type': 'Offer',
      name: plan.name,
      url: `${getSiteUrl()}/login?mode=register`,
      priceCurrency: 'BRL',
      price: String(plan.priceValue),
      availability: 'https://schema.org/InStock',
      category: 'SoftwareSubscription',
      description: `${plan.desc} Período: ${plan.period}.`,
    })),
  }

  const evidenceCard = {
    title: `Sinal de evidência: ${cfg.title.replace(' | BOTinho', '')}`,
    description: `Este cenário usa critérios verificáveis (origem, destino, frequência e revisão humana) para evitar automação sem contexto.`,
    points: [
      `Checklist de validação antes de escalar campanhas.`,
      `Registro de ajustes por logs e rotina semanal.`,
      `Segmentação explícita por cluster: ${seoRoute?.cluster ?? 'operacional'}.`,
    ],
  }

  const journeyLinks = [
    { href: '/botinho-vs-planilha-manual', label: 'Comparar com planilha manual' },
    { href: '/metodologia-uso-responsavel-whatsapp', label: 'Ver metodologia de uso responsável' },
    { href: '/melhores-bots-para-afiliados-whatsapp', label: 'Critérios para avaliar bots' },
  ]

  const proofAssets = getProofAssetsForCluster(seoRoute?.cluster)

  const conversionLinks = [
    { href: '/materiais/checklist-divulgacao-ofertas-grupos-whatsapp', label: 'Checklist de divulgação' },
    { href: '/ferramentas/calculadora-tempo-grupos-whatsapp', label: 'Calculadora de tempo operacional' },
    { href: '/login?mode=register', label: 'Entrar na lista VIP' },
  ]

  const breadcrumbJsonLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Início', item: getSiteUrl() }, { '@type': 'ListItem', position: 2, name: cfg.title.replace(' | BOTinho', ''), item: `${getSiteUrl()}/${slug}` }] }

  return (
    <div className="landing-root">
      <OrganicPageTracker route={seoRoute} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <Hero
        tone={theme.tone}
        primaryCtaLabel="Entrar na Lista VIP"
        eyebrowLabel={theme.eyebrow}
        headlineOverride={heroCopy.headline}
        subOverride={heroCopy.sub}
        heroStyle={{ background: theme.heroBg, borderRadius: 24, paddingInline: 20 }}
      />
      <section>
        <div className="wrap" style={{ marginTop: 28 }}>
          <IntroCard
            eyebrow={`${BRAND_NAME} · ${theme.badge}`}
            title={cfg.uniqueHeadline}
            body={cfg.uniqueBody}
            pills={cfg.uniqueBullets}
            accent={lpType !== 'default'}
          />
        </div>
      </section>
      <section aria-labelledby={`${slug}-roteiro-operacional`}>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
              <span className="pill"><span className="dot" />Roteiro específico</span>
              <h2 id={`${slug}-roteiro-operacional`} style={{ fontSize: 'clamp(24px, 2.4vw, 34px)', lineHeight: 1.12, margin: '14px 0 12px' }}>Como aplicar neste cenário</h2>
              <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--ink)', lineHeight: 1.7 }}>
                {cfg.howTo.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </div>
            <div style={{ background: theme.panelBg, border: `1px solid ${theme.panelBorder}`, borderRadius: 24, padding: 28 }}>
              <span className="pill"><span className="dot" />Critérios de qualidade</span>
              <h2 style={{ fontSize: 'clamp(24px, 2.4vw, 34px)', lineHeight: 1.12, margin: '14px 0 12px' }}>O que validar antes de escalar</h2>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink)', lineHeight: 1.7 }}>
                {cfg.uniqueBullets.map((bullet) => <li key={`check-${bullet}`}>{bullet}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby={`${slug}-evidencia-unica`}>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'color-mix(in oklab, var(--accent) 14%, var(--surface))', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
            <span className="pill"><span className="dot" />Bloco de evidência</span>
            <h2 id={`${slug}-evidencia-unica`} style={{ fontSize: 'clamp(24px, 2.4vw, 34px)', lineHeight: 1.12, margin: '14px 0 10px' }}>{evidenceCard.title}</h2>
            <p style={{ color: 'var(--ink-soft)', lineHeight: 1.65, marginBottom: 12 }}>{evidenceCard.description}</p>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink)', lineHeight: 1.7 }}>
              {evidenceCard.points.map((point) => <li key={point}>{point}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby={`${slug}-cluster-seo`}>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
            <span className="pill"><span className="dot" />Hub & próximos passos</span>
            <h2 id={`${slug}-cluster-seo`} style={{ fontSize: 'clamp(24px, 2.6vw, 36px)', lineHeight: 1.12, margin: '14px 0 12px' }}>Continue pelo cluster certo</h2>
            <p style={{ color: 'var(--ink-soft)', lineHeight: 1.65, marginBottom: 16 }}>
              Use a página hub para comparar cenários parecidos e navegue para páginas relacionadas sem depender de URLs soltas.
            </p>
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {hubRoute && (
                <Link href={hubRoute.path} data-seo-cta="lp-parent-hub" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
                  Ver hub: {hubRoute.label}
                </Link>
              )}
              {relatedRoutes.map((route) => (
                <Link key={route.path} href={route.path} data-seo-cta="lp-related-page" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
                  {route.label}
                </Link>
              ))}
              {journeyLinks.map((link) => (
                <Link key={link.href} href={link.href} data-seo-cta="lp-journey-link" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
                  {link.label}
                </Link>
              ))}
              {conversionLinks.map((link) => (
                <Link key={link.href} href={link.href} data-seo-cta="lp-conversion-link" className="btn btn-accent" style={{ textDecoration: 'none' }}>
                  {link.label}
                </Link>
              ))}
              </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {journeyLinks.map((link) => (
                <Link key={link.href} href={link.href} data-seo-cta="lp-journey-link" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
                  {link.label}
                </Link>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {conversionLinks.map((link) => (
                <Link key={link.href} href={link.href} data-seo-cta="lp-conversion-link" className="btn btn-accent" style={{ textDecoration: 'none' }}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
      </section>

      <section aria-labelledby={`${slug}-proof-library`}>
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
            <span className="pill"><span className="dot" />Biblioteca de provas</span>
            <h2 id={`${slug}-proof-library`} style={{ fontSize: 'clamp(24px, 2.4vw, 34px)', lineHeight: 1.12, margin: '14px 0 16px' }}>Materiais de evidência reutilizáveis</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              {proofAssets.map((asset) => (
                <article key={asset.id} style={{ border: '1px solid var(--line)', borderRadius: 16, padding: 20, background: 'color-mix(in oklab, var(--surface) 92%, white)' }}>
                  <p className="mono" style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-strong)', marginBottom: 8 }}>{asset.evidenceType}</p>
                  <h3 style={{ fontSize: 18, lineHeight: 1.25, marginBottom: 10 }}>{asset.title}</h3>
                  <p style={{ color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 12 }}>{asset.summary}</p>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {asset.links.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href} data-seo-cta="lp-proof-asset" style={{ textDecoration: 'underline', textUnderlineOffset: 4 }}>{link.label}</Link>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
      <div aria-labelledby={`${slug}-faq-especifica`} role="region">
        <div className="wrap" style={{ marginTop: 28 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 24, padding: 28 }}>
            <span className="pill"><span className="dot" />FAQ contextual</span>
            <h2
              id={`${slug}-faq-especifica`}
              style={{ fontSize: 'clamp(24px, 2.6vw, 36px)', lineHeight: 1.12, margin: '14px 0 16px' }}
            >
              {`Perguntas específicas sobre ${cfg.title.replace(' | BOTinho', '')}`}
            </h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {cfg.faq.map((item) => (
                <details
                  key={item.q}
                  style={{
                    border: '1px solid var(--line)',
                    borderRadius: 16,
                    padding: '14px 16px',
                    background: 'color-mix(in oklab, var(--surface) 92%, white)',
                  }}
                >
                  <summary style={{ cursor: 'pointer', fontWeight: 800, color: 'var(--ink)' }}>{item.q}</summary>
                  <p style={{ marginTop: 10, color: 'var(--ink-soft)', lineHeight: 1.65 }}>{item.a}</p>
                </details>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {journeyLinks.map((link) => (
                <Link key={link.href} href={link.href} data-seo-cta="lp-journey-link" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
                  {link.label}
                </Link>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {conversionLinks.map((link) => (
                <Link key={link.href} href={link.href} data-seo-cta="lp-conversion-link" className="btn btn-accent" style={{ textDecoration: 'none' }}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
      <How />
      <Features />
      <Social />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  )
}
