import { MobileShell } from '@/components/mobile/MobileShell'
import { tutorialSteps } from '@/components/mobile/mobileConfigData'

export default function TutorialPage() {
  const doneCount = tutorialSteps.filter((item) => item.done).length

  return (
    <MobileShell title="Conversor" active="inicio">
      <h2 className="text-lg font-semibold">Tutorial</h2>
      <div className="mt-3 rounded-2xl border border-[#d7e7de] bg-white p-4">
        <p className="text-sm font-semibold">Seu progresso: {doneCount}/{tutorialSteps.length}</p>
        <div className="mt-2 h-2 rounded-full bg-[#e7f0eb]"><div className="h-2 rounded-full bg-[#3E9C7A]" style={{ width: `${(doneCount / tutorialSteps.length) * 100}%` }} /></div>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-[#d7e7de] bg-white">
        {tutorialSteps.map((item) => (
          <div key={item.id} className="border-b border-[#edf3ef] p-3 last:border-b-0">
            <p className="text-sm font-semibold">{item.id} · {item.title}</p>
            <p className="mt-1 text-xs text-[#5A6E68]">{item.meta}</p>
            <p className={`mt-1 text-xs font-semibold ${item.done ? 'text-[#3E9C7A]' : item.current ? 'text-[#1F2D2A]' : 'text-[#8FA09A]'}`}>{item.done ? 'Concluído' : item.current ? 'Continuar' : 'Pendente'}</p>
          </div>
        ))}
      </div>
    </MobileShell>
  )
}
