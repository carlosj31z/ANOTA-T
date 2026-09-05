export const PAYMENT_METHODS = [
  { value: 'yape_plin', label: 'Yape / Plin' },
  { value: 'transferencia', label: 'Transferencia bancaria' },
  { value: 'efectivo', label: 'Efectivo contraentrega' },
]

export const PAYMENT_LABELS = Object.fromEntries(PAYMENT_METHODS.map((p) => [p.value, p.label]))
