'use client'

/* Tutorial de credenciais — versão Menta do painel. Conteúdo estático idêntico
 * ao conteúdo configurado no admin; o título vai para a topbar via usePainelHeader. */

import { usePainelHeader } from '../PainelShell'
import { VIDEO_CADASTRO_ETIQUETAS_URL } from '../../../../src/tutorialVideo.js'

const LINKS = {
  cookieEditor: 'https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm',
  mercadoLivreLinkBuilder: 'https://www.mercadolivre.com.br/afiliados/linkbuilder#hub',
  amazonAssociados: 'https://associados.amazon.com.br/',
  shopeeApiForm: 'https://help.shopee.com.br/portal/webform/bbce78695c364ba18c9cbceb74ec9091?entryPoint=1&lastArticleID=',
  shopeeOpenApi: 'https://affiliate.shopee.com.br/open_api',
}

function StepNumber({ n }) {
  return (
    <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-green-600 text-white text-sm font-bold">
      {n}
    </span>
  )
}

function Tip({ children }) {
  return (
    <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <span className="text-base">💡</span>
      <span>{children}</span>
    </div>
  )
}

function Warning({ children }) {
  return (
    <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      <span className="text-base">⚠️</span>
      <span>{children}</span>
    </div>
  )
}

function PlatformCard({ color, icon, title, children }) {
  const borders = {
    blue: 'border-blue-200',
    yellow: 'border-yellow-300',
    orange: 'border-orange-200',
    gray: 'border-gray-200',
  }
  const headers = {
    blue: 'bg-blue-50 border-b border-blue-200',
    yellow: 'bg-yellow-50 border-b border-yellow-200',
    orange: 'bg-orange-50 border-b border-orange-200',
    gray: 'bg-gray-50 border-b border-gray-200',
  }
  return (
    <article className={`rounded-2xl border ${borders[color] || borders.gray} bg-white overflow-hidden shadow-sm`}>
      <header className={`px-5 py-4 ${headers[color] || headers.gray}`}>
        <h2 className="text-lg font-black text-gray-900">{icon} {title}</h2>
      </header>
      <div className="p-5 space-y-4">{children}</div>
    </article>
  )
}

function StepList({ steps }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 items-start">
          <StepNumber n={i + 1} />
          <span className="text-sm text-gray-700 leading-relaxed pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  )
}

function ExternalLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-semibold text-green-700 underline underline-offset-2 hover:text-green-900"
    >
      {children}
      <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  )
}

