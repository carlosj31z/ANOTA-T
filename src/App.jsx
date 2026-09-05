import { useMemo, useState } from 'react'
import CosmicBackground from './components/CosmicBackground'
import CutoffBanner from './components/CutoffBanner'
import Footer from './components/Footer'
import Header from './components/Header'
import ShippingForm from './components/ShippingForm'
import SuccessScreen from './components/SuccessScreen'
import { getMerchant } from './data/merchants'
import { isPastCutoff } from './utils/dates'

export default function App() {
  const merchant = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return getMerchant(params.get('merchant'))
  }, [])

  const [submittedForm, setSubmittedForm] = useState(null)

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <CosmicBackground />

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
            <div className="space-y-5">
              <CutoffBanner cutoffHour={merchant.cutoffHour} passed={isPastCutoff(merchant)} />
              <ShippingForm merchant={merchant} onSubmit={setSubmittedForm} />
            </div>
          )}
        </main>

        <Footer />
      </div>
    </div>
  )
}
