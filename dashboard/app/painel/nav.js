/* Navegação do novo painel.
 *
 * Todas as telas de app já têm versão "Menta" em /painel/* — a migração que
 * aposenta o /dashboard legado foi concluída (ver docs/frontend/parity-matrix.md).
 * Novos itens devem apontar sempre para /painel/*; o /dashboard só permanece
 * como redirect de transição.
 */

const i = (paths) => paths // SVG children prontos para <svg>

export const NAV_GROUPS = [
  {
    title: 'Operação',
    items: [
      {
        label: 'Painel',
        href: '/painel',
        icon: i(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>),
      },
      {
        label: 'Criar oferta',
        href: '/painel/criar-oferta',
        free: true,
        icon: i(<><path d="M12 5v14" /><path d="M5 12h14" /><path d="M4 4h16v16H4z" /></>),
      },
      {
        label: 'Conversor de links',
        href: '/painel/converte-links',
        free: true,
        icon: i(<><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></>),
      },
      {
        label: 'Espelhamento',
        href: '/painel/espelhamento',
        pro: true,
        icon: i(<><path d="M17 2l4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></>),
      },
      {
        label: 'Ofertas automáticas',
        href: '/painel/ofertas-automaticas',
        pro: true,
        icon: i(<><path d="M12 2v4" /><path d="M12 18v4" /><path d="M4.9 4.9l2.8 2.8" /><path d="M16.3 16.3l2.8 2.8" /><circle cx="12" cy="12" r="4" /></>),
      },
      {
        label: 'Enviar mensagem',
        href: '/painel/envio',
        icon: i(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>),
      },
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
        label: 'Grupos',
        href: '/painel/grupos',
        icon: i(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
      },
      {
        label: 'Mensagens',
        href: '/painel/mensagens',
        icon: i(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />),
      },
      {
        label: 'IDs de afiliada',
        href: '/painel/ids-afiliada',
        icon: i(<><circle cx="7.5" cy="15.5" r="5.5" /><path d="M21 2l-9.6 9.6" /><path d="M15.5 7.5 18 10l3-3-2.5-2.5z" /></>),
      },
      {
        label: 'Conexão WhatsApp',
        href: '/painel/whatsapp',
        icon: i(<><rect x="5" y="2" width="14" height="20" rx="2.5" /><line x1="12" y1="18" x2="12" y2="18" /></>),
      },
    ],
  },
  {
    title: 'Preservação avançada',
    items: [
      {
        label: 'Monitoramento',
        href: '/painel/preservacao/monitoramento',
        pro: true,
        icon: i(<><path d="M3 3v18h18" /><path d="m7 14 3-3 3 3 4-5" /></>),
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
        label: 'Configurações',
        href: '/painel/configuracoes',
        icon: i(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>),
      },
      {
        label: 'Plano e cobrança',
        href: '/painel/plano',
        icon: i(<><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></>),
      },
      {
        label: 'Tutorial',
        href: '/painel/tutorial',
        icon: i(<><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>),
      },
    ],
  },
]
