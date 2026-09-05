import { useState } from 'react'
import { isValidSerial, setUnlockedSerial } from '../utils/serial'
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
    <div className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 text-center shadow-2xl shadow-black/50 backdrop-blur-xl animate-fade-in-up">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/30 shadow-[0_0_20px_-4px_rgba(251,191,36,0.5)]">
          <IconLock className="h-7 w-7" />
        </div>

        <h1 className="mt-4 text-lg font-bold text-white">Acceso restringido</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-400">
          Ingrese serial para desbloquear todas las funciones
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-3 text-left">
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
            className={`w-full rounded-xl border bg-white/5 px-4 py-3 text-center font-mono text-[15px] uppercase tracking-wider text-white placeholder:text-gray-600 focus:outline-none ${
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
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-3 text-[15px] font-bold text-white shadow-[0_8px_30px_-8px_rgba(249,115,22,0.6)] transition hover:from-amber-400 hover:to-orange-500 active:scale-[0.99]"
          >
            Desbloquear
          </button>
        </form>
      </div>
    </div>
  )
}
