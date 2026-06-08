import { MobileStateCard } from '@/components/mobile/MobileShell'

export const metadata = {
  title: 'BOTinho Mobile',
  alternates: { canonical: '/m' },
  robots: { index: false, follow: false },
}

const isMobilePreviewEnabled = process.env.NEXT_PUBLIC_ENABLE_MOBILE_PREVIEW !== 'false'

export default function MobileLayout({ children }) {
  if (!isMobilePreviewEnabled) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-md bg-[#EEF6F2] p-4">
        <MobileStateCard
          title="Visual mobile temporariamente desativado"
          description="Ative NEXT_PUBLIC_ENABLE_MOBILE_PREVIEW para liberar as telas em staging."
          tone="error"
        />
      </div>
    )
  }

  return children
}
