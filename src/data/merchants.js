// Registry of stores allowed to use this shipping form, keyed by the
// `?merchant=` URL param. In a real deployment this would live behind an
// API; for this static app it's a build-time config so the link can be
// validated without a backend.
export const MERCHANTS = {
  'march-usa': {
    id: 'march-usa',
    businessName: 'MARCH U.S.A',
    subtitle: 'Formulario de Envío',
    whatsappNumber: '51987654321',
    cutoffHour: 14,
    shippingWeekdays: [5, 6], // viernes y sábado
    weeksAhead: 2,
  },
  u_uybpvkf4A: {
    id: 'u_uybpvkf4A',
    businessName: 'Tienda Demo',
    subtitle: 'Formulario de Envío',
    whatsappNumber: '51900000000',
    cutoffHour: 14,
    shippingWeekdays: [1, 2, 3, 4, 5],
    weeksAhead: 1,
  },
}

export function getMerchant(merchantId) {
  if (!merchantId) return null
  return MERCHANTS[merchantId] ?? null
}
