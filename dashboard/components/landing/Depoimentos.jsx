import { depoimentosPublicaveis, ROTULO_DEPOIMENTOS } from '@/lib/depoimentos';
import { DepoimentosCarrossel } from './DepoimentosCarrossel';

/* Depoimentos reais (Design System v2, seção "Depoimentos"). Não renderiza
 * nada enquanto não houver depoimento autorizado em lib/depoimentos.js. */
export function Depoimentos({ titulo = 'Quem já usa conta como foi' }) {
  const itens = depoimentosPublicaveis();
  if (itens.length === 0) return null;
  return (
    <section id="depoimentos" aria-label="Depoimentos de clientes">
      <div className="wrap">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <span className="pill"><span className="dot" />Depoimentos</span>
          <h2 style={{ marginTop: 16, fontSize: 'clamp(28px, 3.2vw, 40px)', lineHeight: 1.1 }}>{titulo}</h2>
        </div>
        <DepoimentosCarrossel itens={itens} />
        <p className="lp-depo-note">{ROTULO_DEPOIMENTOS}</p>
      </div>
    </section>
  );
}
