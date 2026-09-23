import AntiBanimentoTabs from './AntiBanimentoTabs'

// Tela única "Anti-banimento" (specs/018-unificar-protecao-anti-ban),
// substitui as três telas antigas de "Preservação avançada". Três partes por
// ?parte=situacao|ritmo|conta (padrão situacao); ?destino=<groupId> abre o
// destino já selecionado dentro de "Ritmo por grupo" — mesmo padrão de
// dashboard/app/painel/envios/page.js (server component lê searchParams,
// delega para um client component de abas).
export default async function AntiBanimentoPage({ searchParams }) {
  const query = await searchParams
  const parte = ['situacao', 'ritmo', 'conta'].includes(query?.parte) ? query.parte : 'situacao'
  const destino = typeof query?.destino === 'string' ? query.destino : null

  return <AntiBanimentoTabs parte={parte} destino={destino} />
}
