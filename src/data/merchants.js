// Registry of stores allowed to use this shipping form, keyed by the
// `?merchant=` URL param. In a real deployment this would live behind an
// API; for this static app it's a build-time config so the link can be
// validated without a backend.
export const MERCHANTS = {
  'march-usa': {
    id: 'march-usa',
    businessName: 'ANOTATE',
    subtitle: 'Formulario de Envío',
    whatsappNumber: '51987654321',
    cutoffHour: 14,
    shippingIntervalDays: 2, // una fecha disponible cada 2 días
    weeksAhead: 2,
  },
  u_uybpvkf4A: {
    id: 'u_uybpvkf4A',
    businessName: 'Tienda Demo',
    subtitle: 'Formulario de Envío',
    whatsappNumber: '51900000000',
    cutoffHour: 14,
    shippingIntervalDays: 2,
    weeksAhead: 1,
  },
}

const DEFAULT_MERCHANT_ID = 'march-usa'

// Always resolves to a merchant so the form is usable even without a
// (valid) `?merchant=` link, falling back to the default store.
export function getMerchant(merchantId) {
  return MERCHANTS[merchantId] ?? MERCHANTS[DEFAULT_MERCHANT_ID]
}
