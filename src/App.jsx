import { useMemo, useState } from 'react'
import AccessGate from './components/AccessGate'
import AdminDashboard from './components/AdminDashboard'
import CosmicBackground from './components/CosmicBackground'
import Footer from './components/Footer'
import Header from './components/Header'
import ShippingForm from './components/ShippingForm'
import SuccessScreen from './components/SuccessScreen'
import { getMerchant } from './data/merchants'
import { clearAccess, getAccessRole } from './utils/serial'

export default function App() {
  const merchant = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return getMerchant(params.get('merchant'))
  }, [])

  const [submittedForm, setSubmittedForm] = useState(null)
  const [role, setRole] = useState(() => getAccessRole())
  const [adminView, setAdminView] = useState('dashboard') // 'dashboard' | 'form'

  function handleLogout() {
    clearAccess()
    setSubmittedForm(null)
    setAdminView('dashboard')
    setRole(null)
  }

  const isAdmin = role === 'admin'
  const showForm = !isAdmin || adminView === 'form'
  const wide = isAdmin && adminView === 'dashboard'

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <CosmicBackground />

      {!role ? (
        <AccessGate onUnlock={setRole} />
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
              <SuccessScreen form={submittedForm} merchant={merchant} />
            ) : (
              <>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setSubmittedForm(null)
                      setAdminView('dashboard')
                    }}
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
