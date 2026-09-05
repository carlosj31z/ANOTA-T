import { useState } from 'react'
import { isValidSerial, setUnlockedSerial } from '../utils/serial'
import CrmIllustration from './CrmIllustration'
import { IconLock } from './icons'

export default function SerialGate({ onUnlock }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (isValidSerial(value)) {
      setUnlockedSerial(value)
      onUnlock()
    } else {
      setError(true)
    }
  }

  return (
    <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center gap-6 px-5 py-10 sm:px-8 md:flex-row md:justify-between md:gap-6 md:px-10 lg:px-16 xl:px-24">
      <div className="tilt-3d-wrap hidden w-full max-w-md md:flex md:flex-1 md:items-center md:justify-center lg:max-w-lg">
        <CrmIllustration className="tilt-3d w-full" />
      </div>

      <div className="tilt-3d-wrap flex w-full max-w-[190px] justify-center md:hidden">
        <CrmIllustration className="tilt-3d w-full" />
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-5 text-center shadow-2xl shadow-black/50 backdrop-blur-xl animate-fade-in-up sm:p-6 md:w-[380px] md:max-w-none md:shrink-0">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/30 shadow-[0_0_20px_-4px_rgba(251,191,36,0.5)] sm:h-14 sm:w-14">
          <IconLock className="h-6 w-6 sm:h-7 sm:w-7" />
        </div>

        <h1 className="mt-3 text-base font-bold text-white sm:mt-4 sm:text-lg">Acceso restringido</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-gray-400 sm:text-sm">
          Ingrese serial para desbloquear todas las funciones
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3 text-left sm:mt-5">
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setError(false)
            }}
            placeholder="SN-01-XXXXXXXX"
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className={`w-full rounded-xl border bg-white/5 px-4 py-2.5 text-center font-mono text-[15px] uppercase tracking-wider text-white placeholder:text-gray-600 focus:outline-none sm:py-3 ${
              error
                ? 'border-red-400/60'
                : 'border-white/10 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/20'
            }`}
          />
          {error && (
            <p className="text-center text-xs text-red-400">Serial inválido. Verifica el código e intenta de nuevo.</p>
          )}

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-2.5 text-[14px] font-bold text-white shadow-[0_8px_30px_-8px_rgba(249,115,22,0.6)] transition hover:from-amber-400 hover:to-orange-500 active:scale-[0.99] sm:py-3 sm:text-[15px]"
          >
            Desbloquear
          </button>
        </form>
      </div>
    </div>
  )
}
