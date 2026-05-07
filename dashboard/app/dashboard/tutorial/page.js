'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

const FALLBACK_TUTORIAL = {
  title: 'Guia de Configuração: Pegando suas Credenciais (BOTinho)',
  body: 'Para que o BOTinho trabalhe para você, precisamos conectá-lo às suas contas de afiliado. Siga os passos abaixo para cada plataforma. É mais simples do que parece!',
  links: {
    cookieEditor: 'https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm',
    mercadoLivreLinkBuilder: 'https://www.mercadolivre.com.br/afiliados/linkbuilder#hub',
    amazonAssociados: 'https://associados.amazon.com.br/',
    shopeeApiForm: 'https://help.shopee.com.br/portal/webform/bbce78695c364ba18c9cbceb74ec9091?entryPoint=1&lastArticleID=',
    shopeeOpenApi: 'https://affiliate.shopee.com.br/open_api',
  },
  sections: [
    {
      icon: '🛠️',
      title: 'Passo 0: Ferramenta Essencial',
      steps: [
        'Instale a extensão Cookie-Editor no Google Chrome (computador).',
        'Abra a Chrome Web Store e clique em “Usar no Chrome”.',
      ],
      prints: ['[INSERIR PRINT 1 AQUI] — Destaque o botão “Usar no Chrome”.'],
    },
    {
      icon: '🔵',
      title: 'Mercado Livre',
      steps: [
        'Faça login na sua conta de afiliado.',
        'Acesse o Gerador de Links ML (ou siga: Minha Conta > Afiliados e Criadores > Gerador de links).',
        'Pegando o ID: copie o código do campo ID.',
        'Pegando o SSID: na mesma página, clique na extensão Cookie-Editor.',
        'Procure por “ssid”, clique e copie o valor exibido.',
      ],
      prints: [
        '[INSERIR PRINT 2 AQUI] — Destaque o número do ID circulado em vermelho.',
        '[INSERIR PRINT 3 AQUI] — Mostre onde clicar no ícone da peça de quebra-cabeça/extensão.',
        '[INSERIR PRINT 4 AQUI] — Destaque o campo do valor do cookie “ssid”.',
      ],
    },
    {
      icon: '🟡',
      title: 'Amazon',
      steps: [
        'Acesse o portal Amazon Associados.',
        'Com a página aberta, clique na extensão Cookie-Editor.',
        'Copie as credenciais solicitadas pelo BOTinho que aparecerem na lista de cookies.',
      ],
      prints: ['[INSERIR PRINT DA AMAZON AQUI]'],
    },
    {
      icon: '🟠',
      title: 'Shopee (Solicitação de API)',
      steps: [
        'Acesse o formulário de solicitação da API.',
        'Preencha: AFILIADO > Dúvidas sobre o Programa de Afiliados > Próximo > SIM > Não, estou com outras dificuldades/dúvidas.',
        'ID do afiliado: consulte seu ID (se necessário) e informe no formulário.',
        'Tema: Tenho dúvidas/dificuldades com meu cadastro/conta.',
        'Cenário: Quero ativar a API.',
        'Clique em ENVIAR.',
      ],
    },
    {
      icon: '⏳',
      title: 'E agora?',
      steps: [
        'A Shopee pode levar alguns dias para liberar.',
        'Verifique diariamente o painel Shopee Open API.',
        'Quando aparecer o botão “Redefinir”, clique para revelar Key/Secret e copie para o BOTinho.',
      ],
    },
  ],
}

function TutorialImages({ images = [] }) {
  if (!images.length) return null
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {images.map((img) => (
        <div key={img.id || img.label} className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{img.label}</p>
          {img.note ? <p className="mb-2 text-xs text-gray-600">{img.note}</p> : null}
          {img.url ? <img src={img.url} alt={img.label || 'Print tutorial'} className="w-full rounded-lg border border-gray-100" /> : <p className="text-xs text-gray-500">Sem imagem configurada.</p>}
        </div>
      ))}
    </div>
  )
}

export default function TutorialPage() {
  const [tutorial, setTutorial] = useState(null)

  useEffect(() => {
    api.publicTutorialContent().then((data) => setTutorial(data?.tutorial ?? null)).catch(() => setTutorial(null))
  }, [])

  const title = tutorial?.title || FALLBACK_TUTORIAL.title
  const body = tutorial?.body || FALLBACK_TUTORIAL.body

  return (
    <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <header className="space-y-2">
        <h1 className="text-2xl font-black text-gray-900">{title}</h1>
        <p className="text-sm text-gray-700">{body}</p>
      </header>

      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="font-semibold">Links úteis</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><a className="underline" target="_blank" rel="noreferrer" href={FALLBACK_TUTORIAL.links.cookieEditor}>Cookie-Editor (Chrome Web Store)</a></li>
          <li><a className="underline" target="_blank" rel="noreferrer" href={FALLBACK_TUTORIAL.links.mercadoLivreLinkBuilder}>Gerador de Links ML</a></li>
          <li><a className="underline" target="_blank" rel="noreferrer" href={FALLBACK_TUTORIAL.links.amazonAssociados}>Amazon Associados</a></li>
          <li><a className="underline" target="_blank" rel="noreferrer" href={FALLBACK_TUTORIAL.links.shopeeApiForm}>Formulário API Shopee</a></li>
          <li><a className="underline" target="_blank" rel="noreferrer" href={FALLBACK_TUTORIAL.links.shopeeOpenApi}>Shopee Open API</a></li>
        </ul>
      </div>

      <div className="space-y-3">
        {FALLBACK_TUTORIAL.sections.map((section) => (
          <article key={section.title} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h2 className="text-base font-black text-gray-900">{section.icon} {section.title}</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-700">
              {section.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
            {section.prints?.length ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-gray-600">
                {section.prints.map((hint) => <li key={hint}>{hint}</li>)}
              </ul>
            ) : null}
          </article>
        ))}
      </div>

      <details className="rounded-xl border border-gray-200 bg-gray-50 p-3">
        <summary className="cursor-pointer text-sm font-bold text-gray-800">Prints configurados no Admin</summary>
        <div className="mt-3"><TutorialImages images={tutorial?.images || []} /></div>
      </details>
    </section>
  )
}
