import { IconBox } from './icons'

export default function Header({ businessName, subtitle, minimal = false }) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-xl items-center gap-3 px-5 py-4 sm:px-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-950">
          <IconBox className="h-5 w-5" />
        </span>
        {minimal ? (
          <p className="text-xs font-bold tracking-wide text-gray-400 uppercase">Formulario de Envío</p>
        ) : (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-base font-bold tracking-wide text-gray-900">{businessName}</p>
            <p className="text-[11px] font-bold tracking-wide text-gray-400 uppercase">{subtitle}</p>
          </div>
        )}
      </div>
    </header>
  )
}
