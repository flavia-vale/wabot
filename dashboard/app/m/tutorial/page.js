'use client'

import { MobileShell } from '@/components/mobile/MobileShell'
import { cfgStyles } from '@/components/mobile/mobileStyles'
import { useMobileRoutePerf } from '@/components/mobile/MobileObservability'

const LINKS = {
  cookieEditor: 'https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm',
  mercadoLivreLinkBuilder: 'https://www.mercadolivre.com.br/afiliados/linkbuilder#hub',
  amazonAssociados: 'https://associados.amazon.com.br/',
  shopeeApiForm: 'https://help.shopee.com.br/portal/webform/bbce78695c364ba18c9cbceb74ec9091?entryPoint=1&lastArticleID=',
  shopeeOpenApi: 'https://affiliate.shopee.com.br/open_api',
}

const s = {
  card: { ...cfgStyles.card, padding: 18, marginBottom: 0 },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 },
  body: { fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6 },
  stepRow: { display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 },
  stepBadge: {
    width: 26, height: 26, borderRadius: '50%',
    background: 'var(--success)', color: 'white',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, flexShrink: 0,
  },
  stepText: { fontSize: 13, color: 'var(--ink)', lineHeight: 1.55, paddingTop: 2, flex: 1 },
  tip: {
    display: 'flex', gap: 8, padding: 12,
    borderRadius: 12, border: '1px solid #fde68a',
    background: '#fffbeb', fontSize: 12.5, color: '#78350f', lineHeight: 1.5,
  },
  warn: {
    display: 'flex', gap: 8, padding: 12,
    borderRadius: 12, border: '1px solid #fecaca',
    background: '#fef2f2', fontSize: 12.5, color: '#7f1d1d', lineHeight: 1.5,
  },
  pill: (color) => ({
    display: 'inline-flex', alignItems: 'center',
    padding: '3px 10px', borderRadius: 999,
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
    background: color === 'green' ? '#dcfce7' : color === 'blue' ? '#dbeafe' : color === 'yellow' ? '#fef9c3' : '#ffedd5',
    color: color === 'green' ? '#14532d' : color === 'blue' ? '#1e3a8a' : color === 'yellow' ? '#713f12' : '#7c2d12',
    marginRight: 6, marginBottom: 4,
  }),
  link: { color: 'var(--success)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2 },
  divider: (color) => ({
    borderRadius: 12, border: `1px solid ${color}`,
    background: color === '#bfdbfe' ? '#eff6ff' : color === '#fde68a' ? '#fefce8' : color === '#fdba74' ? '#fff7ed' : '#f1f5f9',
    padding: 14, marginBottom: 12,
  }),
  inlineImg: {
    display: 'block', width: '100%', borderRadius: 12,
    border: '1px solid var(--line)', overflow: 'hidden',
    marginTop: 10, marginBottom: 4,
  },
  imgCaption: {
    fontSize: 11, color: 'var(--ink-soft)', textAlign: 'center',
    padding: '6px 8px', borderTop: '1px solid var(--line)',
    background: 'var(--surface)',
  },
  code: {
    background: 'var(--bg-soft)', border: '1px solid var(--line)',
    borderRadius: 6, padding: '1px 6px', fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink)',
  },
  cookiePill: {
    display: 'inline-flex', padding: '3px 8px', borderRadius: 6,
    background: '#fef9c3', border: '1px solid #fde68a',
    fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
    color: '#713f12', marginRight: 4, marginBottom: 4,
  },
}

function ExternalLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={s.link}>
      {children} ↗
    </a>
  )
}

function Tip({ children }) {
  return (
    <div style={s.tip}>
      <span>💡</span>
      <span>{children}</span>
    </div>
  )
}

function Warning({ children }) {
  return (
    <div style={s.warn}>
      <span>⚠️</span>
      <span>{children}</span>
    </div>
  )
}

function StepList({ steps }) {
  return (
    <div style={{ marginBottom: 4 }}>
      {steps.map((step, i) => (
        <div key={i} style={s.stepRow}>
          <div style={s.stepBadge}>{i + 1}</div>
          <div style={s.stepText}>{step}</div>
        </div>
      ))}
    </div>
  )
}

function SectionBadge({ children, color }) {
  return <span style={s.pill(color)}>{children}</span>
}

function TutorialImage({ src, alt }) {
  return (
    <a href={src} target="_blank" rel="noreferrer" style={s.inlineImg}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" decoding="async" style={{ width: '100%', height: 'auto', display: 'block' }} />
      <div style={s.imgCaption}>🔎 Toque para abrir em alta resolução</div>
    </a>
  )
}

