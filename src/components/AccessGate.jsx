import { useState } from 'react'
import { isValidAdmin, setAdminUnlocked, setUnlockedSerial } from '../utils/serial'
import { checkClientSerial } from '../utils/supabaseClients'
import { logActivation } from '../utils/telemetry'
import CrmIllustration from './CrmIllustration'
import { IconShield, IconStore } from './icons'

function AdminStep({ onUnlock }) {
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (isValidAdmin(user, password)) {
      setAdminUnlocked()
      logActivation({ type: 'admin' }) // fire-and-forget
      onUnlock('admin')
    } else {
      setError(true)
    }
  }

  return (
    <div className="text-left">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/30 sm:h-14 sm:w-14">
          <IconShield className="h-6 w-6 sm:h-7 sm:w-7" />
        </div>
        <h1 className="mt-3 text-base font-bold text-white sm:mt-4 sm:text-lg">Acceso administrador</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-gray-400 sm:text-sm">
          Ingresa tus credenciales
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3 sm:mt-5">
        <input
          value={user}
          onChange={(e) => {
            setUser(e.target.value)
            setError(false)
          }}
          placeholder="Usuario"
          autoFocus
          autoCapitalize="none"
          autoComplete="username"
          spellCheck={false}
          className={`w-full rounded-xl border bg-white/5 px-4 py-2.5 text-[15px] text-white placeholder:text-gray-500 focus:outline-none sm:py-3 ${
            error ? 'border-red-400/60' : 'border-white/10 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/20'
          }`}
        />
        <input
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setError(false)
          }}
          type="password"
          placeholder="Contraseña"
          autoComplete="current-password"
          className={`w-full rounded-xl border bg-white/5 px-4 py-2.5 text-[15px] text-white placeholder:text-gray-500 focus:outline-none sm:py-3 ${
            error ? 'border-red-400/60' : 'border-white/10 focus:border-amber-400/70 focus:ring-2 focus:ring-amber-400/20'
          }`}
        />
        {error && (
          <p className="text-center text-xs text-red-400">Usuario o contraseña incorrectos.</p>
        )}
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-2.5 text-[14px] font-bold text-white shadow-[0_8px_30px_-8px_rgba(249,115,22,0.6)] transition hover:from-amber-400 hover:to-orange-500 active:scale-[0.99] sm:py-3 sm:text-[15px]"
        >
          Ingresar
        </button>
      </form>
    </div>
  )
}

function SerialStep({ onUnlock }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setChecking(true)
    const ok = await checkClientSerial(value)
    setChecking(false)
    if (ok) {
      setUnlockedSerial(value)
      logActivation({ type: 'serial', serial: value.trim().toUpperCase() }) // fire-and-forget
      onUnlock('merchant')
    } else {
      setError(true)
    }
  }

  return (
    <div className="text-left">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-400/30 sm:h-14 sm:w-14">
          <IconStore className="h-6 w-6 sm:h-7 sm:w-7" />
        </div>
        <h1 className="mt-3 text-base font-bold text-white sm:mt-4 sm:text-lg">Acceso negociante</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-gray-400 sm:text-sm">
          Ingrese serial para desbloquear todas las funciones
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3 sm:mt-5">
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
          disabled={checking}
          className={`w-full rounded-xl border bg-white/5 px-4 py-2.5 text-center font-mono text-[15px] uppercase tracking-wider text-white placeholder:text-gray-600 focus:outline-none disabled:opacity-60 sm:py-3 ${
            error ? 'border-red-400/60' : 'border-white/10 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20'
          }`}
        />
        {error && (
          <p className="text-center text-xs text-red-400">Serial inválido. Verifica el código e intenta de nuevo.</p>
        )}
        <button
          type="submit"
          disabled={checking || !value.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-2.5 text-[14px] font-bold text-white shadow-[0_8px_30px_-8px_rgba(34,211,238,0.6)] transition hover:from-cyan-400 hover:to-blue-500 active:scale-[0.99] disabled:opacity-60 sm:py-3 sm:text-[15px]"
        >
          {checking ? 'Verificando…' : 'Desbloquear'}
        </button>
      </form>
    </div>
  )
}

/**
 * `mode`: 'admin' | 'client' — decide qué formulario mostrar. Ya no hay un
 * selector "¿Cómo deseas ingresar?": la URL decide (ver App.jsx) — el link
 * normal ("/") es para el cliente/negociante, y "/admin" para el dueño del
 * negocio. Un click menos para cada quien.
 */
export default function AccessGate({ mode, onUnlock }) {
  return (
    <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center gap-6 px-5 py-10 sm:px-8 md:flex-row md:justify-between md:gap-6 md:px-10 lg:px-16 xl:px-24">
      <div className="tilt-3d-wrap hidden w-full max-w-md md:flex md:flex-1 md:items-center md:justify-center lg:max-w-lg">
        <CrmIllustration className="tilt-3d w-full" />
      </div>

      <div className="tilt-3d-wrap flex w-full max-w-[190px] justify-center md:hidden">
        <CrmIllustration className="tilt-3d w-full" />
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-5 text-center shadow-2xl shadow-black/50 backdrop-blur-xl animate-fade-in-up sm:p-6 md:w-[380px] md:max-w-none md:shrink-0">
        {mode === 'admin' ? <AdminStep onUnlock={onUnlock} /> : <SerialStep onUnlock={onUnlock} />}
      </div>
    </div>
  )
}
