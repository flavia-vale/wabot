'use client'

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

export default function TutorialPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-2">
        <h1 className="text-2xl font-black text-gray-900">
          📚 Guia de Configuração de Credenciais
        </h1>
        <p className="text-gray-600 text-sm leading-relaxed">
          Para o <strong>BOTinho</strong> funcionar, ele precisa se conectar às suas contas de afiliado. Siga os passos abaixo com calma — é mais simples do que parece!
        </p>
        <Tip>
          Este guia cobre <strong>Mercado Livre</strong>, <strong>Amazon</strong> e <strong>Shopee</strong>. Você não precisa configurar todas de uma vez — faça uma por vez.
        </Tip>
      </div>

      {/* Passo 0 */}
      <PlatformCard color="gray" icon="🛠️" title="Passo 0 — Ferramenta Essencial (Cookie-Editor)">
        <p className="text-sm text-gray-700">
          Antes de qualquer coisa, instale a extensão <strong>Cookie-Editor</strong> no Google Chrome no seu computador. Ela vai te ajudar a copiar códigos de autenticação das plataformas.
        </p>
        <StepList steps={[
          <>Abra o Google Chrome no computador (não funciona no celular).</>,
          <><ExternalLink href={LINKS.cookieEditor}>Clique aqui para abrir a Cookie-Editor na Chrome Web Store</ExternalLink> e depois clique no botão <strong>"Usar no Chrome"</strong>.</>,
          <>Confirme a instalação clicando em <strong>"Adicionar extensão"</strong> na janelinha que aparecer.</>,
          <>Pronto! O ícone da extensão (uma bolachinha 🍪) vai aparecer no canto superior direito do navegador.</>,
        ]} />
        <Tip>
          Não encontrou o ícone? Clique no ícone de <strong>peça de quebra-cabeça 🧩</strong> ao lado da barra de endereço e fixe a Cookie-Editor clicando no alfinete 📌.
        </Tip>
      </PlatformCard>

      {/* Mercado Livre */}
      <PlatformCard color="blue" icon="🔵" title="Mercado Livre — Pegando seu ID e SSID">
        <p className="text-sm text-gray-700">
          Você vai precisar de dois códigos: o <strong>ID</strong> (identificador do afiliado) e o <strong>SSID</strong> (código de sessão). Veja como pegar cada um:
        </p>

        <div className="space-y-1">
          <Badge color="blue">Parte 1 — Pegando o ID</Badge>
        </div>
        <StepList steps={[
          <>Faça login na sua conta do Mercado Livre com o perfil de afiliado.</>,
          <><ExternalLink href={LINKS.mercadoLivreLinkBuilder}>Acesse o Gerador de Links ML</ExternalLink> — ou navegue por: <strong>Minha Conta → Afiliados e Criadores → Gerador de links</strong>.</>,
          <>Na página do Gerador de Links, você vai ver um campo chamado <strong>"Etiqueta em uso"</strong> com um código numérico (ex: <code className="bg-gray-100 px-1 rounded text-xs">47xxxxx</code>). Esse é o seu <strong>ID</strong>. Copie-o.</>,
        ]} />

        <div className="space-y-1 pt-2">
          <Badge color="blue">Parte 2 — Pegando o SSID</Badge>
        </div>
        <StepList steps={[
          <><strong>Na mesma página</strong> do Gerador de Links, clique no ícone da extensão <strong>Cookie-Editor</strong> (canto superior direito do Chrome).</>,
          <>Uma lista de itens vai aparecer. Role até encontrar o item chamado <strong className="text-green-700">ssid</strong> e clique nele para expandir.</>,
          <>Você vai ver o campo <strong>Value</strong> com um código longo. Copie esse valor completo.</>,
        ]} />
        <Tip>
          O valor do SSID começa com letras e traços (ex: <code className="bg-gray-100 px-1 rounded text-xs">ghy-xxxxx_-1</code>). Copie tudo, sem espaços extras.
        </Tip>
      </PlatformCard>

      {/* Amazon */}
      <PlatformCard color="yellow" icon="🟡" title="Amazon — Pegando suas Credenciais">
        <p className="text-sm text-gray-700">
          Para a Amazon, você vai usar a Cookie-Editor da mesma forma — mas no portal de associados.
        </p>
        <StepList steps={[
          <><ExternalLink href={LINKS.amazonAssociados}>Acesse o portal Amazon Associados</ExternalLink> e certifique-se de estar logado na sua conta.</>,
          <>Com a página aberta, clique no ícone da extensão <strong>Cookie-Editor</strong> no canto superior direito do Chrome.</>,
          <>O BOTinho vai te dizer exatamente quais cookies buscar (normalmente <strong>session-id</strong> e <strong>x-main</strong>). Procure-os na lista e copie os valores.</>,
          <>Cole cada valor no campo correspondente na tela de <strong>Credenciais</strong> do BOTinho.</>,
        ]} />
        <Tip>
          Se estiver com dificuldade de localizar os cookies, use o campo de busca no topo da Cookie-Editor para filtrar pelo nome.
        </Tip>
      </PlatformCard>

      {/* Shopee */}
      <PlatformCard color="orange" icon="🟠" title="Shopee — Solicitando Acesso à API">
        <p className="text-sm text-gray-700">
          A Shopee funciona diferente: você precisa <strong>solicitar acesso à API</strong> pelo suporte deles. Depois que aprovarem, você pega uma <strong>Key</strong> e um <strong>Secret</strong>.
        </p>

        <div className="space-y-1">
          <Badge color="orange">Parte 1 — Fazendo a solicitação</Badge>
        </div>
        <StepList steps={[
          <><ExternalLink href={LINKS.shopeeApiForm}>Acesse o formulário de solicitação de API da Shopee</ExternalLink>.</>,
          <>Siga este caminho no formulário: <strong>AFILIADO → Dúvidas sobre o Programa de Afiliados → Próximo → SIM → Não, estou com outras dificuldades/dúvidas</strong>.</>,
          <>Preencha os campos assim:<br />
            <ul className="mt-2 space-y-1 pl-4 text-xs text-gray-600 list-disc">
              <li><strong>ID do afiliado:</strong> seu ID Shopee (encontrado no painel de afiliados)</li>
              <li><strong>Tema:</strong> Tenho dúvidas/dificuldades com meu cadastro/conta</li>
              <li><strong>Cenário:</strong> Quero ativar a API</li>
            </ul>
          </>,
          <>Clique em <strong>ENVIAR</strong> e aguarde. A Shopee normalmente responde em alguns dias úteis.</>,
        ]} />

        <div className="space-y-1 pt-2">
          <Badge color="orange">Parte 2 — Pegando Key e Secret (após aprovação)</Badge>
        </div>
        <StepList steps={[
          <><ExternalLink href={LINKS.shopeeOpenApi}>Acesse o painel Shopee Open API</ExternalLink> diariamente até a aprovação aparecer.</>,
          <>Quando aparecer o botão <strong>"Redefinir"</strong>, clique nele — a <strong>Key</strong> e o <strong>Secret</strong> serão revelados.</>,
          <>Copie os dois valores e cole nos campos correspondentes na tela de <strong>Credenciais</strong> do BOTinho.</>,
        ]} />
        <Tip>
          A Key e o Secret da Shopee só aparecem uma vez após clicar em "Redefinir". Guarde-os em local seguro antes de fechar a página!
        </Tip>
      </PlatformCard>

      {/* Final */}
      <div className="rounded-2xl border border-green-200 bg-green-50 p-5 space-y-2">
        <h2 className="font-black text-green-900 text-base">✅ Tudo pronto!</h2>
        <p className="text-sm text-green-800 leading-relaxed">
          Após salvar suas credenciais na tela de <strong>Credenciais</strong>, o BOTinho já consegue gerar links de afiliado automaticamente. Se tiver dúvidas ou algum código não funcionar, fale com o suporte — estamos aqui para ajudar!
        </p>
      </div>
    </div>
  )
}
