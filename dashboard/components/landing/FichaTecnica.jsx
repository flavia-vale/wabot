import { Icon } from './Icon'
import {
  FICHA_COLUNAS,
  FICHA_DEFINICAO,
  FICHA_FATOS,
  FICHA_LINHAS,
  FICHA_NOTA,
  FICHA_TITULO,
  simNao,
} from '@/lib/ficha-tecnica'

/* Ficha técnica canônica (medição de IA de 27/09/2026). Componente de
 * SERVIDOR de propósito: o HTML inicial já carrega a tabela inteira, sem
 * depender de JS — é o que a IA e o Google leem. Os dados vêm SÓ de
 * `lib/ficha-tecnica.js`; nada de texto de recurso escrito aqui. */

function Celula({ valor }) {
  const texto = simNao(valor)
  const ok = valor === true
  return (
    <td className={`ficha-tecnica-cell ${ok ? 'is-yes' : 'is-no'}`}>
      <span className="ficha-tecnica-mark" aria-hidden="true">
        {ok ? <Icon name="check" size={16} stroke={2.2} /> : '—'}
      </span>
      <span className="ficha-tecnica-mark-text">{texto}</span>
    </td>
  )
}

export function FichaTecnica({ headingLevel = 'h2' }) {
  const Heading = headingLevel
  return (
    <section id="ficha-tecnica" aria-labelledby="ficha-tecnica-titulo" className="ficha-tecnica">
      <div className="wrap">
        <div className="ficha-tecnica-head">
          <span className="pill"><span className="dot" />{FICHA_TITULO}</span>
          <Heading id="ficha-tecnica-titulo" className="ficha-tecnica-h">
            O que o produto faz, <span className="serif" style={{ fontStyle: 'italic', color: 'var(--accent-strong)' }}>em uma tabela</span>
          </Heading>
          <p className="ficha-tecnica-def">{FICHA_DEFINICAO}</p>
        </div>

        <dl className="ficha-tecnica-facts">
          {FICHA_FATOS.map((fato) => (
            <div key={fato.rotulo} className="ficha-tecnica-fact">
              <dt>{fato.rotulo}</dt>
              <dd>{fato.valor}</dd>
            </div>
          ))}
        </dl>

        <div className="ficha-tecnica-table-wrap">
          <table className="ficha-tecnica-table">
            <caption className="sr-only">Recursos por plano</caption>
            <thead>
              <tr>
                <th scope="col">{FICHA_COLUNAS[0]}</th>
                <th scope="col"><span className="ficha-tecnica-plan">{FICHA_COLUNAS[1]}</span></th>
                <th scope="col"><span className="ficha-tecnica-plan is-pro">{FICHA_COLUNAS[2]}</span></th>
              </tr>
            </thead>
            <tbody>
              {FICHA_LINHAS.map((linha) => (
                <tr key={linha.recurso}>
                  <th scope="row">{linha.recurso}</th>
                  <Celula valor={linha.basic} />
                  <Celula valor={linha.pro} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ficha-tecnica-note">{FICHA_NOTA}</p>
      </div>
    </section>
  )
}