export default function MobileTutorialPage() {
  useMobileRoutePerf('m/tutorial')

  return (
    <MobileShell title="Conversor" active="conta">
      <div style={cfgStyles.pageH}>
        <div style={cfgStyles.pageEyebrow}>Configuração</div>
        <div style={cfgStyles.pageTitle}>Guia de Credenciais</div>
      </div>

      {/* Header */}
      <div style={cfgStyles.cardWrap}>
        <div style={s.card}>
          <div style={s.body}>
            Para o <strong>BOTinho</strong> funcionar, ele precisa se conectar às suas contas de afiliado. Siga os passos abaixo — é mais simples do que parece!
          </div>
          <div style={{ marginTop: 12, marginBottom: 12 }}>
            <SectionBadge color="green">Tempo: 15–25 min</SectionBadge>
            <SectionBadge color="blue">Dificuldade: fácil</SectionBadge>
            <SectionBadge color="yellow">Ordem: ML → Amazon → Shopee</SectionBadge>
          </div>
          <Tip>
            Este guia cobre <strong>Mercado Livre</strong>, <strong>Amazon</strong> e <strong>Shopee</strong>. Você não precisa configurar todas de uma vez — faça uma por vez.
          </Tip>

          <div style={{ marginTop: 12, borderRadius: 12, border: '1px solid #6ee7b7', background: '#ecfdf5', padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#064e3b', marginBottom: 8 }}>✅ Checklist rápido (antes de começar)</div>
            {[
              'Estou no computador com Google Chrome.',
              'Instalei a extensão Cookie-Editor.',
              'Separei 20 minutos para fazer tudo com calma.',
              'Vou configurar 1 plataforma por vez para evitar confusão.',
            ].map((item) => (
              <div key={item} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: '#065f46', marginBottom: 6, lineHeight: 1.4 }}>
                <span>☑️</span><span>{item}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <Warning>
              Nunca compartilhe seus cookies, IDs, SSID, Key ou Secret com terceiros. Esses dados dão acesso à sua conta.
            </Warning>
          </div>
        </div>
      </div>

      {/* Passo 0 — Cookie-Editor */}
      <div style={cfgStyles.sectionLabel}>🛠️ Passo 0 — Ferramenta Essencial</div>
      <div style={{ padding: '0 16px' }}>
        <div style={s.card}>
          <div style={s.sectionTitle}>Cookie-Editor</div>
          <div style={{ ...s.body, marginBottom: 14 }}>
            Antes de qualquer coisa, instale a extensão <strong>Cookie-Editor</strong> no Google Chrome no seu computador. Ela vai te ajudar a copiar códigos de autenticação das plataformas.
          </div>
          <StepList steps={[
            <>Abra o Google Chrome no computador (não funciona no celular).</>,
            <><ExternalLink href={LINKS.cookieEditor}>Clique aqui para abrir a Cookie-Editor na Chrome Web Store</ExternalLink> e depois clique em <strong>"Usar no Chrome"</strong>.</>,
            <>Confirme a instalação clicando em <strong>"Adicionar extensão"</strong> na janelinha que aparecer.</>,
            <>Pronto! O ícone da extensão (uma bolachinha 🍪) vai aparecer no canto superior direito do navegador.</>,
          ]} />
          <TutorialImage src="https://i.postimg.cc/cvYC69ZD/Captura-de-Tela-2026-05-16-a-s-11-25-44.png" alt="Instalação da extensão Cookie-Editor" />
          <Tip>
            Não encontrou o ícone? Clique no ícone de <strong>peça de quebra-cabeça 🧩</strong> ao lado da barra de endereço e fixe a Cookie-Editor clicando no alfinete 📌.
          </Tip>
        </div>
      </div>

      {/* Mercado Livre */}
      <div style={cfgStyles.sectionLabel}>🔵 Mercado Livre</div>
      <div style={{ padding: '0 16px' }}>
        <div style={s.card}>
          <div style={s.sectionTitle}>Pegando seu ID e SSID</div>
          <div style={{ ...s.body, marginBottom: 14 }}>
            Você vai precisar de dois códigos: o <strong>ID</strong> (identificador do afiliado) e o <strong>SSID</strong> (código de sessão).
          </div>

          <div style={s.divider('#bfdbfe')}>
            <SectionBadge color="blue">Parte 1 — Pegando o ID</SectionBadge>
          </div>
          <StepList steps={[
            <>Faça login na sua conta do Mercado Livre com o perfil de afiliado.</>,
            <><ExternalLink href={LINKS.mercadoLivreLinkBuilder}>Acesse o Gerador de Links ML</ExternalLink> — ou navegue por: <strong>Minha Conta → Afiliados e Criadores → Gerador de links</strong>.</>,
            <>Na página do Gerador de Links, você vai ver um campo chamado <strong>"Etiqueta em uso"</strong> com um código (ex: <code style={s.code}>47xxxxx</code> ou <code style={s.code}>faxxxxx</code>). Esse é o seu <strong>ID</strong>. Copie-o.</>,
          ]} />
          <TutorialImage src="https://i.postimg.cc/cvYC69ZM/Captura-de-Tela-2026-05-16-a-s-11-26-03.png" alt="Mercado Livre: campo etiqueta em uso" />

          <div style={{ ...s.divider('#bfdbfe'), marginTop: 16 }}>
            <SectionBadge color="blue">Parte 2 — Pegando o SSID</SectionBadge>
          </div>
          <StepList steps={[
            <><strong>Na mesma página</strong> do Gerador de Links, clique no ícone da extensão <strong>Cookie-Editor</strong> (canto superior direito do Chrome).</>,
            <>Uma lista de itens vai aparecer. Role até encontrar o item chamado <strong style={{ color: 'var(--success)' }}>ssid</strong> e clique nele para expandir.</>,
            <>Você vai ver o campo <strong>Value</strong> com um código longo. Copie esse valor completo.</>,
          ]} />
          <TutorialImage src="https://i.postimg.cc/68RqTjwf/Captura-de-Tela-2026-05-16-a-s-11-26-57.png" alt="Mercado Livre: abrir Cookie-Editor" />
          <TutorialImage src="https://i.postimg.cc/gxRjrSdK/Captura-de-Tela-2026-05-16-a-s-11-27-08.png" alt="Mercado Livre: valor SSID para copiar" />
          <Tip>
            O valor do SSID começa com letras e traços (ex: <code style={s.code}>ghy-xxxxx_-1</code>). Copie tudo, sem espaços extras.
          </Tip>
        </div>
      </div>

      {/* Amazon */}
      <div style={cfgStyles.sectionLabel}>🟡 Amazon</div>
      <div style={{ padding: '0 16px' }}>
        <div style={s.card}>
          <div style={s.sectionTitle}>Pegando suas Credenciais</div>
          <div style={{ ...s.body, marginBottom: 14 }}>
            Para a Amazon, você vai usar a Cookie-Editor no portal de associados. Os cookies que você precisa copiar estão listados abaixo.
          </div>
          <StepList steps={[
            <><ExternalLink href={LINKS.amazonAssociados}>Acesse o portal Amazon Associados</ExternalLink> e certifique-se de estar logado na sua conta.</>,
            <>Com a página aberta, clique no ícone da <strong>Cookie-Editor</strong> 🍪 no canto superior direito do Chrome.</>,
            <>Uma lista de cookies vai aparecer. Você precisa copiar os valores dos seguintes cookies:
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap' }}>
                {['session-id', 'session-token', 'sess-at-acbbr', 'at-acbbr', 'ubid-acbbr'].map(c => (
                  <span key={c} style={s.cookiePill}>{c}</span>
                ))}
              </div>
            </>,
            <>Para cada um: clique no nome do cookie na lista para expandir e copie o valor que aparece no campo <strong>Value</strong>.</>,
            <>Cole cada valor no campo correspondente na tela de <strong>Credenciais</strong> do BOTinho.</>,
          ]} />
          <TutorialImage src="https://i.postimg.cc/XrFqXH3x/Captura-de-Tela-2026-05-16-a-s-11-27-22.png" alt="Amazon: abrir Cookie-Editor após login" />
          <TutorialImage src="https://i.postimg.cc/JsJ0t6mJ/Captura-de-Tela-2026-05-16-a-s-11-27-33.png" alt="Amazon: cookies necessários na extensão" />
          <Tip>
            Use o campo de <strong>busca (Search)</strong> no topo da Cookie-Editor para encontrar cada cookie rapidamente sem precisar rolar a lista toda.
          </Tip>
        </div>
      </div>

      {/* Shopee */}
      <div style={cfgStyles.sectionLabel}>🟠 Shopee</div>
      <div style={{ padding: '0 16px' }}>
        <div style={s.card}>
          <div style={s.sectionTitle}>Solicitando Acesso à API</div>
          <div style={{ ...s.body, marginBottom: 14 }}>
            A Shopee funciona diferente das outras: você precisa <strong>pedir autorização manualmente</strong> pelo suporte deles. Depois que aprovarem (leva alguns dias), você pega uma <strong>Key</strong> e um <strong>Secret</strong>.
          </div>

          <div style={s.divider('#fdba74')}>
            <SectionBadge color="orange">Parte 1 — Fazendo a solicitação</SectionBadge>
          </div>
          <StepList steps={[
            <><ExternalLink href={LINKS.shopeeApiForm}>Acesse o Formulário de Solicitação da API</ExternalLink>.</>,
            <>Preencha o formulário exatamente assim:
              <div style={{ marginTop: 8 }}>
                {[
                  { label: 'Você é comprador, vendedor ou afiliado?', value: 'Selecione AFILIADO.' },
                  { label: 'Qual é o principal assunto?', value: 'Selecione Dúvidas sobre o Programa de Afiliados.' },
                  { label: 'Você já é Afiliado?', value: 'Marque SIM.' },
                  { label: 'Está com problemas de login?', value: 'Selecione Não, estou com outras dificuldades/dúvidas.' },
                  { label: 'Tema da dificuldade:', value: 'Tenho dúvidas/dificuldades com meu cadastro/conta.' },
                  { label: 'Cenário:', value: 'Quero ativar a API.' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.4 }}>
                    <span style={{ color: '#ea580c', fontWeight: 700, flexShrink: 0 }}>›</span>
                    <span><strong>{label}</strong> {value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--ink)', marginBottom: 4, lineHeight: 1.4 }}>
                  <span style={{ color: '#ea580c', fontWeight: 700, flexShrink: 0 }}>›</span>
                  <span><strong>ID do Afiliado:</strong> informe seu ID Shopee. Se não souber, <ExternalLink href={LINKS.shopeeOpenApi}>acesse este link</ExternalLink> para consultar.</span>
                </div>
              </div>
            </>,
            <>Clique em <strong>ENVIAR</strong>. A Shopee leva alguns dias úteis para liberar o acesso.</>,
          ]} />

          <div style={{ ...s.divider('#fdba74'), marginTop: 16 }}>
            <SectionBadge color="orange">Parte 2 — Pegando Key e Secret (após aprovação)</SectionBadge>
          </div>
          <StepList steps={[
            <><ExternalLink href={LINKS.shopeeOpenApi}>Acesse o painel Shopee Open API</ExternalLink> diariamente até o acesso ser liberado.</>,
            <>Quando aparecer o botão <strong>"Redefinir"</strong>, clique nele — a <strong>Key</strong> e o <strong>Secret</strong> serão exibidos na tela.</>,
            <>Copie os dois valores e cole nos campos correspondentes na tela de <strong>Credenciais</strong> do BOTinho.</>,
          ]} />
          <Tip>
            ⏳ <strong>E agora?</strong> A Shopee leva alguns dias para liberar. Verifique o painel diariamente. Quando o botão <strong>Redefinir</strong> aparecer, clique nele e os dados (Key/Secret) aparecerão para você copiar.
          </Tip>
        </div>
      </div>

      {/* Final */}
      <div style={cfgStyles.sectionLabel}>✅ Tudo pronto!</div>
      <div style={{ padding: '0 16px 32px' }}>
        <div style={{ ...s.card, border: '1px solid #6ee7b7', background: '#ecfdf5' }}>
          <div style={{ fontSize: 14, color: '#065f46', lineHeight: 1.6, marginBottom: 14 }}>
            Após salvar suas credenciais na tela de <strong>Credenciais</strong>, o BOTinho já consegue gerar links de afiliado automaticamente. Se tiver dúvidas ou algum código não funcionar, fale com o suporte!
          </div>
          <div style={{ borderRadius: 12, border: '1px solid #a7f3d0', background: 'rgba(255,255,255,0.8)', padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#065f46', marginBottom: 8 }}>Próximo passo recomendado (2 minutos):</div>
            {[
              'Salvar as credenciais.',
              'Gerar um link de teste de cada plataforma que você configurou.',
              'Confirmar se o link abre corretamente no destino final.',
            ].map((item, i) => (
              <div key={i} style={{ fontSize: 13, color: '#065f46', marginBottom: 4 }}>{i + 1}. {item}</div>
            ))}
          </div>
        </div>
      </div>
    </MobileShell>
  )
}
