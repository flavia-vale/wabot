'use client';

import { useState } from 'react';

function Estrelas({ nota }) {
  return (
    <div className="lp-depo-stars" role="img" aria-label={`Nota ${nota} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 24 24" className={i <= nota ? undefined : 'off'} aria-hidden="true">
          <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="currentColor" />
        </svg>
      ))}
    </div>
  );
}

export function CartaoDepoimento({ d }) {
  return (
    <figure className="lp-depo">
      {d.nota ? <Estrelas nota={d.nota} /> : null}
      <blockquote className="lp-depo-text">{`“${d.texto}”`}</blockquote>
      <figcaption className="lp-depo-who">
        <span className="lp-depo-av" aria-hidden="true">{d.nome.trim()[0].toUpperCase()}</span>
        <div>
          <div className="lp-depo-name">{d.nome}</div>
          <div className="lp-depo-role">{d.papel}</div>
        </div>
      </figcaption>
    </figure>
  );
}

/* 4 ou mais: carrossel (lista duplicada; a cópia é aria-hidden). Menos: cartões lado a lado. */
export function DepoimentosCarrossel({ itens }) {
  const [pausado, setPausado] = useState(false);
  const lista = itens.map((d) => <CartaoDepoimento key={d.nome + d.autorizadoEm} d={d} />);

  if (itens.length < 4) {
    return <div className="lp-depo-row">{lista}</div>;
  }

  return (
    <>
      <div
        className={`lp-carousel${pausado ? ' paused' : ''}`}
        role="region"
        aria-label="Depoimentos de clientes"
      >
        <div className="lp-carousel-track" style={{ '--lp-speed': `${itens.length * 8}s` }}>
          <div className="lp-carousel-half">{lista}</div>
          <div className="lp-carousel-half" aria-hidden="true">
            {itens.map((d) => <CartaoDepoimento key={`c-${d.nome}${d.autorizadoEm}`} d={d} />)}
          </div>
        </div>
      </div>
      <div className="lp-carousel-ctrl">
        <button type="button" className="lp-carousel-btn" aria-pressed={pausado} onClick={() => setPausado((p) => !p)}>
          {pausado ? '▶ Continuar' : '❚❚ Pausar'}
        </button>
      </div>
    </>
  );
}
