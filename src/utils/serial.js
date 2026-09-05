import { VALID_SERIALS } from '../data/serials'

const STORAGE_KEY = 'anotate-unlocked-serial'

export function isValidSerial(code) {
  return VALID_SERIALS.has(String(code).trim().toUpperCase())
}

/** Serial ya desbloqueado en este dispositivo, o null si no hay uno válido. */
export function getUnlockedSerial() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored && isValidSerial(stored) ? stored : null
  } catch {
    return null
  }
}

export function setUnlockedSerial(code) {
  try {
    localStorage.setItem(STORAGE_KEY, code.trim().toUpperCase())
  } catch {
    // localStorage no disponible (modo privado, etc.): el desbloqueo dura solo esta sesión.
  }
}
