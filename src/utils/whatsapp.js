import { COURIERS } from '../data/agencies'
import { PAYMENT_LABELS } from '../data/paymentMethods'

const DELIVERY_TITLES = {
  store: 'NUEVO PEDIDO (RECOJO EN TIENDA)',
  agency: 'NUEVO ENVÍO (AGENCIA)',
  home: 'NUEVO PEDIDO (ENVÍO A DOMICILIO)',
}

function line(label, value) {
  if (!value) return null
  return `*${label}:* ${value}`
}

export function buildWhatsAppSummary(form, merchant) {
  const lines = [`📦 *${DELIVERY_TITLES[form.deliveryMethod] ?? 'NUEVO PEDIDO'}*`, '']

  lines.push(line('Tienda', merchant?.businessName))
  lines.push(line('Cliente', form.fullName))
  lines.push(line('WhatsApp', form.phone ? `+51 ${form.phone}` : ''))

  if (form.deliveryMethod === 'agency') {
    lines.push(line('DNI/CE', form.dni))
    lines.push(line('Courier', COURIERS[form.courier]?.label ?? form.courier))
    lines.push(line('Agencia', form.agency?.label))
    const addr = [form.agency?.address, form.agency?.reference ? `Ref: ${form.agency.reference}` : null]
      .filter(Boolean)
      .join(', ')
    lines.push(line('Dirección', addr))
  }

  if (form.deliveryMethod === 'home') {
    lines.push(line('Dirección', form.address))
    lines.push(line('Ubicación', [form.department, form.provinceDistrict].filter(Boolean).join(' / ')))
    lines.push(line('Referencia', form.reference))
    lines.push(line('Método de pago', PAYMENT_LABELS[form.paymentMethod] ?? form.paymentMethod))
  }

  lines.push(line('Fecha de envío', form.shippingDate?.shortLabel))
  lines.push(line('Notas', form.notes))

  return lines.filter((l) => l !== null).join('\n')
}

export function buildWhatsAppUrl(phoneWithCountryCode, message) {
  const digits = phoneWithCountryCode.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
