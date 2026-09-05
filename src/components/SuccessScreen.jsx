import { COURIERS } from '../data/agencies'
import { PAYMENT_LABELS } from '../data/paymentMethods'
import { buildWhatsAppSummary, buildWhatsAppUrl } from '../utils/whatsapp'
import { IconCheck, IconWhatsapp } from './icons'

const DELIVERY_TITLES = {
  store: 'Recojo en tienda',
  agency: 'Nuevo envío (agencia)',
  home: 'Envío a domicilio',
}

function Row({ icon, children }) {
  return (
    <p className="flex items-start gap-2 text-[13.5px] leading-relaxed text-gray-700">
      <span className="mt-px shrink-0">{icon}</span>
      <span className="min-w-0 break-words">{children}</span>
    </p>
  )
}

export default function SuccessScreen({ form, merchant }) {
  const message = buildWhatsAppSummary(form, merchant)
  const whatsappUrl = buildWhatsAppUrl(merchant.whatsappNumber, message)

  return (
    <div className="flex flex-col items-center py-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600 animate-pop-in">
        <IconCheck className="h-8 w-8" />
      </div>

      <h1 className="mt-4 text-xl font-bold text-gray-900">¡Registro Exitoso!</h1>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-gray-500">
        Tu envío ha sido programado correctamente. Verifica los datos y envíalos por chat con el botón verde.
      </p>

      <div className="animate-fade-in-up mt-6 w-full space-y-2.5 rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm">
        <p className="text-[11px] font-bold tracking-wide text-gray-400 uppercase">Resumen</p>

        <p className="text-sm font-bold text-gray-900">
          📦 {DELIVERY_TITLES[form.deliveryMethod] ?? 'Nuevo pedido'}
        </p>

        <div className="space-y-1.5 pt-1">
          <Row icon="👤">{form.fullName}</Row>
          <Row icon="📱">{form.phone}</Row>

          {form.deliveryMethod === 'agency' && (
            <>
              <Row icon="🆔">DNI: {form.dni}</Row>
              <Row icon="🏬">Agencia: {form.agency?.label}</Row>
              {form.agency?.address && (
                <Row icon="📍">
                  {form.agency.address}
                  {form.agency.reference ? `, Referencia: ${form.agency.reference}` : ''}
                </Row>
              )}
            </>
          )}

          {form.deliveryMethod === 'home' && (
            <>
              <Row icon="📍">{form.address}</Row>
              <Row icon="🏙️">
                {[form.department, form.provinceDistrict].filter(Boolean).join(' / ')}
              </Row>
              {form.reference && <Row icon="📝">{form.reference}</Row>}
              <Row icon="💳">{PAYMENT_LABELS[form.paymentMethod] ?? form.paymentMethod}</Row>
            </>
          )}

          {form.notes && <Row icon="🗒️">{form.notes}</Row>}
        </div>

        {(form.courier || form.shippingDate) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-2.5">
            {form.courier && (
              <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-gray-800">
                🚚 {COURIERS[form.courier]?.label ?? form.courier}
              </span>
            )}
            {form.shippingDate && (
              <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-gray-800">
                📅 {form.shippingDate.shortLabel}
              </span>
            )}
          </div>
        )}
      </div>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 py-3.5 text-[15px] font-bold text-white shadow-sm shadow-green-200 transition hover:bg-green-600 active:scale-[0.99]"
      >
        Enviar por WhatsApp
        <IconWhatsapp className="h-5 w-5" />
      </a>
    </div>
  )
}
