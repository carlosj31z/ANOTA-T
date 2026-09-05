import { useState } from 'react'
import { COURIERS } from '../data/agencies'
import { PAYMENT_LABELS } from '../data/paymentMethods'
import { downloadShippingLabel } from '../utils/label'
import { buildWhatsAppSummary, buildWhatsAppUrl } from '../utils/whatsapp'
import { IconCheck, IconCopy, IconTag, IconWhatsapp } from './icons'

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
  return Promise.resolve()
}

const DELIVERY_TITLES = {
  store: 'Recojo en tienda',
  agency: 'Nuevo envío (agencia)',
  home: 'Envío a domicilio',
}

function Row({ icon, children }) {
  return (
    <p className="flex items-start gap-2 text-[13.5px] leading-relaxed text-gray-300">
      <span className="mt-px shrink-0">{icon}</span>
      <span className="min-w-0 break-words">{children}</span>
    </p>
  )
}

export default function SuccessScreen({ form, merchant }) {
  const message = buildWhatsAppSummary(form, merchant)
  const whatsappUrl = buildWhatsAppUrl(merchant.whatsappNumber, message)
  const [copied, setCopied] = useState(false)
  const [labelSaved, setLabelSaved] = useState(false)

  function handleCopy() {
    copyText(message).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleDownloadLabel() {
    downloadShippingLabel(form, merchant).then(() => {
      setLabelSaved(true)
      setTimeout(() => setLabelSaved(false), 2000)
    })
  }

  return (
    <div className="flex flex-col items-center py-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-400/30 animate-pop-in">
        <IconCheck className="h-8 w-8" />
      </div>

      <h1 className="mt-4 text-xl font-bold text-white">¡Registro Exitoso!</h1>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-gray-400">
        Tu envío ha sido programado correctamente. Verifica los datos y envíalos por chat con el botón verde.
      </p>

      <div className="animate-fade-in-up mt-6 w-full space-y-2.5 rounded-2xl border border-white/10 bg-white/5 p-5 text-left shadow-xl shadow-black/30 backdrop-blur-sm">
        <p className="text-[11px] font-bold tracking-wide text-gray-500 uppercase">Resumen</p>

        <p className="text-sm font-bold text-white">
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 pt-2.5">
            {form.courier && (
              <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-gray-200">
                🚚 {COURIERS[form.courier]?.label ?? form.courier}
              </span>
            )}
            {form.shippingDate && (
              <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-gray-200">
                📅 {form.shippingDate.shortLabel}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex w-full items-stretch gap-2.5">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-[15px] font-bold text-white shadow-[0_8px_30px_-8px_rgba(16,185,129,0.55)] transition hover:bg-emerald-400 active:scale-[0.99]"
        >
          Enviar por WhatsApp
          <IconWhatsapp className="h-5 w-5" />
        </a>

        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copiar resumen al portapapeles"
          title="Copiar resumen"
          className={`flex w-14 shrink-0 items-center justify-center rounded-xl border transition active:scale-[0.97] ${
            copied
              ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400'
              : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          {copied ? <IconCheck className="h-5 w-5" /> : <IconCopy className="h-5 w-5" />}
        </button>
      </div>
      {copied && <p className="mt-2 text-xs font-medium text-emerald-400">Resumen copiado</p>}

      <button
        type="button"
        onClick={handleDownloadLabel}
        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-[14px] font-bold transition active:scale-[0.99] ${
          labelSaved
            ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400'
            : 'border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15'
        }`}
      >
        {labelSaved ? 'Etiqueta descargada' : 'Descargar etiqueta para imprimir'}
        {labelSaved ? <IconCheck className="h-4.5 w-4.5" /> : <IconTag className="h-4.5 w-4.5" />}
      </button>
    </div>
  )
}
