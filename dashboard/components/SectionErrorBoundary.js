'use client'

import { Component } from 'react'

/**
 * Limita o raio de explosão de um widget do Admin: se a section lançar em
 * render OU em efeito (ex.: uma função da api ausente por bundle defasado,
 * virando "x is not a function"), o erro é contido aqui em vez de subir para
 * o error boundary da rota e derrubar o painel inteiro.
 */
export class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    // Não derruba o painel; apenas registra para diagnóstico.
    console.error(`[admin] section "${this.props.label || 'desconhecida'}" falhou`, error)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.silent) return null
      return (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-bold">Esta seção não pôde ser carregada</p>
          <p className="mt-1 text-amber-700">
            {this.props.label ? `“${this.props.label}” ` : ''}falhou ao renderizar. O restante do painel segue funcionando.
          </p>
        </section>
      )
    }
    return this.props.children
  }
}

export default SectionErrorBoundary
