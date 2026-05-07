import { PromocaoPage } from '@/components/promocao/PromocaoPage'

export const metadata = {
  title: 'Promoção Especial Wabot',
  description: 'Página promocional para novos cadastros do Wabot com foco em afiliados de WhatsApp.',
  alternates: { canonical: '/promocao' },
}

export default function Page() {
  return <PromocaoPage />
}
