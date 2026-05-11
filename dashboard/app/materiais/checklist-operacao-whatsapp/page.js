import { PublicPage } from '@/components/PublicShell'
import { LeadMagnetCard } from '@/components/marketing/LeadMagnetCard'

export const metadata = {
  title: 'Checklist de operação para WhatsApp',
  description: 'Checklist para padronizar divulgação de ofertas e cupons em grupos de WhatsApp antes de escalar com automação.',
  alternates: { canonical: '/materiais/checklist-operacao-whatsapp' },
}

const checklistBlocks = [
  ['1. Oferta', ['Preço e estoque conferidos', 'Cupom ou benefício validado', 'Prazo de validade claro', 'Categoria e público definidos']],
  ['2. Link', ['URL final abre corretamente', 'Parâmetros de afiliado presentes', 'Link encurtado ou limpo quando necessário', 'Destino testado no celular']],
  ['3. Copy', ['Headline curta com benefício', 'Preço/condição visível', 'Urgência sem promessa falsa', 'CTA direto para clicar ou salvar']],
  ['4. Grupos', ['Origem e destino identificados', 'Segmento/cidade/nicho registrados', 'Intervalo mínimo entre envios definido', 'Grupos sensíveis fora de disparos repetidos']],
  ['5. Métricas', ['UTM ou tag da campanha preenchida', 'Responsável pelo monitoramento definido', 'Falhas de envio revisadas', 'Aprendizados registrados para o próximo disparo']],
]

export default function Page() {
  return (
    <PublicPage
      eyebrow="Lead magnet · Dia 4"
      title="Checklist de operação para divulgar ofertas no WhatsApp"
      description="Use antes de ligar uma rotina de espelhamento: padronize oferta, link, copy, destinos e métricas para reduzir erro manual."
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {checklistBlocks.map(([title, items]) => (
            <section key={title} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
              <h2 className="text-xl font-black text-gray-950">{title}</h2>
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-gray-700">
                {items.map((item) => (
                  <li key={item} className="flex gap-3"><span aria-hidden="true" className="mt-0.5 text-emerald-600">□</span><span>{item}</span></li>
                ))}
              </ul>
            </section>
          ))}
          <a href="/materiais/checklist-operacao-whatsapp.pdf" className="inline-flex min-h-12 items-center rounded-xl bg-gray-950 px-5 font-black text-white hover:bg-gray-800">
            Baixar PDF
          </a>
        </div>
        <LeadMagnetCard origin="lead_magnet_checklist_operacao_whatsapp" compact />
      </div>
    </PublicPage>
  )
}
