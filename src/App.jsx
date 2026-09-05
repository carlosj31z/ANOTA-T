import { useMemo, useState } from 'react'
import CosmicBackground from './components/CosmicBackground'
import Footer from './components/Footer'
import Header from './components/Header'
import SerialGate from './components/SerialGate'
import ShippingForm from './components/ShippingForm'
import SuccessScreen from './components/SuccessScreen'
import { getMerchant } from './data/merchants'
import { getUnlockedSerial } from './utils/serial'

export default function App() {
  const merchant = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return getMerchant(params.get('merchant'))
  }, [])

  const [submittedForm, setSubmittedForm] = useState(null)
  const [unlocked, setUnlocked] = useState(() => Boolean(getUnlockedSerial()))

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <CosmicBackground />

      {!unlocked ? (
        <SerialGate onUnlock={() => setUnlocked(true)} />
      ) : (
        <div className="relative z-10 flex min-h-screen flex-col">
          <Header
            businessName={merchant.businessName}
            subtitle={merchant.subtitle}
            minimal={Boolean(submittedForm)}
          />

          <main className="mx-auto w-full max-w-xl flex-1 px-5 py-6 sm:px-6">
            {submittedForm ? (
              <SuccessScreen form={submittedForm} merchant={merchant} />
            ) : (
              <ShippingForm merchant={merchant} onSubmit={setSubmittedForm} />
            )}
          </main>

          <Footer />
        </div>
      )}
    </div>
  )
}
