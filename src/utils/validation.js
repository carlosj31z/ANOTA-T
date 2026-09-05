export function isValidPeruPhone(value) {
  return /^9\d{8}$/.test(value.trim())
}

export function isValidDni(value) {
  const v = value.trim().toUpperCase()
  return /^\d{8}$/.test(v) || /^[A-Z0-9]{9,12}$/.test(v)
}

export function isNonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 1
}
