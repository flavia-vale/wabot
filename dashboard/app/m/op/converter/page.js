import Link from 'next/link'
import { MobileShell } from '@/components/mobile/MobileShell'

export default function ConverterPage() {
  return (
    <MobileShell title="Conversor" active="converter">
      <h2 className="text-lg font-semibold">Converter link</h2>
      <div className="mt-3 rounded-2xl border border-[#d7e7de] bg-white p-4">
        <p className="text-xs font-semibold text-[#5A6E68]">Cole o link original</p>
        <div className="mt-2 rounded-xl border border-[#d7e7de] bg-[#EEF6F2] p-3 text-xs text-[#5A6E68]">shopee.com.br/Sandalia-Bege-Verao-i.4738291.928374</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className="rounded-full border border-[#d7e7de] px-3 py-2 text-sm font-semibold">Colar</button>
          <button className="rounded-full bg-[#1F2D2A] px-3 py-2 text-sm font-semibold text-white">Converter agora</button>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-[#bde3d2] bg-[#f3fbf7] p-4">
        <p className="text-xs font-semibold text-[#3E9C7A]">Link convertido</p>
        <div className="mt-2 rounded-xl border border-[#d7e7de] bg-white p-3 text-xs">s.shopee.com.br/3As9XkLp2</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className="rounded-full border border-[#d7e7de] px-3 py-2 text-sm font-semibold">Copiar</button>
          <Link href="/m/op/offer" className="rounded-full bg-[#3E9C7A] px-3 py-2 text-center text-sm font-semibold text-white">Criar oferta</Link>
        </div>
      </div>
    </MobileShell>
  )
}
