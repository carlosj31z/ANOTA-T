import { useState } from 'react'
import { isValidAdmin, isValidSerial, setAdminUnlocked, setUnlockedSerial } from '../utils/serial'
import { logActivation } from '../utils/telemetry'
import CrmIllustration from './CrmIllustration'
import { IconArrowLeft, IconLock, IconShield, IconStore } from './icons'

function RoleStep({ onPick }) {
  return (
    <>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/30 shadow-[0_0_20px_-4px_rgba(251,191,36,0.5)] sm:h-14 sm:w-14">
        <IconLock className="h-6 w-6 sm:h-7 sm:w-7" />
      </div>
      <h1 className="mt-3 text-base font-bold text-white sm:mt-4 sm:text-lg">¿Cómo deseas ingresar?</h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-gray-400 sm:text-sm">
        Selecciona tu tipo de acceso para continuar
      </p>

      <div className="mt-5 space-y-3">
        <button
          type="button"
          onClick={() => onPick('admin')}
          className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-amber-400/50 hover:bg-white/10 active:scale-[0.99]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/30">
            <IconShield className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-bold text-white">Administrador</span>
            <span className="block text-xs text-gray-400">Ingreso con usuario y contraseña</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onPick('merchant')}
          className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-cyan-400/50 hover:bg-white/10 active:scale-[0.99]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-400/30">
            <IconStore className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-bold text-white">Negociante</span>
            <span className="block text-xs text-gray-400">Ingreso con clave serial</span>
          </span>
        </button>
      </div>
    </>
  )
}

function BackButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-gray-400 transition hover:text-white"
    >
      <IconArrowLeft className="h-4 w-4" />
      Volver
    </button>
  )
}

function AdminStep({ onBack, onUnlock }) {
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
      <BackButton onClick={onBack} />
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

function SerialStep({ onBack, onUnlock }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (isValidSerial(value)) {
      setUnlockedSerial(value)
      logActivation({ type: 'serial', serial: value.trim().toUpperCase() }) // fire-and-forget
      onUnlock('merchant')
    } else {
      setError(true)
    }
  }

  return (
    <div className="text-left">
      <BackButton onClick={onBack} />
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
          className={`w-full rounded-xl border bg-white/5 px-4 py-2.5 text-center font-mono text-[15px] uppercase tracking-wider text-white placeholder:text-gray-600 focus:outline-none sm:py-3 ${
            error ? 'border-red-400/60' : 'border-white/10 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20'
          }`}
        />
        {error && (
          <p className="text-center text-xs text-red-400">Serial inválido. Verifica el código e intenta de nuevo.</p>
        )}
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-2.5 text-[14px] font-bold text-white shadow-[0_8px_30px_-8px_rgba(34,211,238,0.6)] transition hover:from-cyan-400 hover:to-blue-500 active:scale-[0.99] sm:py-3 sm:text-[15px]"
        >
          Desbloquear
        </button>
      </form>
    </div>
  )
}

export default function AccessGate({ onUnlock }) {
  const [step, setStep] = useState('role') // 'role' | 'admin' | 'merchant'

  return (
    <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center gap-6 px-5 py-10 sm:px-8 md:flex-row md:justify-between md:gap-6 md:px-10 lg:px-16 xl:px-24">
      <div className="tilt-3d-wrap hidden w-full max-w-md md:flex md:flex-1 md:items-center md:justify-center lg:max-w-lg">
        <CrmIllustration className="tilt-3d w-full" />
      </div>

      <div className="tilt-3d-wrap flex w-full max-w-[190px] justify-center md:hidden">
        <CrmIllustration className="tilt-3d w-full" />
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-5 text-center shadow-2xl shadow-black/50 backdrop-blur-xl animate-fade-in-up sm:p-6 md:w-[380px] md:max-w-none md:shrink-0">
        {step === 'role' && <RoleStep onPick={setStep} />}
        {step === 'admin' && <AdminStep onBack={() => setStep('role')} onUnlock={onUnlock} />}
        {step === 'merchant' && <SerialStep onBack={() => setStep('role')} onUnlock={onUnlock} />}
      </div>
    </div>
  )
}
