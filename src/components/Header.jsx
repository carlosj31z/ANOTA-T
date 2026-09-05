import { IconBox } from './icons'

export default function Header({ businessName, subtitle, minimal = false }) {
  return (
    <header className="border-b border-white/10 bg-white/[0.03] backdrop-blur-xl">
      <div className="mx-auto flex max-w-xl items-center gap-3 px-5 py-4 sm:px-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 text-amber-300 ring-1 ring-amber-400/30 shadow-[0_0_16px_-3px_rgba(251,191,36,0.6)]">
          <IconBox className="h-5 w-5" />
        </span>
        {minimal ? (
          <p className="text-xs font-bold tracking-wide text-gray-400 uppercase">Formulario de Envío</p>
        ) : (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-base font-bold tracking-wide text-white">{businessName}</p>
            <p className="text-[11px] font-bold tracking-wide text-gray-400 uppercase">{subtitle}</p>
          </div>
        )}
      </div>
    </header>
  )
}
