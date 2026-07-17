/* Navegação do novo painel.
 *
 * Todas as telas do app vivem na árvore responsiva canônica /painel/*.
 * Novos itens devem apontar sempre para /painel/*; as árvores legadas foram removidas.
 *
 * Organização (reestruturada): os grupos seguem a jornada do usuário em vez de
 * categorias genéricas — Início → Criar & enviar (ação diária) → Acompanhar
 * (o que saiu/vai sair) → Configuração (mexe uma vez). Recursos avançados de
 * nicho ficam numa subseção recolhível (`collapsible: true`) para não competir
 * com o uso do dia a dia. Onboarding ("Primeiros passos") virou um card no topo
 * da sidebar (ver SidebarOnboarding), que some quando concluído. O grupo "Conta"
 * expõe o item Plano na própria lista de nav (o card de plano no rodapé é
 * status/upsell, não substitui a navegação); configurações e sair seguem no
 * menu do avatar no rodapé.
 */

const i = (paths) => paths // SVG children prontos para <svg>

export const NAV_GROUPS = [
  {
    title: 'Início',
    items: [
      {
        label: 'Painel',
        href: '/painel',
        icon: i(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>),
      },
    ],
  },
  {
    title: 'Criar & enviar',
    items: [
      {
        label: 'Criar oferta',
        href: '/painel/criar-oferta',
        icon: i(<><path d="M12 5v14" /><path d="M5 12h14" /><path d="M4 4h16v16H4z" /></>),
      },
      {
        label: 'Espelhar grupos',
        href: '/painel/espelhamento',
        icon: i(<><path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></>),
      },
      {
        label: 'Ofertas automáticas',
        href: '/painel/ofertas-automaticas',
        pro: true,
        icon: i(<><path d="M12 2v4" /><path d="M12 18v4" /><path d="M4.9 4.9l2.8 2.8" /><path d="M16.3 16.3l2.8 2.8" /><circle cx="12" cy="12" r="4" /></>),
      },
      {
        label: 'Enviar agora',
        href: '/painel/envio',
        icon: i(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>),
      },
      {
        label: 'Filas',
        href: '/painel/filas',
        pro: true,
        icon: i(<><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /><circle cx="2" cy="6" r=".5" /><circle cx="2" cy="12" r=".5" /><circle cx="2" cy="18" r=".5" /></>),
      },
    ],
  },
  {
    title: 'Acompanhar',
    items: [
      {
        label: 'Envios',
        href: '/painel/envios',
        icon: i(<><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></>),
      },
    ],
  },
  {
    title: 'Configuração',
    items: [
      {
        label: 'Conexão WhatsApp',
        href: '/painel/whatsapp',
        icon: i(<><rect x="5" y="2" width="14" height="20" rx="2.5" /><line x1="12" y1="18" x2="12" y2="18" /></>),
      },
      {
        label: 'Grupos',
        href: '/painel/grupos',
        icon: i(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
      },
      {
        label: 'Templates de mensagens',
        href: '/painel/mensagens',
        icon: i(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />),
      },
      {
        label: 'Minhas credenciais',
        href: '/painel/ids-afiliada',
        icon: i(<><circle cx="7.5" cy="15.5" r="5.5" /><path d="M21 2l-9.6 9.6" /><path d="M15.5 7.5 18 10l3-3-2.5-2.5z" /></>),
      },
    ],
  },
  {
    title: 'Preservação avançada',
    collapsible: true,
    defaultOpen: true,
    items: [
      {
        label: 'Monitoramento',
        href: '/painel/preservacao/monitoramento',
        pro: true,
        icon: i(<><path d="M3 3v18h18" /><path d="m7 14 3-3 3 3 4-5" /></>),
      },
      {
        label: 'Preservação por grupo e canal',
        href: '/painel/preservacao/destinos',
        pro: true,
        icon: i(<><circle cx="12" cy="10" r="3" /><path d="M12 2a8 8 0 0 0-8 8c0 5.4 8 12 8 12s8-6.6 8-12a8 8 0 0 0-8-8z" /></>),
      },
      {
        label: 'Configurações avançadas',
        href: '/painel/preservacao/configuracoes',
        pro: true,
        icon: i(<><path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5l-8-3z" /><path d="m9 12 2 2 4-4" /></>),
      },
    ],
  },
  {
    title: 'Conta',
    items: [
      {
        label: 'Plano',
        href: '/painel/plano',
        icon: i(<path d="M12 2.5l2.9 6 6.6.6-5 4.4 1.5 6.5L12 16.9 5.5 20.5 7 14 2 9.6l6.6-.6z" />),
      },
      {
        label: 'Afiliados',
        href: '/painel/afiliados',
        icon: i(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 1-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
      },
    ],
  },
]
