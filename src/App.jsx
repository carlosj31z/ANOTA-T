import { useEffect, useMemo, useState } from 'react'
import AccessGate from './components/AccessGate'
import AdminDashboard from './components/AdminDashboard'
import CosmicBackground from './components/CosmicBackground'
import Footer from './components/Footer'
import Header from './components/Header'
import { IconRefresh } from './components/icons'
import ShippingForm from './components/ShippingForm'
import SuccessScreen from './components/SuccessScreen'
import { getMerchant } from './data/merchants'
import { clearAccess, getStoredRole, getStoredSerial } from './utils/serial'
import { checkClientSerial } from './utils/supabaseClients'

export default function App() {
  const merchant = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return getMerchant(params.get('merchant'))
  }, [])

  // La URL decide el flujo: "/admin" es del dueño del negocio; cualquier
  // otro link (el normal, con o sin ?merchant=) es para el cliente/
  // negociante. Ya no hay un selector "¿Cómo deseas ingresar?" — un click
  // menos para cada quien.
  const isAdminRoute = useMemo(() => /^\/admin(\/|$)/.test(window.location.pathname), [])

  const [submittedForm, setSubmittedForm] = useState(null)
  // El rol de admin se confía de inmediato (localStorage) — se resuelve acá
  // mismo, sin efecto. El de negociante necesita una llamada de red para
  // re-validarse contra Supabase (puede haber sido revocado), así que solo
  // ese caso arranca "cargando" y lo resuelve el efecto de abajo.
  const [role, setRole] = useState(() => (isAdminRoute ? (getStoredRole() === 'admin' ? 'admin' : null) : null))
  const [checkingAccess, setCheckingAccess] = useState(() => !isAdminRoute && Boolean(getStoredSerial()))
  const [adminView, setAdminView] = useState('dashboard') // 'dashboard' | 'form'

  useEffect(() => {
    if (isAdminRoute) return undefined
    const stored = getStoredSerial()
    if (!stored) return undefined
    let alive = true
    checkClientSerial(stored).then((ok) => {
      if (!alive) return
      if (ok) setRole('merchant')
      else clearAccess()
      setCheckingAccess(false)
    })
    return () => {
      alive = false
    }
  }, [isAdminRoute])

  function handleLogout() {
    clearAccess()
    setSubmittedForm(null)
    setAdminView('dashboard')
    setRole(null)
  }

  function handleBackToPanel() {
    setSubmittedForm(null)
    setAdminView('dashboard')
  }

  const isAdmin = role === 'admin'
  const showForm = !isAdmin || adminView === 'form'
  const wide = isAdmin && adminView === 'dashboard'

  if (checkingAccess) {
    return (
      <div className="relative min-h-screen overflow-x-hidden">
        <CosmicBackground />
        <div className="relative z-10 flex min-h-screen items-center justify-center gap-2 text-gray-400">
          <IconRefresh className="h-4 w-4 animate-spin" />
          <span className="text-sm">Cargando…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <CosmicBackground />

      {!role ? (
        <AccessGate mode={isAdminRoute ? 'admin' : 'client'} onUnlock={setRole} />
      ) : (
        <div className="relative z-10 flex min-h-screen flex-col">
          <Header
            businessName={merchant.businessName}
            subtitle={isAdmin ? 'Panel de administrador' : merchant.subtitle}
            minimal={Boolean(submittedForm) && !isAdmin}
          />

          <main className={`mx-auto w-full flex-1 px-5 py-6 sm:px-6 ${wide ? 'max-w-5xl' : 'max-w-xl'}`}>
            {isAdmin && adminView === 'dashboard' ? (
              <AdminDashboard onLogout={handleLogout} onOpenForm={() => setAdminView('form')} />
            ) : submittedForm ? (
              <SuccessScreen
                form={submittedForm}
                merchant={merchant}
                onNewOrder={() => setSubmittedForm(null)}
                onBackToPanel={isAdmin ? handleBackToPanel : null}
              />
            ) : (
              <>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleBackToPanel}
                    className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-gray-400 transition hover:text-white"
                  >
                    ← Volver al panel
                  </button>
                )}
                {showForm && <ShippingForm merchant={merchant} onSubmit={setSubmittedForm} />}
              </>
            )}
          </main>

          <Footer />
        </div>
      )}
    </div>
  )
}
