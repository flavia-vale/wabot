import Image from 'next/image'

// Imagem ilustrativa do painel de vendas. Os números são fictícios e a
// legenda diz isso; nunca apresentar como resultado real de cliente.
export function PainelVendasIlustrativo({ className = '' }) {
  return (
    <figure className={className} style={{ margin: '32px auto', maxWidth: 960 }}>
      <Image
        src="/ilustracoes/painel-vendas-exemplo.png"
        alt="Exemplo ilustrativo da aba Vendas do painel do Espelha Grupos, com comissão, pedidos, cliques e ofertas enviadas (dados fictícios)"
        width={1200}
        height={720}
        sizes="(max-width: 960px) 100vw, 960px"
        style={{ width: '100%', height: 'auto', borderRadius: 16 }}
      />
      <figcaption style={{ fontSize: 13, color: 'var(--ink-soft, #5A6E68)', textAlign: 'center', marginTop: 8 }}>
        Exemplo ilustrativo com dados fictícios: não são resultados de clientes.
      </figcaption>
    </figure>
  )
}
