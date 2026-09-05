import { VALID_SERIALS } from '../data/serials'

const SERIAL_KEY = 'anotate-unlocked-serial'
const ROLE_KEY = 'anotate-access-role'

// Credenciales de administrador. Nota: al ser una app 100% estática (sin
// backend), estas credenciales viajan en el código del cliente y son
// visibles para cualquiera que inspeccione el bundle. Sirven como barrera
// de acceso ligera, no como seguridad real.
export const ADMIN_USER = 'admin'
const ADMIN_PASSWORD = '962029292'

export function isValidAdmin(user, password) {
  return String(user).trim().toLowerCase() === ADMIN_USER && String(password) === ADMIN_PASSWORD
}

export function isValidSerial(code) {
  return VALID_SERIALS.has(String(code).trim().toUpperCase())
}

/** Serial ya desbloqueado en este dispositivo, o null si no hay uno válido. */
export function getUnlockedSerial() {
  try {
    const stored = localStorage.getItem(SERIAL_KEY)
    return stored && isValidSerial(stored) ? stored : null
  } catch {
    return null
  }
}

export function setUnlockedSerial(code) {
  try {
    localStorage.setItem(SERIAL_KEY, code.trim().toUpperCase())
    localStorage.setItem(ROLE_KEY, 'merchant')
  } catch {
    // localStorage no disponible (modo privado, etc.): el desbloqueo dura solo esta sesión.
  }
}

export function setAdminUnlocked() {
  try {
    localStorage.setItem(ROLE_KEY, 'admin')
  } catch {
    // sin persistencia: el acceso dura solo esta sesión.
  }
}

/**
 * Rol con el que ya está desbloqueado el dispositivo, o null si aún no.
 * 'admin' si entró un administrador; 'merchant' si hay un serial válido.
 */
export function getAccessRole() {
  try {
    const role = localStorage.getItem(ROLE_KEY)
    if (role === 'admin') return 'admin'
    if (getUnlockedSerial()) return 'merchant'
    return null
  } catch {
    return null
  }
}
