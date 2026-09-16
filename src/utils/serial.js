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

/**
 * Serial guardado en este dispositivo SIN re-validar contra Supabase (solo
 * lectura síncrona, para el estado inicial). La validación real —que puede
 * revocar el acceso si el admin desactivó ese cliente— se hace de forma
 * asíncrona con `checkClientSerial()` de utils/supabaseClients.js; ver
 * App.jsx.
 */
export function getStoredSerial() {
  try {
    return localStorage.getItem(SERIAL_KEY) || null
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
 * Rol guardado en este dispositivo SIN re-validar (lectura síncrona, para
 * el arranque de la app). 'admin' se confía de inmediato; 'merchant' debe
 * re-confirmarse de forma asíncrona (ver arriba) porque el serial pudo
 * haber sido retirado por el administrador desde entonces.
 */
export function getStoredRole() {
  try {
    const role = localStorage.getItem(ROLE_KEY)
    if (role === 'admin') return 'admin'
    if (role === 'merchant' && getStoredSerial()) return 'merchant'
    return null
  } catch {
    return null
  }
}

/** Cierra la sesión de este dispositivo (vuelve a pedir credenciales). */
export function clearAccess() {
  try {
    localStorage.removeItem(ROLE_KEY)
    localStorage.removeItem(SERIAL_KEY)
  } catch {
    // sin persistencia
  }
}