function Badge({ children, color = 'green' }) {
  const colors = {
    green: 'bg-green-100 text-green-800',
    blue: 'bg-blue-100 text-blue-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    orange: 'bg-orange-100 text-orange-800',
  }
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${colors[color] || colors.green}`}>
      {children}
    </span>
  )
}

function QuickChecklist() {
  const items = [
    'Estou no computador com Google Chrome.',
    'Instalei a extensão Cookie-Editor.',
    'Separei 20 minutos para fazer tudo com calma.',
    'Vou configurar 1 plataforma por vez para evitar confusão.',
  ]
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <h3 className="text-sm font-black text-emerald-900">✅ Checklist rápido (antes de começar)</h3>
      <ul className="mt-3 space-y-2 text-sm text-emerald-900">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="mt-0.5">☑️</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function VideoBanner({ href, title, desc }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-4 rounded-2xl border border-red-200 bg-red-50 p-4 hover:bg-red-100 transition-colors"
    >
      <span className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full bg-red-600 text-white">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-black text-red-900">{title}</span>
        <span className="block text-xs text-red-800 mt-0.5">{desc}</span>
      </span>
      <span className="ml-auto flex-shrink-0 text-xs font-bold text-red-700 underline underline-offset-2">Assistir ▶</span>
    </a>
  )
}

function TutorialInlineImage({ src, alt }) {
  return (
    <a href={src} target="_blank" rel="noreferrer" className="mx-auto block w-full max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="h-auto w-full object-contain"
      />
      <span className="block border-t border-gray-100 px-3 py-2 text-base font-extrabold text-gray-700">
        🔎 Toque para abrir em alta resolução
      </span>
    </a>
  )
}

export default function TutorialPage() {
  usePainelHeader({ title: 'Tutorial', subtitle: 'Guia de configuração de credenciais de afiliada' })

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <h1 className="text-2xl font-black text-gray-900">
          📚 Guia de Configuração de Credenciais
        </h1>
        <p className="text-gray-600 text-sm leading-relaxed">
          Para o <strong>Espelha Grupos</strong> funcionar, ele precisa se conectar às suas contas de afiliado. Siga os passos abaixo com calma — é mais simples do que parece!
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge color="green">Tempo médio: 15-25 min</Badge>
          <Badge color="blue">Dificuldade: fácil</Badge>
          <Badge color="yellow">Ordem recomendada: ML → Amazon → Shopee</Badge>
        </div>
        <VideoBanner
          href={VIDEO_CADASTRO_ETIQUETAS_URL}
          title="🎥 Prefere assistir? Vídeo-aula: Como cadastrar suas credenciais"
          desc="Shopee, Mercado Livre, Amazon e Magazine Luiza passo a passo em vídeo."
        />
        <Tip>
          Este guia cobre <strong>Mercado Livre</strong>, <strong>Amazon</strong> e <strong>Shopee</strong>. Você não precisa configurar todas de uma vez — faça uma por vez.
        </Tip>
        <QuickChecklist />
        <Warning>
          Nunca compartilhe seus cookies, IDs, SSID, Key ou Secret com terceiros. Esses dados dão acesso à sua conta.
        </Warning>
        <Tip>
          Esse código é usado só para montar seus links de oferta já com a sua comissão. Ele fica guardado trancado
          (criptografado) e você pode apagá-lo quando quiser, no botão dentro de <strong>Minhas credenciais</strong>.
          De tempos em tempos ele vence — quando isso acontecer, o painel avisa e é só colar um novo.
        </Tip>
      </div>

      {/* Passo 0 */}
      <PlatformCard color="gray" icon="🛠️" title="Passo 0 — Ferramenta Essencial (Cookie-Editor)">
        <p className="text-sm text-gray-700">
          Antes de qualquer coisa, instale a extensão <strong>Cookie-Editor</strong> no Google Chrome no seu computador. Ela vai te ajudar a copiar códigos de autenticação das plataformas.
        </p>
        <StepList steps={[
          <>Abra o Google Chrome no computador (não funciona no celular).</>,
          <><ExternalLink href={LINKS.cookieEditor}>Clique aqui para abrir a Cookie-Editor na Chrome Web Store</ExternalLink> e depois clique no botão <strong>&quot;Usar no Chrome&quot;</strong>.</>,
          <>Confirme a instalação clicando em <strong>&quot;Adicionar extensão&quot;</strong> na janelinha que aparecer.</>,
          <>Pronto! O ícone da extensão (uma bolachinha 🍪) vai aparecer no canto superior direito do navegador.</>,
        ]} />
        <TutorialInlineImage src="https://i.postimg.cc/cvYC69ZD/Captura-de-Tela-2026-05-16-a-s-11-25-44.png" alt="Passo zero: instalação da extensão Cookie-Editor" />
        <Tip>
          Não encontrou o ícone? Clique no ícone de <strong>peça de quebra-cabeça 🧩</strong> ao lado da barra de endereço e fixe a Cookie-Editor clicando no alfinete 📌.
        </Tip>
      </PlatformCard>

      {/* Mercado Livre */}
      <PlatformCard color="blue" icon="🔵" title="Mercado Livre — Pegando sua Etiqueta em uso e SSID">
        <p className="text-sm text-gray-700">
          Você vai precisar de dois códigos: a <strong>Etiqueta em uso</strong> (identificador do afiliado no Gerador de Links) e o <strong>SSID</strong> (código de sessão). Veja como pegar cada um:
        </p>

        <div className="space-y-1">
          <Badge color="blue">Parte 1 — Pegando a Etiqueta em uso</Badge>
        </div>
        <StepList steps={[
          <>Faça login na sua conta do Mercado Livre com o perfil de afiliado.</>,
          <><ExternalLink href={LINKS.mercadoLivreLinkBuilder}>Acesse o Gerador de Links ML</ExternalLink> — ou navegue por: <strong>Minha Conta → Afiliados e Criadores → Gerador de links</strong>.</>,
          <>Na página do Gerador de Links, você vai ver um campo chamado <strong>&quot;Etiqueta em uso&quot;</strong> com um código (ex: <code className="bg-gray-100 px-1 rounded text-xs">47xxxxx</code> ou <code className="bg-gray-100 px-1 rounded text-xs">faxxxxx</code>). Essa é a informação que deve ser colada no campo <strong>Etiqueta em uso</strong>. Copie-a exatamente como aparece.</>,
        ]} />
        <TutorialInlineImage src="https://i.postimg.cc/cvYC69ZM/Captura-de-Tela-2026-05-16-a-s-11-26-03.png" alt="Mercado Livre parte 1: campo etiqueta em uso" />

        <div className="space-y-1 pt-2">
          <Badge color="blue">Parte 2 — Pegando o SSID</Badge>
        </div>
        <StepList steps={[
          <><strong>Na mesma página</strong> do Gerador de Links, clique no ícone da extensão <strong>Cookie-Editor</strong> (canto superior direito do Chrome).</>,
          <>Uma lista de itens vai aparecer. Role até encontrar o item chamado <strong className="text-green-700">ssid</strong> e clique nele para expandir.</>,
          <>Você vai ver o campo <strong>Value</strong> com um código longo. Copie esse valor completo.</>,
        ]} />
        <TutorialInlineImage src="https://i.postimg.cc/68RqTjwf/Captura-de-Tela-2026-05-16-a-s-11-26-57.png" alt="Mercado Livre parte 2: clicar no Cookie-Editor" />
        <TutorialInlineImage src="https://i.postimg.cc/gxRjrSdK/Captura-de-Tela-2026-05-16-a-s-11-27-08.png" alt="Mercado Livre parte 2: valor de SSID para copiar" />
        <Tip>
          O valor do SSID começa com letras e traços (ex: <code className="bg-gray-100 px-1 rounded text-xs">ghy-xxxxx_-1</code>). Copie tudo, sem espaços extras.
        </Tip>
      </PlatformCard>

      {/* Amazon */}
      <PlatformCard color="yellow" icon="🟡" title="Amazon — Pegando suas Credenciais">
        <p className="text-sm text-gray-700">
          Para a Amazon, você vai usar a Cookie-Editor no portal de associados. Os cookies que você precisa copiar estão listados abaixo.
        </p>
        <StepList steps={[
          <><ExternalLink href={LINKS.amazonAssociados}>Acesse o portal Amazon Associados</ExternalLink> e certifique-se de estar logado na sua conta.</>,
          <>Com a página aberta, clique no ícone da <strong>Cookie-Editor</strong> 🍪 no canto superior direito do Chrome.</>,
          <>Uma lista de cookies vai aparecer. Você precisa copiar os valores dos seguintes cookies:
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['session-id', 'session-token', 'sess-at-acbbr', 'at-acbbr', 'ubid-acbbr'].map(c => (
                <code key={c} className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-900">{c}</code>
              ))}
            </div>
          </>,
          <>Para cada um: clique no nome do cookie na lista para expandir e copie o valor que aparece no campo <strong>Value</strong>.</>,
          <>Cole cada valor no campo correspondente na tela de <strong>IDs de afiliada</strong> do Espelha Grupos.</>,
        ]} />
        <TutorialInlineImage src="https://i.postimg.cc/XrFqXH3x/Captura-de-Tela-2026-05-16-a-s-11-27-22.png" alt="Amazon: abrir Cookie-Editor após login" />
        <TutorialInlineImage src="https://i.postimg.cc/JsJ0t6mJ/Captura-de-Tela-2026-05-16-a-s-11-27-33.png" alt="Amazon: cookies necessários listados na extensão" />
        <Tip>
          Use o campo de <strong>busca (Search)</strong> no topo da Cookie-Editor para encontrar cada cookie rapidamente sem precisar rolar a lista toda.
        </Tip>
      </PlatformCard>

      {/* Shopee */}
      <PlatformCard color="orange" icon="🟠" title="Shopee — Solicitando Acesso à API">
        <p className="text-sm text-gray-700">
          A Shopee funciona diferente das outras: você precisa <strong>pedir autorização manualmente</strong> pelo suporte deles. Depois que aprovarem (leva alguns dias), você pega uma <strong>Key</strong> e um <strong>Secret</strong>.
        </p>

        <div className="space-y-1">
          <Badge color="orange">Parte 1 — Fazendo a solicitação</Badge>
        </div>
        <StepList steps={[
          <><ExternalLink href={LINKS.shopeeApiForm}>Acesse o Formulário de Solicitação da API</ExternalLink>.</>,
          <>Preencha o formulário exatamente assim:
            <ul className="mt-2 space-y-2 pl-1 text-sm text-gray-700">
              <li className="flex gap-2 items-start">
                <span className="text-orange-500 font-bold">›</span>
                <span><strong>Você é comprador, vendedor ou afiliado?</strong> Selecione <strong>AFILIADO</strong>.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="text-orange-500 font-bold">›</span>
                <span><strong>Qual é o principal assunto?</strong> Selecione <strong>Dúvidas sobre o Programa de Afiliados</strong>.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="text-orange-500 font-bold">›</span>
                <span><em>Clique em <strong>Próximo</strong>.</em></span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="text-orange-500 font-bold">›</span>
                <span><strong>Você já é Afiliado?</strong> Marque <strong>SIM</strong>.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="text-orange-500 font-bold">›</span>
                <span><strong>Está com problemas de login?</strong> Selecione <strong>Não, estou com outras dificuldades/dúvidas</strong>.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="text-orange-500 font-bold">›</span>
                <span><strong>ID do Afiliado:</strong> informe seu ID Shopee. Se não souber, <ExternalLink href={LINKS.shopeeOpenApi}>acesse este link</ExternalLink> para consultar.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="text-orange-500 font-bold">›</span>
                <span><strong>Tema da dificuldade:</strong> Tenho dúvidas/dificuldades com meu cadastro/conta.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="text-orange-500 font-bold">›</span>
                <span><strong>Cenário:</strong> Quero ativar a API.</span>
              </li>
            </ul>
          </>,
          <>Clique em <strong>ENVIAR</strong>. A Shopee leva alguns dias úteis para liberar o acesso.</>,
        ]} />

        <div className="space-y-1 pt-2">
          <Badge color="orange">Parte 2 — Pegando Key e Secret (após aprovação)</Badge>
        </div>
        <StepList steps={[
          <><ExternalLink href={LINKS.shopeeOpenApi}>Acesse o painel Shopee Open API</ExternalLink> diariamente até o acesso ser liberado.</>,
          <>Quando aparecer o botão <strong>&quot;Redefinir&quot;</strong>, clique nele — a <strong>Key</strong> e o <strong>Secret</strong> serão exibidos na tela.</>,
          <>Copie os dois valores e cole nos campos correspondentes na tela de <strong>IDs de afiliada</strong> do Espelha Grupos.</>,
        ]} />
        <Tip>
          ⏳ <strong>E agora?</strong> A Shopee leva alguns dias para liberar. Verifique o painel diariamente. Quando o botão <strong>Redefinir</strong> aparecer, clique nele e os dados (Key/Secret) aparecerão para você copiar.
        </Tip>
      </PlatformCard>

      {/* Final */}
      <div className="rounded-2xl border border-green-200 bg-green-50 p-5 space-y-3">
        <h2 className="font-black text-green-900 text-base">✅ Tudo pronto!</h2>
        <p className="text-sm text-green-800 leading-relaxed">
          Após salvar suas credenciais na tela de <strong>IDs de afiliada</strong>, o Espelha Grupos já consegue gerar links de afiliado automaticamente. Se tiver dúvidas ou algum código não funcionar, fale com o suporte — estamos aqui para ajudar!
        </p>
        <div className="rounded-xl border border-green-300 bg-white/80 p-3">
          <p className="text-sm font-bold text-green-900">Próximo passo recomendado (2 minutos):</p>
          <ol className="mt-2 space-y-1 text-sm text-green-900">
            <li>1. Salvar as credenciais.</li>
            <li>2. Gerar um link de teste de cada plataforma que você configurou.</li>
            <li>3. Confirmar se o link abre corretamente no destino final.</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
