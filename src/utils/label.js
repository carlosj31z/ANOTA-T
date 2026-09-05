import { COURIERS } from '../data/agencies'
import { PAYMENT_LABELS } from '../data/paymentMethods'

// Etiqueta de envío en tamaño 4x6" (el estándar de courier) a 300dpi.
const WIDTH = 1200
const HEIGHT = 1800
const MARGIN = 72

const DELIVERY_TITLES = {
  store: 'RETIRO EN TIENDA',
  agency: 'RETIRO EN AGENCIA',
  home: 'ENVÍO A DOMICILIO',
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(' ')
  const lines = []
  let current = ''
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word
    if (current && ctx.measureText(attempt).width > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = attempt
    }
  }
  if (current) lines.push(current)
  return lines
}

function drawWrapped(ctx, text, x, y, maxWidth, lineHeight) {
  const lines = wrapText(ctx, text, maxWidth)
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight))
  return y + lines.length * lineHeight
}

function sectionLabel(ctx, text, x, y) {
  ctx.font = '600 26px Arial'
  ctx.fillStyle = '#9a9a9a'
  ctx.fillText(text.toUpperCase(), x, y)
  ctx.fillStyle = '#111111'
  return y + 14
}

function divider(ctx, x, y, width) {
  ctx.strokeStyle = '#dcdcdc'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + width, y)
  ctx.stroke()
  return y + 44
}

function buildOrderCode(form) {
  const digits = (form.phone || '').slice(-6) || '000000'
  const dateFragment = form.shippingDate?.value ? form.shippingDate.value.slice(5).replace('-', '') : '0000'
  return `ANT-${digits}-${dateFragment}`
}

function slugify(text) {
  return String(text || 'envio')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function renderLabelCanvas(form, merchant) {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  const contentWidth = WIDTH - MARGIN * 2

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#111111'

  let y = MARGIN + 30

  // Encabezado / marca
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = 4
  ctx.strokeRect(MARGIN, y - 34, 46, 40)
  ctx.beginPath()
  ctx.moveTo(MARGIN, y - 14)
  ctx.lineTo(MARGIN + 23, y - 2)
  ctx.lineTo(MARGIN + 46, y - 14)
  ctx.stroke()

  ctx.font = '800 44px Arial'
  ctx.fillText(merchant.businessName, MARGIN + 66, y)
  ctx.font = '600 22px Arial'
  ctx.fillStyle = '#666666'
  ctx.fillText('FORMULARIO DE ENVÍO', MARGIN + 66, y + 30)
  ctx.fillStyle = '#111111'

  y += 70
  y = divider(ctx, MARGIN, y, contentWidth)

  // Badge de método de entrega
  const badgeText = DELIVERY_TITLES[form.deliveryMethod] ?? 'NUEVO PEDIDO'
  ctx.font = '700 26px Arial'
  const badgeWidth = ctx.measureText(badgeText).width + 48
  ctx.fillStyle = '#f2f2f2'
  ctx.fillRect(MARGIN, y - 34, badgeWidth, 48)
  ctx.fillStyle = '#111111'
  ctx.fillText(badgeText, MARGIN + 24, y)
  y += 60

  // Destinatario
  y = sectionLabel(ctx, 'Destinatario', MARGIN, y)
  ctx.font = '700 40px Arial'
  y = drawWrapped(ctx, form.fullName || '—', MARGIN, y + 34, contentWidth, 46)
  ctx.font = '400 28px Arial'
  y += 14
  const contactLine = [form.phone ? `Tel: +51 ${form.phone}` : null, form.dni ? `DNI/CE: ${form.dni}` : null]
    .filter(Boolean)
    .join('   ·   ')
  ctx.fillText(contactLine, MARGIN, y)
  y += 50
  y = divider(ctx, MARGIN, y, contentWidth)

  // Entrega
  y = sectionLabel(ctx, 'Entrega', MARGIN, y)
  y += 34
  ctx.font = '400 30px Arial'

  if (form.deliveryMethod === 'agency') {
    ctx.font = '700 30px Arial'
    y = drawWrapped(ctx, COURIERS[form.courier]?.label ?? form.courier ?? '', MARGIN, y, contentWidth, 38)
    ctx.font = '400 28px Arial'
    y += 8
    y = drawWrapped(ctx, form.agency?.label ?? '', MARGIN, y, contentWidth, 36)
    y += 8
    const addr = [form.agency?.address, form.agency?.reference ? `Ref: ${form.agency.reference}` : null]
      .filter(Boolean)
      .join(' — ')
    y = drawWrapped(ctx, addr, MARGIN, y, contentWidth, 36)
  } else if (form.deliveryMethod === 'home') {
    y = drawWrapped(ctx, form.address ?? '', MARGIN, y, contentWidth, 36)
    y += 8
    y = drawWrapped(
      ctx,
      [form.department, form.provinceDistrict].filter(Boolean).join(' / '),
      MARGIN,
      y,
      contentWidth,
      36,
    )
    if (form.reference) {
      y += 8
      y = drawWrapped(ctx, `Ref: ${form.reference}`, MARGIN, y, contentWidth, 36)
    }
    y += 8
    y = drawWrapped(
      ctx,
      `Pago: ${PAYMENT_LABELS[form.paymentMethod] ?? form.paymentMethod ?? ''}`,
      MARGIN,
      y,
      contentWidth,
      36,
    )
  } else {
    y = drawWrapped(ctx, 'El cliente recoge su pedido en tienda.', MARGIN, y, contentWidth, 36)
  }

  y += 26
  y = divider(ctx, MARGIN, y, contentWidth)

  // Fecha
  y = sectionLabel(ctx, 'Fecha de envío', MARGIN, y)
  ctx.font = '700 32px Arial'
  y = drawWrapped(ctx, form.shippingDate?.label ?? '—', MARGIN, y + 36, contentWidth, 38)

  if (form.notes) {
    y += 26
    y = divider(ctx, MARGIN, y, contentWidth)
    y = sectionLabel(ctx, 'Notas', MARGIN, y)
    ctx.font = '400 28px Arial'
    y = drawWrapped(ctx, form.notes, MARGIN, y + 34, contentWidth, 36)
  }

  // Pie: código de referencia + barras decorativas
  const barY = HEIGHT - MARGIN - 90
  ctx.fillStyle = '#111111'
  let barX = MARGIN
  let seed = 0
  for (const char of buildOrderCode(form)) seed += char.charCodeAt(0)
  for (let i = 0; i < 46 && barX < WIDTH - MARGIN; i++) {
    seed = (seed * 9301 + 49297) % 233280
    const barWidth = 2 + (seed % 5)
    const barHeight = 60 + (seed % 20)
    ctx.fillRect(barX, barY - barHeight, barWidth, barHeight)
    barX += barWidth + 4
  }

  ctx.font = '700 26px Arial'
  ctx.fillText(buildOrderCode(form), MARGIN, HEIGHT - MARGIN)
  ctx.font = '400 20px Arial'
  ctx.fillStyle = '#888888'
  ctx.textAlign = 'right'
  ctx.fillText('Formulario Logístico', WIDTH - MARGIN, HEIGHT - MARGIN)
  ctx.textAlign = 'left'

  return canvas
}

export async function downloadShippingLabel(form, merchant) {
  const canvas = renderLabelCanvas(form, merchant)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `etiqueta-${slugify(form.fullName)}.png`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
