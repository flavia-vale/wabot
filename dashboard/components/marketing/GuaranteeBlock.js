import Link from 'next/link'
import { SUPPORT_HOURS, SUPPORT_RESPONSE_SLA, SUPPORT_WHATSAPP_URL } from '@/lib/marketing-content'

const guarantees = [
  ['7 dias para pedir reembolso', 'Depois do primeiro pagamento, você pode pedir a devolução integral dentro de 7 dias corridos.'],
  ['Sem fidelidade e sem multa', 'Cancele pelo painel. O acesso continua até o fim do período que já foi pago.'],
  ['Suporte humano no WhatsApp', `${SUPPORT_HOURS}. ${SUPPORT_RESPONSE_SLA}.`],
  ['Sem anúncio nas suas mensagens', 'Nem o Basic nem o Pro colocam propaganda do Espelha Grupos nas ofertas enviadas.'],
]

export function GuaranteeBlock() {
  return (
    <section aria-labelledby="garantia-title" style={{ paddingTop: 64 }}>
      <div className="wrap">
        <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto 26px' }}>
          <span className="pill"><span className="dot" />Garantia e tranquilidade</span>
          <h2 id="garantia-title" style={{ fontSize: 'clamp(30px, 3.5vw, 46px)', lineHeight: 1.1, marginTop: 16 }}>
            Teste com calma. <span className="serif" style={{ color: 'var(--accent-strong)', fontStyle: 'italic' }}>Fique porque funciona para você.</span>
          </h2>
        </div>
        <div className="marketing-guarantee-grid">
          {guarantees.map(([title, body]) => (
            <article key={title} className="marketing-guarantee-card">
              <span aria-hidden="true">✓</span>
              <div><h3>{title}</h3><p>{body}</p></div>
            </article>
          ))}
        </div>
        <p style={{ textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13.5, marginTop: 18 }}>
          Leia a <Link href="/politica-de-reembolso">política de reembolso</Link> ou <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">fale com o suporte</a>.
        </p>
      </div>
    </section>
  )
}

